import { NotFoundException } from '@nestjs/common';
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

    return {
      service: new UsersService(prisma as never),
      prisma,
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
