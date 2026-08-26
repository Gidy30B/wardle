import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiDraftReviewStatus } from '@prisma/client';
import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { DiagnosisTeachingRuleGenerationService } from './diagnosis-teaching-rule-generation.service';
import { TeachingRuleDraftQualityValidator } from './teaching-rule-draft-quality-validator.service';

const requiredEnv = {
  DATABASE_URL: 'postgres://example',
  REDIS_URL: 'redis://example',
  CLERK_JWT_ISSUER: 'https://example.com',
  CLERK_JWT_AUDIENCE: 'audience',
  NODE_ENV: 'test',
  LOG_LEVEL: 'debug',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  SCORE_WEIGHT_EXACT: '1',
  SCORE_WEIGHT_SYNONYM: '1',
  SCORE_WEIGHT_FUZZY: '1',
  SCORE_WEIGHT_EMBEDDING: '1',
  SCORE_WEIGHT_ONTOLOGY: '1',
  EVALUATOR_VERSION: 'v2',
} as const;

describe('DiagnosisTeachingRuleGenerationService', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    Object.keys(requiredEnv).forEach((key) => delete process.env[key]);
    if (originalOpenAiKey) {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
    resetEnvCacheForTests();
  });

  function buildService(providerPayload: unknown = validProviderPayload()) {
    Object.assign(process.env, requiredEnv);
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const openAiCreate = jest.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(providerPayload) } }],
    });
    const prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn().mockResolvedValue(registry()),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'mimic-1',
            displayLabel: 'Bullous pemphigoid',
            canonicalName: 'bullous pemphigoid',
            aliases: [],
          },
        ]),
      },
      aiDraftRevisionAudit: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = new DiagnosisTeachingRuleGenerationService(
      prisma as never,
      new TeachingRuleDraftQualityValidator(),
    );
    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create: openAiCreate,
          },
        },
      },
    });
    return { prisma, service, openAiCreate };
  }

  it('sends approved provider payload and excludes Cases, unapproved Education, drafts, users and learners', async () => {
    const { service, openAiCreate } = buildService();

    await service.generate({
      diagnosisRegistryId: 'registry-1',
      approvedBrief: approvedBrief(),
      reasoningContext: approvedReasoningContext(),
    });

    const request = openAiCreate.mock.calls[0][0];
    const userMessage = request.messages.find(
      (message: { role: string }) => message.role === 'user',
    );
    const prompt = JSON.parse(userMessage.content);
    expect(prompt.context.registry).toEqual(
      expect.objectContaining({
        id: 'registry-1',
        canonicalName: 'dermatitis herpetiformis',
        displayLabel: 'Dermatitis herpetiformis',
        specialty: 'Dermatology',
        graphFacts: [expect.objectContaining({ id: 'fact-1' })],
        teachingRules: [
          expect.objectContaining({
            id: 'rule-active',
            title: 'Existing approved rule summary',
          }),
        ],
      }),
    );
    expect(prompt.context.editorialBrief).toEqual(
      expect.objectContaining({
        id: 'brief-1',
        version: 3,
        status: 'APPROVED',
        summary: expect.stringContaining('Dermatitis herpetiformis'),
      }),
    );
    expect(prompt.context).toHaveProperty('approvedReasoningContext');
    expect(prompt.context.registry).not.toHaveProperty('education');
    expect(prompt.context.registry).not.toHaveProperty('cases');
    expect(prompt.context.registry).not.toHaveProperty('clinicalCaseDrafts');
    expect(prompt.context.registry).not.toHaveProperty('graphCandidates');
    expect(prompt.context.providerBoundary.excludedProviderEgress).toEqual(
      expect.arrayContaining([
        'patient data',
        'learner data',
        'user data',
        'game-session data',
        'Case content',
        'ClinicalCaseDraft content',
        'unapproved Education content',
        'Education candidates',
        'unapproved Graph Candidates',
      ]),
    );
  });

  it('maps valid provider rules to candidate payloads with evidence expectation but not verification', async () => {
    const { service } = buildService();

    const result = await service.generate({
      diagnosisRegistryId: 'registry-1',
      approvedBrief: approvedBrief(),
    });

    expect(result.validation.status).toBe('PASS');
    expect(result.provenance).toEqual(
      expect.objectContaining({
        editorialBriefId: 'brief-1',
        editorialBriefVersion: 3,
        editorialBriefStatus: 'APPROVED',
      }),
    );
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'CANDIDATE',
          source: 'GENERATED',
          expectedEvidence: expect.objectContaining({
            evidenceExpected: true,
            evidenceVerified: false,
          }),
        }),
      ]),
    );
  });

  it('blocks generic provider rules and records rejected generation audit', async () => {
    const { prisma, service } = buildService(genericProviderPayload());

    await expect(
      service.generate({
        diagnosisRegistryId: 'registry-1',
        approvedBrief: approvedBrief(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.aiDraftRevisionAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          affectedArtifactType: 'DIAGNOSIS_TEACHING_RULE_GENERATION',
          reviewStatus: AiDraftReviewStatus.REJECTED,
        }),
      }),
    );
  });

  it('blocks wrong-diagnosis rule output', async () => {
    const payload = validProviderPayload();
    payload.rules[0].title =
      'Bullous pemphigoid uses tense bullae and linear basement membrane staining as its discriminator.';
    payload.rules[0].acceptableManifestations = [
      'Bullous pemphigoid has tense bullae and linear staining.',
    ];
    payload.rules[0].sourceConcepts = ['Bullous pemphigoid'];
    const { service } = buildService(payload);

    await expect(
      service.generate({
        diagnosisRegistryId: 'registry-1',
        approvedBrief: approvedBrief(),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        blockers: expect.arrayContaining([
          expect.stringContaining('wrong_or_missing_target_diagnosis'),
        ]),
      }),
    });
  });

  it('surfaces useful partial coverage as warnings when safe', async () => {
    const payload = validProviderPayload();
    payload.rules = payload.rules.slice(0, 2);
    payload.rules[0].title =
      'Dermatitis herpetiformis rash recognition, direct immunofluorescence confirmation and symptom-control management should be decomposed for review.';
    const { service } = buildService(payload);

    const result = await service.generate({
      diagnosisRegistryId: 'registry-1',
      approvedBrief: {
        ...approvedBrief(),
        requiredPitfalls: [],
        managementAnchors: [],
      },
    });

    expect(result.validation.status).toBe('PASS_WITH_WARNINGS');
    expect(result.validation.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('multi_concept_overloaded_rule'),
      ]),
    );
  });

  it('provider failure is explicit and creates no fake success audit', async () => {
    const { openAiCreate, prisma, service } = buildService();
    openAiCreate.mockRejectedValue(new Error('provider unavailable'));

    await expect(
      service.generate({
        diagnosisRegistryId: 'registry-1',
        approvedBrief: approvedBrief(),
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.aiDraftRevisionAudit.create).not.toHaveBeenCalled();
  });

  it('missing provider configuration fails before any fallback content is produced', async () => {
    Object.assign(process.env, requiredEnv);
    delete process.env.OPENAI_API_KEY;
    resetEnvCacheForTests();
    const prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      aiDraftRevisionAudit: {
        create: jest.fn(),
      },
    };
    const service = new DiagnosisTeachingRuleGenerationService(
      prisma as never,
      new TeachingRuleDraftQualityValidator(),
    );

    await expect(
      service.generate({
        diagnosisRegistryId: 'registry-1',
        approvedBrief: approvedBrief(),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'TEACHING_RULE_GENERATION_FAILED',
      }),
    });
    expect(prisma.diagnosisRegistry.findUnique).not.toHaveBeenCalled();
  });

  it('rejects non-approved Brief status before provider invocation', async () => {
    const { openAiCreate, prisma, service } = buildService();

    await expect(
      service.generate({
        diagnosisRegistryId: 'registry-1',
        approvedBrief: {
          ...approvedBrief(),
          status: 'NEEDS_REVIEW',
        },
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'BRIEF_NOT_APPROVED',
      }),
    });
    expect(openAiCreate).not.toHaveBeenCalled();
    expect(prisma.diagnosisRegistry.findUnique).not.toHaveBeenCalled();
  });

  it('records successful provenance with exact Brief identity and candidate IDs', async () => {
    const { prisma, service } = buildService();
    const result = await service.generate({
      diagnosisRegistryId: 'registry-1',
      approvedBrief: approvedBrief(),
    });

    await service.recordSuccessfulAudit({
      diagnosisRegistryId: 'registry-1',
      candidateIds: ['rule-1', 'rule-2'],
      result,
    });

    expect(prisma.aiDraftRevisionAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          affectedArtifactType: 'DIAGNOSIS_TEACHING_RULE',
          affectedArtifactId: 'rule-1,rule-2',
          reviewStatus: AiDraftReviewStatus.PENDING_REVIEW,
          sourceIssue: expect.objectContaining({
            editorialBriefId: 'brief-1',
            editorialBriefVersion: 3,
            editorialBriefStatus: 'APPROVED',
          }),
        }),
      }),
    );
  });
});

