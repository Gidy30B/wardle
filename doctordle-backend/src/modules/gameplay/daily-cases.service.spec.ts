import {
  ForbiddenException,
} from '@nestjs/common';
import {
  CaseEditorialStatus,
  PublishTrack,
} from '@prisma/client';
import {
  DailyCasesService,
  getTrackPriority,
  normalizeDailyDate,
} from './daily-cases.service';

type StoreCase = {
  id: string;
  title: string;
  date: Date;
  difficulty: string;
  diagnosisId: string;
  clues: unknown;
  explanation: unknown;
  editorialStatus: CaseEditorialStatus;
  approvedAt: Date | null;
  currentRevision: {
    publishTrack: PublishTrack | null;
    date: Date;
  } | null;
};

type StoreDailyCase = {
  id: string;
  caseId: string;
  date: Date;
  track: PublishTrack;
  sequenceIndex: number;
  createdAt: Date;
};

type StoreUser = {
  id: string;
  subscriptionTier: string;
};

type StoreSession = {
  id: string;
  caseId: string;
  userId: string;
  dailyCaseId: string;
  userTierAtStart: string | null;
  status: string;
  startedAt: Date;
  completedAt?: Date | null;
  processingAt?: Date | null;
  processedAt?: Date | null;
  xpAwardedAt?: Date | null;
  currentClueIndexLegacy?: number | null;
  attempts: Array<{ result: string }>;
};

type StoreLeaderboardEntry = {
  id: string;
  userId: string;
  dailyCaseId: string;
};

