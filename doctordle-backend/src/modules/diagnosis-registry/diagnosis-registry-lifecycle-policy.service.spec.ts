import { BadRequestException } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphFactStatus,
  DiagnosisRegistryStatus,
} from '@prisma/client';
import { DiagnosisRegistryLifecyclePolicyService } from './diagnosis-registry-lifecycle-policy.service';

function buildRegistry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'registry-1',
    canonicalName: 'Asthma',
    canonicalNormalized: 'asthma',
    displayLabel: 'Asthma',
    status: DiagnosisRegistryStatus.DRAFT,
    active: false,
    isPlayable: false,
    isGeneratable: false,
    onboardingStatus: DiagnosisEditorialOnboardingStatus.COMPLETE,
    specialty: 'Pulmonology',
    category: 'Obstructive',
    bodySystem: 'Respiratory',
    difficultyBand: 'BASIC',
    isDescriptive: false,
    isCompositional: false,
    activationReviewedByUserId: null,
    activationReviewedAt: null,
    education: {
      id: 'education-1',
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    editorialBrief: {
      id: 'brief-1',
      status: 'APPROVED',
    },
    teachingRules: [
      {
        id: 'rule-1',
        status: 'APPROVED',
        appliesToCaseGeneration: true,
      },
    ],
    cases: [
      {
        id: 'case-1',
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        publishedAt: null,
        currentRevisionId: 'revision-1',
      },
    ],
    graphFacts: [{ id: 'fact-1' }],
    ...overrides,
  };
}

