import '../src/core/config/load-env.js';
import { Prisma, PrismaClient } from '@prisma/client';

const KEEP_LATEST_USERS = 11;
const EXECUTE_FLAG = '--execute';

const prisma = new PrismaClient();

type UserCleanupTarget = {
  id: string;
  clerkId: string | null;
  email: string | null;
  displayName: string | null;
  role: string;
  createdAt: Date;
};

type UserCleanupImpact = {
  userId: string;
  cascadedDeletes: {
    sessions: number;
    notifications: number;
    notificationPreferences: number;
    pushDeviceTokens: number;
    userOrganizations: number;
    leaderboardEntries: number;
    userSettings: number;
    userProgress: number;
    userStats: number;
  };
  detachedReferences: {
    attempts: number;
    approvedCases: number;
    createdCaseRevisions: number;
    triggeredCaseValidations: number;
    caseReviews: number;
  };
};

function isExecuteMode(): boolean {
  return process.argv.includes(EXECUTE_FLAG);
}

function assertSafeRuntime(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  if (Number.isNaN(KEEP_LATEST_USERS) || KEEP_LATEST_USERS < 1) {
    throw new Error(`Invalid KEEP_LATEST_USERS=${KEEP_LATEST_USERS}`);
  }
}

function toPublicUser(user: UserCleanupTarget) {
  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

async function getUsersOrdered(
  client: PrismaClient | Prisma.TransactionClient,
): Promise<UserCleanupTarget[]> {
  return client.user.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      clerkId: true,
      email: true,
      displayName: true,
      role: true,
      createdAt: true,
    },
  });
}

async function getImpactForUser(
  client: PrismaClient,
  userId: string,
): Promise<UserCleanupImpact> {
  const [
    sessions,
    attempts,
    notifications,
    notificationPreferences,
    pushDeviceTokens,
    userOrganizations,
    leaderboardEntries,
    userSettings,
    userProgress,
    userStats,
    approvedCases,
    createdCaseRevisions,
    triggeredCaseValidations,
    caseReviews,
  ] = await Promise.all([
    client.gameSession.count({ where: { userId } }),
    client.attempt.count({ where: { userId } }),
    client.notification.count({ where: { userId } }),
    client.notificationPreference.count({ where: { userId } }),
    client.pushDeviceToken.count({ where: { userId } }),
    client.userOrganization.count({ where: { userId } }),
    client.leaderboardEntry.count({ where: { userId } }),
    client.userSettings.count({ where: { userId } }),
    client.userProgress.count({ where: { userId } }),
    client.userStats.count({ where: { userId } }),
    client.case.count({ where: { approvedByUserId: userId } }),
    client.caseRevision.count({ where: { createdByUserId: userId } }),
    client.caseValidationRun.count({ where: { triggeredByUserId: userId } }),
    client.caseReview.count({ where: { reviewerUserId: userId } }),
  ]);

  return {
    userId,
    cascadedDeletes: {
      sessions,
      notifications,
      notificationPreferences,
      pushDeviceTokens,
      userOrganizations,
      leaderboardEntries,
      userSettings,
      userProgress,
      userStats,
    },
    detachedReferences: {
      attempts,
      approvedCases,
      createdCaseRevisions,
      triggeredCaseValidations,
      caseReviews,
    },
  };
}

function assertSamePlan(expectedIds: string[], actualIds: string[]): void {
  const expected = expectedIds.join(',');
  const actual = actualIds.join(',');

  if (expected !== actual) {
    throw new Error(
      [
        'User cleanup plan changed before deletion.',
        `Expected delete IDs: ${expected || '(none)'}`,
        `Actual delete IDs: ${actual || '(none)'}`,
      ].join(' '),
    );
  }
}

async function main() {
  assertSafeRuntime();

  const execute = isExecuteMode();
  const users = await getUsersOrdered(prisma);
  const usersToKeep = users.slice(0, KEEP_LATEST_USERS);
  const usersToDelete = users.slice(KEEP_LATEST_USERS);
  const deleteIds = usersToDelete.map((user) => user.id);
  const impacts = await Promise.all(
    deleteIds.map((userId) => getImpactForUser(prisma, userId)),
  );

  console.log(
    JSON.stringify(
      {
        event: 'dev_users.cleanup.plan',
        mode: execute ? 'execute' : 'dry_run',
        keepLatestUsers: KEEP_LATEST_USERS,
        totalUsers: users.length,
        keepCount: usersToKeep.length,
        deleteCount: usersToDelete.length,
        keptUsers: usersToKeep.map(toPublicUser),
        usersToDelete: usersToDelete.map(toPublicUser),
        impact: impacts,
      },
      null,
      2,
    ),
  );

  if (!execute) {
    console.log(
      JSON.stringify({
        event: 'dev_users.cleanup.dry_run_complete',
        message: `No users deleted. Re-run with ${EXECUTE_FLAG} to execute.`,
      }),
    );
    return;
  }

  if (deleteIds.length === 0) {
    console.log(
      JSON.stringify({
        event: 'dev_users.cleanup.noop',
        message: `There are ${users.length} users; nothing older than the latest ${KEEP_LATEST_USERS} to delete.`,
      }),
    );
    return;
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const transactionUsers = await getUsersOrdered(tx);
      const transactionDeleteIds = transactionUsers
        .slice(KEEP_LATEST_USERS)
        .map((user) => user.id);

      assertSamePlan(deleteIds, transactionDeleteIds);

      return tx.user.deleteMany({
        where: {
          id: {
            in: deleteIds,
          },
        },
      });
    },
    {
      timeout: 30_000,
      maxWait: 10_000,
    },
  );

  if (result.count !== deleteIds.length) {
    throw new Error(
      `Expected to delete ${deleteIds.length} users, but Prisma deleted ${result.count}.`,
    );
  }

  console.log(
    JSON.stringify(
      {
        event: 'dev_users.cleanup.completed',
        deletedCount: result.count,
        deletedUserIds: deleteIds,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        event: 'dev_users.cleanup.failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
