import { NotificationSettingPreferenceKey } from './notification-settings.contract';
import { NotificationType } from './notification-type.constants';
import { NotificationCategory } from './notification.types';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService preference suppression', () => {
  function createService(preferencesByKey: Record<string, boolean> = {}) {
    const notification = {
      id: 'notification-1',
      userId: 'user-1',
      type: NotificationType.LearningExplanationReady,
      category: NotificationCategory.Learning,
      title: 'Title',
      body: 'Body',
      data: null,
      priority: 'normal',
      readAt: null,
      seenAt: null,
      createdAt: new Date('2026-05-14T09:00:00.000Z'),
      expiresAt: null,
      idempotencyKey: 'idempotency-1',
    };

    const prisma = {
      notificationPreference: {
        findUnique: jest.fn(({ where }) => {
          const key = where.userId_category.category;

          if (!(key in preferencesByKey)) {
            return Promise.resolve(null);
          }

          return Promise.resolve({
            inAppEnabled: preferencesByKey[key],
          });
        }),
      },
      notification: {
        create: jest.fn().mockResolvedValue(notification),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const preferences = new NotificationPreferencesService(prisma as never);

    return {
      service: new NotificationsService(prisma as never, preferences),
      prisma,
    };
  }

  function createServiceWithPushFailure() {
    const notification = {
      id: 'notification-1',
      userId: 'user-1',
      type: NotificationType.GameplayDailyCaseAvailable,
      category: NotificationCategory.Gameplay,
      title: 'Title',
      body: 'Body',
      data: null,
      priority: 'normal',
      readAt: null,
      seenAt: null,
      createdAt: new Date('2026-05-14T09:00:00.000Z'),
      expiresAt: null,
      idempotencyKey: 'idempotency-1',
    };
    const prisma = {
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      notification: {
        create: jest.fn().mockResolvedValue(notification),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const preferences = new NotificationPreferencesService(prisma as never);
    const pushNotifications = {
      sendForNotification: jest.fn().mockRejectedValue(new Error('FCM down')),
    };

    return {
      service: new NotificationsService(
        prisma as never,
        preferences,
        pushNotifications as never,
      ),
      pushNotifications,
    };
  }

  const baseInput = {
    userId: 'user-1',
    title: 'Title',
    body: 'Body',
    idempotencyKey: 'idempotency-1',
  };

  it('weeklyDigest=false suppresses learning.weekly_digest', async () => {
    const { service, prisma } = createService({
      [NotificationSettingPreferenceKey.WeeklyDigest]: false,
    });

    await expect(
      service.createIfEnabled({
        ...baseInput,
        type: NotificationType.LearningWeeklyDigest,
        category: NotificationCategory.Learning,
      }),
    ).resolves.toEqual({
      created: false,
      reason: 'preference_disabled',
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('weeklyDigest=false does not suppress learning.explanation_ready', async () => {
    const { service, prisma } = createService({
      [NotificationSettingPreferenceKey.WeeklyDigest]: false,
    });

    await expect(
      service.createIfEnabled({
        ...baseInput,
        type: NotificationType.LearningExplanationReady,
        category: NotificationCategory.Learning,
      }),
    ).resolves.toMatchObject({ created: true });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('raw LEARNING=false still suppresses learning.explanation_ready', async () => {
    const { service, prisma } = createService({
      [NotificationCategory.Learning]: false,
    });

    await expect(
      service.createIfEnabled({
        ...baseInput,
        type: NotificationType.LearningExplanationReady,
        category: NotificationCategory.Learning,
      }),
    ).resolves.toEqual({
      created: false,
      reason: 'preference_disabled',
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('streakReminders=false suppresses streak notifications', async () => {
    const { service, prisma } = createService({
      [NotificationSettingPreferenceKey.StreakReminders]: false,
    });

    for (const type of [
      NotificationType.StreakReminder,
      NotificationType.StreakMilestone,
    ]) {
      await expect(
        service.createIfEnabled({
          ...baseInput,
          type,
          category: NotificationCategory.Streak,
        }),
      ).resolves.toMatchObject({ created: false });
    }

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('challengeAlerts=false suppresses gameplay and leaderboard notifications', async () => {
    const { service, prisma } = createService({
      [NotificationSettingPreferenceKey.ChallengeAlerts]: false,
    });

    for (const input of [
      {
        type: NotificationType.GameplayDailyCaseAvailable,
        category: NotificationCategory.Gameplay,
      },
      {
        type: NotificationType.LeaderboardRankChanged,
        category: NotificationCategory.Leaderboard,
      },
      {
        type: NotificationType.LeaderboardWeeklySummary,
        category: NotificationCategory.Leaderboard,
      },
    ]) {
      await expect(
        service.createIfEnabled({
          ...baseInput,
          ...input,
        }),
      ).resolves.toMatchObject({ created: false });
    }

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('productAnnouncements=false suppresses content.product_announcement', async () => {
    const { service, prisma } = createService({
      [NotificationSettingPreferenceKey.ProductAnnouncements]: false,
    });

    await expect(
      service.createIfEnabled({
        ...baseInput,
        type: NotificationType.ContentProductAnnouncement,
        category: NotificationCategory.Content,
      }),
    ).resolves.toMatchObject({ created: false });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('reward.xp_awarded still works by default', async () => {
    const { service, prisma } = createService();

    await expect(
      service.createIfEnabled({
        ...baseInput,
        type: NotificationType.RewardXpAwarded,
        category: NotificationCategory.Reward,
      }),
    ).resolves.toMatchObject({ created: true });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('queued notification creation writes recipient userId, type, and category', async () => {
    const { service, prisma } = createService();

    await service.createIfEnabled({
      userId: 'user-2',
      type: NotificationType.GameplayDailyCaseAvailable,
      category: NotificationCategory.Gameplay,
      title: 'Daily case available',
      body: 'A new Wardle case is ready to play',
      data: {
        dailyCaseId: 'daily-case-1',
      },
      idempotencyKey: 'gameplay.daily_case_available:daily-case-1:user-2',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-2',
        type: NotificationType.GameplayDailyCaseAvailable,
        category: NotificationCategory.Gameplay,
        idempotencyKey: 'gameplay.daily_case_available:daily-case-1:user-2',
      }),
    });
  });

  it('prevents duplicate sends when idempotency already exists', async () => {
    const { service, prisma } = createService();
    const existing = {
      id: 'notification-existing',
      userId: 'user-1',
      type: NotificationType.StreakReminder,
      category: NotificationCategory.Streak,
      title: 'Keep your streak alive',
      body: "Complete today's case before your streak resets",
      data: null,
      priority: 'normal',
      readAt: null,
      seenAt: null,
      createdAt: new Date('2026-05-14T09:00:00.000Z'),
      expiresAt: null,
      idempotencyKey: 'streak.reminder:2026-05-14:user-1',
    };
    prisma.notification.create.mockRejectedValueOnce({
      code: 'P2002',
    });
    prisma.notification.findUnique.mockResolvedValueOnce(existing);

    await expect(
      service.createIfEnabled({
        ...baseInput,
        type: NotificationType.StreakReminder,
        category: NotificationCategory.Streak,
        idempotencyKey: existing.idempotencyKey,
      }),
    ).resolves.toEqual({
      created: false,
      reason: 'duplicate',
      notification: existing,
    });
  });

  it('still succeeds when push sending fails after notification creation', async () => {
    const { service, pushNotifications } = createServiceWithPushFailure();

    await expect(
      service.createIfEnabled({
        ...baseInput,
        type: NotificationType.GameplayDailyCaseAvailable,
        category: NotificationCategory.Gameplay,
      }),
    ).resolves.toMatchObject({
      created: true,
      notification: {
        id: 'notification-1',
      },
    });
    expect(pushNotifications.sendForNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'notification-1',
      }),
    );
  });
});
