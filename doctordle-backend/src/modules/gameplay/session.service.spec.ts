import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PublishTrack } from '@prisma/client';
import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { SessionService } from './session.service';

function createSessionServiceFixture() {
  let claimAt: Date | undefined;

  const prisma: any = {};
  prisma.gameSession = {
    updateMany: jest
      .fn()
      .mockImplementation(async (args: any) => {
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
      clues: [{ id: 'c1-0', type: 'history', value: 'Shortness of breath', order: 0 }],
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

  const evaluatorApiService = {
    evaluateGuess: jest.fn(),
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
  };

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
  };

  const metrics = {
    increment: jest.fn(),
  };

  return {
    prisma,
    cacheService,
    aiContentService,
    evaluatorApiService,
    attemptService,
    evaluationService,
    rewardOrchestrator,
    dailyCasesService,
    logger,
    metrics,
    getClaimAt: () => claimAt,
    service: new SessionService(
      prisma as never,
      cacheService as never,
      aiContentService as never,
      evaluatorApiService as never,
      attemptService as never,
      evaluationService as never,
      rewardOrchestrator as never,
      dailyCasesService as never,
      logger as never,
      metrics as never,
    ),
  };
}

describe('SessionService premium enforcement', () => {
  afterEach(() => {
    delete process.env.ENABLE_DEV_REPLAY;
    resetEnvCacheForTests();
  });

  it('startDailyGame skips completed cases and opens the next unfinished case', async () => {
    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-18',
      cases: [{ dailyCaseId: 'dc-1' }, { dailyCaseId: 'dc-2' }],
    });
    fixture.prisma.gameSession.findMany.mockResolvedValue([
      { dailyCaseId: 'dc-1', status: 'completed' },
    ]);
    fixture.dailyCasesService.getOrCreateGameSessionForDailyCase.mockResolvedValue({
      session: {
        id: 'session-2',
        caseId: 'case-2',
        dailyCaseId: 'dc-2',
        status: 'active',
        attempts: [],
      },
      dailyCase: {
        id: 'dc-2',
        caseId: 'case-2',
        date: new Date('2026-04-18T00:00:00.000Z'),
        case: {
          id: 'case-2',
          difficulty: 'easy',
          date: new Date('2026-04-18T00:00:00.000Z'),
        },
      },
      user: {
        id: 'user-1',
        subscriptionTier: 'free',
      },
    });

    const result = await fixture.service.startDailyGame({ userId: 'user-1' });

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') {
      throw new Error('Expected ready state');
    }
    expect(fixture.dailyCasesService.getOrCreateGameSessionForDailyCase).toHaveBeenCalledWith(
      'user-1',
      'dc-2',
    );
    expect(result.sessionId).toBe('session-2');
  });

  it('startDailyGame returns waiting when all available daily cases are completed', async () => {
    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-18',
      cases: [{ dailyCaseId: 'dc-1' }, { dailyCaseId: 'dc-2' }],
    });
    fixture.prisma.gameSession.findMany.mockResolvedValue([
      { dailyCaseId: 'dc-1', status: 'completed' },
      { dailyCaseId: 'dc-2', status: 'completed' },
    ]);

    const result = await fixture.service.startDailyGame({ userId: 'user-1' });

    expect(result.state).toBe('waiting');
    if (result.state !== 'waiting') {
      throw new Error('Expected waiting state');
    }
    expect(fixture.dailyCasesService.getOrCreateGameSessionForDailyCase).not.toHaveBeenCalled();
    expect(result.nextCaseAt).toMatch(/T00:00:00.000Z$/);
  });

  it('startDailyGame auto-replays the most recent today session when dev replay is enabled', async () => {
    process.env.ENABLE_DEV_REPLAY = 'true';
    resetEnvCacheForTests();

    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-18',
      cases: [{ dailyCaseId: 'dc-1' }, { dailyCaseId: 'dc-2' }],
    });
    fixture.prisma.gameSession.findMany.mockResolvedValue([
      { dailyCaseId: 'dc-1', status: 'completed' },
      { dailyCaseId: 'dc-2', status: 'completed' },
    ]);
    fixture.prisma.gameSession.findFirst.mockResolvedValue({
      dailyCaseId: 'dc-2',
    });
    fixture.dailyCasesService.getOrCreateGameSessionForDailyCase.mockResolvedValue({
      session: {
        id: 'session-replay',
        caseId: 'case-2',
        dailyCaseId: 'dc-2',
        status: 'active',
        attempts: [],
      },
      dailyCase: {
        id: 'dc-2',
        caseId: 'case-2',
        date: new Date('2026-04-18T00:00:00.000Z'),
        case: {
          id: 'case-2',
          difficulty: 'hard',
          date: new Date('2026-04-18T00:00:00.000Z'),
        },
      },
      user: {
        id: 'user-1',
        subscriptionTier: 'premium',
      },
    });

    const result = await fixture.service.startDailyGame({ userId: 'user-1' });

    expect(result.state).toBe('ready');
    expect(fixture.prisma.gameSession.findFirst).toHaveBeenCalled();
    expect(
      fixture.dailyCasesService.resetUserSessionForDailyCaseReplay,
    ).toHaveBeenCalledWith('user-1', 'dc-2');
    expect(
      fixture.dailyCasesService.getOrCreateGameSessionForDailyCase,
    ).toHaveBeenCalledWith('user-1', 'dc-2');
  });

  it('startDailyGame keeps an active session instead of auto-replaying it in dev', async () => {
    process.env.ENABLE_DEV_REPLAY = 'true';
    resetEnvCacheForTests();

    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-18',
      cases: [{ dailyCaseId: 'dc-1' }, { dailyCaseId: 'dc-2' }],
    });
    fixture.prisma.gameSession.findMany.mockResolvedValue([
      { dailyCaseId: 'dc-1', status: 'completed' },
      { dailyCaseId: 'dc-2', status: 'active' },
    ]);
    fixture.dailyCasesService.getOrCreateGameSessionForDailyCase.mockResolvedValue({
      session: {
        id: 'session-2',
        caseId: 'case-2',
        dailyCaseId: 'dc-2',
        status: 'active',
        attempts: [],
      },
      dailyCase: {
        id: 'dc-2',
        caseId: 'case-2',
        date: new Date('2026-04-18T00:00:00.000Z'),
        case: {
          id: 'case-2',
          difficulty: 'hard',
          date: new Date('2026-04-18T00:00:00.000Z'),
        },
      },
      user: {
        id: 'user-1',
        subscriptionTier: 'premium',
      },
    });

    const result = await fixture.service.startDailyGame({ userId: 'user-1' });

    expect(result.state).toBe('ready');
    expect(fixture.prisma.gameSession.findFirst).not.toHaveBeenCalled();
    expect(
      fixture.dailyCasesService.resetUserSessionForDailyCaseReplay,
    ).not.toHaveBeenCalled();
    expect(
      fixture.dailyCasesService.getOrCreateGameSessionForDailyCase,
    ).toHaveBeenCalledWith('user-1', 'dc-2');
  });

  it('startDailyGame devReplay resets the selected daily case instead of returning waiting', async () => {
    process.env.ENABLE_DEV_REPLAY = 'true';
    resetEnvCacheForTests();

    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-18',
      cases: [{ dailyCaseId: 'dc-1' }],
    });
    fixture.dailyCasesService.getOrCreateGameSessionForDailyCase.mockResolvedValue({
      session: {
        id: 'session-replay',
        caseId: 'case-1',
        dailyCaseId: 'dc-1',
        status: 'active',
        attempts: [],
      },
      dailyCase: {
        id: 'dc-1',
        caseId: 'case-1',
        date: new Date('2026-04-18T00:00:00.000Z'),
        case: {
          id: 'case-1',
          difficulty: 'easy',
          date: new Date('2026-04-18T00:00:00.000Z'),
        },
      },
      user: {
        id: 'user-1',
        subscriptionTier: 'free',
      },
    });

    const result = await fixture.service.startDailyGame({
      userId: 'user-1',
      devReplay: true,
    });

    expect(result.state).toBe('ready');
    expect(
      fixture.dailyCasesService.resetUserSessionForDailyCaseReplay,
    ).toHaveBeenCalledWith('user-1', 'dc-1');
    expect(
      fixture.dailyCasesService.getOrCreateGameSessionForDailyCase,
    ).toHaveBeenCalledWith('user-1', 'dc-1');
  });

  it('startDailyGame devReplay uses the provided dailyCaseId when present', async () => {
    process.env.ENABLE_DEV_REPLAY = 'true';
    resetEnvCacheForTests();

    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-18',
      cases: [
        { dailyCaseId: 'dc-1', track: PublishTrack.DAILY, sequenceIndex: 1 },
        { dailyCaseId: 'dc-2', track: PublishTrack.PREMIUM, sequenceIndex: 1 },
      ],
    });
    fixture.dailyCasesService.getOrCreateGameSessionForDailyCase.mockResolvedValue({
      session: {
        id: 'session-replay',
        caseId: 'case-2',
        dailyCaseId: 'dc-2',
        status: 'active',
        attempts: [],
      },
      dailyCase: {
        id: 'dc-2',
        caseId: 'case-2',
        date: new Date('2026-04-18T00:00:00.000Z'),
        case: {
          id: 'case-2',
          difficulty: 'hard',
          date: new Date('2026-04-18T00:00:00.000Z'),
        },
      },
      user: {
        id: 'user-1',
        subscriptionTier: 'premium',
      },
    });

    await fixture.service.startDailyGame({
      userId: 'user-1',
      devReplay: true,
      dailyCaseId: 'dc-2',
    });

    expect(
      fixture.dailyCasesService.resetUserSessionForDailyCaseReplay,
    ).toHaveBeenCalledWith('user-1', 'dc-2');
  });

  it('startDailyGame devReplay resolves track + sequenceIndex explicitly', async () => {
    process.env.ENABLE_DEV_REPLAY = 'true';
    resetEnvCacheForTests();

    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-18',
      cases: [
        { dailyCaseId: 'dc-daily', track: PublishTrack.DAILY, sequenceIndex: 1 },
        { dailyCaseId: 'dc-premium-1', track: PublishTrack.PREMIUM, sequenceIndex: 1 },
        { dailyCaseId: 'dc-premium-2', track: PublishTrack.PREMIUM, sequenceIndex: 2 },
      ],
    });
    fixture.dailyCasesService.getOrCreateGameSessionForDailyCase.mockResolvedValue({
      session: {
        id: 'session-replay',
        caseId: 'case-3',
        dailyCaseId: 'dc-premium-2',
        status: 'active',
        attempts: [],
      },
      dailyCase: {
        id: 'dc-premium-2',
        caseId: 'case-3',
        date: new Date('2026-04-18T00:00:00.000Z'),
        case: {
          id: 'case-3',
          difficulty: 'hard',
          date: new Date('2026-04-18T00:00:00.000Z'),
        },
      },
      user: {
        id: 'user-1',
        subscriptionTier: 'premium',
      },
    });

    await fixture.service.startDailyGame({
      userId: 'user-1',
      devReplay: true,
      track: PublishTrack.PREMIUM,
      sequenceIndex: 2,
    });

    expect(
      fixture.dailyCasesService.resetUserSessionForDailyCaseReplay,
    ).toHaveBeenCalledWith('user-1', 'dc-premium-2');
  });

  it('startDailyGame devReplay falls back to the most recent today session', async () => {
    process.env.ENABLE_DEV_REPLAY = 'true';
    resetEnvCacheForTests();

    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-18',
      cases: [
        { dailyCaseId: 'dc-daily', track: PublishTrack.DAILY, sequenceIndex: 1 },
        { dailyCaseId: 'dc-premium-1', track: PublishTrack.PREMIUM, sequenceIndex: 1 },
      ],
    });
    fixture.prisma.gameSession.findFirst.mockResolvedValue({
      dailyCaseId: 'dc-premium-1',
    });
    fixture.dailyCasesService.getOrCreateGameSessionForDailyCase.mockResolvedValue({
      session: {
        id: 'session-replay',
        caseId: 'case-2',
        dailyCaseId: 'dc-premium-1',
        status: 'active',
        attempts: [],
      },
      dailyCase: {
        id: 'dc-premium-1',
        caseId: 'case-2',
        date: new Date('2026-04-18T00:00:00.000Z'),
        case: {
          id: 'case-2',
          difficulty: 'hard',
          date: new Date('2026-04-18T00:00:00.000Z'),
        },
      },
      user: {
        id: 'user-1',
        subscriptionTier: 'premium',
      },
    });

    await fixture.service.startDailyGame({
      userId: 'user-1',
      devReplay: true,
    });

    expect(fixture.prisma.gameSession.findFirst).toHaveBeenCalled();
    expect(
      fixture.dailyCasesService.resetUserSessionForDailyCaseReplay,
    ).toHaveBeenCalledWith('user-1', 'dc-premium-1');
  });

  it('startDailyGame devReplay rejects ambiguous replay without an explicit target', async () => {
    process.env.ENABLE_DEV_REPLAY = 'true';
    resetEnvCacheForTests();

    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-18',
      cases: [
        { dailyCaseId: 'dc-daily', track: PublishTrack.DAILY, sequenceIndex: 1 },
        { dailyCaseId: 'dc-premium-1', track: PublishTrack.PREMIUM, sequenceIndex: 1 },
      ],
    });
    fixture.prisma.gameSession.findFirst.mockResolvedValue(null);

    await expect(
      fixture.service.startDailyGame({
        userId: 'user-1',
        devReplay: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignores devReplay when the env gate is disabled', async () => {
    const fixture = createSessionServiceFixture();
    fixture.dailyCasesService.getTodayCasesForUser.mockResolvedValue({
      date: '2026-04-18',
      cases: [{ dailyCaseId: 'dc-1' }],
    });
    fixture.prisma.gameSession.findMany.mockResolvedValue([
      { dailyCaseId: 'dc-1', status: 'completed' },
    ]);

    const result = await fixture.service.startDailyGame({
      userId: 'user-1',
      devReplay: true,
    });

    expect(result.state).toBe('waiting');
    expect(
      fixture.dailyCasesService.resetUserSessionForDailyCaseReplay,
    ).not.toHaveBeenCalled();
  });

  it('rejects forged free submission into a premium session', async () => {
    const fixture = createSessionServiceFixture();
    fixture.prisma.gameSession.findUnique.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      userTierAtStart: 'free',
      status: 'active',
      user: { subscriptionTier: 'free' },
      dailyCase: { track: PublishTrack.PREMIUM },
      case: {
        id: 'case-1',
        diagnosis: { name: 'Asthma' },
        difficulty: 'easy',
        date: new Date('2026-04-18T00:00:00.000Z'),
      },
      attempts: [],
    });

    await expect(
      fixture.service.submitDailyGuess({
        userId: 'user-1',
        sessionId: 'session-1',
        guess: 'asthma',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(fixture.evaluatorApiService.evaluateGuess).not.toHaveBeenCalled();
  });

  it('allows a downgraded user to continue an existing premium session started while premium', async () => {
    const fixture = createSessionServiceFixture();
    fixture.prisma.gameSession.findUnique
      .mockResolvedValueOnce({
        id: 'session-1',
        caseId: 'case-1',
        userId: 'user-1',
        dailyCaseId: 'dc-premium',
        userTierAtStart: 'premium',
        status: 'active',
        user: { subscriptionTier: 'free' },
        dailyCase: { track: PublishTrack.PREMIUM },
        case: {
          id: 'case-1',
          diagnosis: { name: 'Asthma' },
          difficulty: 'easy',
          date: new Date('2026-04-18T00:00:00.000Z'),
        },
        attempts: [],
      })
      .mockImplementationOnce(async () => ({
        id: 'session-1',
        caseId: 'case-1',
        userId: 'user-1',
        dailyCaseId: 'dc-premium',
        userTierAtStart: 'premium',
        status: 'active',
        processingAt: fixture.getClaimAt(),
        user: { subscriptionTier: 'free' },
        dailyCase: { track: PublishTrack.PREMIUM },
        attempts: [],
      }));

    fixture.evaluatorApiService.evaluateGuess.mockResolvedValue({
      label: 'correct',
      score: 0.98,
      evaluatorVersion: 'v2',
      retrievalMode: 'fallback',
      normalizedGuess: 'asthma',
      signals: { synonym: true },
    });
    fixture.evaluationService.computeGuessOutcome.mockReturnValue({
      attemptsCount: 1,
      computedScore: 0.98,
      nextClueIndex: 1,
      gameOver: true,
      gameOverReason: 'correct',
      shouldRequestReward: true,
      isTerminalCorrect: true,
      clueIndex: 0,
    });

    const result = await fixture.service.submitDailyGuess({
      userId: 'user-1',
      sessionId: 'session-1',
      guess: 'asthma',
    });

    expect(result.result).toBe('correct');
    expect(fixture.evaluatorApiService.evaluateGuess).toHaveBeenCalled();
    expect(fixture.attemptService.recordAttemptInTransaction).toHaveBeenCalled();
  });
});
