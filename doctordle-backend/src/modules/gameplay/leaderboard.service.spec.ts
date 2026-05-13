import { LeaderboardService } from './leaderboard.service';

const user = {
  displayName: null,
  stats: null,
  organizations: [],
};

function createLeaderboardServiceFixture() {
  const prisma = {
    dailyCase: {
      create: jest.fn(),
      createMany: jest.fn(),
      upsert: jest.fn(),
    },
    leaderboardEntry: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    gameSession: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        caseId: 'case-1',
        dailyCaseId: 'daily-1',
        status: 'completed',
        dailyCase: {
          caseId: 'case-1',
        },
      }),
    },
  };
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    deleteByPrefix: jest.fn().mockResolvedValue(0),
  };
  const logger = {
    info: jest.fn(),
  };
  const metrics = {
    increment: jest.fn(),
  };
  const dailyCasesService = {
    findDailyCaseForDate: jest.fn().mockResolvedValue({ id: 'daily-1' }),
  };

  return {
    prisma,
    cache,
    logger,
    metrics,
    dailyCasesService,
    service: new LeaderboardService(
      prisma as never,
      cache as never,
      logger as never,
      metrics as never,
      dailyCasesService as never,
    ),
  };
}

describe('LeaderboardService timing tie-breakers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('orders daily entries by faster time before completedAt and returns timeToComplete', async () => {
    const fixture = createLeaderboardServiceFixture();
    fixture.prisma.leaderboardEntry.findMany.mockResolvedValue([
      {
        userId: 'fast',
        score: 200,
        attemptsCount: 2,
        timeToComplete: 102,
        completedAt: new Date('2026-04-22T09:05:00.000Z'),
        user,
      },
      {
        userId: 'slow',
        score: 200,
        attemptsCount: 2,
        timeToComplete: 160,
        completedAt: new Date('2026-04-22T09:00:00.000Z'),
        user,
      },
      {
        userId: 'unknown',
        score: 200,
        attemptsCount: 2,
        timeToComplete: null,
        completedAt: new Date('2026-04-22T08:00:00.000Z'),
        user,
      },
    ]);

    const result = await fixture.service.getToday(10);

    expect(fixture.dailyCasesService.findDailyCaseForDate).toHaveBeenCalledWith(
      expect.objectContaining({
        track: 'DAILY',
        sequenceIndex: 1,
      }),
    );
    expect(fixture.prisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dailyCaseId: 'daily-1' },
        orderBy: [
          { score: 'desc' },
          { attemptsCount: 'asc' },
          { timeToComplete: { sort: 'asc', nulls: 'last' } },
          { completedAt: 'asc' },
        ],
      }),
    );
    expect(result.map((entry) => entry.userId)).toEqual([
      'fast',
      'slow',
      'unknown',
    ]);
    expect(result[0].timeToComplete).toBe(102);
  });

  it('/leaderboard/today returns an empty response without creating a DailyCase when missing', async () => {
    const fixture = createLeaderboardServiceFixture();
    fixture.dailyCasesService.findDailyCaseForDate.mockResolvedValue(null);

    const result = await fixture.service.getToday(10);

    expect(result).toEqual([]);
    expect(fixture.prisma.leaderboardEntry.findMany).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.create).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.createMany).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.upsert).not.toHaveBeenCalled();
  });

  it('counts real completion times as better than null times for daily rank', async () => {
    const fixture = createLeaderboardServiceFixture();
    fixture.prisma.leaderboardEntry.findUnique.mockResolvedValue({
      userId: 'unknown',
      score: 200,
      attemptsCount: 2,
      timeToComplete: null,
      completedAt: new Date('2026-04-22T08:00:00.000Z'),
      user,
    });
    fixture.prisma.leaderboardEntry.count.mockResolvedValue(1);

    await fixture.service.getUserPosition({
      userId: 'unknown',
      mode: 'daily',
    });

    expect(fixture.dailyCasesService.findDailyCaseForDate).toHaveBeenCalledWith(
      expect.objectContaining({
        track: 'DAILY',
        sequenceIndex: 1,
      }),
    );
    expect(fixture.prisma.leaderboardEntry.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              score: 200,
              attemptsCount: 2,
              timeToComplete: { not: null },
            }),
          ]),
        }),
      }),
    );
  });

  it('/leaderboard/me?mode=daily returns null without creating a DailyCase when missing', async () => {
    const fixture = createLeaderboardServiceFixture();
    fixture.dailyCasesService.findDailyCaseForDate.mockResolvedValue(null);

    const result = await fixture.service.getUserPosition({
      userId: 'unknown',
      mode: 'daily',
    });

    expect(result).toBeNull();
    expect(fixture.prisma.leaderboardEntry.findUnique).not.toHaveBeenCalled();
    expect(fixture.prisma.leaderboardEntry.count).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.create).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.createMany).not.toHaveBeenCalled();
    expect(fixture.prisma.dailyCase.upsert).not.toHaveBeenCalled();
  });

  it('creates leaderboard completions only when the session matches the assigned DailyCase', async () => {
    const fixture = createLeaderboardServiceFixture();
    fixture.prisma.leaderboardEntry.findUnique.mockResolvedValue(null);

    await fixture.service.upsertCompletion({
      sessionId: 'session-1',
      userId: 'user-1',
      caseId: 'case-1',
      dailyCaseId: 'daily-1',
      score: 200,
      attemptsCount: 2,
      completedAt: new Date('2026-04-22T09:00:00.000Z'),
      timeToComplete: 60,
    });

    expect(fixture.prisma.gameSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
      }),
    );
    expect(fixture.prisma.leaderboardEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          dailyCaseId: 'daily-1',
        }),
      }),
    );
  });

  it('rejects leaderboard completions when the session case differs from the DailyCase case', async () => {
    const fixture = createLeaderboardServiceFixture();
    fixture.prisma.gameSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      caseId: 'case-old',
      dailyCaseId: 'daily-1',
      status: 'completed',
      dailyCase: {
        caseId: 'case-1',
      },
    });

    await expect(
      fixture.service.upsertCompletion({
        sessionId: 'session-1',
        userId: 'user-1',
        caseId: 'case-old',
        dailyCaseId: 'daily-1',
        score: 200,
        attemptsCount: 2,
        completedAt: new Date('2026-04-22T09:00:00.000Z'),
        timeToComplete: 60,
      }),
    ).rejects.toThrow(
      'Leaderboard completion case does not match the assigned daily case',
    );

    expect(fixture.prisma.leaderboardEntry.create).not.toHaveBeenCalled();
    expect(fixture.prisma.leaderboardEntry.update).not.toHaveBeenCalled();
  });

  it('sorts weekly ties by cases completed, attempts, then total time', async () => {
    const fixture = createLeaderboardServiceFixture();
    fixture.prisma.leaderboardEntry.findMany.mockResolvedValue([
      {
        userId: 'two-fast',
        score: 100,
        attemptsCount: 1,
        timeToComplete: 60,
        completedAt: new Date('2026-04-22T09:00:00.000Z'),
        user,
      },
      {
        userId: 'two-fast',
        score: 100,
        attemptsCount: 1,
        timeToComplete: 50,
        completedAt: new Date('2026-04-23T09:00:00.000Z'),
        user,
      },
      {
        userId: 'two-slow',
        score: 100,
        attemptsCount: 1,
        timeToComplete: 80,
        completedAt: new Date('2026-04-22T08:00:00.000Z'),
        user,
      },
      {
        userId: 'two-slow',
        score: 100,
        attemptsCount: 1,
        timeToComplete: 70,
        completedAt: new Date('2026-04-23T08:00:00.000Z'),
        user,
      },
      {
        userId: 'one',
        score: 200,
        attemptsCount: 1,
        timeToComplete: 40,
        completedAt: new Date('2026-04-24T08:00:00.000Z'),
        user,
      },
    ]);

    const result = await fixture.service.getWeekly(10);

    expect(result.map((entry) => entry.userId)).toEqual([
      'two-fast',
      'two-slow',
      'one',
    ]);
    expect(result[0].casesCompleted).toBe(2);
    expect(result[0].totalTimeToComplete).toBe(110);
  });
});