function buildPrisma(registry = buildRegistry(), counts: number[] = [0, 0, 0, 0, 0]) {
  return {
    diagnosisRegistry: {
      findUnique: jest.fn().mockResolvedValue(registry),
      update: jest.fn().mockResolvedValue({
        id: 'registry-1',
        status: DiagnosisRegistryStatus.ACTIVE,
        active: true,
        isPlayable: true,
        isGeneratable: true,
        onboardingStatus: DiagnosisEditorialOnboardingStatus.COMPLETE,
        activationReviewedByUserId: 'senior-1',
        activationReviewedAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
      count: jest.fn().mockResolvedValue(counts[0]),
    },
    diagnosisAlias: {
      count: jest.fn().mockResolvedValue(counts[1]),
    },
    diagnosisRegistryCandidate: {
      count: jest.fn().mockResolvedValue(counts[2]),
    },
    caseDifferentialMapping: {
      count: jest.fn().mockResolvedValue(counts[3]),
    },
    educationDifferentialMapping: {
      count: jest.fn().mockResolvedValue(counts[4]),
    },
  };
}

describe('DiagnosisRegistryLifecyclePolicyService', () => {
  it('allows activation when governance assets are ready', async () => {
    const prisma = buildPrisma();
    const service = new DiagnosisRegistryLifecyclePolicyService(prisma as never);

    const result = await service.getLifecycle('registry-1');

    expect(result.readiness.activation.allowed).toBe(true);
    expect(result.readiness.dictionaryActivation.allowed).toBe(true);
    expect(result.readiness.playability.allowed).toBe(false);
    expect(result.visibility.dictionaryVisible).toBe(false);
    expect(prisma.diagnosisRegistry.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'registry-1' },
      }),
    );
  });

  it('returns blockers for incomplete onboarding and duplicate risk', async () => {
    const prisma = buildPrisma(
      buildRegistry({
        onboardingStatus: DiagnosisEditorialOnboardingStatus.BRIEF_STARTED,
        education: null,
      }),
      [1, 1, 1, 0, 0],
    );
    const service = new DiagnosisRegistryLifecyclePolicyService(prisma as never);

    const result = await service.getLifecycle('registry-1');

    expect(result.readiness.activation.allowed).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        'Editorial onboarding is not complete',
        'Duplicate registry risk is unresolved',
        'Pending registry candidate conflict is unresolved',
        'No approved or published education exists',
      ]),
    );
    expect(result.duplicateRisk).toEqual({
      registryCanonicalMatches: 1,
      registryAliasMatches: 1,
      pendingCandidateConflicts: 1,
    });
  });

  it('marks active playable registry entries as generatable-ready', async () => {
    const prisma = buildPrisma(
      buildRegistry({
        status: DiagnosisRegistryStatus.ACTIVE,
        active: true,
        isPlayable: true,
      }),
    );
    const service = new DiagnosisRegistryLifecyclePolicyService(prisma as never);

    const result = await service.getLifecycle('registry-1');

    expect(result.readiness.generatability.allowed).toBe(true);
    expect(result.visibility.playable).toBe(true);
    expect(result.visibility.generatable).toBe(false);
  });

  it('blocks lifecycle actions when readiness has blockers', async () => {
    const prisma = buildPrisma(
      buildRegistry({
        onboardingStatus: DiagnosisEditorialOnboardingStatus.NEW,
      }),
    );
    const service = new DiagnosisRegistryLifecyclePolicyService(prisma as never);

    await expect(
      service.performAction({
        diagnosisRegistryId: 'registry-1',
        reviewerUserId: 'senior-1',
        action: 'activate',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.diagnosisRegistry.update).not.toHaveBeenCalled();
  });

  it('updates activation metadata when activation is allowed', async () => {
    const prisma = buildPrisma();
    const service = new DiagnosisRegistryLifecyclePolicyService(prisma as never);

    await service.performAction({
      diagnosisRegistryId: 'registry-1',
      reviewerUserId: 'senior-1',
      action: 'activate',
    });

    expect(prisma.diagnosisRegistry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'registry-1' },
        data: expect.objectContaining({
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          activationReviewedByUser: { connect: { id: 'senior-1' } },
          activationReviewedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('activates a metadata-ready draft for dictionary visibility without full governance readiness', async () => {
    const prisma = buildPrisma(
      buildRegistry({
        onboardingStatus: DiagnosisEditorialOnboardingStatus.NEW,
        education: null,
        editorialBrief: null,
        teachingRules: [],
        cases: [],
      }),
    );
    const service = new DiagnosisRegistryLifecyclePolicyService(prisma as never);

    const result = await service.performAction({
      diagnosisRegistryId: 'registry-1',
      reviewerUserId: 'senior-1',
      action: 'activate_for_dictionary',
      isGeneratable: true,
    });

    expect(prisma.diagnosisRegistry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          isPlayable: true,
          isGeneratable: true,
          onboardingStatus: DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW,
          activationReviewedByUser: { connect: { id: 'senior-1' } },
          activationReviewedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.activationTelemetry).toMatchObject({
      before: {
        status: DiagnosisRegistryStatus.DRAFT,
        active: false,
        isPlayable: false,
        isGeneratable: false,
      },
      after: {
        status: DiagnosisRegistryStatus.ACTIVE,
        active: true,
      },
      dictionaryVisible: true,
      playable: true,
      cacheInvalidated: true,
      activatedByUserId: 'senior-1',
      activatedAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('blocks dictionary activation when required metadata is missing', async () => {
    const prisma = buildPrisma(
      buildRegistry({
        specialty: null,
        category: null,
        bodySystem: null,
      }),
    );
    const service = new DiagnosisRegistryLifecyclePolicyService(prisma as never);

    await expect(
      service.performAction({
        diagnosisRegistryId: 'registry-1',
        reviewerUserId: 'senior-1',
        action: 'activate_for_dictionary',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.diagnosisRegistry.update).not.toHaveBeenCalled();
  });

  it('blocks dictionary activation for descriptive or compositional rows', async () => {
    const prisma = buildPrisma(
      buildRegistry({
        isCompositional: true,
      }),
    );
    const service = new DiagnosisRegistryLifecyclePolicyService(prisma as never);

    const result = await service.getLifecycle('registry-1');

    expect(result.readiness.dictionaryActivation.allowed).toBe(false);
    expect(result.readiness.dictionaryActivation.blockers).toContain(
      'Descriptive or compositional entries require manual safety review before dictionary activation',
    );
  });

  it('uses centralized playable and generatable helpers', () => {
    const service = new DiagnosisRegistryLifecyclePolicyService({} as never);

    expect(
      service.isPlayable({
        status: DiagnosisRegistryStatus.ACTIVE,
        active: true,
        isPlayable: true,
      }),
    ).toBe(true);
    expect(
      service.isGeneratable({
        status: DiagnosisRegistryStatus.ACTIVE,
        active: true,
        isPlayable: true,
        isGeneratable: true,
      }),
    ).toBe(true);
    expect(
      service.isDictionaryVisible({
        status: DiagnosisRegistryStatus.DRAFT,
        active: true,
      }),
    ).toBe(false);
    expect(DiagnosisGraphFactStatus.ACTIVE).toBe('ACTIVE');
  });
});
