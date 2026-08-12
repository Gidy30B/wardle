import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { CaseEditorialStatus, PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Pool } from 'pg';

const expectedEntryCount = Number(
  process.env.PERICARDITIS_LEADERBOARD_EXPECTED_ENTRIES ?? 2,
);

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for leaderboard cleanup.');
}

if (!Number.isInteger(expectedEntryCount) || expectedEntryCount < 1) {
  throw new Error(
    'PERICARDITIS_LEADERBOARD_EXPECTED_ENTRIES must be a positive integer.',
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 20_000,
  allowExitOnIdle: true,
  ssl:
    databaseUrl.includes('railway') ||
    databaseUrl.includes('proxy.rlwy.net') ||
    databaseUrl.includes('postgres.railway.internal')
      ? { rejectUnauthorized: false }
      : undefined,
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

const knownCaseTitles = [
  'Positional Chest Pain Progressing to Obstructive Shock from Cardiac Tamponade',
  'Positional Pleuritic Chest Pain with Pericardial Effusion and Tamponade Physiology',
];

const knownDiagnosisLabels = [
  'Pericarditis',
  'Acute Pericarditis',
  'Acute Pericarditis with Cardiac Tamponade',
];

async function main() {
  const entries = await prisma.leaderboardEntry.findMany({
    where: {
      dailyCase: {
        case: {
          editorialStatus: CaseEditorialStatus.REJECTED,
          OR: [
            { title: { in: knownCaseTitles } },
            { proposedDiagnosisText: { in: knownDiagnosisLabels } },
            {
              diagnosisRegistry: {
                canonicalNormalized: 'pericarditis',
              },
            },
          ],
        },
      },
    },
    orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      userId: true,
      dailyCaseId: true,
      score: true,
      attemptsCount: true,
      completedAt: true,
      user: {
        select: {
          username: true,
          email: true,
        },
      },
      dailyCase: {
        select: {
          caseId: true,
          date: true,
          track: true,
          sequenceIndex: true,
          case: {
            select: {
              title: true,
              editorialStatus: true,
              proposedDiagnosisText: true,
            },
          },
        },
      },
    },
  });

  console.log('Rejected pericarditis leaderboard entries found:', {
    expectedEntryCount,
    actualEntryCount: entries.length,
    entries: entries.map((entry) => ({
      leaderboardEntryId: entry.id,
      userId: entry.userId,
      username: entry.user.username,
      email: entry.user.email,
      dailyCaseId: entry.dailyCaseId,
      caseId: entry.dailyCase.caseId,
      caseTitle: entry.dailyCase.case.title,
      date: entry.dailyCase.date,
      track: entry.dailyCase.track,
      sequenceIndex: entry.dailyCase.sequenceIndex,
      score: entry.score,
      attemptsCount: entry.attemptsCount,
      completedAt: entry.completedAt,
    })),
  });

  if (entries.length !== expectedEntryCount) {
    const candidates = await prisma.case.findMany({
      where: {
        OR: [
          { title: { in: knownCaseTitles } },
          { proposedDiagnosisText: { in: knownDiagnosisLabels } },
          {
            diagnosisRegistry: {
              canonicalNormalized: 'pericarditis',
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        editorialStatus: true,
        proposedDiagnosisText: true,
        dailyCases: {
          select: {
            id: true,
            date: true,
            track: true,
            sequenceIndex: true,
            _count: {
              select: {
                sessions: true,
                leaderboardEntries: true,
              },
            },
          },
        },
      },
    });

    const rejectedCasesWithLeaderboardEntries = await prisma.case.findMany({
      where: {
        editorialStatus: CaseEditorialStatus.REJECTED,
        dailyCases: {
          some: {
            leaderboardEntries: { some: {} },
          },
        },
      },
      select: {
        id: true,
        title: true,
        proposedDiagnosisText: true,
        diagnosisRegistry: {
          select: {
            displayLabel: true,
            canonicalNormalized: true,
          },
        },
        dailyCases: {
          where: { leaderboardEntries: { some: {} } },
          select: {
            id: true,
            date: true,
            track: true,
            sequenceIndex: true,
            _count: {
              select: {
                sessions: true,
                leaderboardEntries: true,
              },
            },
          },
        },
      },
    });

    console.log('Pericarditis case cleanup diagnostics:', candidates);
    console.log(
      'Rejected cases with leaderboard entries:',
      rejectedCasesWithLeaderboardEntries,
    );
    throw new Error(
      `Refusing leaderboard cleanup: expected ${expectedEntryCount} entries but found ${entries.length}. No rows were deleted.`,
    );
  }

  const entryIds = entries.map((entry) => entry.id);
  const deleted = await prisma.$transaction(async (tx) => {
    const result = await tx.leaderboardEntry.deleteMany({
      where: { id: { in: entryIds } },
    });

    if (result.count !== expectedEntryCount) {
      throw new Error(
        `Leaderboard cleanup deleted ${result.count} entries; expected ${expectedEntryCount}. Transaction rolled back.`,
      );
    }

    return result.count;
  });

  const remaining = await prisma.leaderboardEntry.count({
    where: { id: { in: entryIds } },
  });
  const [dailyCacheKeysDeleted, weeklyCacheKeysDeleted] = await Promise.all([
    deleteCacheByPrefix('leaderboard:daily:'),
    deleteCacheByPrefix('leaderboard:weekly:'),
  ]);

  console.log('Rejected pericarditis leaderboard cleanup complete:', {
    deletedLeaderboardEntries: deleted,
    remainingTargetEntries: remaining,
    dailyCacheKeysDeleted,
    weeklyCacheKeysDeleted,
    sessionsDeleted: 0,
    attemptsDeleted: 0,
    xpAdjusted: false,
    streaksAdjusted: false,
  });
}

async function deleteCacheByPrefix(prefix: string): Promise<number> {
  if (redis.status === 'wait') {
    await redis.connect();
  }

  let cursor = '0';
  let deleted = 0;
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      `${prefix}*`,
      'COUNT',
      '100',
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      deleted += await redis.del(...keys);
    }
  } while (cursor !== '0');

  return deleted;
}

function resolvePgConnectionString(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('prisma+postgres://')) return value;

  const parsed = new URL(value);
  const apiKey = parsed.searchParams.get('api_key');
  if (!apiKey) {
    throw new Error(
      'DATABASE_URL uses prisma+postgres:// but is missing api_key.',
    );
  }

  const payload = JSON.parse(
    Buffer.from(apiKey, 'base64url').toString('utf8'),
  ) as { databaseUrl?: unknown };
  if (typeof payload.databaseUrl !== 'string' || !payload.databaseUrl) {
    throw new Error(
      'DATABASE_URL uses prisma+postgres:// but api_key has no databaseUrl.',
    );
  }

  return payload.databaseUrl;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (redis.status !== 'end') {
      await redis.quit().catch(() => undefined);
    }
    await prisma.$disconnect();
    await pool.end();
  });
