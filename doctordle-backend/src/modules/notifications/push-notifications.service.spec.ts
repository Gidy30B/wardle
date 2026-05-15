import { NotificationCategory } from './notification.types';
import { PushNotificationsService } from './push-notifications.service';

describe('PushNotificationsService', () => {
  const now = new Date('2026-05-15T08:00:00.000Z');
  const notification = {
    id: 'notification-1',
    userId: 'user-1',
    type: 'gameplay.daily_case_available',
    category: NotificationCategory.Gameplay,
    title: 'Daily case available',
    body: 'A new Wardle case is ready to play',
    data: {
      dailyCaseId: 'daily-case-1',
    },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService(input: {
    pushEnabled?: boolean;
    tokens?: string[];
    providerError?: Error;
    invalidTokens?: string[];
  } = {}) {
    const prisma = {
      pushDeviceToken: {
        findMany: jest.fn().mockResolvedValue(
          (input.tokens ?? ['token-1']).map((token) => ({
            token,
          })),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const preferences = {
      isPushEnabled: jest.fn().mockResolvedValue(input.pushEnabled ?? true),
    };
    const provider = {
      sendMulticast: input.providerError
        ? jest.fn().mockRejectedValue(input.providerError)
        : jest.fn().mockResolvedValue({
            successCount: 1,
            failureCount: input.invalidTokens?.length ?? 0,
            invalidTokens: input.invalidTokens ?? [],
          }),
    };

    return {
      service: new PushNotificationsService(
        prisma as never,
        preferences as never,
        provider as never,
      ),
      prisma,
      preferences,
      provider,
    };
  }

  it('does not send when category push preference is off', async () => {
    const { service, prisma, provider } = createService({
      pushEnabled: false,
    });

    await expect(service.sendForNotification(notification)).resolves.toEqual({
      sent: false,
      reason: 'preference_disabled',
    });

    expect(prisma.pushDeviceToken.findMany).not.toHaveBeenCalled();
    expect(provider.sendMulticast).not.toHaveBeenCalled();
  });

  it('does not send when there are no active tokens', async () => {
    const { service, provider } = createService({
      tokens: [],
    });

    await expect(service.sendForNotification(notification)).resolves.toEqual({
      sent: false,
      reason: 'no_active_tokens',
    });

    expect(provider.sendMulticast).not.toHaveBeenCalled();
  });

  it('sends to active tokens with notification metadata', async () => {
    const { service, prisma, provider } = createService({
      tokens: ['token-1', 'token-2'],
    });

    await expect(service.sendForNotification(notification)).resolves.toEqual({
      sent: true,
      successCount: 1,
      failureCount: 0,
      invalidTokenCount: 0,
    });

    expect(prisma.pushDeviceToken.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        disabledAt: null,
      },
      select: {
        token: true,
      },
    });
    expect(provider.sendMulticast).toHaveBeenCalledWith({
      tokens: ['token-1', 'token-2'],
      title: notification.title,
      body: notification.body,
      data: {
        notificationId: notification.id,
        type: notification.type,
        category: notification.category,
        metadata: JSON.stringify(notification.data),
      },
    });
  });

  it('soft-disables invalid tokens reported by FCM', async () => {
    const { service, prisma } = createService({
      tokens: ['token-1', 'token-2'],
      invalidTokens: ['token-2'],
    });

    await service.sendForNotification(notification);

    expect(prisma.pushDeviceToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        token: {
          in: ['token-2'],
        },
        disabledAt: null,
      },
      data: {
        disabledAt: now,
      },
    });
  });

  it('absorbs provider errors', async () => {
    const { service } = createService({
      providerError: new Error('FCM down'),
    });

    await expect(service.sendForNotification(notification)).resolves.toEqual({
      sent: false,
      reason: 'provider_error',
    });
  });
});
