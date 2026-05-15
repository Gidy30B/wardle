import { PushDeviceTokensService } from './push-device-tokens.service';

describe('PushDeviceTokensService', () => {
  const now = new Date('2026-05-15T08:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService() {
    const tokenRow = {
      id: 'push-token-1',
      userId: 'user-1',
      token: 'ExponentPushToken[test]',
      platform: 'android',
      deviceId: 'device-1',
      appVersion: '1.0.0',
      lastSeenAt: now,
      disabledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const prisma = {
      pushDeviceToken: {
        upsert: jest.fn().mockResolvedValue(tokenRow),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    return {
      service: new PushDeviceTokensService(prisma as never),
      prisma,
      tokenRow,
    };
  }

  it('authenticated user can register token', async () => {
    const { service, prisma } = createService();

    await expect(
      service.registerForUser('user-1', {
        token: 'ExponentPushToken[test]',
        platform: 'android',
        deviceId: 'device-1',
        appVersion: '1.0.0',
      }),
    ).resolves.toMatchObject({
      token: {
        userId: 'user-1',
        token: 'ExponentPushToken[test]',
        platform: 'android',
        disabledAt: null,
      },
    });

    expect(prisma.pushDeviceToken.upsert).toHaveBeenCalledWith({
      where: {
        token: 'ExponentPushToken[test]',
      },
      create: expect.objectContaining({
        userId: 'user-1',
        token: 'ExponentPushToken[test]',
        platform: 'android',
        deviceId: 'device-1',
        appVersion: '1.0.0',
        lastSeenAt: now,
        disabledAt: null,
      }),
      update: expect.objectContaining({
        userId: 'user-1',
        platform: 'android',
        lastSeenAt: now,
        disabledAt: null,
      }),
    });
  });

  it('same token updates lastSeenAt and clears disabledAt', async () => {
    const { service, prisma } = createService();

    await service.registerForUser('user-1', {
      token: 'ExponentPushToken[test]',
      platform: 'ios',
    });

    expect(prisma.pushDeviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          userId: 'user-1',
          platform: 'ios',
          lastSeenAt: now,
          disabledAt: null,
        }),
      }),
    );
  });

  it('token cannot be deleted by another user', async () => {
    const { service, prisma } = createService();
    prisma.pushDeviceToken.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.disableForUser('other-user', 'ExponentPushToken[test]'),
    ).resolves.toEqual({
      disabled: false,
    });

    expect(prisma.pushDeviceToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'other-user',
        token: 'ExponentPushToken[test]',
        disabledAt: null,
      },
      data: {
        disabledAt: now,
      },
    });
  });

  it('delete disables token without hard-delete', async () => {
    const { service, prisma } = createService();

    await expect(
      service.disableForUser('user-1', 'ExponentPushToken[test]'),
    ).resolves.toEqual({
      disabled: true,
    });

    expect(prisma.pushDeviceToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        token: 'ExponentPushToken[test]',
        disabledAt: null,
      },
      data: {
        disabledAt: now,
      },
    });
    expect(prisma.pushDeviceToken.delete).toBeUndefined();
  });
});
