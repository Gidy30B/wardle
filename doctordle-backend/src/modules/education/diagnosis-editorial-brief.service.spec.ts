import { BadRequestException } from '@nestjs/common';
import { DiagnosisEditorialBriefService } from './diagnosis-editorial-brief.service';
import type { GeneratedEditorialBriefBootstrap } from './diagnosis-editorial-brief-generation.service';

describe('DiagnosisEditorialBriefService', () => {
  function buildService(
    generation: GeneratedEditorialBriefBootstrap = generatedBrief(),
  ) {
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
    const lifecyclePolicy = {
      assertBootstrapReady: jest.fn().mockResolvedValue(undefined),
    };
    const briefGenerationService = {
      generate: jest.fn().mockResolvedValue(generation),
      recordSuccessfulAudit: jest.fn().mockResolvedValue(undefined),
    };
    return {
      prisma,
      lifecyclePolicy,
      briefGenerationService,
      service: new DiagnosisEditorialBriefService(
        prisma as never,
        lifecyclePolicy as never,
        briefGenerationService as never,
      ),
    };
  }

  it('generates a provider-backed brief draft without requiring Education, Cases or Teaching Rules', async () => {
    const { prisma, service, lifecyclePolicy, briefGenerationService } =
      buildService();
    prisma.diagnosisEditorialBrief.findUnique.mockResolvedValue(null);
    prisma.diagnosisEditorialBrief.create.mockImplementation(({ data }) =>
      Promise.resolve(briefRow(data)),
    );

    const result = await service.generateBrief('registry-1');

    expect(lifecyclePolicy.assertBootstrapReady).toHaveBeenCalledWith(
      'registry-1',
    );
    expect(briefGenerationService.generate).toHaveBeenCalledWith('registry-1');
    expect(prisma.diagnosisRegistry.findUnique).not.toHaveBeenCalled();
    expect(prisma.diagnosisEditorialBrief.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'NEEDS_REVIEW',
          requiredTeachingRuleIds: [],
          learningGoals: expect.arrayContaining([
            expect.stringContaining('Dermatitis herpetiformis'),
          ]),
        }),
      }),
    );
    expect(briefGenerationService.recordSuccessfulAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnosisRegistryId: 'registry-1',
        briefId: 'brief-1',
      }),
    );
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.requiredTeachingRuleIds).toEqual([]);
  });

  it('generated brief is never active', async () => {
    const { prisma, service } = buildService();
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

  it('provider failure does not fall back to generic successful content', async () => {
    const { prisma, service, briefGenerationService } = buildService();
    briefGenerationService.generate.mockRejectedValue(
      new BadRequestException({
        code: 'BOOTSTRAP_GENERATION_FAILED',
      }),
    );

    await expect(service.generateBrief('registry-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.diagnosisEditorialBrief.create).not.toHaveBeenCalled();
    expect(prisma.diagnosisEditorialBrief.update).not.toHaveBeenCalled();
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

    await expect(
      service.getApprovedBriefContext('registry-1'),
    ).resolves.toBeNull();
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

function generatedBrief(
  overrides: Partial<GeneratedEditorialBriefBootstrap> = {},
): GeneratedEditorialBriefBootstrap {
  return {
    payload: {
      summary:
        'Dermatitis herpetiformis should be taught through pruritic grouped extensor vesicles, gluten-sensitive enteropathy association, and direct immunofluorescence confirmation.',
      learningGoals: [
        'Recognize Dermatitis herpetiformis from intensely pruritic grouped papulovesicles on extensor surfaces.',
        'Distinguish Dermatitis herpetiformis from bullous pemphigoid using morphology, distribution, and immunofluorescence pattern.',
        'Connect Dermatitis herpetiformis management to gluten-sensitive disease while separating symptom control from disease modification.',
      ],
      requiredTeachingRuleIds: [],
      requiredMimicIds: ['mimic-1'],
      requiredPitfalls: [
        'Treating absent gastrointestinal symptoms as exclusion -> Maintain suspicion when the skin pattern and immunofluorescence fit.',
      ],
      keyInvestigations: [
        'Perilesional direct immunofluorescence: confirmatory role: granular IgA in dermal papillae.',
      ],
      managementAnchors: [
        'Separate rapid itch control from gluten-free diet: symptom relief is not the same as disease modification.',
      ],
      difficultyGuidance: ['Preserve morphology before revealing serology.'],
      caseGenerationGuidance: [
        'Keep bullous pemphigoid plausible until immunofluorescence pattern is available.',
      ],
      educationGuidance: [
        'Teach biopsy site and immunofluorescence role, not just test names.',
      ],
      graphGuidance: [],
      version: 1,
    },
    generatedDraft: {
      targetDiagnosis: 'Dermatitis herpetiformis',
      educationalScope: 'Diagnostic reasoning for grouped extensor vesicles.',
      learningGoals: [],
      coreClinicalPattern: 'Pruritic grouped papulovesicles.',
      importantMimics: [],
      highValueFindings: [],
      keyInvestigations: [],
      managementAnchors: [],
      pitfalls: [],
      difficultyGuidance: [],
      caseGenerationGuidance: [],
      educationGuidance: [],
      uncertainties: [],
    },
    validation: {
      status: 'PASS',
      blockers: [],
      warnings: [],
      qualitySignals: [
        'model_generated',
        'diagnosis_identity_present',
        'diagnosis_specific',
        'editor_review_required',
      ],
    },
    provenance: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      generatorVersion: 'DiagnosisEditorialBriefGenerationService.v1',
      promptVersion: 'diagnosis_editorial_brief_bootstrap.v1',
      generatedAt: '2026-01-01T00:00:00.000Z',
      diagnosisRegistryId: 'registry-1',
      contextHash: 'context-hash',
      resolvedMimics: [
        {
          name: 'Bullous pemphigoid',
          diagnosisRegistryId: 'mimic-1',
          displayLabel: 'Bullous pemphigoid',
        },
      ],
      unresolvedMimics: [],
    },
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
