import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { FcmPushProvider } from './fcm-push.provider';

describe('FcmPushProvider', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    resetEnvCacheForTests();
  });

  it('uses no-op mode when push notifications are disabled', async () => {
    process.env = {
      ...originalEnv,
      PUSH_NOTIFICATIONS_ENABLED: 'false',
    };
    resetEnvCacheForTests();

    const provider = new FcmPushProvider();

    expect(provider.isConfigured()).toBe(false);
    await expect(
      provider.sendMulticast({
        tokens: ['token-1'],
        title: 'Title',
        body: 'Body',
        data: {
          notificationId: 'notification-1',
          type: 'system.push_test',
          category: 'SYSTEM',
          metadata: '{}',
        },
      }),
    ).resolves.toEqual({
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
    });
  });
});
