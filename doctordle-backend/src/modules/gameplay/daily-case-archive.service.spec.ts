import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CaseEditorialStatus, PublishTrack } from '@prisma/client';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service';
import { DailyCasesService, normalizeDailyDate } from './daily-cases.service';

function createService(prisma: any) {
  return new DailyCasesService(prisma, new CaseEligibilityPolicyService());
}

function dailyCase(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? 'daily-1',
    caseId: overrides.caseId ?? 'case-1',
    date: overrides.date ?? normalizeDailyDate('2026-08-10'),
    track: overrides.track ?? PublishTrack.DAILY,
    sequenceIndex: overrides.sequenceIndex ?? 1,
    case: {
      id: overrides.caseId ?? 'case-1',
      publicNumber: overrides.publicNumber ?? 61,
      difficulty: overrides.difficulty ?? 'STANDARD',
      editorialStatus:
        overrides.editorialStatus ?? CaseEditorialStatus.PUBLISHED,
    },
    sessions: overrides.sessions ?? [],
  };
}

describe('DailyCasesService archive', () => {
  it('returns released archive cases with user-specific status and no spoiler fields', async () => {
    const prisma = {
      user: {
        upsert: jest.fn().mockResolvedValue({ subscriptionTier: 'free' }),
      },
      dailyCase: {
        findMany: jest.fn().mockResolvedValue([
          dailyCase({ id: 'daily-unplayed', sessions: [] }),
          dailyCase({
            id: 'daily-active',
            sessions: [{ status: 'active', completedAt: null }],
          }),
          dailyCase({
            id: 'daily-completed',
            sessions: [
              {
                status: 'completed',
                completedAt: new Date('2026-08-10T08:05:00.000Z'),
              },
            ],
          }),
        ]),
      },
    };
    const service = createService(prisma);

    const result = await service.listArchiveForUser({
      userId: 'user-1',
      date: '2026-08-11T12:00:00.000Z',
    });

    expect(prisma.dailyCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: { lt: normalizeDailyDate('2026-08-11T12:00:00.000Z') },
          track: { in: [PublishTrack.DAILY] },
        }),
        select: expect.not.objectContaining({
          diagnosis: expect.anything(),
          explanation: expect.anything(),
          clues: expect.anything(),
          differentials: expect.anything(),
        }),
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        dailyCaseId: 'daily-unplayed',
        status: 'unplayed',
        completedAt: null,
      }),
      expect.objectContaining({
        dailyCaseId: 'daily-active',
        status: 'in_progress',
        completedAt: null,
      }),
      expect.objectContaining({
        dailyCaseId: 'daily-completed',
        status: 'completed',
        completedAt: '2026-08-10T08:05:00.000Z',
      }),
    ]);
    expect(JSON.stringify(result.items)).not.toContain('diagnosis');
    expect(JSON.stringify(result.items)).not.toContain('explanation');
  });

  it('does not let another user completion mark my archive item completed', async () => {
    const prisma = {
      user: {
        upsert: jest.fn().mockResolvedValue({ subscriptionTier: 'free' }),
      },
      dailyCase: {
        findMany: jest.fn().mockResolvedValue([
          dailyCase({ id: 'daily-1', sessions: [] }),
        ]),
      },
    };
    const service = createService(prisma);

    const result = await service.listArchiveForUser({ userId: 'user-1' });

    expect(prisma.dailyCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          sessions: expect.objectContaining({
            where: { userId: 'user-1' },
          }),
        }),
      }),
    );
    expect(result.items[0]).toMatchObject({ status: 'unplayed' });
  });

  it('blocks future DailyCase IDs from archive start', async () => {
    const prisma = {
      user: {
        upsert: jest.fn().mockResolvedValue({ subscriptionTier: 'free' }),
      },
      dailyCase: {
        findUnique: jest.fn().mockResolvedValue(
          dailyCase({
            id: 'future-daily',
            date: normalizeDailyDate('2026-08-12'),
          }),
        ),
      },
    };
    const service = createService(prisma);

    await expect(
      service.assertDailyCaseReleasedForUser({
        userId: 'user-1',
        dailyCaseId: 'future-daily',
        date: '2026-08-11T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks unplayable historical DailyCases from archive start', async () => {
    const prisma = {
      user: {
        upsert: jest.fn().mockResolvedValue({ subscriptionTier: 'free' }),
      },
      dailyCase: {
        findUnique: jest.fn().mockResolvedValue(
          dailyCase({
            id: 'draft-daily',
            editorialStatus: CaseEditorialStatus.DRAFT,
          }),
        ),
      },
    };
    const service = createService(prisma);

    await expect(
      service.assertDailyCaseReleasedForUser({
        userId: 'user-1',
        dailyCaseId: 'draft-daily',
        date: '2026-08-11T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks premium archive cases for free users', async () => {
    const prisma = {
      user: {
        upsert: jest.fn().mockResolvedValue({ subscriptionTier: 'free' }),
      },
      dailyCase: {
        findUnique: jest.fn().mockResolvedValue(
          dailyCase({
            id: 'premium-daily',
            track: PublishTrack.PREMIUM,
          }),
        ),
      },
    };
    const service = createService(prisma);

    await expect(
      service.assertDailyCaseReleasedForUser({
        userId: 'user-1',
        dailyCaseId: 'premium-daily',
        date: '2026-08-11T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
