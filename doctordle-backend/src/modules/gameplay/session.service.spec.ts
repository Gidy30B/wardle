import { BadRequestException } from '@nestjs/common';
import { DiagnosisRegistryStatus } from '@prisma/client';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service';
import { SessionService } from './session.service';

function createSessionServiceFixture() {
  let claimAt: Date | undefined;

  const prisma: any = {};
  prisma.gameSession = {
    updateMany: jest.fn().mockImplementation(async (args: any) => {
      if (args.data?.processingAt instanceof Date) {
        claimAt = args.data.processingAt;
      }

      return { count: 1 };
    }),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
  };
  prisma.$transaction = jest.fn(async (handler: (tx: any) => unknown) =>
    handler(prisma),
  );
  prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([
    {
      clues: [
        { id: 'c1-0', type: 'history', value: 'Shortness of breath', order: 0 },
      ],
    },
  ]);
  prisma.attempt = {
    findFirst: jest.fn().mockResolvedValue(null),
  };

  const cacheService = {
    set: jest.fn().mockResolvedValue(undefined),
  };

  const aiContentService = {
    getHint: jest.fn(),
    getExplanation: jest.fn().mockResolvedValue(null),
  };

  const diagnosisRegistryMatcherService = {
    evaluateGameplayGuess: jest.fn(),
  };

  const attemptService = {
    recordAttemptInTransaction: jest.fn().mockResolvedValue(undefined),
  };

  const evaluationService = {
    getDerivedClueIndex: jest.fn().mockReturnValue(0),
    getClueMismatch: jest.fn().mockReturnValue(null),
    computeGuessOutcome: jest.fn(),
  };

  const rewardOrchestrator = {
    emitAttemptSubmitted: jest.fn().mockResolvedValue(undefined),
    emitAttemptEvaluated: jest.fn().mockResolvedValue(undefined),
    emitSessionCompleted: jest.fn().mockResolvedValue(undefined),
    emitRewardRequested: jest.fn().mockResolvedValue(undefined),
  };

  const dailyCasesService = {
    getTodayCasesForUser: jest.fn(),
    getOrCreateGameSessionForDailyCase: jest.fn(),
    resetUserSessionForDailyCaseReplay: jest.fn().mockResolvedValue(undefined),
    publishDailyCasesForDate: jest.fn(),
    ensureScheduleWindow: jest.fn(),
  };

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
  };

  const metrics = {
    increment: jest.fn(),
  };

  const diagnosisRegistrySnapshotService = {
    getVersion: jest.fn().mockResolvedValue({
      version: 'dictionary-v2',
      generatedAt: '2026-04-22T08:00:00.000Z',
      diagnosisCount: 1,
      aliasCount: 0,
      selectionRequired: true,
      autocompleteEnabled: true,
    }),
  };

  return {
    prisma,
    cacheService,
    aiContentService,
    diagnosisRegistryMatcherService,
    attemptService,
    evaluationService,
    rewardOrchestrator,
    dailyCasesService,
    logger,
    metrics,
    diagnosisRegistrySnapshotService,
    getClaimAt: () => claimAt,
    service: new SessionService(
      prisma as never,
      cacheService as never,
      aiContentService as never,
      diagnosisRegistryMatcherService as never,
      attemptService as never,
      evaluationService as never,
      rewardOrchestrator as never,
      dailyCasesService as never,
      logger as never,
      metrics as never,
      new CaseEligibilityPolicyService(),
      diagnosisRegistrySnapshotService as never,
    ),
  };
}

