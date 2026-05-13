import {
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CaseEditorialStatus, PublishTrack } from '@prisma/client';
import {
  DailyCasesService,
  getTrackPriority,
  normalizeDailyDate,
} from './daily-cases.service';

type StoreCase = {
  id: string;
  publicNumber?: number | null;
  title: string;
  date: Date;
  difficulty: string;
  diagnosisId: string | null;
  clues: unknown;
  explanation: unknown;
  editorialStatus: CaseEditorialStatus;
  approvedAt: Date | null;
  currentRevision: {
    id?: string;
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

  prisma.$executeRaw = jest.fn().mockResolvedValue(0);

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
        return store.users.find((user) => user.id === args.where.id) ?? null;
      }),
    },
    case: {
      findMany: jest.fn(async (args: any) => {
        if (!args.where?.currentRevision) {
          return [...store.cases]
            .sort((left, right) => {
              const approvedDelta =
                (left.approvedAt?.getTime() ?? 0) -
                (right.approvedAt?.getTime() ?? 0);
              return approvedDelta !== 0
                ? approvedDelta
                : left.id.localeCompare(right.id);
            })
            .map((item) => ({
              id: item.id,
              title: item.title,
              diagnosisId: item.diagnosisId,
              clues: item.clues,
              explanation: item.explanation,
              editorialStatus: item.editorialStatus,
              approvedAt: item.approvedAt,
            }));
        }

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
              (left.approvedAt?.getTime() ?? 0) -
              (right.approvedAt?.getTime() ?? 0);
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
            editorialStatus: item.editorialStatus,
            currentRevisionId: item.currentRevision?.id ?? null,
            currentRevision: item.currentRevision
              ? {
                  id: item.currentRevision.id ?? `rev-${item.id}`,
                  date: item.currentRevision.date,
                  publishTrack: item.currentRevision.publishTrack,
                }
              : null,
          }));
      }),
    },
    dailyCase: {
      findMany: jest.fn(async (args: any) => {
        let rows = [...store.dailyCases];

        if (args.where?.date instanceof Date) {
          rows = rows.filter(
            (row) => row.date.getTime() === (args.where.date as Date).getTime(),
          );
        }

        if (args.where?.date?.gte) {
          rows = rows.filter(
            (row) => row.date.getTime() >= args.where.date.gte.getTime(),
          );
        }

        if (args.where?.date?.lte) {
          rows = rows.filter(
            (row) => row.date.getTime() <= args.where.date.lte.getTime(),
          );
        }

        if (args.where?.track?.in) {
          const allowed = args.where.track.in as PublishTrack[];
          rows = rows.filter((row) => allowed.includes(row.track));
        }

        if (
          args.where?.track &&
          typeof args.where.track === 'string' &&
          !args.where.track.in
        ) {
          rows = rows.filter((row) => row.track === args.where.track);
        }

        if (typeof args.where?.sequenceIndex === 'number') {
          rows = rows.filter(
            (row) => row.sequenceIndex === args.where.sequenceIndex,
          );
        }

        rows.sort((left, right) => {
          const dateDelta = left.date.getTime() - right.date.getTime();
          if (dateDelta !== 0) {
            return dateDelta;
          }

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
            store.sessions.find((session) => session.id === args.where.id) ??
            null
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
          const error = new Error('duplicate session') as Error & {
            code?: string;
          };
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
        const found = store.sessions.find(
          (session) => session.id === args.where.id,
        );
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
    service: new DailyCasesService(prisma as never, dailyLimitService as never),
  };
}

function addScheduleCase(
  store: ReturnType<typeof createDailyCasesFixture>['store'],
  overrides: Partial<StoreCase> & { id: string },
) {
  const targetDate = normalizeDailyDate('2099-01-01');
  const hasOverride = (key: keyof StoreCase) =>
    Object.prototype.hasOwnProperty.call(overrides, key);
  store.cases.push({
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    date: overrides.date ?? normalizeDailyDate('2020-01-01'),
    difficulty: overrides.difficulty ?? 'easy',
    diagnosisId: hasOverride('diagnosisId')
      ? (overrides.diagnosisId ?? null)
      : `diagnosis-${overrides.id}`,
    clues: overrides.clues ?? [{ value: `clue ${overrides.id}` }],
    explanation: hasOverride('explanation')
      ? (overrides.explanation ?? null)
      : { summary: `summary ${overrides.id}` },
    editorialStatus:
      overrides.editorialStatus ?? CaseEditorialStatus.READY_TO_PUBLISH,
    approvedAt: overrides.approvedAt ?? new Date('2026-01-01T00:00:00.000Z'),
    currentRevision:
      overrides.currentRevision === undefined
        ? {
            publishTrack: PublishTrack.PREMIUM,
            date: targetDate,
          }
        : overrides.currentRevision,
  });
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

describe('DailyCasesService', () => {
  it('schedules a READY_TO_PUBLISH inventory case without using revision dates', async () => {
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-02-01');
    addScheduleCase(store, {
      id: 'case-ready',
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      currentRevision: {
        publishTrack: PublishTrack.PREMIUM,
        date: normalizeDailyDate('2020-05-01'),
      },
    });

    const result = await service.ensureScheduleWindow(scheduleDate, 1);

    expect(result.createdCount).toBe(1);
    expect(store.dailyCases).toMatchObject([
      {
        caseId: 'case-ready',
        date: scheduleDate,
        track: PublishTrack.DAILY,
        sequenceIndex: 1,
      },
    ]);
  });

  it('schedules an APPROVED inventory case', async () => {
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-02-02');
    addScheduleCase(store, {
      id: 'case-approved',
      editorialStatus: CaseEditorialStatus.APPROVED,
    });

    const result = await service.ensureScheduleWindow(scheduleDate, 1);

    expect(result.createdSlots).toEqual([
      {
        date: '2099-02-02',
        dailyCaseId: 'dc-1',
        caseId: 'case-approved',
        track: PublishTrack.DAILY,
        sequenceIndex: 1,
      },
    ]);
  });

  it('excludes invalid inventory with scheduling diagnostics', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-02-03');
    addScheduleCase(store, { id: 'case-valid' });
    addScheduleCase(store, { id: 'case-invalid-clues', clues: [] });
    addScheduleCase(store, { id: 'case-missing-diagnosis', diagnosisId: null });
    addScheduleCase(store, {
      id: 'case-missing-explanation',
      explanation: null,
    });
    addScheduleCase(store, {
      id: 'case-draft',
      editorialStatus: CaseEditorialStatus.DRAFT,
    });

    const result = await service.ensureScheduleWindow(scheduleDate, 1);

    expect(result.createdCount).toBe(1);
    expect(result.excludedCases).toEqual(
      expect.arrayContaining([
        { caseId: 'case-invalid-clues', reason: 'invalid_clues' },
        { caseId: 'case-missing-diagnosis', reason: 'missing_diagnosis' },
        { caseId: 'case-missing-explanation', reason: 'missing_explanation' },
        { caseId: 'case-draft', reason: 'invalid_status' },
      ]),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('daily_case.schedule.case.excluded'),
    );
    logSpy.mockRestore();
  });

  it('excludes already scheduled cases from the explicit schedule window', async () => {
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-02-04');
    const previousDate = normalizeDailyDate('2099-01-15');
    addScheduleCase(store, { id: 'case-already-scheduled' });
    addScheduleCase(store, {
      id: 'case-fresh',
      approvedAt: new Date('2026-01-01T00:00:01.000Z'),
    });
    store.dailyCases.push({
      id: 'dc-existing-elsewhere',
      caseId: 'case-already-scheduled',
      date: previousDate,
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.ensureScheduleWindow(scheduleDate, 1);

    expect(result.excludedCases).toContainEqual({
      caseId: 'case-already-scheduled',
      reason: 'already_scheduled',
    });
    expect(
      store.dailyCases.find(
        (slot) => slot.date.getTime() === scheduleDate.getTime(),
      )?.caseId,
    ).toBe('case-fresh');
  });

  it('creates a full seven day DAILY schedule when inventory is sufficient', async () => {
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-03-01');
    for (let index = 0; index < 7; index += 1) {
      addScheduleCase(store, {
        id: `case-full-${index + 1}`,
        approvedAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`),
      });
    }

    const result = await service.ensureScheduleWindow(scheduleDate, 7);

    expect(result.createdCount).toBe(7);
    expect(result.missingDates).toEqual([]);
    expect(store.dailyCases).toHaveLength(7);
    expect(
      store.dailyCases.map(
        (slot) =>
          `${slot.date.toISOString().slice(0, 10)}:${slot.track}:${slot.sequenceIndex}`,
      ),
    ).toEqual([
      '2099-03-01:DAILY:1',
      '2099-03-02:DAILY:1',
      '2099-03-03:DAILY:1',
      '2099-03-04:DAILY:1',
      '2099-03-05:DAILY:1',
      '2099-03-06:DAILY:1',
      '2099-03-07:DAILY:1',
    ]);
  });

  it('creates a partial schedule and logs missing dates when inventory is short', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-04-01');
    for (let index = 0; index < 3; index += 1) {
      addScheduleCase(store, { id: `case-partial-${index + 1}` });
    }

    const result = await service.ensureScheduleWindow(scheduleDate, 7);

    expect(result.createdCount).toBe(3);
    expect(result.missingDates).toEqual([
      '2099-04-04',
      '2099-04-05',
      '2099-04-06',
      '2099-04-07',
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('daily_case.schedule.slot.missing_no_inventory'),
    );
    warnSpy.mockRestore();
  });

  it('preserves existing window slots while creating missing future slots', async () => {
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-05-01');
    const preservedDate = addUtcDays(scheduleDate, 1);
    addScheduleCase(store, { id: 'case-preserved' });
    addScheduleCase(store, { id: 'case-new-1' });
    addScheduleCase(store, { id: 'case-new-2' });
    store.dailyCases.push({
      id: 'dc-preserved',
      caseId: 'case-preserved',
      date: preservedDate,
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.ensureScheduleWindow(scheduleDate, 3);

    expect(result.existingSlots).toEqual([
      {
        date: '2099-05-02',
        dailyCaseId: 'dc-preserved',
        caseId: 'case-preserved',
        track: PublishTrack.DAILY,
        sequenceIndex: 1,
      },
    ]);
    expect(result.createdCount).toBe(2);
    expect(
      store.dailyCases.find(
        (slot) => slot.date.getTime() === preservedDate.getTime(),
      )?.caseId,
    ).toBe('case-preserved');
    expect(store.dailyCases).toHaveLength(3);
  });

  it('can run the explicit scheduler repeatedly without duplicating slots', async () => {
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-06-01');
    addScheduleCase(store, { id: 'case-repeat-1' });
    addScheduleCase(store, { id: 'case-repeat-2' });

    const first = await service.ensureScheduleWindow(scheduleDate, 2);
    const second = await service.ensureScheduleWindow(scheduleDate, 2);

    expect(first.createdCount).toBe(2);
    expect(second.createdCount).toBe(0);
    expect(second.existingCount).toBe(2);
    expect(store.dailyCases).toHaveLength(2);
    expect(
      new Set(
        store.dailyCases.map(
          (slot) =>
            `${slot.date.toISOString().slice(0, 10)}:${slot.track}:${slot.sequenceIndex}`,
        ),
      ).size,
    ).toBe(2);
  });

  it('finds an existing daily case without publishing or creating rows', async () => {
    const { service, store, prisma } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18T18:30:00.000Z');
    store.dailyCases.push({
      id: 'dc-daily',
      caseId: 'case-daily',
      date,
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
      createdAt: new Date(),
    });
    store.cases.push({
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
    });

    const result = await service.findDailyCaseForDate({
      date: '2026-04-18T18:30:00.000Z',
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
    });

    expect(result?.id).toBe('dc-daily');
    expect(result?.case.id).toBe('case-daily');
    expect(prisma.dailyCase.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date_track_sequenceIndex: {
            date,
            track: PublishTrack.DAILY,
            sequenceIndex: 1,
          },
        },
      }),
    );
    expect(prisma.dailyCase.createMany).not.toHaveBeenCalled();
  });

  it('returns null for a missing daily case without publishing or creating rows', async () => {
    const { service, prisma } = createDailyCasesFixture();

    const result = await service.findDailyCaseForDate({
      date: '2026-04-18',
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
    });

    expect(result).toBeNull();
    expect(prisma.dailyCase.findUnique).toHaveBeenCalled();
    expect(prisma.case.findMany).not.toHaveBeenCalled();
    expect(prisma.dailyCase.createMany).not.toHaveBeenCalled();
  });

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
    expect(
      result.cases.every((item) => item.track === PublishTrack.DAILY),
    ).toBe(true);
  });

  it('lists available daily cases without publishing or creating rows', async () => {
    const { service, store, prisma } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    const publishSpy = jest.spyOn(service, 'publishDailyCasesForDate');
    store.dailyCases.push({
      id: 'dc-daily',
      caseId: 'case-daily',
      date,
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
      createdAt: new Date(),
    });
    store.cases.push({
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
    });

    const result = await service.listAvailableDailyCasesForTier('free', date);

    expect(result.map((item) => item.id)).toEqual(['dc-daily']);
    expect(publishSpy).not.toHaveBeenCalled();
    expect(prisma.dailyCase.createMany).not.toHaveBeenCalled();
  });

  it('returns an empty today feed without publishing or creating rows', async () => {
    const { service, prisma } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    const publishSpy = jest.spyOn(service, 'publishDailyCasesForDate');

    const result = await service.getTodayCasesForUser('free-user', date);

    expect(result).toEqual({
      date: '2026-04-18',
      cases: [],
    });
    expect(publishSpy).not.toHaveBeenCalled();
    expect(prisma.case.findMany).not.toHaveBeenCalled();
    expect(prisma.dailyCase.createMany).not.toHaveBeenCalled();
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

    expect(
      result.cases.map((item) => `${item.track}:${item.sequenceIndex}`),
    ).toEqual(['DAILY:1', 'PREMIUM:1', 'PREMIUM:2']);
    expect(
      result.cases.map((item) => ({
        displayLabel: item.displayLabel,
        trackDisplayLabel: item.trackDisplayLabel,
      })),
    ).toEqual([
      {
        displayLabel: 'Daily Case 2026-04-18 #1',
        trackDisplayLabel: 'Daily Case 2026-04-18 #1',
      },
      {
        displayLabel: 'Daily Case 2026-04-18 #1',
        trackDisplayLabel: 'Premium Case 2026-04-18 #1',
      },
      {
        displayLabel: 'Daily Case 2026-04-18 #2',
        trackDisplayLabel: 'Premium Case 2026-04-18 #2',
      },
    ]);
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
      processedAt: null,
      xpAwardedAt: null,
      currentClueIndexLegacy: 0,
    });
    expect(store.sessions[0].attempts).toEqual([]);
    expect(store.leaderboardEntries).toEqual([]);
  });

  it('rejects dev replay reset when the session case differs from the DailyCase case', async () => {
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
      caseId: 'case-old',
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
      attempts: [{ result: 'correct' }],
    });

    await expect(
      service.resetUserSessionForDailyCaseReplay('free-user', 'dc-daily'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(store.sessions[0]).toMatchObject({
      status: 'completed',
      caseId: 'case-old',
      completedAt: new Date('2026-04-18T08:05:00.000Z'),
    });
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

    expect(
      first.map((item) => `${item.track}:${item.sequenceIndex}:${item.caseId}`),
    ).toEqual(
      second.map(
        (item) => `${item.track}:${item.sequenceIndex}:${item.caseId}`,
      ),
    );
    expect(store.dailyCases).toHaveLength(3);
    expect(
      new Set(
        store.dailyCases.map(
          (item) =>
            `${item.date.toISOString()}-${item.track}-${item.sequenceIndex}`,
        ),
      ).size,
    ).toBe(store.dailyCases.length);
  });

  it('creates missing slots when one legacy row already exists for the date', async () => {
    const { service, store, prisma } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.dailyCases.push({
      id: 'dc-legacy',
      caseId: 'case-legacy',
      date,
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
      createdAt: new Date('2026-04-17T23:00:00.000Z'),
    });
    store.cases.push(
      {
        id: 'case-legacy',
        title: 'Legacy Case',
        date,
        difficulty: 'easy',
        diagnosisId: 'd0',
        clues: [{ value: 'legacy clue' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-16T00:00:00.000Z'),
        currentRevision: { publishTrack: PublishTrack.DAILY, date },
      },
      {
        id: 'case-premium-a',
        title: 'Premium A',
        date,
        difficulty: 'medium',
        diagnosisId: 'd1',
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
        diagnosisId: 'd2',
        clues: [{ value: 'premium clue B' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:03.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
    );

    const result = await service.publishDailyCasesForDate(date);

    expect(prisma.dailyCase.createMany).toHaveBeenCalledWith({
      data: [
        {
          date,
          caseId: 'case-premium-a',
          track: PublishTrack.PREMIUM,
          sequenceIndex: 1,
        },
        {
          date,
          caseId: 'case-premium-b',
          track: PublishTrack.PREMIUM,
          sequenceIndex: 2,
        },
      ],
      skipDuplicates: true,
    });
    expect(
      result.map(
        (item) => `${item.track}:${item.sequenceIndex}:${item.caseId}`,
      ),
    ).toEqual([
      'DAILY:1:case-legacy',
      'PREMIUM:1:case-premium-a',
      'PREMIUM:2:case-premium-b',
    ]);
  });

  it('does not overwrite existing slots while filling missing slots', async () => {
    const { service, store } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.dailyCases.push({
      id: 'dc-curated',
      caseId: 'case-curated',
      date,
      track: PublishTrack.PREMIUM,
      sequenceIndex: 1,
      createdAt: new Date('2026-04-17T23:00:00.000Z'),
    });
    store.cases.push(
      {
        id: 'case-curated',
        title: 'Curated Premium',
        date,
        difficulty: 'hard',
        diagnosisId: 'd0',
        clues: [{ value: 'curated clue' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-16T00:00:00.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
      {
        id: 'case-premium-b',
        title: 'Premium B',
        date,
        difficulty: 'medium',
        diagnosisId: 'd1',
        clues: [{ value: 'premium clue B' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:03.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
    );

    await service.publishDailyCasesForDate(date);

    expect(
      store.dailyCases.find(
        (item) =>
          item.track === PublishTrack.PREMIUM && item.sequenceIndex === 1,
      )?.caseId,
    ).toBe('case-curated');
    expect(
      store.dailyCases.find(
        (item) =>
          item.track === PublishTrack.PREMIUM && item.sequenceIndex === 2,
      )?.caseId,
    ).toBe('case-premium-b');
  });

  it('does not duplicate a caseId across same-day slots', async () => {
    const { service, store } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.dailyCases.push({
      id: 'dc-legacy',
      caseId: 'case-premium-a',
      date,
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
      createdAt: new Date('2026-04-17T23:00:00.000Z'),
    });
    store.cases.push(
      {
        id: 'case-premium-a',
        title: 'Premium A',
        date,
        difficulty: 'medium',
        diagnosisId: 'd1',
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
        diagnosisId: 'd2',
        clues: [{ value: 'premium clue B' }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:03.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
    );

    await service.publishDailyCasesForDate(date);

    expect(
      store.dailyCases
        .map((item) => item.caseId)
        .filter((caseId) => caseId === 'case-premium-a'),
    ).toHaveLength(1);
    expect(
      store.dailyCases.find(
        (item) =>
          item.track === PublishTrack.PREMIUM && item.sequenceIndex === 1,
      )?.caseId,
    ).toBe('case-premium-b');
  });

  it('returns existing rows and warns when no unused candidates can fill missing slots', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service, store, prisma } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.dailyCases.push({
      id: 'dc-legacy',
      caseId: 'case-premium-a',
      date,
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
      createdAt: new Date('2026-04-17T23:00:00.000Z'),
    });
    store.cases.push({
      id: 'case-premium-a',
      title: 'Premium A',
      date,
      difficulty: 'medium',
      diagnosisId: 'd1',
      clues: [{ value: 'premium clue A' }],
      explanation: null,
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      approvedAt: new Date('2026-04-17T00:00:02.000Z'),
      currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
    });

    const result = await service.publishDailyCasesForDate(date);

    expect(result.map((item) => item.id)).toEqual(['dc-legacy']);
    expect(prisma.dailyCase.createMany).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'daily_case.publish.insufficient_unused_candidates',
      ),
    );
    warnSpy.mockRestore();
  });
});
