import { GoneException } from '@nestjs/common';
import { PublishTrack } from '@prisma/client';
import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { CaseEligibilityPolicyService } from './case-eligibility-policy.service';
import { CasesService } from './cases.service';

describe('CasesService', () => {
  const originalEnv = { ...process.env };
  const fixedToday = new Date('2026-04-18T12:30:00.000Z');
  const normalizedToday = new Date('2026-04-18T00:00:00.000Z');

  function createServiceFixture(overrides?: {
    root?: Record<string, unknown>;
    case?: Record<string, unknown>;
    dailyCase?: Record<string, unknown>;
    diagnosisRegistry?: Record<string, unknown>;
  }) {
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(async (operation: (tx: unknown) => Promise<unknown>) =>
          operation(prisma),
        ),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'case-1' }]),
      case: {
        findFirst: jest.fn().mockResolvedValue({ publicNumber: 237 }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          editorialStatus: 'READY_TO_PUBLISH',
          clues: [{ type: 'history', value: 'clue', order: 0 }],
          diagnosis: { name: 'Asthma' },
          publicNumber: 238,
        }),
        create: jest.fn(),
        upsert: jest.fn(),
        ...(overrides?.case ?? {}),
      },
      dailyCase: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn(),
        ...(overrides?.dailyCase ?? {}),
      },
      diagnosisRegistry: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'registry-1',
          legacyDiagnosisId: null,
          displayLabel: 'Asthma',
          active: true,
          isPlayable: true,
        }),
        ...(overrides?.diagnosisRegistry ?? {}),
      },
      gameSession: {
        count: jest.fn().mockResolvedValue(0),
      },
      leaderboardEntry: {
        count: jest.fn().mockResolvedValue(0),
      },
      ...(overrides?.root ?? {}),
    };

    const aiContentService = {
      scheduleCaseContent: jest.fn(),
    };

    const editorialMetrics = {
      recordAssignmentAccepted: jest.fn(),
      recordAssignmentRejected: jest.fn(),
      recordLazyNoEligibleCaseMiss: jest.fn(),
    };

    return {
      prisma,
      aiContentService,
      editorialMetrics,
      service: new CasesService(
        prisma as never,
        aiContentService as never,
        editorialMetrics as never,
        new CaseEligibilityPolicyService(),
      ),
    };
  }

  function setEnv(overrides?: Partial<NodeJS.ProcessEnv>) {
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      CLERK_JWT_ISSUER: 'https://issuer.example.com',
      CLERK_JWT_AUDIENCE: 'wardle',
      NODE_ENV: 'test',
      DEV_BYPASS_DAILY_LIMIT: 'false',
      ENABLE_DEV_REPLAY: 'false',
      LOG_LEVEL: 'info',
      EMBEDDING_MODEL: 'text-embedding-3-small',
      SCORE_WEIGHT_EXACT: '1',
      SCORE_WEIGHT_SYNONYM: '1',
      SCORE_WEIGHT_FUZZY: '1',
      SCORE_WEIGHT_EMBEDDING: '1',
      SCORE_WEIGHT_ONTOLOGY: '1',
      EVALUATOR_VERSION: 'test',
      ...overrides,
    };
    resetEnvCacheForTests();
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(fixedToday);
    setEnv();
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...originalEnv };
    resetEnvCacheForTests();
    jest.clearAllMocks();
  });

  it('retires legacy daily assignment without writing DailyCase rows', async () => {
    const fixture = createServiceFixture();

    await expect(
      fixture.service.assignDailyCase('2026-04-18', 'case-1'),
    ).rejects.toThrow(GoneException);

    expect(fixture.prisma.dailyCase.findUnique).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.create).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.upsert).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.delete).not.toHaveBeenCalled();
  });

  it('retires legacy reset and rebuild without writing DailyCase rows', async () => {
    const fixture = createServiceFixture();

    await expect(fixture.service.resetTodayCase()).rejects.toThrow(
      GoneException,
    );
    await expect(fixture.service.rebuildTodayCase()).rejects.toThrow(
      GoneException,
    );

    expect(fixture.prisma.dailyCase.create).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.upsert).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.delete).not.toHaveBeenCalled();
  });

  it('writes diagnosisRegistryId during manual case creation without requiring legacy diagnosisId', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'case-2',
      title: 'Reactive airway disease',
      date: new Date('2026-04-20T00:00:00.000Z'),
      difficulty: 'medium',
      history: 'Wheezing after exercise',
      symptoms: ['wheezing'],
      diagnosisId: null,
      publicNumber: 238,
      diagnosis: null,
      diagnosisRegistry: {
        displayLabel: 'Asthma',
        canonicalName: 'asthma',
      },
    });
    const fixture = createServiceFixture({
      case: {
        create,
      },
    });

    await fixture.service.createCase({
      title: 'Reactive airway disease',
      history: 'Wheezing after exercise',
      symptoms: ['wheezing'],
      diagnosisRegistryId: 'registry-1',
    });

    expect(fixture.prisma.diagnosisRegistry.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'registry-1',
      },
      select: {
        id: true,
        legacyDiagnosisId: true,
        displayLabel: true,
        status: true,
        active: true,
        isPlayable: true,
      },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosisId: null,
          diagnosisRegistryId: 'registry-1',
          proposedDiagnosisText: 'Asthma',
          diagnosisMappingStatus: 'MATCHED',
          diagnosisMappingMethod: 'EDITOR_SELECTED',
          diagnosisMappingConfidence: 1,
          publicNumber: 238,
        }),
      }),
    );
  });

  it('assigns the next public number during manual case creation', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'case-2',
      publicNumber: 238,
      title: 'Reactive airway disease',
      date: new Date('2026-04-20T00:00:00.000Z'),
      difficulty: 'medium',
      history: 'Wheezing after exercise',
      symptoms: ['wheezing'],
      diagnosisId: 'diagnosis-1',
      diagnosis: { name: 'Asthma' },
    });
    const fixture = createServiceFixture({
      case: {
        create,
      },
    });

    await fixture.service.createCase({
      title: 'Reactive airway disease',
      history: 'Wheezing after exercise',
      symptoms: ['wheezing'],
      diagnosisRegistryId: 'registry-1',
    });

    expect(fixture.prisma.case.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          publicNumber: 'desc',
        },
        select: {
          publicNumber: true,
        },
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicNumber: 238,
        }),
      }),
    );
  });


  it('does not create a legacy lazy DailyCase when fallback is disabled by default', async () => {
    const fixture = createServiceFixture();

    await expect(fixture.service.getTodayCase()).rejects.toThrow(
      'No daily case has been published for today',
    );

    expect(fixture.prisma.dailyCase.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date_track_sequenceIndex: {
            date: normalizedToday,
            track: PublishTrack.DAILY,
            sequenceIndex: 1,
          },
        },
      }),
    );
    expect(fixture.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(fixture.prisma.case.findUnique).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.create).not.toHaveBeenCalled();
    expect(
      fixture.editorialMetrics.recordAssignmentRejected,
    ).not.toHaveBeenCalled();
  });

  it('returns an existing DailyCase without using the fallback', async () => {
    const fixture = createServiceFixture({
      dailyCase: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'dc-1',
          caseId: 'case-1',
          date: normalizedToday,
          track: PublishTrack.DAILY,
          sequenceIndex: 1,
          case: {
            id: 'case-1',
            publicNumber: 238,
            clues: [{ type: 'history', value: 'clue', order: 0 }],
          },
        }),
      },
    });

    const result = await fixture.service.getTodayCase();

    expect(result).toMatchObject({
      dailyCaseId: 'dc-1',
      displayLabel: 'Case 238',
      trackDisplayLabel: 'Daily Case 238',
      caseId: 'case-1',
      date: normalizedToday,
    });
    expect(fixture.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.create).not.toHaveBeenCalled();
  });

  it('does not create a legacy fallback when a DailyCase create mock exists', async () => {
    const fixture = createServiceFixture({
      dailyCase: {
        create: jest.fn().mockResolvedValue({
          id: 'dc-created',
          caseId: 'case-1',
          date: normalizedToday,
          track: PublishTrack.DAILY,
          sequenceIndex: 1,
          case: {
            id: 'case-1',
            publicNumber: 238,
            clues: [{ type: 'history', value: 'clue', order: 0 }],
          },
        }),
      },
    });

    await expect(fixture.service.getTodayCase()).rejects.toThrow(
      'No daily case has been published for today',
    );
    expect(fixture.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.create).not.toHaveBeenCalled();
  });

  it('keeps the legacy today path read-only in production', async () => {
    setEnv({
      NODE_ENV: 'production',
    });
    const fixture = createServiceFixture();

    await expect(fixture.service.getTodayCase()).rejects.toThrow(
      'No daily case has been published for today',
    );
    expect(fixture.prisma.dailyCase.create).not.toHaveBeenCalled();
  });
});
