import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DiagnosisEditorialOnboardingStatus,
  DifferentialResolutionStatus,
} from '@prisma/client';
import { DiagnosisEditorialOnboardingService } from './diagnosis-editorial-onboarding.service';

describe('DiagnosisEditorialOnboardingService', () => {
  function createFixture() {
    const prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      caseDifferentialMapping: {
        count: jest.fn(),
      },
      educationDifferentialMapping: {
        count: jest.fn(),
      },
    };

    return {
      prisma,
      service: new DiagnosisEditorialOnboardingService(prisma as never),
    };
  }

  function diagnosis(overrides: Record<string, unknown> = {}) {
    return {
      id: 'registry-1',
      canonicalName: 'rare mimic syndrome',
      displayLabel: 'Rare Mimic Syndrome',
      status: 'DRAFT',
      active: false,
      isPlayable: false,
      isGeneratable: false,
      onboardingStatus: DiagnosisEditorialOnboardingStatus.NEW,
      onboardingStartedAt: new Date('2026-06-01T12:00:00.000Z'),
      onboardingCompletedAt: null,
      education: null,
      editorialBrief: null,
      _count: {
        teachingRules: 0,
        cases: 0,
        graphFacts: 0,
        graphCandidates: 0,
      },
      ...overrides,
    };
  }

  it('reports missing components and recommended onboarding actions', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(diagnosis());
    prisma.caseDifferentialMapping.count.mockResolvedValue(1);
    prisma.educationDifferentialMapping.count.mockResolvedValue(1);

    const result = await service.getOnboarding('registry-1');

    expect(result.onboardingStatus).toBe(
      DiagnosisEditorialOnboardingStatus.NEW,
    );
    expect(result.progress.percent).toBe(0);
    expect(result.missingComponents).toEqual(
      expect.arrayContaining([
        'teaching_rules',
        'editorial_brief',
        'education',
        'cases',
        'graph',
        'unresolved_differentials',
      ]),
    );
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'seed-legacy-teaching-rules' }),
        expect.objectContaining({ id: 'generate-editorial-brief' }),
        expect.objectContaining({ id: 'generate-education-draft' }),
        expect.objectContaining({ id: 'generate-targeted-case' }),
        expect.objectContaining({ id: 'review-unresolved-differentials' }),
      ]),
    );
    expect(prisma.caseDifferentialMapping.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [
              DifferentialResolutionStatus.UNRESOLVED,
              DifferentialResolutionStatus.AMBIGUOUS,
            ],
          },
        }),
      }),
    );
  });

  it('marks a fully provisioned diagnosis ready for review', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      diagnosis({
        education: { id: 'education-1', editorialStatus: 'PUBLISHED' },
        editorialBrief: { id: 'brief-1', status: 'ACTIVE' },
        _count: {
          teachingRules: 3,
          cases: 1,
          graphFacts: 2,
          graphCandidates: 0,
        },
      }),
    );
    prisma.caseDifferentialMapping.count.mockResolvedValue(0);
    prisma.educationDifferentialMapping.count.mockResolvedValue(0);

    const result = await service.getOnboarding('registry-1');

    expect(result.readiness).toBe('ready_for_review');
    expect(result.progress.percent).toBe(100);
    expect(result.missingComponents).toEqual([]);
  });

  it('updates status through explicit senior actions only', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue({ id: 'registry-1' });
    prisma.diagnosisRegistry.update.mockResolvedValue({});
    prisma.caseDifferentialMapping.count.mockResolvedValue(0);
    prisma.educationDifferentialMapping.count.mockResolvedValue(0);
    prisma.diagnosisRegistry.findUnique
      .mockResolvedValueOnce({ id: 'registry-1' })
      .mockResolvedValueOnce(
        diagnosis({
          onboardingStatus:
            DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW,
        }),
      );

    await service.updateStatus('registry-1', 'mark_ready_for_review');

    expect(prisma.diagnosisRegistry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboardingStatus:
            DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW,
        }),
      }),
    );
  });

  it('rejects invalid status actions', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue({ id: 'registry-1' });

    await expect(
      service.updateStatus('registry-1', 'bad_action' as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the diagnosis registry entry is missing', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(null);

    await expect(service.getOnboarding('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('summarizes onboarding queues for editorial home', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistry.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);

    await expect(service.getSummary()).resolves.toEqual({
      newlyCreatedDiagnoses: 2,
      diagnosesMissingRules: 3,
      diagnosesMissingEducation: 4,
      readyForReviewDiagnoses: 1,
    });
  });
});
