import { NotificationCampaignService } from './notification-campaign.service';
import { NotificationType } from './notification-type.constants';
import { NotificationCategory } from './notification.types';

describe('NotificationCampaignService', () => {
  type MockPrisma = {
    dailyCase: {
      findFirst: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
    };
    gameSession: {
      groupBy: jest.Mock;
    };
  };

  type MockProducer = {
    enqueueDailyCaseAvailable: jest.Mock;
    enqueueStreakReminder: jest.Mock;
    enqueueLearningWeeklyDigest: jest.Mock;
  };

  type MockPreferences = {
    isNotificationEnabled: jest.Mock;
  };

  function createService(enabledByUserId: Record<string, boolean> = {}) {
    const prisma: MockPrisma = {
      dailyCase: {
        findFirst: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      gameSession: {
        groupBy: jest.fn(),
      },
    };
    const producer: MockProducer = {
      enqueueDailyCaseAvailable: jest.fn().mockResolvedValue(undefined),
      enqueueStreakReminder: jest.fn().mockResolvedValue(undefined),
      enqueueLearningWeeklyDigest: jest.fn().mockResolvedValue(undefined),
    };
    const preferences: MockPreferences = {
      isNotificationEnabled: jest.fn(({ userId }) =>
        Promise.resolve(enabledByUserId[userId] ?? true),
      ),
    };

    return {
      service: new NotificationCampaignService(
        prisma as never,
        producer as never,
        preferences as never,
      ),
      prisma,
      producer,
      preferences,
    };
  }

  it('enqueues daily case alerts for users who have not started the daily case', async () => {
    const { service, prisma, producer } = createService();
    prisma.dailyCase.findFirst.mockResolvedValue({ id: 'daily-case-1' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
    ]);

    await expect(
      service.enqueueDailyCaseAlerts({
        date: '2026-05-14',
      }),
    ).resolves.toEqual({
      campaign: 'daily_case_alerts',
      date: '2026-05-14',
      dailyCaseId: 'daily-case-1',
      dryRun: false,
      consideredCount: 2,
      eligibleCount: 2,
      enqueuedCount: 2,
      skippedCount: 0,
    });

    expect(prisma.dailyCase.findFirst).toHaveBeenCalledWith({
      where: {
        date: new Date('2026-05-14T00:00:00.000Z'),
        track: 'DAILY',
        sequenceIndex: 1,
      },
      select: {
        id: true,
      },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessions: {
            none: {
              dailyCaseId: 'daily-case-1',
            },
          },
        }),
      }),
    );
    expect(producer.enqueueDailyCaseAvailable).toHaveBeenCalledWith({
      userId: 'user-1',
      dailyCaseId: 'daily-case-1',
      date: '2026-05-14',
    });
    expect(producer.enqueueDailyCaseAvailable).toHaveBeenCalledWith({
      userId: 'user-2',
      dailyCaseId: 'daily-case-1',
      date: '2026-05-14',
    });
  });

  it('dryRun=true returns considered/eligible/skipped counts without enqueueing daily alerts', async () => {
    const { service, prisma, producer, preferences } = createService({
      'user-2': false,
    });
    prisma.dailyCase.findFirst.mockResolvedValue({ id: 'daily-case-1' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
      { id: 'user-3' },
    ]);

    await expect(
      service.enqueueDailyCaseAlerts({
        date: '2026-05-14',
        dryRun: true,
      }),
    ).resolves.toEqual({
      campaign: 'daily_case_alerts',
      dryRun: true,
      date: '2026-05-14',
      dailyCaseId: 'daily-case-1',
      consideredCount: 3,
      eligibleCount: 2,
      enqueuedCount: 0,
      skippedCount: 1,
    });

    expect(preferences.isNotificationEnabled).toHaveBeenCalledWith({
      userId: 'user-2',
      type: NotificationType.GameplayDailyCaseAvailable,
      category: NotificationCategory.Gameplay,
    });
    expect(producer.enqueueDailyCaseAvailable).not.toHaveBeenCalled();
  });

  it('targetUserId dry run considers only that user and does not enqueue', async () => {
    const targetUserId = '56ccf133-8c55-4c77-adce-a29e232af449';
    const { service, prisma, producer } = createService();
    prisma.dailyCase.findFirst.mockResolvedValue({ id: 'daily-case-1' });
    prisma.user.findMany.mockResolvedValue([{ id: targetUserId }]);

    await expect(
      service.enqueueDailyCaseAlerts({
        date: '2026-05-14',
        dryRun: true,
        targetUserId,
      }),
    ).resolves.toEqual({
      campaign: 'daily_case_alerts',
      dryRun: true,
      date: '2026-05-14',
      dailyCaseId: 'daily-case-1',
      consideredCount: 1,
      eligibleCount: 1,
      enqueuedCount: 0,
      skippedCount: 0,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: targetUserId,
        }),
      }),
    );
    expect(producer.enqueueDailyCaseAvailable).not.toHaveBeenCalled();
  });

  it('opted-out targeted user is skipped', async () => {
    const targetUserId = '56ccf133-8c55-4c77-adce-a29e232af449';
    const { service, prisma, producer } = createService({
      [targetUserId]: false,
    });
    prisma.dailyCase.findFirst.mockResolvedValue({ id: 'daily-case-1' });
    prisma.user.findMany.mockResolvedValue([{ id: targetUserId }]);

    await expect(
      service.enqueueDailyCaseAlerts({
        date: '2026-05-14',
        targetUserId,
      }),
    ).resolves.toMatchObject({
      consideredCount: 1,
      eligibleCount: 0,
      enqueuedCount: 0,
      skippedCount: 1,
    });

    expect(producer.enqueueDailyCaseAvailable).not.toHaveBeenCalled();
  });

  it('opted-in targeted user is eligible', async () => {
    const targetUserId = '56ccf133-8c55-4c77-adce-a29e232af449';
    const { service, prisma } = createService({
      [targetUserId]: true,
    });
    prisma.dailyCase.findFirst.mockResolvedValue({ id: 'daily-case-1' });
    prisma.user.findMany.mockResolvedValue([{ id: targetUserId }]);

    await expect(
      service.enqueueDailyCaseAlerts({
        date: '2026-05-14',
        dryRun: true,
        targetUserId,
      }),
    ).resolves.toMatchObject({
      consideredCount: 1,
      eligibleCount: 1,
      enqueuedCount: 0,
      skippedCount: 0,
    });
  });

  it('dryRun=false enqueues only opted-in daily alert users', async () => {
    const { service, prisma, producer } = createService({
      'user-2': false,
    });
    prisma.dailyCase.findFirst.mockResolvedValue({ id: 'daily-case-1' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
    ]);

    await expect(
      service.enqueueDailyCaseAlerts({
        date: '2026-05-14',
      }),
    ).resolves.toMatchObject({
      consideredCount: 2,
      eligibleCount: 1,
      enqueuedCount: 1,
      skippedCount: 1,
    });

    expect(producer.enqueueDailyCaseAvailable).toHaveBeenCalledTimes(1);
    expect(producer.enqueueDailyCaseAvailable).toHaveBeenCalledWith({
      userId: 'user-1',
      dailyCaseId: 'daily-case-1',
      date: '2026-05-14',
    });
  });

  it('real run with targetUserId enqueues one job when eligible', async () => {
    const targetUserId = '56ccf133-8c55-4c77-adce-a29e232af449';
    const { service, prisma, producer } = createService();
    prisma.dailyCase.findFirst.mockResolvedValue({ id: 'daily-case-1' });
    prisma.user.findMany.mockResolvedValue([{ id: targetUserId }]);

    await expect(
      service.enqueueDailyCaseAlerts({
        date: '2026-05-14',
        targetUserId,
      }),
    ).resolves.toMatchObject({
      consideredCount: 1,
      eligibleCount: 1,
      enqueuedCount: 1,
      skippedCount: 0,
    });

    expect(producer.enqueueDailyCaseAvailable).toHaveBeenCalledTimes(1);
    expect(producer.enqueueDailyCaseAvailable).toHaveBeenCalledWith({
      userId: targetUserId,
      dailyCaseId: 'daily-case-1',
      date: '2026-05-14',
    });
  });

  it('returns without enqueueing daily alerts when no daily case exists', async () => {
    const { service, prisma, producer } = createService();
    prisma.dailyCase.findFirst.mockResolvedValue(null);

    await expect(
      service.enqueueDailyCaseAlerts({
        date: '2026-05-14',
      }),
    ).resolves.toMatchObject({
      campaign: 'daily_case_alerts',
      dailyCaseId: null,
      consideredCount: 0,
      eligibleCount: 0,
      enqueuedCount: 0,
    });

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(producer.enqueueDailyCaseAvailable).not.toHaveBeenCalled();
  });

  it('enqueues streak reminders for users with an active streak who have not played today', async () => {
    const { service, prisma, producer } = createService();
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

    await expect(
      service.enqueueStreakReminders({
        date: '2026-05-14',
      }),
    ).resolves.toEqual({
      campaign: 'streak_reminders',
      dryRun: false,
      date: '2026-05-14',
      consideredCount: 1,
      eligibleCount: 1,
      enqueuedCount: 1,
      skippedCount: 0,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stats: {
            currentStreak: {
              gt: 0,
            },
            lastPlayedDate: new Date('2026-05-13T00:00:00.000Z'),
          },
          sessions: {
            none: {
              completedAt: {
                gte: new Date('2026-05-14T00:00:00.000Z'),
                lt: new Date('2026-05-15T00:00:00.000Z'),
              },
            },
          },
        }),
      }),
    );
    expect(producer.enqueueStreakReminder).toHaveBeenCalledWith({
      userId: 'user-1',
      reminderDate: '2026-05-14',
    });
  });

  it('respects limit when selecting streak reminder candidates', async () => {
    const { service, prisma } = createService();
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

    await service.enqueueStreakReminders({
      date: '2026-05-14',
      limit: 1,
      dryRun: true,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
      }),
    );
  });

  it('enqueues weekly digests for users with completed sessions in the window', async () => {
    const { service, prisma, producer } = createService();
    prisma.gameSession.groupBy.mockResolvedValue([
      {
        userId: 'user-1',
        _count: {
          _all: 4,
        },
      },
    ]);

    await expect(
      service.enqueueWeeklyDigest({
        weekStart: '2026-05-04',
        weekEnd: '2026-05-11',
      }),
    ).resolves.toEqual({
      campaign: 'weekly_digest',
      dryRun: false,
      weekStart: '2026-05-04',
      weekEnd: '2026-05-11',
      consideredCount: 1,
      eligibleCount: 1,
      enqueuedCount: 1,
      skippedCount: 0,
    });

    expect(prisma.gameSession.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['userId'],
        where: expect.objectContaining({
          status: 'completed',
          completedAt: {
            gte: new Date('2026-05-04T00:00:00.000Z'),
            lt: new Date('2026-05-11T00:00:00.000Z'),
          },
        }),
      }),
    );
    expect(producer.enqueueLearningWeeklyDigest).toHaveBeenCalledWith({
      userId: 'user-1',
      weekStart: '2026-05-04',
      reviewedCount: 4,
    });
  });

  it('missing preferences use safe defaults and keep users eligible', async () => {
    const { service, prisma, producer, preferences } = createService();
    prisma.gameSession.groupBy.mockResolvedValue([
      {
        userId: 'user-1',
        _count: {
          _all: 4,
        },
      },
    ]);

    await expect(
      service.enqueueWeeklyDigest({
        weekStart: '2026-05-04',
        weekEnd: '2026-05-11',
      }),
    ).resolves.toMatchObject({
      consideredCount: 1,
      eligibleCount: 1,
      enqueuedCount: 1,
      skippedCount: 0,
    });

    expect(preferences.isNotificationEnabled).toHaveBeenCalledWith({
      userId: 'user-1',
      type: NotificationType.LearningWeeklyDigest,
      category: NotificationCategory.Learning,
    });
    expect(producer.enqueueLearningWeeklyDigest).toHaveBeenCalledTimes(1);
  });
});
