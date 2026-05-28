import { UserOnboardingStatus } from '@prisma/client';
import { UserSyncService } from './user-sync.service';

describe('UserSyncService username identity', () => {
  function createService() {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'user-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          id: 'user-1',
          clerkId: 'clerk-1',
          email: 'ada@example.com',
          username: null,
          normalizedUsername: null,
          subscriptionTier: 'free',
          lastPlayedAt: null,
          role: 'user',
        },
      ]),
    };

    return {
      prisma,
      service: new UserSyncService(prisma as never),
    };
  }

  it('creates Google/OAuth users without deriving a username from Clerk data', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(null);

    await service.syncUser({
      clerkId: 'clerk-1',
      email: 'ada@example.com',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clerkId: 'clerk-1',
        email: 'ada@example.com',
        onboardingStatus: UserOnboardingStatus.PROFILE_REQUIRED,
      }),
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({
        username: expect.any(String),
      }),
    });
  });

  it('moves existing users with missing username back to profile required', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      clerkId: 'clerk-1',
      username: null,
    });

    await service.syncUser({
      clerkId: 'clerk-1',
      email: 'ada@example.com',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        email: 'ada@example.com',
        onboardingStatus: UserOnboardingStatus.PROFILE_REQUIRED,
        onboardingCompletedAt: null,
      },
    });
  });
});