function buildActiveSession(caseDiagnosisRegistryId: string | null) {
  return {
    id: 'session-1',
    userId: 'user-1',
    caseId: 'case-1',
    dailyCaseId: 'daily-1',
    userTierAtStart: 'free',
    status: 'active',
    processingAt: null,
    startedAt: new Date('2026-04-22T08:00:00.000Z'),
    completedAt: null,
    user: {
      subscriptionTier: 'free',
    },
    dailyCase: {
      track: 'DAILY',
    },
    case: {
      id: 'case-1',
      diagnosisRegistryId: caseDiagnosisRegistryId,
      diagnosis: {
        id: 'diagnosis-1',
        name: 'Asthma',
        system: 'Pulmonology',
      },
      diagnosisRegistry: caseDiagnosisRegistryId
        ? {
            id: caseDiagnosisRegistryId,
            displayLabel: 'Asthma',
            canonicalName: 'Asthma',
            specialty: 'Pulmonology',
            category: 'Obstructive Lung Disease',
            bodySystem: 'Respiratory',
          }
        : null,
      difficulty: 'medium',
      date: new Date('2026-04-22T00:00:00.000Z'),
    },
    attempts: [],
  };
}

function buildFreshSession(claimAt?: Date) {
  return {
    id: 'session-1',
    caseId: 'case-1',
    userId: 'user-1',
    dailyCaseId: 'daily-1',
    userTierAtStart: 'free',
    status: 'active',
    processingAt: claimAt,
    user: {
      subscriptionTier: 'free',
    },
    dailyCase: {
      track: 'DAILY',
    },
    attempts: [],
  };
}

