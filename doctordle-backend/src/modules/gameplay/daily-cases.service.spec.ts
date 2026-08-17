import {
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import {
  CaseEditorialStatus,
  CaseRevisionPublicationStanding,
  DiagnosisRegistryStatus,
  PublishTrack,
} from '@prisma/client';
import {
  DailyCasesService,
  getTrackPriority,
  normalizeDailyDate,
} from './daily-cases.service';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service';

type StoreCase = {
  id: string;
  publicNumber?: number | null;
  title: string;
  date: Date;
  difficulty: string;
  diagnosisId: string | null;
  diagnosisRegistryId: string | null;
  diagnosisMappingStatus: string;
  diagnosisRegistry: {
    id: string;
    displayLabel?: string | null;
    canonicalName?: string | null;
    status: DiagnosisRegistryStatus;
    active: boolean;
    isPlayable: boolean;
  } | null;
  clues: unknown;
  explanation: unknown;
  editorialStatus: CaseEditorialStatus;
  approvedAt: Date | null;
  publishedAt?: Date | null;
  currentRevision: {
    id?: string;
    publishTrack: PublishTrack | null;
    date: Date;
  } | null;
};

type StoreDailyCase = {
  id: string;
  caseId: string;
  caseRevisionId?: string | null;
  publicationDecisionId?: string | null;
  date: Date;
  track: PublishTrack;
  sequenceIndex: number;
  createdAt: Date;
};

type StorePublicationDecision = {
  id: string;
  caseId: string;
  caseRevisionId: string;
  standing: CaseRevisionPublicationStanding;
  occurredAt: Date;
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
    publicationDecisions: [] as StorePublicationDecision[],
    sessions: [] as StoreSession[],
    leaderboardEntries: [] as StoreLeaderboardEntry[],
  };

  let dailyCaseCounter = 1;
  let sessionCounter = 1;
  let leaderboardCounter = 1;
  let sessionUniqueLookupCount = 0;

  const normalizeCaseForAssignment = (item: Partial<StoreCase> & StoreCase) => {
    const diagnosisRegistryId =
      item.diagnosisRegistryId === undefined
        ? `registry-${item.id}`
        : item.diagnosisRegistryId;
    const diagnosisRegistry =
      item.diagnosisRegistry === undefined
        ? diagnosisRegistryId
          ? {
              id: diagnosisRegistryId,
              displayLabel: item.title,
              canonicalName: item.title,
              status: DiagnosisRegistryStatus.ACTIVE,
              active: true,
              isPlayable: true,
            }
          : null
        : item.diagnosisRegistry;

    return {
      diagnosisRegistryId,
      diagnosisMappingStatus: item.diagnosisMappingStatus ?? 'MATCHED',
      diagnosisRegistry,
    };
  };

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
              ...normalizeCaseForAssignment(item),
              id: item.id,
              title: item.title,
              diagnosisId: item.diagnosisId,
              clues: item.clues,
              explanation:
                item.explanation ??
                (item.id === 'case-missing-explanation'
                  ? null
                  : { summary: `summary ${item.id}` }),
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
            ...normalizeCaseForAssignment(item),
            id: item.id,
            title: item.title,
            date: item.date,
            difficulty: item.difficulty,
            diagnosisId: item.diagnosisId,
            clues: item.clues,
            explanation:
              item.explanation ??
              (item.id === 'case-missing-explanation'
                ? null
                : { summary: `summary ${item.id}` }),
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
      updateMany: jest.fn(async (args: any) => {
        const ids = new Set((args.where?.id?.in ?? []) as string[]);
        let count = 0;

        for (const item of store.cases) {
          if (ids.size > 0 && !ids.has(item.id)) {
            continue;
          }

          if (
            args.where?.editorialStatus &&
            item.editorialStatus !== args.where.editorialStatus
          ) {
            continue;
          }

          Object.assign(item, args.data);
          count += 1;
        }

        return { count };
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
            caseRevisionId: row.caseRevisionId ?? null,
            publicationDecisionId: row.publicationDecisionId ?? null,
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
    caseRevisionPublicationDecision: {
      findMany: jest.fn(async (args: any) => {
        const revisionDate = args.where?.caseRevision?.is?.date;
        return store.publicationDecisions
          .filter(
            (decision) =>
              decision.standing === args.where.standing &&
              (!revisionDate ||
                (store.cases
                  .find((item) => item.id === decision.caseId)
                  ?.currentRevision?.date.getTime() ?? Number.NaN) >=
                  revisionDate.gte.getTime()) &&
              (!revisionDate ||
                (store.cases
                  .find((item) => item.id === decision.caseId)
                  ?.currentRevision?.date.getTime() ?? Number.NaN) <
                  revisionDate.lt.getTime()),
          )
          .sort((left, right) => {
            const occurredDelta =
              left.occurredAt.getTime() - right.occurredAt.getTime();
            return occurredDelta !== 0
              ? occurredDelta
              : left.id.localeCompare(right.id);
          })
          .map((decision) => {
            const caseRecord = store.cases.find(
              (item) => item.id === decision.caseId,
            )!;
            const revision = caseRecord.currentRevision!;
            return {
              id: decision.id,
              caseId: decision.caseId,
              caseRevisionId: decision.caseRevisionId,
              occurredAt: decision.occurredAt,
              case: {
                id: caseRecord.id,
                title: caseRecord.title,
                editorialStatus: caseRecord.editorialStatus,
                approvedAt: caseRecord.approvedAt,
                publishedAt: caseRecord.publishedAt ?? null,
                currentRevisionId: revision.id ?? `rev-${caseRecord.id}`,
              },
              caseRevision: {
                id: decision.caseRevisionId,
                caseId: decision.caseId,
                date: revision.date,
                publishTrack: revision.publishTrack,
              },
            };
          });
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

  return {
    prisma,
    store,
    service: new DailyCasesService(
      prisma as never,
      new CaseEligibilityPolicyService(),
    ),
  };
}

function addScheduleCase(
  store: ReturnType<typeof createDailyCasesFixture>['store'],
  overrides: Partial<StoreCase> & {
    id: string;
    authorizePublication?: boolean;
  },
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
    diagnosisRegistryId: hasOverride('diagnosisRegistryId')
      ? (overrides.diagnosisRegistryId ?? null)
      : `registry-${overrides.id}`,
    diagnosisMappingStatus: overrides.diagnosisMappingStatus ?? 'MATCHED',
    diagnosisRegistry:
      overrides.diagnosisRegistry === undefined
        ? {
            id: `registry-${overrides.id}`,
            displayLabel: overrides.title ?? overrides.id,
            canonicalName: overrides.title ?? overrides.id,
            status: DiagnosisRegistryStatus.ACTIVE,
            active: true,
            isPlayable: true,
          }
        : overrides.diagnosisRegistry,
    clues: overrides.clues ?? [
      { type: 'history', value: `clue ${overrides.id}`, order: 0 },
    ],
    explanation: hasOverride('explanation')
      ? (overrides.explanation ?? null)
      : { summary: `summary ${overrides.id}` },
    editorialStatus:
      overrides.editorialStatus ?? CaseEditorialStatus.READY_TO_PUBLISH,
    approvedAt: overrides.approvedAt ?? new Date('2026-01-01T00:00:00.000Z'),
    publishedAt: overrides.publishedAt ?? null,
    currentRevision:
      overrides.currentRevision === undefined
        ? {
            id: `rev-${overrides.id}`,
            publishTrack: PublishTrack.PREMIUM,
            date: targetDate,
          }
        : overrides.currentRevision,
  });

  if (overrides.authorizePublication !== false) {
    addPublicationDecisionForCase(store, overrides.id);
  }
}

function addPublicationDecisionForCase(
  store: ReturnType<typeof createDailyCasesFixture>['store'],
  caseId: string,
  overrides: Partial<StorePublicationDecision> = {},
) {
  const caseRecord = store.cases.find((item) => item.id === caseId);
  if (!caseRecord?.currentRevision) {
    throw new Error(`Cannot authorize publication without revision: ${caseId}`);
  }
  const caseRevisionId =
    caseRecord.currentRevision.id ?? overrides.caseRevisionId ?? `rev-${caseId}`;
  if (!caseRecord.currentRevision.id) {
    caseRecord.currentRevision.id = caseRevisionId;
  }
  store.publicationDecisions.push({
    id: overrides.id ?? `pub-${caseId}`,
    caseId,
    caseRevisionId,
    standing:
      overrides.standing ?? CaseRevisionPublicationStanding.AUTHORIZED,
    occurredAt:
      overrides.occurredAt ?? new Date('2026-01-01T00:00:00.000Z'),
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
    expect(store.cases.find((item) => item.id === 'case-ready')).toMatchObject({
      editorialStatus: CaseEditorialStatus.PUBLISHED,
    });
    expect(
      store.cases.find((item) => item.id === 'case-ready')?.publishedAt,
    ).toBeInstanceOf(Date);
  });

  it('does not schedule APPROVED inventory without APP-008A publication authority', async () => {
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-02-02');
    addScheduleCase(store, {
      id: 'case-approved',
      editorialStatus: CaseEditorialStatus.APPROVED,
      authorizePublication: false,
    });

    const result = await service.ensureScheduleWindow(scheduleDate, 1);

    expect(result.createdSlots).toEqual([]);
    expect(result.skippedSlots).toContainEqual({
      date: '2099-02-02',
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
      reason: 'no_eligible_case',
    });
    expect(store.cases.find((item) => item.id === 'case-approved')).toMatchObject(
      {
        editorialStatus: CaseEditorialStatus.APPROVED,
        publishedAt: null,
      },
    );
  });

  it('schedules active APP-008A publication even when Case is PUBLISHED projection', async () => {
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-02-02');
    addScheduleCase(store, {
      id: 'case-published',
      editorialStatus: CaseEditorialStatus.PUBLISHED,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.ensureScheduleWindow(scheduleDate, 1);

    expect(result.createdSlots).toMatchObject([
      {
        caseId: 'case-published',
        caseRevisionId: 'rev-case-published',
        publicationDecisionId: 'pub-case-published',
        track: PublishTrack.DAILY,
        sequenceIndex: 1,
      },
    ]);
  });

  it('ignores unpublication-authorized inventory with scheduling diagnostics', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-02-03');
    addScheduleCase(store, { id: 'case-valid' });
    addScheduleCase(store, {
      id: 'case-no-publication',
      authorizePublication: false,
    });
    addScheduleCase(store, { id: 'case-invalid-clues', clues: [] });
    addScheduleCase(store, {
      id: 'case-missing-diagnosis',
      diagnosisRegistryId: null,
      diagnosisRegistry: null,
    });
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
    expect(result.excludedCases).toEqual([]);
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('case-no-publication'),
    );
    for (const caseId of [
      'case-no-publication',
      'case-invalid-clues',
      'case-missing-diagnosis',
      'case-missing-explanation',
      'case-draft',
    ]) {
      expect(store.cases.find((item) => item.id === caseId)?.publishedAt).toBe(
        null,
      );
    }
    logSpy.mockRestore();
  });

  it('does not assign already scheduled authorized publications again', async () => {
    const { service, store } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-02-05');
    const previousDate = normalizeDailyDate('2099-01-15');
    addScheduleCase(store, {
      id: 'case-published',
      editorialStatus: CaseEditorialStatus.PUBLISHED,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    store.dailyCases.push({
      id: 'dc-existing-elsewhere',
      caseId: 'case-published',
      date: previousDate,
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.ensureScheduleWindow(scheduleDate, 1);

    expect(result.createdCount).toBe(0);
    expect(result.blockedCases).toContainEqual({
      caseId: 'case-published',
      diagnosis: 'case-published',
      editorialStatus: CaseEditorialStatus.PUBLISHED,
      reason: 'already_scheduled',
    });
    expect(store.dailyCases).toHaveLength(1);
    expect(store.cases.find((item) => item.id === 'case-published')).toMatchObject(
      {
        editorialStatus: CaseEditorialStatus.PUBLISHED,
        publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    );
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
        caseRevisionId: null,
        publicationDecisionId: null,
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
    const { service, store, prisma } = createDailyCasesFixture();
    const scheduleDate = normalizeDailyDate('2099-06-01');
    addScheduleCase(store, { id: 'case-repeat-1' });
    addScheduleCase(store, { id: 'case-repeat-2' });

    const first = await service.ensureScheduleWindow(scheduleDate, 2);
    (prisma.case.updateMany as jest.Mock).mockClear();
    const second = await service.ensureScheduleWindow(scheduleDate, 2);

    expect(first.createdCount).toBe(2);
    expect(second.createdCount).toBe(0);
    expect(second.existingCount).toBe(2);
    expect(prisma.case.updateMany).not.toHaveBeenCalled();
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
      clues: [{ type: 'history', value: 'clue', order: 0 }],
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
        clues: [{ type: 'history', value: 'clue', order: 0 }],
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
        clues: [{ type: 'history', value: 'premium clue', order: 0 }],
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
      clues: [{ type: 'history', value: 'clue', order: 0 }],
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
        clues: [{ type: 'history', value: 'clue', order: 0 }],
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
        clues: [{ type: 'history', value: 'premium clue 2', order: 0 }],
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
        clues: [{ type: 'history', value: 'premium clue 1', order: 0 }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:02.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
    );
    addPublicationDecisionForCase(store, 'case-daily');
    addPublicationDecisionForCase(store, 'case-premium-2');
    addPublicationDecisionForCase(store, 'case-premium-1');

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

  it('allows a free user to replay the same daily case without creating a duplicate session', async () => {
    const { service, store } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.users.push({ id: 'free-user', subscriptionTier: 'free' });
    store.cases.push({
      id: 'case-daily',
      title: 'Daily Case',
      date,
      difficulty: 'easy',
      diagnosisId: 'd1',
      clues: [{ type: 'history', value: 'daily clue', order: 0 }],
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
      attempts: [{ result: 'correct' }],
    });

    const result = await service.getOrCreateGameSessionForDailyCase(
      'free-user',
      'dc-daily',
    );

    expect(result.session.id).toBe('session-1');
    expect(result.session.dailyCaseId).toBe('dc-daily');
    expect(store.sessions).toHaveLength(1);
  });

  it('allows a free user to start the current daily case after completing an archived daily assignment', async () => {
    const { service, store } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.users.push({ id: 'free-user', subscriptionTier: 'free' });
    store.cases.push(
      {
        id: 'case-archive',
        title: 'Archive Case',
        date: normalizeDailyDate('2026-04-17'),
        difficulty: 'easy',
        diagnosisId: 'd1',
        clues: [{ type: 'history', value: 'archive clue', order: 0 }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date(),
        currentRevision: { publishTrack: PublishTrack.DAILY, date: normalizeDailyDate('2026-04-17') },
      },
      {
        id: 'case-current',
        title: 'Current Daily',
        date,
        difficulty: 'easy',
        diagnosisId: 'd2',
        clues: [{ type: 'history', value: 'current clue', order: 0 }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date(),
        currentRevision: { publishTrack: PublishTrack.DAILY, date },
      },
    );
    store.dailyCases.push(
      {
        id: 'dc-archive',
        caseId: 'case-archive',
        date: normalizeDailyDate('2026-04-17'),
        track: PublishTrack.DAILY,
        sequenceIndex: 1,
        createdAt: new Date(),
      },
      {
        id: 'dc-current',
        caseId: 'case-current',
        date,
        track: PublishTrack.DAILY,
        sequenceIndex: 1,
        createdAt: new Date(),
      },
    );
    store.sessions.push({
      id: 'archive-session',
      caseId: 'case-archive',
      userId: 'free-user',
      dailyCaseId: 'dc-archive',
      userTierAtStart: 'free',
      status: 'completed',
      startedAt: new Date('2026-04-17T08:00:00.000Z'),
      completedAt: new Date('2026-04-17T08:05:00.000Z'),
      processingAt: null,
      processedAt: new Date('2026-04-17T08:05:01.000Z'),
      xpAwardedAt: new Date('2026-04-17T08:05:02.000Z'),
      currentClueIndexLegacy: 3,
      attempts: [{ result: 'correct' }],
    });

    const result = await service.getOrCreateGameSessionForDailyCase(
      'free-user',
      'dc-current',
    );

    expect(result.session.dailyCaseId).toBe('dc-current');
    expect(store.sessions).toHaveLength(2);
  });

  it('allows a free user to start an archive daily case after completing the current daily case', async () => {
    const { service, store } = createDailyCasesFixture();
    const date = normalizeDailyDate('2026-04-18');
    store.users.push({ id: 'free-user', subscriptionTier: 'free' });
    store.cases.push(
      {
        id: 'case-current',
        title: 'Current Daily',
        date,
        difficulty: 'easy',
        diagnosisId: 'd1',
        clues: [{ type: 'history', value: 'current clue', order: 0 }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date(),
        currentRevision: { publishTrack: PublishTrack.DAILY, date },
      },
      {
        id: 'case-archive',
        title: 'Archive Case',
        date: normalizeDailyDate('2026-04-17'),
        difficulty: 'easy',
        diagnosisId: 'd2',
        clues: [{ type: 'history', value: 'archive clue', order: 0 }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date(),
        currentRevision: { publishTrack: PublishTrack.DAILY, date: normalizeDailyDate('2026-04-17') },
      },
    );
    store.dailyCases.push(
      {
        id: 'dc-current',
        caseId: 'case-current',
        date,
        track: PublishTrack.DAILY,
        sequenceIndex: 1,
        createdAt: new Date(),
      },
      {
        id: 'dc-archive',
        caseId: 'case-archive',
        date: normalizeDailyDate('2026-04-17'),
        track: PublishTrack.DAILY,
        sequenceIndex: 1,
        createdAt: new Date(),
      },
    );
    store.sessions.push({
      id: 'current-session',
      caseId: 'case-current',
      userId: 'free-user',
      dailyCaseId: 'dc-current',
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

    const result = await service.getOrCreateGameSessionForDailyCase(
      'free-user',
      'dc-archive',
    );

    expect(result.session.dailyCaseId).toBe('dc-archive');
    expect(store.sessions).toHaveLength(2);
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
      clues: [{ type: 'history', value: 'premium clue', order: 0 }],
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
      clues: [{ type: 'history', value: 'premium clue', order: 0 }],
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
      clues: [{ type: 'history', value: 'premium clue', order: 0 }],
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
      clues: [{ type: 'history', value: 'clue', order: 0 }],
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
      clues: [{ type: 'history', value: 'clue', order: 0 }],
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
        clues: [{ type: 'history', value: 'clue', order: 0 }],
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
        clues: [{ type: 'history', value: 'premium clue A', order: 0 }],
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
        clues: [{ type: 'history', value: 'premium clue B', order: 0 }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:03.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
    );
    addPublicationDecisionForCase(store, 'case-daily', {
      occurredAt: new Date('2026-04-17T00:00:00.000Z'),
    });
    addPublicationDecisionForCase(store, 'case-premium-a', {
      occurredAt: new Date('2026-04-17T00:00:02.000Z'),
    });
    addPublicationDecisionForCase(store, 'case-premium-b', {
      occurredAt: new Date('2026-04-17T00:00:03.000Z'),
    });

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
        clues: [{ type: 'history', value: 'legacy clue', order: 0 }],
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
        clues: [{ type: 'history', value: 'premium clue A', order: 0 }],
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
        clues: [{ type: 'history', value: 'premium clue B', order: 0 }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:03.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
    );
    addPublicationDecisionForCase(store, 'case-premium-a', {
      occurredAt: new Date('2026-04-17T00:00:02.000Z'),
    });
    addPublicationDecisionForCase(store, 'case-premium-b', {
      occurredAt: new Date('2026-04-17T00:00:03.000Z'),
    });

    const result = await service.publishDailyCasesForDate(date);

    expect(prisma.dailyCase.createMany).toHaveBeenCalledWith({
      data: [
        {
          date,
          caseId: 'case-premium-a',
          caseRevisionId: 'rev-case-premium-a',
          publicationDecisionId: 'pub-case-premium-a',
          track: PublishTrack.PREMIUM,
          sequenceIndex: 1,
        },
        {
          date,
          caseId: 'case-premium-b',
          caseRevisionId: 'rev-case-premium-b',
          publicationDecisionId: 'pub-case-premium-b',
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
        clues: [{ type: 'history', value: 'curated clue', order: 0 }],
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
        clues: [{ type: 'history', value: 'premium clue B', order: 0 }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:03.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
    );
    addPublicationDecisionForCase(store, 'case-premium-b', {
      occurredAt: new Date('2026-04-17T00:00:03.000Z'),
    });

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
        clues: [{ type: 'history', value: 'premium clue A', order: 0 }],
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
        clues: [{ type: 'history', value: 'premium clue B', order: 0 }],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        approvedAt: new Date('2026-04-17T00:00:03.000Z'),
        currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
      },
    );
    addPublicationDecisionForCase(store, 'case-premium-a', {
      occurredAt: new Date('2026-04-17T00:00:02.000Z'),
    });
    addPublicationDecisionForCase(store, 'case-premium-b', {
      occurredAt: new Date('2026-04-17T00:00:03.000Z'),
    });

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

  it('returns diagnostics when no unused candidates can fill missing slots', async () => {
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
      clues: [{ type: 'history', value: 'premium clue A', order: 0 }],
      explanation: null,
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      approvedAt: new Date('2026-04-17T00:00:02.000Z'),
      currentRevision: { publishTrack: PublishTrack.PREMIUM, date },
    });
    addPublicationDecisionForCase(store, 'case-premium-a', {
      occurredAt: new Date('2026-04-17T00:00:02.000Z'),
    });

    const result = await service.assignDailyCasesForDate(date);

    expect(result.existingSlots.map((item) => item.dailyCaseId)).toEqual([
      'dc-legacy',
    ]);
    expect(result.blockedCases).toContainEqual({
      caseId: 'case-premium-a',
      diagnosis: 'Premium A',
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      reason: 'already_scheduled',
    });
    expect(prisma.dailyCase.createMany).not.toHaveBeenCalled();
  });
});