function createDailyCasesFixture(options?: { forceCreateRace?: boolean }) {
  const store = {
    users: [] as StoreUser[],
    cases: [] as StoreCase[],
    dailyCases: [] as StoreDailyCase[],
    sessions: [] as StoreSession[],
    leaderboardEntries: [] as StoreLeaderboardEntry[],
  };

  let dailyCaseCounter = 1;
  let sessionCounter = 1;
  let leaderboardCounter = 1;
  let sessionUniqueLookupCount = 0;

  const attachCase = (dailyCase: StoreDailyCase) => ({
    ...dailyCase,
    case: store.cases.find((item) => item.id === dailyCase.caseId)!,
  });

  const prisma: any = {};

  prisma.$transaction = jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return input(prisma);
      }

      return input;
    });

  Object.assign(prisma, {
    user: {
      upsert: jest.fn(async (args: any) => {
        const existing = store.users.find((user) => user.id === args.where.id);
        if (existing) {
          Object.assign(existing, args.update ?? {});
          return existing;
        }

        const created = {
          id: args.create.id,
          subscriptionTier: args.create.subscriptionTier ?? 'free',
        } satisfies StoreUser;
        store.users.push(created);
        return created;
      }),
      findUnique: jest.fn(async (args: any) => {
        return (
          store.users.find((user) => user.id === args.where.id) ?? null
        );
      }),
    },
    case: {
      findMany: jest.fn(async (args: any) => {
        const gte = args.where.currentRevision.is.date.gte as Date;
        const lt = args.where.currentRevision.is.date.lt as Date;
        const statuses = args.where.editorialStatus.in as CaseEditorialStatus[];

        return store.cases
          .filter((item) => {
            const revisionDate = item.currentRevision?.date;
            return (
              statuses.includes(item.editorialStatus) &&
              revisionDate !== undefined &&
              revisionDate !== null &&
              revisionDate >= gte &&
              revisionDate < lt
            );
          })
          .sort((left, right) => {
            const approvedDelta =
              (left.approvedAt?.getTime() ?? 0) - (right.approvedAt?.getTime() ?? 0);
            return approvedDelta !== 0
              ? approvedDelta
              : left.id.localeCompare(right.id);
          })
          .map((item) => ({
            id: item.id,
            title: item.title,
            date: item.date,
            difficulty: item.difficulty,
            diagnosisId: item.diagnosisId,
            clues: item.clues,
            explanation: item.explanation,
            currentRevision: item.currentRevision
              ? {
                  publishTrack: item.currentRevision.publishTrack,
                }
              : null,
          }));
      }),
    },
    dailyCase: {
      findMany: jest.fn(async (args: any) => {
        let rows = [...store.dailyCases];

        if (args.where?.date) {
          rows = rows.filter(
            (row) => row.date.getTime() === (args.where.date as Date).getTime(),
          );
        }

        if (args.where?.track?.in) {
          const allowed = args.where.track.in as PublishTrack[];
          rows = rows.filter((row) => allowed.includes(row.track));
        }

        rows.sort((left, right) => {
          const trackDelta =
            getTrackPriority(left.track) - getTrackPriority(right.track);
          return trackDelta !== 0
            ? trackDelta
            : left.sequenceIndex - right.sequenceIndex;
        });

        return rows.map(attachCase);
      }),
      findUnique: jest.fn(async (args: any) => {
        let found: StoreDailyCase | undefined;
        if (args.where.id) {
          found = store.dailyCases.find((row) => row.id === args.where.id);
        } else if (args.where.date_track_sequenceIndex) {
          const key = args.where.date_track_sequenceIndex;
          found = store.dailyCases.find(
            (row) =>
              row.date.getTime() === key.date.getTime() &&
              row.track === key.track &&
              row.sequenceIndex === key.sequenceIndex,
          );
        }

        return found ? attachCase(found) : null;
      }),
      createMany: jest.fn(async (args: any) => {
        let createdCount = 0;
        for (const row of args.data as Array<StoreDailyCase>) {
          const existing = store.dailyCases.find(
            (item) =>
              item.date.getTime() === row.date.getTime() &&
              item.track === row.track &&
              item.sequenceIndex === row.sequenceIndex,
          );

          if (existing && args.skipDuplicates) {
            continue;
          }

          store.dailyCases.push({
            id: `dc-${dailyCaseCounter++}`,
            caseId: row.caseId,
            date: row.date,
            track: row.track,
            sequenceIndex: row.sequenceIndex,
            createdAt: new Date(),
          });
          createdCount += 1;
        }

        return { count: createdCount };
      }),
    },
    gameSession: {
      findUnique: jest.fn(async (args: any) => {
        if (args.where.id) {
          return (
            store.sessions.find((session) => session.id === args.where.id) ?? null
          );
        }

        if (args.where.userId_dailyCaseId) {
          if (options?.forceCreateRace && sessionUniqueLookupCount < 2) {
            sessionUniqueLookupCount += 1;
            return null;
          }

          const found = store.sessions.find(
            (session) =>
              session.userId === args.where.userId_dailyCaseId.userId &&
              session.dailyCaseId === args.where.userId_dailyCaseId.dailyCaseId,
          );
          return found ?? null;
        }

        return null;
      }),
      create: jest.fn(async (args: any) => {
        const duplicate = store.sessions.find(
          (session) =>
            session.userId === args.data.userId &&
            session.dailyCaseId === args.data.dailyCaseId,
        );

        if (duplicate) {
          const error = new Error('duplicate session') as Error & { code?: string };
          error.code = 'P2002';
          throw error;
        }

        const created = {
          id: `session-${sessionCounter++}`,
          caseId: args.data.caseId,
          userId: args.data.userId,
          dailyCaseId: args.data.dailyCaseId,
          userTierAtStart: args.data.userTierAtStart ?? null,
          status: args.data.status,
          startedAt: new Date(),
          completedAt: null,
          processingAt: null,
          processedAt: null,
          xpAwardedAt: null,
          currentClueIndexLegacy: 0,
          attempts: [],
        } satisfies StoreSession;

        store.sessions.push(created);
        return created;
      }),
      update: jest.fn(async (args: any) => {
        const found = store.sessions.find((session) => session.id === args.where.id);
        if (!found) {
          throw new Error(`Session not found: ${args.where.id}`);
        }

        Object.assign(found, args.data);
        return found;
      }),
    },
    attempt: {
      deleteMany: jest.fn(async (args: any) => {
        const found = store.sessions.find(
          (session) => session.id === args.where.sessionId,
        );

        if (!found) {
          return { count: 0 };
        }

        const deleted = found.attempts.length;
        found.attempts = [];
        return { count: deleted };
      }),
    },
    leaderboardEntry: {
      deleteMany: jest.fn(async (args: any) => {
        const before = store.leaderboardEntries.length;
        store.leaderboardEntries = store.leaderboardEntries.filter(
          (entry) =>
            !(
              entry.userId === args.where.userId &&
              entry.dailyCaseId === args.where.dailyCaseId
            ),
        );
        return { count: before - store.leaderboardEntries.length };
      }),
      create: jest.fn(async (args: any) => {
        const created = {
          id: `lb-${leaderboardCounter++}`,
          userId: args.data.userId,
          dailyCaseId: args.data.dailyCaseId,
        } satisfies StoreLeaderboardEntry;
        store.leaderboardEntries.push(created);
        return created;
      }),
    },
  });

  const dailyLimitService = {
    assertCanStartInTransaction: jest.fn().mockResolvedValue(undefined),
  };

  return {
    prisma,
    store,
    dailyLimitService,
    service: new DailyCasesService(
      prisma as never,
      dailyLimitService as never,
    ),
  };
}

