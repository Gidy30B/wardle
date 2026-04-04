import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function toUtcDateOnly(value: Date): Date {
  const normalized = new Date(value);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

async function main() {
  const sessions = await prisma.gameSession.findMany({
    select: {
      id: true,
      caseId: true,
      userId: true,
      dailyCaseId: true,
      startedAt: true,
    },
    orderBy: {
      startedAt: 'asc',
    },
  });

  let updatedCount = 0;
  let skippedCount = 0;
  let createdDailyCaseCount = 0;
  let failedCount = 0;

  for (const session of sessions) {
    try {
      let nextUserId = session.userId;
      let nextDailyCaseId = session.dailyCaseId;

      if (!nextUserId) {
        const attemptWithUser = await prisma.attempt.findFirst({
          where: {
            sessionId: session.id,
            userId: {
              not: null,
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            userId: true,
          },
        });

        if (!attemptWithUser?.userId) {
          failedCount += 1;
          console.error(
            `FAILED session=${session.id}: cannot infer userId from attempts`,
          );
          continue;
        }

        nextUserId = attemptWithUser.userId;
      }

      if (!nextDailyCaseId) {
        const startedDayUtc = toUtcDateOnly(session.startedAt);

        let dailyCase = await prisma.dailyCase.findUnique({
          where: {
            date: startedDayUtc,
          },
          select: {
            id: true,
            caseId: true,
          },
        });

        if (!dailyCase) {
          dailyCase = await prisma.dailyCase.create({
            data: {
              caseId: session.caseId,
              date: startedDayUtc,
            },
            select: {
              id: true,
              caseId: true,
            },
          });
          createdDailyCaseCount += 1;
        }

        nextDailyCaseId = dailyCase.id;
      }

      const needsUpdate =
        nextUserId !== session.userId || nextDailyCaseId !== session.dailyCaseId;

      if (!needsUpdate) {
        skippedCount += 1;
        continue;
      }

      await prisma.gameSession.update({
        where: {
          id: session.id,
        },
        data: {
          userId: nextUserId,
          dailyCaseId: nextDailyCaseId,
        },
      });

      updatedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error(`FAILED session=${session.id}`, error);
    }
  }

  console.log(
    JSON.stringify(
      {
        totalSessions: sessions.length,
        updatedCount,
        skippedCount,
        createdDailyCaseCount,
        failedCount,
      },
      null,
      2,
    ),
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
