import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserOnboardingStatus } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService settings', () => {
  const user = { id: 'user-1' };
  const defaultSettings = {
    showTimer: true,
    hintsEnabled: true,
    autocompleteEnabled: true,
    difficultyPreference: 'STANDARD',
    spacedRepetitionEnabled: false,
    createdAt: new Date('2026-04-29T10:00:00.000Z'),
    updatedAt: new Date('2026-04-29T10:00:00.000Z'),
  };

  function createService(userResult: { id: string } | null = user) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(userResult),
      },
      userSettings: {
        upsert: jest.fn().mockResolvedValue(defaultSettings),
      },
    };
    const cache = {
      deleteByPrefix: jest.fn().mockResolvedValue(0),
    };

    return {
      service: new UsersService(prisma as never, cache as never),
      prisma,
      cache,
    };
  }

  it('creates default settings on first read', async () => {
    const { service, prisma } = createService();

    await expect(service.getMySettings(user.id)).resolves.toEqual(defaultSettings);

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
  });

  it('persists only provided settings fields', async () => {
    const { service, prisma } = createService();

    await service.updateMySettings(user.id, {
      showTimer: false,
      difficultyPreference: 'HARD',
    });

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
      where: { userId: user.id },
      update: {
        showTimer: false,
        difficultyPreference: 'HARD',
      },
      create: {
        userId: user.id,
        showTimer: false,
        hintsEnabled: undefined,
        autocompleteEnabled: undefined,
        difficultyPreference: 'HARD',
        spacedRepetitionEnabled: undefined,
      },
    });
  });

  it('fails when the authenticated user no longer exists', async () => {
    const { service } = createService(null);

    await expect(service.getMySettings(user.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService onboarding', () => {
  const profileUser = {
    id: 'user-1',
    clerkId: 'clerk-1',
    email: 'ada@example.com',
    username: 'Ada Lovelace',
    normalizedUsername: 'ada lovelace',
    trainingLevel: null,
    country: null,
    individualMode: false,
    onboardingStatus: UserOnboardingStatus.ORGANIZATION_REQUIRED,
    onboardingCompletedAt: null,
    primaryOrganizationId: null,
    role: 'user',
    primaryOrganization: null,
    organizations: [],
  };

  function createService(prismaOverrides: Record<string, unknown> = {}) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(profileUser),
        update: jest.fn().mockResolvedValue(profileUser),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          username: 'Ada Lovelace',
          individualMode: false,
          primaryOrganizationId: null,
          onboardingCompletedAt: null,
        }),
      },
      organization: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'org-1' }),
      },
      userOrganization: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
      ...prismaOverrides,
    };
    const cache = {
      deleteByPrefix: jest.fn().mockResolvedValue(0),
    };

    return {
      service: new UsersService(prisma as never, cache as never),
      prisma,
      cache,
    };
  }

  it('saves profile and moves the user to organization choice', async () => {
    const { service, prisma, cache } = createService();

    await service.saveOnboardingProfile('user-1', {
      username: 'Ada Lovelace',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { normalizedUsername: 'ada lovelace' },
      select: { id: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        username: 'Ada Lovelace',
        normalizedUsername: 'ada lovelace',
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        individualMode: false,
        onboardingStatus: UserOnboardingStatus.ORGANIZATION_REQUIRED,
        onboardingCompletedAt: null,
      },
    });
    expect(cache.deleteByPrefix).toHaveBeenCalledWith('leaderboard:daily:');
  });

  it('rejects usernames already claimed by another user', async () => {
    const { service, prisma } = createService({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'other-user' }),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    });

    await expect(
      service.saveOnboardingProfile('user-1', {
        username: 'Ada Lovelace',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects reserved usernames', async () => {
    const { service, prisma } = createService();

    await expect(
      service.saveOnboardingProfile('user-1', {
        username: 'Admin',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('completes onboarding as an individual without touching memberships', async () => {
    const { service, prisma } = createService({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ username: 'Ada Lovelace' })
          .mockResolvedValueOnce({
            ...profileUser,
            individualMode: true,
            onboardingStatus: UserOnboardingStatus.COMPLETE,
          }),
        update: jest.fn().mockResolvedValue({}),
      },
    });

    await service.completeOnboardingAsIndividual('user-1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        individualMode: true,
        primaryOrganizationId: null,
        onboardingStatus: UserOnboardingStatus.COMPLETE,
        onboardingCompletedAt: expect.any(Date),
      },
    });
  });

  it('sets a primary organization without suspending other memberships', async () => {
    const { service, prisma } = createService({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ username: 'Ada Lovelace' })
          .mockResolvedValueOnce({
            ...profileUser,
            individualMode: false,
            onboardingStatus: UserOnboardingStatus.COMPLETE,
            primaryOrganizationId: 'org-1',
          }),
        update: jest.fn().mockResolvedValue({}),
      },
    });

    await service.completeOnboardingWithOrganization('user-1', {
      organizationId: 'org-1',
    });

    expect(prisma.userOrganization.upsert).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: 'user-1',
          organizationId: 'org-1',
        },
      },
      create: {
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'MEMBER',
        status: 'ACTIVE',
      },
      update: {
        status: 'ACTIVE',
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        individualMode: false,
        primaryOrganizationId: 'org-1',
        onboardingStatus: UserOnboardingStatus.COMPLETE,
        onboardingCompletedAt: expect.any(Date),
      },
    });
    expect(prisma.userOrganization).not.toHaveProperty('updateMany');
  });
});