describe('DailyCasesService', () => {
  it('returns DAILY only for free users', async () => {
    const { service, store } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.users.push({ id: 'free-user', subscriptionTier: 'free' });
    store.dailyCases.push(
      {
        id: 'dc-daily',
        caseId: 'case-daily',
        date,
        track: PublishTrack.DAILY,
        sequenceIndex: 1,
        createdAt: new Date(),
      },
      {
        id: 'dc-premium',
        caseId: 'case-premium',
        date,
        track: PublishTrack.PREMIUM,
        sequenceIndex: 1,
        createdAt: new Date(),
      },
    );
    store.cases.push(
      {
        id: 'case-daily',
        title: 'Daily Case',
        date,
        difficulty: 'easy',
        diagnosisId: 'd1',
        clues: [{ value: 'clue' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:00.000Z'),
        currentRevision: { publishTrack: PublishTrack.DAILY, date },
      },
      {
        id: 'case-premium',
        title: 'Premium Case',
        date,
        difficulty: 'hard',
        diagnosisId: 'd2',
        clues: [{ value: 'premium clue' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:01.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
    );

    const result = await service.getTodayCasesForUser('free-user', date);

    expect(result.cases).toHaveLength(1);
    expect(result.cases.every((item) => item.track === PublishTrack.DAILY)).toBe(
      true,
    );
  });

  it('returns DAILY then PREMIUM for premium users in deterministic order', async () => {
    const { service, store } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.users.push({ id: 'premium-user', subscriptionTier: 'premium' });
    store.cases.push(
      {
        id: 'case-daily',
        title: 'Daily Case',
        date,
        difficulty: 'easy',
        diagnosisId: 'd1',
        clues: [{ value: 'clue' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:00.000Z'),
        currentRevision: { publishTrack: PublishTrack.DAILY, date },
      },
      {
        id: 'case-premium-2',
        title: 'Premium Case 2',
        date,
        difficulty: 'medium',
        diagnosisId: 'd2',
        clues: [{ value: 'premium clue 2' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:03.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
      {
        id: 'case-premium-1',
        title: 'Premium Case 1',
        date,
        difficulty: 'medium',
        diagnosisId: 'd3',
        clues: [{ value: 'premium clue 1' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:02.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
    );

    await service.publishDailyCasesForDate(date);
    const result = await service.getTodayCasesForUser('premium-user', date);

    expect(result.cases.map((item) => `${item.track}:${item.sequenceIndex}`)).toEqual(
      ['DAILY:1', 'PREMIUM:1', 'PREMIUM:2'],
    );
  });

  it('forbids free users from starting premium daily cases', async () => {
    const { service, store } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.users.push({ id: 'free-user', subscriptionTier: 'free' });
    store.cases.push({
      id: 'case-premium',
      title: 'Premium Case',
      date,
      difficulty: 'hard',
      diagnosisId: 'd1',
      clues: [{ value: 'premium clue' }],
      explanation: null,
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      approvedAt: new Date(),
      currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
    });
    store.dailyCases.push({
      id: 'dc-premium',
      caseId: 'case-premium',
      date,
      track: PublishTrack.PREMIUM,
      sequenceIndex: 1,
      createdAt: new Date(),
    });

    await expect(
      service.getOrCreateGameSessionForDailyCase('free-user', 'dc-premium'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows premium users to start premium daily cases and snapshots tier', async () => {
    const { service, store } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.users.push({ id: 'premium-user', subscriptionTier: 'premium' });
    store.cases.push({
      id: 'case-premium',
      title: 'Premium Case',
      date,
      difficulty: 'hard',
      diagnosisId: 'd1',
      clues: [{ value: 'premium clue' }],
      explanation: null,
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      approvedAt: new Date(),
      currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
    });
    store.dailyCases.push({
      id: 'dc-premium',
      caseId: 'case-premium',
      date,
      track: PublishTrack.PREMIUM,
      sequenceIndex: 1,
      createdAt: new Date(),
    });

    const result = await service.getOrCreateGameSessionForDailyCase(
      'premium-user',
      'dc-premium',
    );

    expect(result.session.dailyCaseId).toBe('dc-premium');
    expect(result.session.userTierAtStart).toBe('premium');
  });

  it('reuses the same session on repeated starts and under create-race recovery', async () => {
    const fixture = createDailyCasesFixture({ forceCreateRace: true });
    const { service, store } = fixture;
    const date = normalizeDailyDate('2026-04-18');
    store.users.push({ id: 'premium-user', subscriptionTier: 'premium' });
    store.cases.push({
      id: 'case-premium',
      title: 'Premium Case',
      date,
      difficulty: 'hard',
      diagnosisId: 'd1',
      clues: [{ value: 'premium clue' }],
      explanation: null,
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      approvedAt: new Date(),
      currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
    });
    store.dailyCases.push({
      id: 'dc-premium',
      caseId: 'case-premium',
      date,
      track: PublishTrack.PREMIUM,
      sequenceIndex: 1,
      createdAt: new Date(),
    });

    const [first, second] = await Promise.all([
      service.getOrCreateGameSessionForDailyCase('premium-user', 'dc-premium'),
      service.getOrCreateGameSessionForDailyCase('premium-user', 'dc-premium'),
    ]);

    expect(store.sessions).toHaveLength(1);
    expect(first.session.id).toBe(second.session.id);
  });

  it('resets a completed daily session for dev replay without creating a second session', async () => {
    const { service, store } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.users.push({ id: 'free-user', subscriptionTier: 'free' });
    store.cases.push({
      id: 'case-daily',
      title: 'Daily Case',
      date,
      difficulty: 'easy',
      diagnosisId: 'd1',
      clues: [{ value: 'clue' }],
      explanation: null,
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      approvedAt: new Date(),
      currentRevision: { publishTrack: PublishTrack.DAILY, date },
    });
    store.dailyCases.push({
      id: 'dc-daily',
      caseId: 'case-daily',
      date,
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
      createdAt: new Date(),
    });
    store.sessions.push({
      id: 'session-1',
      caseId: 'case-daily',
      userId: 'free-user',
      dailyCaseId: 'dc-daily',
      userTierAtStart: 'free',
      status: 'completed',
      startedAt: new Date('2026-04-18T08:00:00.000Z'),
      completedAt: new Date('2026-04-18T08:05:00.000Z'),
      processingAt: null,
      processedAt: new Date('2026-04-18T08:05:01.000Z'),
      xpAwardedAt: new Date('2026-04-18T08:05:02.000Z'),
      currentClueIndexLegacy: 3,
      attempts: [{ result: 'wrong' }, { result: 'correct' }],
    });
    store.leaderboardEntries.push({
      id: 'lb-1',
      userId: 'free-user',
      dailyCaseId: 'dc-daily',
    });

    await service.resetUserSessionForDailyCaseReplay('free-user', 'dc-daily');

    expect(store.sessions).toHaveLength(1);
    expect(store.sessions[0]).toMatchObject({
      id: 'session-1',
      status: 'active',
      completedAt: null,
      processingAt: null,
      processedAt: new Date('2026-04-18T08:05:01.000Z'),
      xpAwardedAt: new Date('2026-04-18T08:05:02.000Z'),
      currentClueIndexLegacy: 0,
    });
    expect(store.sessions[0].attempts).toEqual([]);
    expect(store.leaderboardEntries).toEqual([]);
  });

  it('publishes daily cases idempotently with stable per-track sequencing', async () => {
    const { service, store } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.cases.push(
      {
        id: 'case-daily',
        title: 'Daily Case',
        date,
        difficulty: 'easy',
        diagnosisId: 'd1',
        clues: [{ value: 'clue' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:00.000Z'),
        currentRevision: { publishTrack: PublishTrack.DAILY, date },
      },
      {
        id: 'case-premium-a',
        title: 'Premium A',
        date,
        difficulty: 'medium',
        diagnosisId: 'd2',
        clues: [{ value: 'premium clue A' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:02.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
      {
        id: 'case-premium-b',
        title: 'Premium B',
        date,
        difficulty: 'medium',
        diagnosisId: 'd3',
        clues: [{ value: 'premium clue B' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:03.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
    );

    const first = await service.publishDailyCasesForDate(date);
    const second = await service.publishDailyCasesForDate(date);

    expect(first.map((item) => `${item.track}:${item.sequenceIndex}:${item.caseId}`)).toEqual(
      second.map((item) => `${item.track}:${item.sequenceIndex}:${item.caseId}`),
    );
    expect(store.dailyCases).toHaveLength(3);
    expect(
      new Set(
        store.dailyCases.map(
          (item) => `${item.date.toISOString()}-${item.track}-${item.sequenceIndex}`,
        ),
      ).size,
    ).toBe(store.dailyCases.length);
  });
});
