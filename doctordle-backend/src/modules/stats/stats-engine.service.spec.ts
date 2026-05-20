import { StatsEngineService } from './stats-engine.service';

describe('StatsEngineService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const progress = {
    xpTotal: 120,
    level: 2,
    xpCurrentLevel: 20,
    xpToNextLevel: 80,
    rank: 'Intern',
    currentStreak: 2,
    longestStreak: 4,
    bestStreak: 4,
  };

  function createService(sessions: unknown[]) {
    const prisma = {
      gameSession: {
        findMany: jest.fn().mockResolvedValue(sessions),
      },
      userProgress: {
        findUnique: jest.fn().mockResolvedValue({ xpTotal: progress.xpTotal }),
      },
      userStats: {
        findUnique: jest.fn().mockResolvedValue({
          currentStreak: progress.currentStreak,
          bestStreak: progress.bestStreak,
        }),
      },
    };
    const rankService = {
      getRank: jest.fn().mockReturnValue(progress.rank),
    };
    const xpService = {
      deriveLevelFromXpTotal: jest.fn().mockReturnValue({
        level: progress.level,
        xpCurrentLevel: progress.xpCurrentLevel,
        xpToNextLevel: progress.xpToNextLevel,
      }),
    };

    return {
      service: new StatsEngineService(
        prisma as never,
        rankService as never,
        xpService as never,
      ),
      prisma,
      rankService,
      xpService,
    };
  }

  function session(input: {
    startedAt?: string;
    completedAt?: string;
    results: string[];
    difficulty?: string;
    specialty?: string | null;
    bodySystem?: string | null;
    category?: string | null;
    diagnosisRegistry?: null;
  }) {
    return {
      startedAt: new Date(input.startedAt ?? '2026-05-01T10:00:00.000Z'),
      completedAt: new Date(input.completedAt ?? '2026-05-01T10:02:00.000Z'),
      case: {
        difficulty: input.difficulty ?? 'medium',
        diagnosisRegistry:
          input.diagnosisRegistry === null
            ? null
            : {
                specialty: input.specialty ?? 'Neurology',
                bodySystem: input.bodySystem ?? 'Nervous System',
                category: input.category ?? null,
              },
      },
      attempts: input.results.map((result, index) => ({
        result,
        clueIndexAtAttempt: index,
        createdAt: new Date(`2026-05-01T10:0${index}:00.000Z`),
      })),
    };
  }

  it('returns empty/null-safe stats when the user has no completed sessions', async () => {
    const { service } = createService([]);

    await expect(service.getUserStats('user-1')).resolves.toMatchObject({
      totals: {
        casesCompleted: 0,
        solved: 0,
        missed: 0,
        accuracyPct: null,
        averageAttempts: null,
        averageCluesUsed: null,
        averageTimeSecs: null,
      },
      progress: {
        xpTotal: 120,
        level: 2,
        rank: 'Intern',
        currentLevelXp: 20,
        currentStreak: 2,
        bestStreak: 4,
      },
      bySpecialty: [],
      byBodySystem: [],
      byDifficulty: [],
      weakAreas: [],
      recent: {
        lastPlayedAt: null,
        recentCompletedCases: 0,
        recentAccuracyPct: null,
      },
    });
  });

  it('calculates solved, missed, accuracy, attempts, clues, and time', async () => {
    const { service } = createService([
      session({
        results: ['wrong', 'correct'],
        completedAt: '2026-05-01T10:02:00.000Z',
      }),
      session({
        results: ['wrong', 'wrong', 'wrong'],
        completedAt: '2026-05-01T10:03:00.000Z',
      }),
    ]);

    const report = await service.getUserStats('user-1');

    expect(report.totals).toEqual({
      casesCompleted: 2,
      solved: 1,
      missed: 1,
      accuracyPct: 50,
      averageAttempts: 2.5,
      averageCluesUsed: 2.5,
      averageTimeSecs: 150,
    });
  });

  it('uses the latest attempt as the solved signal', async () => {
    const { service } = createService([
      session({
        results: ['wrong', 'correct', 'wrong'],
      }),
      session({
        results: ['wrong', 'wrong', 'correct'],
      }),
    ]);

    const report = await service.getUserStats('user-1');

    expect(report.totals).toEqual(
      expect.objectContaining({
        casesCompleted: 2,
        solved: 1,
        missed: 1,
        accuracyPct: 50,
      }),
    );
  });

  it('handles completed sessions with no attempts as missed cases', async () => {
    const { service } = createService([
      session({
        results: [],
      }),
    ]);

    const report = await service.getUserStats('user-1');

    expect(report.totals).toEqual(
      expect.objectContaining({
        casesCompleted: 1,
        solved: 0,
        missed: 1,
        accuracyPct: 0,
        averageAttempts: 0,
        averageCluesUsed: 0,
      }),
    );
  });

  it('groups performance by specialty, body system, and difficulty', async () => {
    const { service } = createService([
      session({
        results: ['correct'],
        specialty: 'Neurology',
        bodySystem: 'Nervous System',
        difficulty: 'easy',
      }),
      session({
        results: ['wrong'],
        specialty: 'Neurology',
        bodySystem: 'Nervous System',
        difficulty: 'easy',
      }),
      session({
        results: ['correct'],
        specialty: 'Cardiology',
        bodySystem: 'Cardiovascular',
        difficulty: 'hard',
      }),
    ]);

    const report = await service.getUserStats('user-1');

    expect(report.bySpecialty).toEqual([
      expect.objectContaining({
        key: 'neurology',
        label: 'Neurology',
        casesCompleted: 2,
        solved: 1,
        missed: 1,
        accuracyPct: 50,
      }),
      expect.objectContaining({
        key: 'cardiology',
        label: 'Cardiology',
        casesCompleted: 1,
        solved: 1,
        missed: 0,
        accuracyPct: 100,
      }),
    ]);
    expect(report.byBodySystem[0]).toEqual(
      expect.objectContaining({
        key: 'nervous-system',
        casesCompleted: 2,
      }),
    );
    expect(report.byDifficulty[0]).toEqual(
      expect.objectContaining({
        key: 'easy',
        casesCompleted: 2,
      }),
    );
  });

  it('falls back safely when diagnosis registry metadata is missing', async () => {
    const { service } = createService([
      session({
        results: ['correct'],
        diagnosisRegistry: null,
        difficulty: '',
      }),
    ]);

    const report = await service.getUserStats('user-1');

    expect(report.bySpecialty[0]).toEqual(
      expect.objectContaining({
        key: 'general',
        label: 'General',
      }),
    );
    expect(report.byBodySystem[0]).toEqual(
      expect.objectContaining({
        key: 'general',
        label: 'General',
      }),
    );
    expect(report.byDifficulty[0]).toEqual(
      expect.objectContaining({
        key: 'unknown',
        label: 'unknown',
      }),
    );
  });

  it('detects weak areas after enough completed cases', async () => {
    const { service } = createService([
      session({ results: ['wrong'], specialty: 'Neurology' }),
      session({ results: ['wrong'], specialty: 'Neurology' }),
      session({ results: ['correct'], specialty: 'Neurology' }),
      session({ results: ['correct'], specialty: 'Cardiology' }),
      session({ results: ['correct'], specialty: 'Cardiology' }),
      session({ results: ['correct'], specialty: 'Cardiology' }),
    ]);

    const report = await service.getUserStats('user-1');

    expect(report.weakAreas).toContainEqual(
      expect.objectContaining({
        type: 'specialty',
        key: 'neurology',
        priority: 'high',
        accuracyPct: 33,
      }),
    );
  });

  it('sorts weak areas by priority, accuracy, and case count', async () => {
    const { service } = createService([
      session({ results: ['wrong'], specialty: 'Cardiology' }),
      session({ results: ['wrong'], specialty: 'Cardiology' }),
      session({ results: ['wrong'], specialty: 'Cardiology' }),
      session({ results: ['wrong'], specialty: 'Neurology' }),
      session({ results: ['wrong'], specialty: 'Neurology' }),
      session({ results: ['correct'], specialty: 'Neurology' }),
      session({ results: ['wrong'], specialty: 'Endocrinology' }),
      session({ results: ['correct'], specialty: 'Endocrinology' }),
      session({ results: ['correct'], specialty: 'Endocrinology' }),
    ]);

    const report = await service.getUserStats('user-1');

    const specialtyWeakAreas = report.weakAreas.filter(
      (area) => area.type === 'specialty',
    );

    expect(specialtyWeakAreas.map((area) => area.key).slice(0, 2)).toEqual([
      'cardiology',
      'neurology',
    ]);
    expect(specialtyWeakAreas[0]).toEqual(
      expect.objectContaining({
        priority: 'high',
        accuracyPct: 0,
      }),
    );
  });

  it('clamps invalid negative durations to zero', async () => {
    const { service } = createService([
      session({
        startedAt: '2026-05-01T10:05:00.000Z',
        completedAt: '2026-05-01T10:00:00.000Z',
        results: ['correct'],
      }),
    ]);

    const report = await service.getUserStats('user-1');

    expect(report.totals.averageTimeSecs).toBe(0);
  });

  it('summarizes recent performance over the last 14 days', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-20T00:00:00.000Z').getTime());
    const { service } = createService([
      session({
        results: ['correct'],
        completedAt: '2026-05-19T00:00:00.000Z',
      }),
      session({
        results: ['wrong'],
        completedAt: '2026-05-18T00:00:00.000Z',
      }),
      session({
        results: ['correct'],
        completedAt: '2026-04-01T00:00:00.000Z',
      }),
    ]);

    const report = await service.getUserStats('user-1');

    expect(report.recent).toEqual({
      lastPlayedAt: '2026-05-19T00:00:00.000Z',
      recentCompletedCases: 2,
      recentAccuracyPct: 50,
    });
  });
});
