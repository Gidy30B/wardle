import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { GeneratedTeachingRuleCandidates } from './diagnosis-teaching-rule-generation.service';
import { TeachingRulesAdminService } from './teaching-rules-admin.service';

const diagnosisRegistryId = '11111111-1111-4111-8111-111111111111';
const ruleId = '22222222-2222-4222-8222-222222222222';

describe('TeachingRulesAdminService', () => {
  function buildRule(overrides: Record<string, unknown> = {}) {
    return {
      id: ruleId,
      diagnosisRegistryId,
      stableKey: 'potassium_before_insulin',
      title: 'Potassium before insulin',
      category: 'management_concept',
      importance: 'critical',
      rationale: 'Insulin can worsen hypokalemia.',
      acceptableManifestations: ['check potassium before insulin'],
      requiredDifferentials: [],
      expectedEvidence: {},
      difficultyHints: {},
      avoidTooEarly: false,
      appliesToEducation: true,
      appliesToCaseGeneration: true,
      appliesToGraph: false,
      status: 'NEEDS_REVIEW',
      source: 'EDITOR_CREATED',
      version: 1,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  function buildService(
    generation: GeneratedTeachingRuleCandidates = generatedRules(),
  ) {
    const prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn().mockResolvedValue({
          id: diagnosisRegistryId,
          canonicalName: 'diabetic ketoacidosis',
          displayLabel: 'Diabetic Ketoacidosis',
          specialty: null,
          category: null,
          bodySystem: null,
          clinicalSetting: null,
          difficultyBand: null,
          aliases: [{ term: 'DKA' }],
        }),
      },
      diagnosisTeachingRule: {
        findMany: jest.fn().mockResolvedValue([buildRule()]),
        findUnique: jest.fn().mockResolvedValue(buildRule()),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve(buildRule(data))),
        update: jest.fn().mockResolvedValue(buildRule({ status: 'APPROVED' })),
      },
    };
    const curriculumProvider = {
      getRules: jest.fn().mockResolvedValue({
        teachingUnits: [{ id: 'potassium_before_insulin' }],
      }),
    };
    const seedService = {
      seedLegacyTeachingRulesForDiagnosis: jest
        .fn()
        .mockResolvedValue({ rulesUpserted: 1 }),
    };
    const briefService = {
      getApprovedBriefContext: jest.fn().mockResolvedValue({
        id: 'brief-1',
        status: 'APPROVED',
        version: 1,
        summary: 'DKA requires ketosis with metabolic acidosis.',
        learningGoals: ['Distinguish DKA from HHS.'],
        requiredTeachingRuleIds: [],
        requiredMimicIds: ['HHS'],
        requiredPitfalls: ['Potassium can fall after insulin'],
        keyInvestigations: ['beta-hydroxybutyrate'],
        managementAnchors: ['potassium check before insulin'],
        difficultyGuidance: [],
        caseGenerationGuidance: [],
        educationGuidance: [],
        graphGuidance: [],
      }),
    };
    const lifecyclePolicy = {
      assertTeachingRuleGenerationReady: jest.fn().mockResolvedValue({}),
    };
    const generationService = {
      generate: jest.fn().mockResolvedValue(generation),
      recordSuccessfulAudit: jest.fn().mockResolvedValue(undefined),
    };

    return {
      prisma,
      curriculumProvider,
      seedService,
      briefService,
      generationService,
      lifecyclePolicy,
      service: new TeachingRulesAdminService(
        prisma as never,
        curriculumProvider as never,
        seedService as never,
        undefined,
        undefined,
        briefService as never,
        generationService as never,
        lifecyclePolicy as never,
      ),
    };
  }

  it('lists rules for diagnosis', async () => {
    const { service } = buildService();

    const result = await service.listRules(diagnosisRegistryId);

    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toEqual(
      expect.objectContaining({
        stableKey: 'potassium_before_insulin',
        createdAt: '2026-06-01T00:00:00.000Z',
      }),
    );
  });

  it('creates a manual rule', async () => {
    const { prisma, service } = buildService();

    await service.createRule(diagnosisRegistryId, {
      stableKey: 'dka_vs_hhs',
      title: 'DKA vs HHS',
      category: 'differential_concept',
      importance: 'critical',
      acceptableManifestations: ['HHS lacks prominent ketoacidosis'],
    });

    expect(prisma.diagnosisTeachingRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stableKey: 'dka_vs_hhs',
          status: 'NEEDS_REVIEW',
          source: 'EDITOR_CREATED',
        }),
      }),
    );
  });

  it('updates a rule', async () => {
    const { prisma, service } = buildService();

    await service.updateRule(ruleId, {
      title: 'Potassium safety before insulin',
      importance: 'high',
    });

    expect(prisma.diagnosisTeachingRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ruleId },
        data: expect.objectContaining({
          title: 'Potassium safety before insulin',
          importance: 'high',
        }),
      }),
    );
  });

  it.each([
    ['approve', 'APPROVED'],
    ['reject', 'REJECTED'],
    ['deprecate', 'DEPRECATED'],
  ])('reviews a rule with %s', async (action, status) => {
    const { prisma, service } = buildService();

    await service.reviewRule(ruleId, action);

    expect(prisma.diagnosisTeachingRule.update).toHaveBeenCalledWith({
      where: { id: ruleId },
      data: { status },
    });
  });

  it('rejects duplicate stableKey', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisTeachingRule.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.createRule(diagnosisRegistryId, {
        stableKey: 'potassium_before_insulin',
        title: 'Potassium before insulin',
        category: 'management_concept',
        importance: 'critical',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generated candidates do not become active', async () => {
    const { generationService, prisma, service } = buildService();

    const result = await service.generateCandidateRules(diagnosisRegistryId);

    expect(generationService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnosisRegistryId,
        approvedBrief: expect.objectContaining({
          id: 'brief-1',
          status: 'APPROVED',
          version: 1,
        }),
      }),
    );
    expect(prisma.diagnosisTeachingRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CANDIDATE',
          source: 'GENERATED',
        }),
      }),
    );
    expect(result.generatedCount).toBe(2);
    expect(result.rules.every((rule) => rule.status === 'CANDIDATE')).toBe(
      true,
    );
    expect(generationService.recordSuccessfulAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnosisRegistryId,
        candidateIds: expect.arrayContaining([ruleId]),
      }),
    );
  });

  it('blocks generated candidates before Editorial Brief approval', async () => {
    const { generationService, lifecyclePolicy, prisma, service } =
      buildService();
    lifecyclePolicy.assertTeachingRuleGenerationReady.mockRejectedValueOnce(
      new BadRequestException('Approved Editorial Brief is required'),
    );

    await expect(
      service.generateCandidateRules(diagnosisRegistryId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.diagnosisTeachingRule.create).not.toHaveBeenCalled();
    expect(generationService.generate).not.toHaveBeenCalled();
  });

  it.each(['DRAFT', 'NEEDS_REVIEW', 'DEPRECATED'])(
    'does not invoke provider for %s Editorial Brief',
    async () => {
      const { briefService, generationService, prisma, service } =
        buildService();
      briefService.getApprovedBriefContext.mockResolvedValue(null);

      await expect(
        service.generateCandidateRules(diagnosisRegistryId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(generationService.generate).not.toHaveBeenCalled();
      expect(prisma.diagnosisTeachingRule.create).not.toHaveBeenCalled();
    },
  );

  it('allows ACTIVE Editorial Brief to invoke provider', async () => {
    const { briefService, generationService, service } = buildService();
    briefService.getApprovedBriefContext.mockResolvedValue({
      ...approvedBrief(),
      status: 'ACTIVE',
    });

    await service.generateCandidateRules(diagnosisRegistryId);

    expect(generationService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        approvedBrief: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('does not persist when the approved Brief changes during generation', async () => {
    const { briefService, generationService, prisma, service } = buildService();
    briefService.getApprovedBriefContext
      .mockResolvedValueOnce(approvedBrief())
      .mockResolvedValueOnce({ ...approvedBrief(), version: 2 });

    await expect(
      service.generateCandidateRules(diagnosisRegistryId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(generationService.generate).toHaveBeenCalled();
    expect(prisma.diagnosisTeachingRule.create).not.toHaveBeenCalled();
  });

  it('skips duplicate generated rules without mutating existing rules', async () => {
    const { prisma, service } = buildService(
      generatedRules({
        candidates: [
          candidatePayload({
            stableKey: 'dif_granular_iga',
            title:
              'Dermatitis herpetiformis uses granular IgA on direct immunofluorescence as a confirmatory discriminator.',
          }),
          candidatePayload({
            stableKey: 'dif_granular_iga',
            title:
              'Dermatitis herpetiformis uses granular IgA on direct immunofluorescence as a confirmatory discriminator.',
          }),
        ],
      }),
    );

    const result = await service.generateCandidateRules(diagnosisRegistryId);

    expect(result.generatedCount).toBe(1);
    expect(result.duplicatesSkipped).toBe(1);
    expect(prisma.diagnosisTeachingRule.update).not.toHaveBeenCalled();
  });

  it('provider failure creates no fake generic rules', async () => {
    const { generationService, prisma, service } = buildService();
    generationService.generate.mockRejectedValue(
      new BadRequestException({ code: 'TEACHING_RULE_GENERATION_FAILED' }),
    );

    await expect(
      service.generateCandidateRules(diagnosisRegistryId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.diagnosisTeachingRule.create).not.toHaveBeenCalled();
  });

  it('validates selected teaching unit ids against provider output', async () => {
    const { service } = buildService();

    await expect(
      service.validateTeachingUnitIds(diagnosisRegistryId, ['missing_unit']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('runs legacy seed for one diagnosis', async () => {
    const { seedService, service } = buildService();

    await service.seedLegacyRulesForDiagnosis(diagnosisRegistryId);

    expect(
      seedService.seedLegacyTeachingRulesForDiagnosis,
    ).toHaveBeenCalledWith(diagnosisRegistryId);
  });
});

function approvedBrief() {
  return {
    id: 'brief-1',
    status: 'APPROVED',
    version: 1,
    summary: 'DKA requires ketosis with metabolic acidosis.',
    learningGoals: ['Distinguish DKA from HHS.'],
    requiredTeachingRuleIds: [],
    requiredMimicIds: ['HHS'],
    requiredPitfalls: ['Potassium can fall after insulin'],
    keyInvestigations: ['beta-hydroxybutyrate'],
    managementAnchors: ['potassium check before insulin'],
    difficultyGuidance: [],
    caseGenerationGuidance: [],
    educationGuidance: [],
    graphGuidance: [],
  };
}

function candidatePayload(overrides: Record<string, unknown> = {}) {
  return {
    stableKey: 'dif_granular_iga',
    title:
      'Dermatitis herpetiformis uses granular IgA on direct immunofluorescence as a confirmatory discriminator.',
    category: 'investigation_concept',
    importance: 'critical',
    rationale:
      'This operationalizes the approved Brief investigation priority.',
    acceptableManifestations: [
      'Direct immunofluorescence has a confirmatory discriminator role.',
    ],
    requiredDifferentials: [],
    expectedEvidence: {
      evidenceExpected: true,
      evidenceVerified: false,
      reason: 'Confirmatory investigation claim requires evidence review.',
    },
    difficultyHints: {
      relevance: 'Use after morphology and distribution clues.',
      clueTiming: 'mid_to_late',
      revealConstraints: ['Do not reveal confirmatory test first.'],
    },
    avoidTooEarly: true,
    appliesToEducation: true,
    appliesToCaseGeneration: true,
    appliesToGraph: false,
    status: 'CANDIDATE',
    source: 'GENERATED',
    ...overrides,
  };
}

function generatedRules(
  overrides: Partial<GeneratedTeachingRuleCandidates> = {},
): GeneratedTeachingRuleCandidates {
  return {
    candidates: [
      candidatePayload(),
      candidatePayload({
        stableKey: 'bp_mimic_separator',
        title:
          'Dermatitis herpetiformis keeps bullous pemphigoid plausible until morphology, distribution and immunofluorescence separate them.',
        category: 'differential_concept',
        requiredDifferentials: [
          {
            diagnosisRegistryId: null,
            diagnosis: 'Bullous pemphigoid',
            whyConfused:
              'Both can cause pruritic blistering eruptions in adults.',
            keySeparator:
              'Grouped extensor papulovesicles with granular IgA favor dermatitis herpetiformis.',
          },
        ],
      }),
    ] as never,
    generatedDrafts: [],
    validation: {
      status: 'PASS',
      blockers: [],
      warnings: [],
      qualitySignals: [
        'model_generated',
        'brief_derived',
        'diagnosis_specific',
        'editor_review_required',
      ],
      ruleResults: [],
      coverage: {
        coveredLearningGoalIndexes: [0],
        coveredMimics: ['Bullous pemphigoid'],
        coveredInvestigations: ['Direct immunofluorescence'],
        coveredPitfalls: [],
        coveredManagementAnchors: [],
        coveredDifficultyGuidance: [],
        missingCriticalIntent: [],
      },
    },
    provenance: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      generatorVersion: 'DiagnosisTeachingRuleGenerationService.v1',
      promptVersion: 'diagnosis_teaching_rule_generation.v1',
      generatedAt: '2026-01-01T00:00:00.000Z',
      diagnosisRegistryId,
      editorialBriefId: 'brief-1',
      editorialBriefVersion: 1,
      editorialBriefStatus: 'APPROVED',
      contextHash: 'context-hash',
      resolvedBriefMimics: [],
      unresolvedBriefMimics: [],
    },
    ...overrides,
  };
}