describe('SessionService gameplay registry correctness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns completed sessions as learning library cases', async () => {
    const fixture = createSessionServiceFixture();
    fixture.prisma.gameSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        userId: 'user-1',
        caseId: 'case-1',
        dailyCaseId: 'daily-1',
        status: 'completed',
        startedAt: new Date('2026-04-22T08:00:00.000Z'),
        completedAt: new Date('2026-04-22T08:01:40.000Z'),
        dailyCase: {
          id: 'daily-1',
          date: new Date('2026-04-22T00:00:00.000Z'),
          track: 'DAILY',
          sequenceIndex: 1,
        },
        case: {
          id: 'case-1',
          title: 'Asthma',
          diagnosisRegistryId: 'registry-1',
          date: new Date('2026-04-22T00:00:00.000Z'),
          difficulty: 'medium',
          explanation: {
            summary: 'Acute bronchospasm with reversible airflow obstruction.',
            keyFindings: ['Wheeze'],
            reasoning: ['Wheeze and dyspnea support asthma.'],
            differentialAnalysis: [
              {
                diagnosis: 'COPD',
                whyPlausibleEarly:
                  'Both COPD and asthma can present with wheeze and dyspnea.',
                ruledOutByClues: [
                  {
                    clueOrder: 4,
                    evidence: 'Spirometry improves after bronchodilator.',
                    reason:
                      'Reversible airflow obstruction is more characteristic of asthma than COPD.',
                  },
                ],
                finalReasonLessLikely:
                  'The reversible pattern favors asthma over fixed chronic obstruction.',
              },
            ],
          },
          differentials: ['COPD'],
          diagnosis: {
            id: 'diagnosis-1',
            name: 'Asthma',
            system: 'Pulmonology',
          },
          diagnosisRegistry: {
            id: 'registry-1',
            displayLabel: 'Asthma',
            canonicalName: 'Asthma',
            specialty: 'Pulmonology',
            category: 'Obstructive Lung Disease',
            bodySystem: 'Respiratory',
          },
        },
        attempts: [{ result: 'wrong' }, { result: 'correct' }],
      },
    ]);

    const result = await fixture.service.getCompletedLearningLibrary({
      userId: 'user-1',
    });

    expect(fixture.prisma.gameSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          status: 'completed',
        }),
      }),
    );
    expect(result.cases).toHaveLength(1);
    expect(result.cases[0]).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        dailyCaseId: 'daily-1',
        track: 'DAILY',
        sequenceIndex: 1,
        playerResult: {
          solved: true,
          attemptsUsed: 2,
          timeSecs: 100,
        },
        case: expect.objectContaining({
          id: 'case-1',
          title: 'Asthma',
          diagnosisRegistryId: 'registry-1',
          educationAvailable: true,
          diagnosis: {
            id: 'registry-1',
            displayLabel: 'Asthma',
            canonicalName: 'Asthma',
            specialty: 'Pulmonology',
            category: 'Obstructive Lung Disease',
            bodySystem: 'Respiratory',
          },
          specialty: 'Pulmonology',
          category: 'Obstructive Lung Disease',
          bodySystem: 'Respiratory',
          difficulty: 'medium',
          clues: [
            {
              id: 'c1-0',
              type: 'history',
              value: 'Shortness of breath',
              order: 0,
            },
          ],
          explanation: expect.objectContaining({
            summary: 'Acute bronchospasm with reversible airflow obstruction.',
            differentials: ['COPD'],
            differentialAnalysis: [
              {
                diagnosis: 'COPD',
                whyPlausibleEarly:
                  'Both COPD and asthma can present with wheeze and dyspnea.',
                ruledOutByClues: [
                  {
                    clueOrder: 4,
                    evidence: 'Spirometry improves after bronchodilator.',
                    reason:
                      'Reversible airflow obstruction is more characteristic of asthma than COPD.',
                  },
                ],
                finalReasonLessLikely:
                  'The reversible pattern favors asthma over fixed chronic obstruction.',
              },
            ],
          }),
        }),
      }),
    );
  });

  it('marks legacy-only learning library cases as education unavailable', async () => {
    const fixture = createSessionServiceFixture();
    fixture.prisma.gameSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        userId: 'user-1',
        caseId: 'case-1',
        dailyCaseId: 'daily-1',
        status: 'completed',
        startedAt: new Date('2026-04-22T08:00:00.000Z'),
        completedAt: new Date('2026-04-22T08:01:40.000Z'),
        dailyCase: {
          id: 'daily-1',
          date: new Date('2026-04-22T00:00:00.000Z'),
          track: 'DAILY',
          sequenceIndex: 1,
        },
        case: {
          id: 'case-1',
          title: 'Asthma',
          date: new Date('2026-04-22T00:00:00.000Z'),
          difficulty: 'medium',
          explanation: {
            summary: 'Acute bronchospasm with reversible airflow obstruction.',
          },
          differentials: ['COPD'],
          diagnosis: {
            id: 'diagnosis-1',
            name: 'Asthma',
            system: 'Pulmonology',
          },
          diagnosisRegistry: null,
          diagnosisRegistryId: null,
        },
        attempts: [{ result: 'correct' }],
      },
    ]);

    const result = await fixture.service.getCompletedLearningLibrary({
      userId: 'user-1',
    });

    expect(result.cases[0].case).toEqual(
      expect.objectContaining({
        diagnosisRegistryId: null,
        educationAvailable: false,
        diagnosis: expect.objectContaining({
          id: 'diagnosis-1',
          displayLabel: 'Asthma',
        }) as unknown,
      }),
    );
  });

  it('rejects daily start when the returned session case differs from the DailyCase case', async () => {
    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-22',
      cases: [
        {
          dailyCaseId: 'daily-1',
          track: 'DAILY',
          sequenceIndex: 1,
        },
      ],
    });
    fixture.dailyCasesService.getOrCreateGameSessionForDailyCase.mockResolvedValue(
      {
        user: {
          id: 'user-1',
          subscriptionTier: 'free',
        },
        session: {
          id: 'session-1',
          caseId: 'case-old',
          dailyCaseId: 'daily-1',
          status: 'active',
          startedAt: new Date('2026-04-22T08:00:00.000Z'),
          completedAt: null,
          attempts: [],
        },
        dailyCase: {
          id: 'daily-1',
          caseId: 'case-1',
          date: new Date('2026-04-22T00:00:00.000Z'),
          track: 'DAILY',
          sequenceIndex: 1,
          case: {
            id: 'case-1',
            date: new Date('2026-04-22T00:00:00.000Z'),
            difficulty: 'medium',
          },
        },
      },
    );

    await expect(
      fixture.service.startDailyGame({ userId: 'user-1' }),
    ).rejects.toThrow('Session case no longer matches the assigned daily case');

    expect(fixture.cacheService.set).not.toHaveBeenCalled();
  });

  it('returns waiting for daily start when no scheduled case exists without creating a DailyCase', async () => {
    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-22',
      cases: [],
    });

    const result = await fixture.service.startDailyGame({ userId: 'user-1' });

    expect(result).toEqual({
      state: 'waiting',
      nextCaseAt: expect.any(String),
    });
    expect(
      fixture.dailyCasesService.getOrCreateGameSessionForDailyCase,
    ).not.toHaveBeenCalled();
    expect(
      fixture.dailyCasesService.publishDailyCasesForDate,
    ).not.toHaveBeenCalled();
    expect(
      fixture.dailyCasesService.ensureScheduleWindow,
    ).not.toHaveBeenCalled();
  });

  it('starts from an existing scheduled DailyCase without invoking scheduling writes', async () => {
    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-22',
      cases: [
        {
          dailyCaseId: 'daily-1',
          track: 'DAILY',
          sequenceIndex: 1,
        },
      ],
    });
    fixture.dailyCasesService.getOrCreateGameSessionForDailyCase.mockResolvedValue(
      {
        user: {
          id: 'user-1',
          subscriptionTier: 'free',
        },
        session: {
          id: 'session-1',
          caseId: 'case-1',
          dailyCaseId: 'daily-1',
          status: 'active',
          startedAt: new Date('2026-04-22T08:00:00.000Z'),
          completedAt: null,
          attempts: [],
        },
        dailyCase: {
          id: 'daily-1',
          caseId: 'case-1',
          date: new Date('2026-04-22T00:00:00.000Z'),
          track: 'DAILY',
          sequenceIndex: 1,
          case: {
            id: 'case-1',
            date: new Date('2026-04-22T00:00:00.000Z'),
            difficulty: 'medium',
          },
        },
      },
    );

    const result = await fixture.service.startDailyGame({ userId: 'user-1' });

    expect(result.state).toBe('ready');
    expect(
      fixture.dailyCasesService.getOrCreateGameSessionForDailyCase,
    ).toHaveBeenCalledWith('user-1', 'daily-1');
    expect(
      fixture.dailyCasesService.publishDailyCasesForDate,
    ).not.toHaveBeenCalled();
    expect(
      fixture.dailyCasesService.ensureScheduleWindow,
    ).not.toHaveBeenCalled();
  });

  it('loads normalized legacy investigation clues for gameplay', async () => {
    const fixture = createSessionServiceFixture();
    fixture.prisma.$queryRawUnsafe.mockResolvedValue([
      {
        clues: [
          {
            type: 'investigation',
            value:
              'Upper gastrointestinal endoscopy demonstrates a duodenal ulcer.',
            order: 0,
          },
        ],
      },
    ]);
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-22',
      cases: [
        {
          dailyCaseId: 'daily-1',
          track: 'DAILY',
          sequenceIndex: 1,
        },
      ],
    });
    fixture.dailyCasesService.getOrCreateGameSessionForDailyCase.mockResolvedValue(
      {
        user: {
          id: 'user-1',
          subscriptionTier: 'free',
        },
        session: {
          id: 'session-1',
          caseId: 'case-1',
          dailyCaseId: 'daily-1',
          status: 'active',
          startedAt: new Date('2026-04-22T08:00:00.000Z'),
          completedAt: null,
          attempts: [],
        },
        dailyCase: {
          id: 'daily-1',
          caseId: 'case-1',
          date: new Date('2026-04-22T00:00:00.000Z'),
          track: 'DAILY',
          sequenceIndex: 1,
          case: {
            id: 'case-1',
            date: new Date('2026-04-22T00:00:00.000Z'),
            difficulty: 'medium',
          },
        },
      },
    );

    const result = await fixture.service.startDailyGame({ userId: 'user-1' });

    expect(result.state).toBe('ready');
    expect(result.case?.clues).toEqual([
      {
        id: 'case-1-0',
        type: 'imaging',
        value: 'Upper gastrointestinal endoscopy demonstrates a duodenal ulcer.',
        order: 0,
      },
    ]);
  });

  it('uses registry evaluation to persist a correct selected diagnosis submission', async () => {
    const fixture = createSessionServiceFixture();
    fixture.prisma.gameSession.findUnique
      .mockImplementationOnce(async () => buildActiveSession('registry-1'))
      .mockImplementationOnce(async () =>
        buildFreshSession(fixture.getClaimAt()),
      );
    fixture.diagnosisRegistryMatcherService.evaluateGameplayGuess.mockResolvedValue(
      {
        expectedDiagnosisRegistryId: 'registry-1',
        expectedDiagnosisStatus: DiagnosisRegistryStatus.ACTIVE,
        expectedDiagnosisUsable: true,
        isCorrect: true,
        resolution: {
          submittedDiagnosisRegistryId: 'registry-1',
          submittedGuessText: 'Asthma attack',
          normalizedGuess: 'asthma attack',
          resolvedDiagnosisRegistryId: 'registry-1',
          resolutionMethod: 'SELECTED_ID',
          isResolvable: true,
        },
        evaluation: {
          score: 1,
          label: 'correct',
          evaluatorVersion: 'registry:v2',
          retrievalMode: 'selected-id-only',
          normalizedGuess: 'asthma attack',
          signals: {
            registryCorrectnessAuthority: true,
            submittedDiagnosisRegistryId: 'registry-1',
            resolvedDiagnosisRegistryId: 'registry-1',
            diagnosisResolutionMethod: 'SELECTED_ID',
          },
        },
      },
    );
    fixture.evaluationService.computeGuessOutcome.mockReturnValue({
      clueIndex: 0,
      attemptsCount: 1,
      computedScore: 100,
      nextClueIndex: 1,
      gameOver: true,
      gameOverReason: 'correct',
      shouldRequestReward: true,
      isTerminalCorrect: true,
    });

    const result = await fixture.service.submitGuess({
      sessionId: 'session-1',
      userId: 'user-1',
      diagnosisRegistryId: 'registry-1',
      guess: 'Asthma attack',
    });

    expect(
      fixture.diagnosisRegistryMatcherService.evaluateGameplayGuess,
    ).toHaveBeenCalledWith({
      expectedDiagnosisRegistryId: 'registry-1',
      submittedDiagnosisRegistryId: 'registry-1',
      submittedGuessText: 'Asthma attack',
    });
    expect(
      fixture.attemptService.recordAttemptInTransaction,
    ).toHaveBeenCalledWith(
      fixture.prisma,
      expect.objectContaining({
        guess: 'Asthma attack',
        normalizedGuess: 'asthma attack',
        selectedDiagnosisId: 'registry-1',
        strictMatchedDiagnosisId: 'registry-1',
        strictMatchOutcome: 'SELECTED_ID',
        result: 'correct',
      }),
    );
    expect(
      fixture.rewardOrchestrator.emitAttemptEvaluated,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'correct',
        submittedDiagnosisRegistryId: 'registry-1',
        submittedGuessText: 'Asthma attack',
        resolvedDiagnosisRegistryId: 'registry-1',
        resolutionMethod: 'SELECTED_ID',
      }),
    );
    expect(result.result).toBe('correct');
    expect(result.feedback?.evaluatorVersion).toBe('registry:v2');
    expect(result.feedback?.signals?.diagnosisResolutionMethod).toBe(
      'SELECTED_ID',
    );
  });

  it('rejects merged selected diagnosis ids before attempt persistence', async () => {
    const fixture = createSessionServiceFixture();
    fixture.prisma.gameSession.findUnique
      .mockImplementationOnce(async () => buildActiveSession('registry-target'))
      .mockImplementationOnce(async () =>
        buildFreshSession(fixture.getClaimAt()),
      );
    fixture.diagnosisRegistryMatcherService.evaluateGameplayGuess.mockResolvedValue(
      {
        expectedDiagnosisRegistryId: 'registry-target',
        expectedDiagnosisStatus: DiagnosisRegistryStatus.ACTIVE,
        expectedDiagnosisUsable: true,
        isCorrect: true,
        resolution: {
          submittedDiagnosisRegistryId: 'registry-source',
          submittedGuessText: 'Old asthma label',
          normalizedGuess: 'old asthma label',
          resolvedDiagnosisRegistryId: 'registry-target',
          resolutionMethod: 'MERGED_SELECTED_ID',
          resolutionReason: 'MERGED_SELECTED_ID',
          isResolvable: true,
        },
        evaluation: {
          score: 1,
          label: 'correct',
          evaluatorVersion: 'registry:v2',
          retrievalMode: 'selected-id-only',
          normalizedGuess: 'old asthma label',
          signals: {
            registryCorrectnessAuthority: true,
            diagnosisResolutionMethod: 'MERGED_SELECTED_ID',
          },
        },
      },
    );
    fixture.evaluationService.computeGuessOutcome.mockReturnValue({
      clueIndex: 0,
      attemptsCount: 1,
      computedScore: 100,
      nextClueIndex: 1,
      gameOver: true,
      gameOverReason: 'correct',
      shouldRequestReward: true,
      isTerminalCorrect: true,
    });

    await expect(
      fixture.service.submitGuess({
        sessionId: 'session-1',
        userId: 'user-1',
        diagnosisRegistryId: 'registry-source',
        guess: 'Old asthma label',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'DICTIONARY_STALE',
        currentDictionaryVersion: 'dictionary-v2',
        resolutionReason: 'MERGED_SELECTED_ID',
      }),
    });

    expect(
      fixture.attemptService.recordAttemptInTransaction,
    ).not.toHaveBeenCalled();
  });

  it('rejects invalid selected diagnosis ids before attempt persistence', async () => {
    const fixture = createSessionServiceFixture();
    fixture.prisma.gameSession.findUnique.mockImplementationOnce(async () =>
      buildActiveSession('registry-1'),
    );
    fixture.diagnosisRegistryMatcherService.evaluateGameplayGuess.mockResolvedValue(
      {
        expectedDiagnosisRegistryId: 'registry-1',
        expectedDiagnosisStatus: DiagnosisRegistryStatus.ACTIVE,
        expectedDiagnosisUsable: true,
        isCorrect: false,
        resolution: {
          submittedDiagnosisRegistryId: 'missing-registry',
          submittedGuessText: 'Asthma',
          normalizedGuess: 'asthma',
          resolvedDiagnosisRegistryId: null,
          resolutionMethod: 'UNRESOLVED',
          resolutionReason: 'INVALID_SELECTED_ID',
          isResolvable: false,
        },
        evaluation: {
          score: 0,
          label: 'wrong',
          evaluatorVersion: 'registry:v2',
          retrievalMode: 'selected-id-only',
          normalizedGuess: 'asthma',
          signals: {
            registryCorrectnessAuthority: true,
            diagnosisResolutionReason: 'INVALID_SELECTED_ID',
          },
        },
      },
    );

    await expect(
      fixture.service.submitGuess({
        sessionId: 'session-1',
        userId: 'user-1',
        diagnosisRegistryId: 'missing-registry',
        guess: 'Asthma',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INVALID_DIAGNOSIS_SELECTION',
        currentDictionaryVersion: 'dictionary-v2',
        resolutionReason: 'INVALID_SELECTED_ID',
      }),
    });

    expect(
      fixture.rewardOrchestrator.emitAttemptEvaluated,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedDiagnosisRegistryId: 'missing-registry',
        resolutionReason: 'INVALID_SELECTED_ID',
      }),
    );
    expect(fixture.prisma.$transaction).not.toHaveBeenCalled();
    expect(
      fixture.attemptService.recordAttemptInTransaction,
    ).not.toHaveBeenCalled();
  });

  it('rejects gameplay submissions without a diagnosisRegistryId', async () => {
    const fixture = createSessionServiceFixture();

    await expect(
      fixture.service.submitGuess({
        sessionId: 'session-1',
        userId: 'user-1',
      } as never),
    ).rejects.toThrow(BadRequestException);

    expect(
      fixture.diagnosisRegistryMatcherService.evaluateGameplayGuess,
    ).not.toHaveBeenCalled();
    expect(
      fixture.rewardOrchestrator.emitAttemptSubmitted,
    ).not.toHaveBeenCalled();
  });

  it('handles cases without a linked registry diagnosis safely', async () => {
    const fixture = createSessionServiceFixture();
    fixture.prisma.gameSession.findUnique
      .mockImplementationOnce(async () => buildActiveSession(null))
      .mockImplementationOnce(async () =>
        buildFreshSession(fixture.getClaimAt()),
      );
    fixture.diagnosisRegistryMatcherService.evaluateGameplayGuess.mockResolvedValue(
      {
        expectedDiagnosisRegistryId: null,
        expectedDiagnosisStatus: null,
        expectedDiagnosisUsable: false,
        isCorrect: false,
        resolution: {
          submittedDiagnosisRegistryId: 'registry-1',
          submittedGuessText: 'Asthma',
          normalizedGuess: 'asthma',
          resolvedDiagnosisRegistryId: 'registry-1',
          resolutionMethod: 'SELECTED_ID',
          resolutionReason: 'EXPECTED_DIAGNOSIS_MISSING',
          isResolvable: true,
        },
        evaluation: {
          score: 0,
          label: 'wrong',
          evaluatorVersion: 'registry:v2',
          retrievalMode: 'selected-id-only',
          normalizedGuess: 'asthma',
          signals: {
            registryCorrectnessAuthority: true,
            expectedDiagnosisUsable: false,
            diagnosisResolutionReason: 'EXPECTED_DIAGNOSIS_MISSING',
            diagnosisResolutionMethod: 'SELECTED_ID',
          },
        },
      },
    );
    fixture.evaluationService.computeGuessOutcome.mockReturnValue({
      clueIndex: 0,
      attemptsCount: 1,
      computedScore: 0,
      nextClueIndex: 1,
      gameOver: false,
      gameOverReason: null,
      shouldRequestReward: false,
      isTerminalCorrect: false,
    });

    const result = await fixture.service.submitGuess({
      sessionId: 'session-1',
      userId: 'user-1',
      diagnosisRegistryId: 'registry-1',
      guess: 'Asthma',
    });

    expect(result.result).toBe('wrong');
    expect(result.feedback?.signals?.expectedDiagnosisUsable).toBe(false);
    expect(
      fixture.rewardOrchestrator.emitRewardRequested,
    ).not.toHaveBeenCalled();
  });

  it('returns duplicate responses without recording a second attempt', async () => {
    const fixture = createSessionServiceFixture();
    fixture.prisma.gameSession.findUnique
      .mockImplementationOnce(async () => buildActiveSession('registry-1'))
      .mockImplementationOnce(async () =>
        buildFreshSession(fixture.getClaimAt()),
      );
    fixture.diagnosisRegistryMatcherService.evaluateGameplayGuess.mockResolvedValue(
      {
        expectedDiagnosisRegistryId: 'registry-1',
        expectedDiagnosisStatus: DiagnosisRegistryStatus.ACTIVE,
        expectedDiagnosisUsable: true,
        isCorrect: true,
        resolution: {
          submittedDiagnosisRegistryId: 'registry-1',
          submittedGuessText: 'Asthma',
          normalizedGuess: 'asthma',
          resolvedDiagnosisRegistryId: 'registry-1',
          resolutionMethod: 'SELECTED_ID',
          isResolvable: true,
        },
        evaluation: {
          score: 1,
          label: 'correct',
          evaluatorVersion: 'registry:v2',
          retrievalMode: 'selected-id-only',
          normalizedGuess: 'asthma',
          signals: {
            registryCorrectnessAuthority: true,
          },
        },
      },
    );
    fixture.prisma.attempt.findFirst.mockResolvedValue({
      id: 'attempt-existing',
      result: 'correct',
      score: 100,
    });

    const result = await fixture.service.submitGuess({
      sessionId: 'session-1',
      userId: 'user-1',
      diagnosisRegistryId: 'registry-1',
      guess: 'Asthma',
    });

    expect(result.duplicate).toBe(true);
    expect(
      fixture.attemptService.recordAttemptInTransaction,
    ).not.toHaveBeenCalled();
  });
});