function registry() {
  return {
    id: 'registry-1',
    canonicalName: 'dermatitis herpetiformis',
    canonicalNormalized: 'dermatitis herpetiformis',
    displayLabel: 'Dermatitis herpetiformis',
    specialty: 'Dermatology',
    subspecialty: null,
    category: 'Autoimmune blistering disease',
    bodySystem: 'Skin',
    organSystem: 'Integumentary',
    clinicalSetting: 'outpatient dermatology',
    ageGroup: 'adult',
    urgencyLevel: 'routine',
    difficultyBand: 'INTERMEDIATE',
    rarityBand: 'UNCOMMON',
    preferredClueTypes: ['rash_morphology'],
    excludedClueTypes: [],
    aliases: [
      {
        term: 'Duhring disease',
        kind: 'synonym',
        acceptedForMatch: true,
      },
    ],
    graphFacts: [
      {
        id: 'fact-1',
        type: 'MIMIC',
        label: 'Bullous pemphigoid is a mimic',
        targetDiagnosisRegistryId: 'mimic-1',
        targetDiagnosisRegistry: {
          displayLabel: 'Bullous pemphigoid',
          canonicalName: 'bullous pemphigoid',
        },
      },
    ],
    teachingRules: [
      {
        id: 'rule-active',
        stableKey: 'existing_rule',
        title: 'Existing approved rule summary',
        category: 'finding_concept',
        importance: 'high',
      },
    ],
  };
}

