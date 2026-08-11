import { PublishTrack } from '@prisma/client';
import { ParticipationPolicyService } from '../gameplay/participation-policy.service';
import { computeTimeToCompleteSeconds, QueueProcessor } from './queue.processor';

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  })),
);

describe('computeTimeToCompleteSeconds', () => {
  it('returns rounded non-negative seconds between startedAt and completedAt', () => {
    expect(
      computeTimeToCompleteSeconds({
        startedAt: new Date('2026-04-22T08:00:00.000Z'),
        completedAt: new Date('2026-04-22T08:01:41.600Z'),
      }),
    ).toBe(102);
  });

  it('returns null when a timestamp is missing', () => {
    expect(
      computeTimeToCompleteSeconds({
        startedAt: new Date('2026-04-22T08:00:00.000Z'),
        completedAt: null,
      }),
    ).toBeNull();
  });

  it('clamps negative durations to zero', () => {
    expect(
      computeTimeToCompleteSeconds({
        startedAt: new Date('2026-04-22T08:01:00.000Z'),
        completedAt: new Date('2026-04-22T08:00:00.000Z'),
      }),
    ).toBe(0);
  });
});

type QueueProcessorFixture = {
  prisma: {
    gameSession: {
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  streakService: {
    updateOnCompletion: jest.Mock;
  };
  xpService: {
    awardXpForSession: jest.Mock;
  };
  leaderboardService: {
    upsertCompletion: jest.Mock;
  };
  rewardOrchestrator: {
    emitRewardApplied: jest.Mock;
  };
  redisPubSub: {
    publish: jest.Mock;
  };
  notificationProducer: {
    rewardXpAwarded: jest.Mock;
    enqueueStreakMilestone: jest.Mock;
  };
  process: () => Promise<void>;
  destroy: () => Promise<void>;
};

function utcToday(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function yesterday(): Date {
  const date = utcToday();
  date.setUTCDate(date.getUTCDate() - 1);
  return date;
}

function buildCompletedSession(input: {
  date: Date;
  track: PublishTrack;
  result?: 'correct' | 'wrong';
}) {
  return {
    id: 'session-1',
    caseId: 'case-1',
    userId: 'user-1',
    dailyCaseId: 'daily-1',
    dailyCase: {
      caseId: 'case-1',
      date: input.date,
      track: input.track,
    },
    startedAt: new Date('2026-04-22T08:00:00.000Z'),
    completedAt: new Date('2026-04-22T08:01:40.000Z'),
    processingAt: null,
    processedAt: null,
    status: 'completed',
    xpAwardedAt: null,
    attempts: [
      {
        score: input.result === 'wrong' ? 0 : 100,
        result: input.result ?? 'correct',
        createdAt: new Date('2026-04-22T08:01:40.000Z'),
      },
    ],
    _count: {
      attempts: 2,
    },
  };
}

function createQueueProcessorFixture(
  session: ReturnType<typeof buildCompletedSession> | null,
): QueueProcessorFixture {
  const prisma = {
    gameSession: {
      updateMany: jest
        .fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(session),
    },
  };
  const streakService = {
    updateOnCompletion: jest.fn().mockResolvedValue(3),
  };
  const xpService = {
    awardXpForSession: jest.fn().mockResolvedValue({
      applied: true,
      xpGained: 110,
      level: 2,
      xpTotal: 210,
      xpCurrentLevel: 110,
    }),
  };
  const leaderboardService = {
    upsertCompletion: jest.fn().mockResolvedValue(undefined),
  };
  const rewardOrchestrator = {
    emitRewardApplied: jest.fn().mockResolvedValue(undefined),
  };
  const redisPubSub = {
    publish: jest.fn().mockResolvedValue(undefined),
  };
  const notificationProducer = {
    rewardXpAwarded: jest.fn().mockResolvedValue(undefined),
    enqueueStreakMilestone: jest.fn().mockResolvedValue(undefined),
  };
  const processor = new QueueProcessor(
    prisma as never,
    streakService as never,
    xpService as never,
    leaderboardService as never,
    new ParticipationPolicyService(),
    rewardOrchestrator as never,
    redisPubSub as never,
    notificationProducer as never,
  );

  return {
    prisma,
    streakService,
    xpService,
    leaderboardService,
    rewardOrchestrator,
    redisPubSub,
    notificationProducer,
    process: () =>
      (
        processor as unknown as {
          processGameCompleted: (job: {
            id: string;
            data: { sessionId: string; userId: string };
            timestamp: number;
          }) => Promise<void>;
        }
      ).processGameCompleted({
        id: 'job-1',
        data: {
          sessionId: 'session-1',
          userId: 'user-1',
        },
        timestamp: Date.now(),
      }),
    destroy: () => processor.onModuleDestroy(),
  };
}

function expectCompletionMarkedProcessed(fixture: QueueProcessorFixture) {
  expect(fixture.prisma.gameSession.updateMany).toHaveBeenLastCalledWith({
    where: {
      id: 'session-1',
      userId: 'user-1',
      processedAt: null,
    },
    data: {
      processedAt: expect.any(Date),
      processingAt: null,
    },
  });
}

describe('QueueProcessor participation policy integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('awards XP, updates streak, and writes leaderboard for current DAILY completion', async () => {
    const fixture = createQueueProcessorFixture(
      buildCompletedSession({
        date: utcToday(),
        track: PublishTrack.DAILY,
      }),
    );

    await fixture.process();
    await fixture.destroy();

    expect(fixture.streakService.updateOnCompletion).toHaveBeenCalledWith({
      userId: 'user-1',
      completedAt: new Date('2026-04-22T08:01:40.000Z'),
    });
    expect(fixture.xpService.awardXpForSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      streak: 3,
      attemptsCount: 2,
    });
    expect(fixture.leaderboardService.upsertCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        dailyCaseId: 'daily-1',
        score: 100,
      }),
    );
    expect(fixture.notificationProducer.enqueueStreakMilestone).toHaveBeenCalled();
    expect(fixture.rewardOrchestrator.emitRewardApplied).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
    });
    expectCompletionMarkedProcessed(fixture);
  });

  it('awards Archive XP without changing streak or leaderboard', async () => {
    const fixture = createQueueProcessorFixture(
      buildCompletedSession({
        date: yesterday(),
        track: PublishTrack.DAILY,
      }),
    );

    await fixture.process();
    await fixture.destroy();

    expect(fixture.streakService.updateOnCompletion).not.toHaveBeenCalled();
    expect(fixture.xpService.awardXpForSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      streak: 0,
      attemptsCount: 2,
    });
    expect(fixture.leaderboardService.upsertCompletion).not.toHaveBeenCalled();
    expect(fixture.notificationProducer.enqueueStreakMilestone).not.toHaveBeenCalled();
    expect(fixture.notificationProducer.rewardXpAwarded).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      xp: 110,
    });
    expectCompletionMarkedProcessed(fixture);
  });

  it('awards Premium XP without changing streak or leaderboard', async () => {
    const fixture = createQueueProcessorFixture(
      buildCompletedSession({
        date: utcToday(),
        track: PublishTrack.PREMIUM,
      }),
    );

    await fixture.process();
    await fixture.destroy();

    expect(fixture.streakService.updateOnCompletion).not.toHaveBeenCalled();
    expect(fixture.xpService.awardXpForSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      streak: 0,
      attemptsCount: 2,
    });
    expect(fixture.leaderboardService.upsertCompletion).not.toHaveBeenCalled();
    expect(fixture.rewardOrchestrator.emitRewardApplied).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
    });
    expectCompletionMarkedProcessed(fixture);
  });

  it('keeps current DAILY leaderboard behavior for incorrect completions without XP or streak', async () => {
    const fixture = createQueueProcessorFixture(
      buildCompletedSession({
        date: utcToday(),
        track: PublishTrack.DAILY,
        result: 'wrong',
      }),
    );

    await fixture.process();
    await fixture.destroy();

    expect(fixture.streakService.updateOnCompletion).not.toHaveBeenCalled();
    expect(fixture.xpService.awardXpForSession).not.toHaveBeenCalled();
    expect(fixture.leaderboardService.upsertCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        dailyCaseId: 'daily-1',
        score: 0,
      }),
    );
    expect(fixture.rewardOrchestrator.emitRewardApplied).not.toHaveBeenCalled();
    expectCompletionMarkedProcessed(fixture);
  });

  it('does not duplicate side effects for an already processed completion', async () => {
    const fixture = createQueueProcessorFixture(null);
    fixture.prisma.gameSession.updateMany.mockReset();
    fixture.prisma.gameSession.updateMany.mockResolvedValue({ count: 0 });
    fixture.prisma.gameSession.findUnique.mockResolvedValue({
      userId: 'user-1',
      status: 'completed',
      processingAt: null,
      processedAt: new Date('2026-04-22T08:02:00.000Z'),
    });

    await fixture.process();
    await fixture.destroy();

    expect(fixture.streakService.updateOnCompletion).not.toHaveBeenCalled();
    expect(fixture.xpService.awardXpForSession).not.toHaveBeenCalled();
    expect(fixture.leaderboardService.upsertCompletion).not.toHaveBeenCalled();
    expect(fixture.rewardOrchestrator.emitRewardApplied).not.toHaveBeenCalled();
  });
});
