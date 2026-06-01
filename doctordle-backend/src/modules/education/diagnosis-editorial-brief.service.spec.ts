import { BadRequestException } from '@nestjs/common';
import { DiagnosisEditorialBriefService } from './diagnosis-editorial-brief.service';

describe('DiagnosisEditorialBriefService', () => {
  function buildService() {
    const prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn(),
      },
      diagnosisEditorialBrief: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    return {
      prisma,
      service: new DiagnosisEditorialBriefService(prisma as never),
    };
  }

  it('generates a brief from approved teaching rules', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      generationRegistry({
        teachingRules: [
          teachingRule({
            id: 'rule-active',
            title: 'Potassium before insulin',
            importance: 'critical',
          }),
          teachingRule({
            id: 'rule-approved',
            title: 'DKA versus HHS',
            category: 'differential_concept',
            importance: 'high',
          }),
        ],
      }),
    );
    prisma.diagnosisEditorialBrief.findUnique.mockResolvedValue(null);
    prisma.diagnosisEditorialBrief.create.mockImplementation(({ data }) =>
      Promise.resolve(briefRow(data)),
    );

    const result = await service.generateBrief('registry-1');

    expect(prisma.diagnosisRegistry.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          teachingRules: expect.objectContaining({
            where: { status: { in: ['ACTIVE', 'APPROVED'] } },
          }),
        }),
      }),
    );
    expect(prisma.diagnosisEditorialBrief.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'NEEDS_REVIEW',
          requiredTeachingRuleIds: ['rule-active', 'rule-approved'],
        }),
      }),
    );
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.requiredTeachingRuleIds).toEqual([
      'rule-active',
      'rule-approved',
    ]);
  });

  it('generated brief is never active', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      generationRegistry({ teachingRules: [teachingRule()] }),
    );
    prisma.diagnosisEditorialBrief.findUnique.mockResolvedValue(
      briefRow({ status: 'ACTIVE', version: 3 }),
    );
    prisma.diagnosisEditorialBrief.update.mockImplementation(({ data }) =>
      Promise.resolve(briefRow({ ...data, version: 4 })),
    );

    const result = await service.generateBrief('registry-1');

    expect(prisma.diagnosisEditorialBrief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'NEEDS_REVIEW',
          version: { increment: 1 },
        }),
      }),
    );
    expect(result.status).toBe('NEEDS_REVIEW');
  });

  it('approved active brief is returned for generation context', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisEditorialBrief.findFirst.mockResolvedValue(
      briefRow({
        status: 'APPROVED',
        learningGoals: ['Use discriminator reasoning.'],
        requiredTeachingRuleIds: ['rule-1'],
      }),
    );

    const context = await service.getApprovedBriefContext('registry-1');

    expect(prisma.diagnosisEditorialBrief.findFirst).toHaveBeenCalledWith({
      where: {
        diagnosisRegistryId: 'registry-1',
        status: { in: ['APPROVED', 'ACTIVE'] },
      },
    });
    expect(context?.learningGoals).toEqual(['Use discriminator reasoning.']);
    expect(context?.requiredTeachingRuleIds).toEqual(['rule-1']);
  });

  it('inactive brief is excluded from generation context', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisEditorialBrief.findFirst.mockResolvedValue(null);

    await expect(service.getApprovedBriefContext('registry-1')).resolves.toBeNull();
  });

  it('create validates required fields', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue({
      id: 'registry-1',
      canonicalName: 'appendicitis',
      displayLabel: 'Appendicitis',
    });

    await expect(
      service.createBrief('registry-1', {
        summary: '',
        learningGoals: [],
        requiredTeachingRuleIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function teachingRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    stableKey: 'rule_1',
    title: 'Acidosis with ketones',
    category: 'investigation_concept',
    importance: 'critical',
    rationale: null,
    requiredDifferentials: [],
    acceptableManifestations: [],
    difficultyHints: {},
    appliesToEducation: true,
    appliesToCaseGeneration: true,
    appliesToGraph: false,
    ...overrides,
  };
}

function generationRegistry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'registry-1',
    canonicalName: 'diabetic ketoacidosis',
    displayLabel: 'Diabetic ketoacidosis',
    category: 'Metabolic',
    specialty: 'Endocrinology',
    bodySystem: 'Endocrine',
    difficultyBand: 'INTERMEDIATE',
    teachingRules: [],
    graphFacts: [],
    graphCandidates: [],
    education: null,
    cases: [],
    ...overrides,
  };
}

function briefRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'brief-1',
    diagnosisRegistryId: 'registry-1',
    summary: 'Teach DKA as a staged metabolic emergency.',
    learningGoals: [],
    requiredTeachingRuleIds: [],
    requiredMimicIds: [],
    requiredPitfalls: [],
    keyInvestigations: [],
    managementAnchors: [],
    difficultyGuidance: [],
    caseGenerationGuidance: [],
    educationGuidance: [],
    graphGuidance: [],
    status: 'NEEDS_REVIEW',
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