function approvedBrief() {
  return {
    id: 'brief-1',
    status: 'APPROVED',
    version: 3,
    summary:
      'Dermatitis herpetiformis should teach grouped extensor vesicles, gluten-sensitive enteropathy and direct immunofluorescence confirmation.',
    learningGoals: [
      'Recognize Dermatitis herpetiformis from intensely pruritic grouped extensor papulovesicles.',
      'Distinguish Dermatitis herpetiformis from bullous pemphigoid using morphology, distribution and granular IgA.',
    ],
    requiredTeachingRuleIds: [],
    requiredMimicIds: ['mimic-1'],
    requiredPitfalls: [
      'Absence of gastrointestinal symptoms does not exclude Dermatitis herpetiformis.',
    ],
    keyInvestigations: [
      'Perilesional direct immunofluorescence shows granular IgA.',
    ],
    managementAnchors: [
      'Separate rapid symptom control from long-term gluten-free disease control.',
    ],
    difficultyGuidance: [
      'Preserve rash morphology before revealing confirmatory testing.',
    ],
    caseGenerationGuidance: [
      'Keep bullous pemphigoid plausible until immunofluorescence separates it.',
    ],
    educationGuidance: [
      'Teach biopsy context, not just the investigation name.',
    ],
    graphGuidance: [],
  };
}

function approvedReasoningContext() {
  return {
    constrained: true,
    reasoningPathId: 'reasoning-1',
    confidence: 'high',
    hallucinationRisk: 'low',
    reasoningGoal: 'Separate mimic diagnoses',
    requiredTeachingPoints: [
      'Use granular IgA to separate Dermatitis herpetiformis from bullous pemphigoid.',
    ],
    discriminatorEvidenceUsed: ['granular IgA'],
    sourceTeachingRelationshipIds: [],
    sourceEvidenceRelationshipIds: [],
    coverageGapsAddressed: [],
    contradictoryDiagnosisIds: [],
    generationCoverageSnapshot: {},
    warnings: [],
    reasoningQualityWarnings: [],
  } as never;
}

function validProviderPayload() {
  return {
    rules: [
      {
        stableKeyHint: 'dh_extensor_grouped_eruption',
        title:
          'Dermatitis herpetiformis should present as intensely pruritic grouped extensor papulovesicles rather than nonspecific itch.',
        category: 'finding_concept',
        importance: 'critical',
        rationale:
          'This operationalizes the approved Brief core clinical pattern.',
        acceptableManifestations: [
          'Grouped extensor papulovesicles with excoriations raise suspicion for Dermatitis herpetiformis.',
        ],
        requiredDifferentials: [],
        expectedEvidence: {
          evidenceExpected: false,
          evidenceClass: null,
          reason: null,
        },
        difficultyHints: {
          relevance: 'Useful as an early pattern clue.',
          clueTiming: 'early',
          revealConstraints: ['Do not reveal immunofluorescence first.'],
        },
        avoidTooEarly: false,
        appliesToEducation: true,
        appliesToCaseGeneration: true,
        appliesToGraph: false,
        sourceBriefGoalIndexes: [0],
        sourceConcepts: ['grouped extensor papulovesicles'],
      },
      {
        stableKeyHint: 'dh_bp_separator',
        title:
          'Dermatitis herpetiformis keeps bullous pemphigoid plausible until morphology, distribution and granular IgA separate them.',
        category: 'differential_concept',
        importance: 'critical',
        rationale: 'The Brief requires explicit mimic separation.',
        acceptableManifestations: [
          'Bullous pemphigoid remains plausible until granular IgA and grouped extensor morphology favor Dermatitis herpetiformis.',
        ],
        requiredDifferentials: [
          {
            registryId: null,
            diagnosis: 'Bullous pemphigoid',
            whyConfused:
              'Both can cause pruritic blistering eruptions in adults.',
            keySeparator:
              'Dermatitis herpetiformis favors grouped extensor papulovesicles and granular IgA.',
          },
        ],
        expectedEvidence: {
          evidenceExpected: true,
          evidenceClass: 'mimic discriminator',
          reason: 'Differential discriminator should be evidence reviewed.',
        },
        difficultyHints: {
          relevance: 'Maintain ambiguity through early clues.',
          clueTiming: 'mid',
          revealConstraints: [
            'Do not collapse the differential before morphology is described.',
          ],
        },
        avoidTooEarly: true,
        appliesToEducation: true,
        appliesToCaseGeneration: true,
        appliesToGraph: false,
        sourceBriefGoalIndexes: [1],
        sourceConcepts: ['bullous pemphigoid', 'granular IgA'],
      },
      {
        stableKeyHint: 'dh_dif_role',
        title:
          'Dermatitis herpetiformis uses perilesional direct immunofluorescence as a confirmatory discriminator, not a generic screening test.',
        category: 'investigation_concept',
        importance: 'high',
        rationale:
          'The Brief prioritizes investigation role and biopsy context.',
        acceptableManifestations: [
          'Perilesional direct immunofluorescence has a confirmatory role for Dermatitis herpetiformis.',
        ],
        requiredDifferentials: [],
        expectedEvidence: {
          evidenceExpected: true,
          evidenceClass: 'confirmatory investigation',
          reason: 'Confirmatory investigation claims require evidence review.',
        },
        difficultyHints: {
          relevance: 'Useful after clinical pattern is established.',
          clueTiming: 'late',
          revealConstraints: [
            'Do not use direct immunofluorescence as clue one.',
          ],
        },
        avoidTooEarly: true,
        appliesToEducation: true,
        appliesToCaseGeneration: true,
        appliesToGraph: false,
        sourceBriefGoalIndexes: [1],
        sourceConcepts: ['direct immunofluorescence', 'granular IgA'],
      },
      {
        stableKeyHint: 'dh_gi_absence_pitfall',
        title:
          'Dermatitis herpetiformis should not be excluded solely because gastrointestinal symptoms are absent.',
        category: 'pitfall_concept',
        importance: 'high',
        rationale: 'The Brief names this as a reasoning trap.',
        acceptableManifestations: [
          'Absence of gastrointestinal symptoms does not exclude Dermatitis herpetiformis.',
        ],
        requiredDifferentials: [],
        expectedEvidence: {
          evidenceExpected: true,
          evidenceClass: 'diagnostic pitfall',
          reason: 'Potential exclusion logic requires evidence review.',
        },
        difficultyHints: {
          relevance: 'Can appear in intermediate cases.',
          clueTiming: 'mid',
          revealConstraints: ['Avoid using absent GI symptoms as a rule-out.'],
        },
        avoidTooEarly: false,
        appliesToEducation: true,
        appliesToCaseGeneration: true,
        appliesToGraph: false,
        sourceBriefGoalIndexes: [],
        sourceConcepts: ['absent gastrointestinal symptoms'],
      },
      {
        stableKeyHint: 'dh_symptom_vs_disease_control',
        title:
          'Dermatitis herpetiformis management teaching should separate rapid itch control from long-term gluten-free disease control.',
        category: 'management_concept',
        importance: 'supporting',
        rationale: 'The Brief includes a management anchor but not a regimen.',
        acceptableManifestations: [
          'Separate symptom control from long-term disease control in Dermatitis herpetiformis.',
        ],
        requiredDifferentials: [],
        expectedEvidence: {
          evidenceExpected: true,
          evidenceClass: 'management principle',
          reason: 'Management principles require evidence review.',
        },
        difficultyHints: {
          relevance: 'Useful in explanation rather than early clueing.',
          clueTiming: 'explanation',
          revealConstraints: [],
        },
        avoidTooEarly: false,
        appliesToEducation: true,
        appliesToCaseGeneration: false,
        appliesToGraph: false,
        sourceBriefGoalIndexes: [],
        sourceConcepts: [
          'rapid symptom control',
          'gluten-free disease control',
        ],
      },
    ],
  };
}

function genericProviderPayload() {
  return {
    rules: [
      {
        stableKeyHint: 'generic_features',
        title: 'Recognize important clinical features.',
        category: 'finding_concept',
        importance: 'critical',
        rationale: 'Teach important clinical features.',
        acceptableManifestations: ['Use appropriate investigations.'],
        requiredDifferentials: [],
        expectedEvidence: {
          evidenceExpected: false,
          evidenceClass: null,
          reason: null,
        },
        difficultyHints: {
          relevance: null,
          clueTiming: null,
          revealConstraints: [],
        },
        avoidTooEarly: false,
        appliesToEducation: true,
        appliesToCaseGeneration: true,
        appliesToGraph: false,
        sourceBriefGoalIndexes: [],
        sourceConcepts: [],
      },
    ],
  };
}
