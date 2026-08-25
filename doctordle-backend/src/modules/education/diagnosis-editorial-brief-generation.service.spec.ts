import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiDraftReviewStatus } from '@prisma/client';
import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { DiagnosisEditorialBriefGenerationService } from './diagnosis-editorial-brief-generation.service';
import { EditorialBriefDraftQualityValidator } from './editorial-brief-draft-quality-validator.service';

describe('DiagnosisEditorialBriefGenerationService', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
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

  afterEach(() => {
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
      choices: [
        {
          message: {
            content: JSON.stringify(providerPayload),
          },
        },
      ],
    });
    const prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn().mockResolvedValue(bootstrapRegistry()),
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
    const service = new DiagnosisEditorialBriefGenerationService(
      prisma as never,
      new EditorialBriefDraftQualityValidator(),
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

  it('sends only registry identity, taxonomy, aliases, notes and active graph facts to OpenAI', async () => {
    const { service, openAiCreate } = buildService();

    await service.generate('registry-1');

    const request = openAiCreate.mock.calls[0][0];
    const userMessage = request.messages.find(
      (message: { role: string }) => message.role === 'user',
    );
    const parsedPrompt = JSON.parse(userMessage.content);
    expect(parsedPrompt.context.registry).toEqual(
      expect.objectContaining({
        id: 'registry-1',
        canonicalName: 'dermatitis herpetiformis',
        displayLabel: 'Dermatitis herpetiformis',
        specialty: 'Dermatology',
        aliases: [
          {
            term: 'Duhring disease',
            kind: 'synonym',
            acceptedForMatch: true,
          },
        ],
        graphFacts: [
          expect.objectContaining({
            id: 'fact-1',
            label: 'Bullous pemphigoid is a mimic',
          }),
        ],
      }),
    );
    expect(parsedPrompt.context.registry).not.toHaveProperty('education');
    expect(parsedPrompt.context.registry).not.toHaveProperty('cases');
    expect(parsedPrompt.context.registry).not.toHaveProperty('teachingRules');
    expect(parsedPrompt.context.registry).not.toHaveProperty('reasoningPaths');
    expect(
      parsedPrompt.context.bootstrapBoundary.excludedProviderEgress,
    ).toEqual(
      expect.arrayContaining(['patient data', 'learner data', 'user data']),
    );
  });

  it('maps a diagnosis-specific provider response into a review-required Brief payload', async () => {
    const { service } = buildService();

    const result = await service.generate('registry-1');

    expect(result.validation.status).toBe('PASS');
    expect(result.payload.requiredTeachingRuleIds).toEqual([]);
    expect(result.payload.requiredMimicIds).toEqual(['mimic-1']);
    expect(result.payload.summary).toContain('Dermatitis herpetiformis');
    expect(result.provenance).toEqual(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4o-mini',
        diagnosisRegistryId: 'registry-1',
        promptVersion: 'diagnosis_editorial_brief_bootstrap.v1',
      }),
    );
  });

  it('blocks generic-only output and records a rejected audit', async () => {
    const { service, prisma } = buildService(genericProviderPayload());

    await expect(service.generate('registry-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.aiDraftRevisionAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: AiDraftReviewStatus.REJECTED,
          affectedArtifactType: 'DIAGNOSIS_EDITORIAL_BRIEF_BOOTSTRAP',
        }),
      }),
    );
  });

  it('blocks output aimed at the wrong diagnosis', async () => {
    const { service } = buildService({
      ...validProviderPayload(),
      targetDiagnosis: 'Bullous pemphigoid',
    });

    await expect(service.generate('registry-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        blockers: expect.arrayContaining(['possible_cross_diagnosis_leakage']),
      }),
    });
  });

  it('surfaces partial high-quality output as warnings rather than approval', async () => {
    const { service } = buildService({
      ...validProviderPayload(),
      pitfalls: [],
      uncertainties: [
        'Management specifics require editorial evidence review.',
      ],
    });

    const result = await service.generate('registry-1');

    expect(result.validation.status).toBe('PASS_WITH_WARNINGS');
    expect(result.validation.warnings).toEqual(
      expect.arrayContaining([
        'missing_reasoning_traps',
        'provider_uncertainty_present',
      ]),
    );
  });

  it('provider failure is explicit and does not create audit success', async () => {
    const { service, prisma, openAiCreate } = buildService();
    openAiCreate.mockRejectedValue(new Error('provider unavailable'));

    await expect(service.generate('registry-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
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
    const service = new DiagnosisEditorialBriefGenerationService(
      prisma as never,
      new EditorialBriefDraftQualityValidator(),
    );

    await expect(service.generate('registry-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'BOOTSTRAP_GENERATION_FAILED',
      }),
    });
    expect(prisma.diagnosisRegistry.findUnique).not.toHaveBeenCalled();
  });

  it('records successful provenance after the governed Brief row exists', async () => {
    const { service, prisma } = buildService();
    const result = await service.generate('registry-1');

    await service.recordSuccessfulAudit({
      diagnosisRegistryId: 'registry-1',
      briefId: 'brief-1',
      result,
    });

    expect(prisma.aiDraftRevisionAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          affectedArtifactType: 'DIAGNOSIS_EDITORIAL_BRIEF',
          affectedArtifactId: 'brief-1',
          reviewStatus: AiDraftReviewStatus.PENDING_REVIEW,
          generatedOutput: expect.objectContaining({
            validation: result.validation,
            provenance: result.provenance,
          }),
        }),
      }),
    );
  });
});

function bootstrapRegistry() {
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
    notes: 'Non-patient registry note: emphasize extensor grouped vesicles.',
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
  };
}

function validProviderPayload() {
  return {
    targetDiagnosis: 'Dermatitis herpetiformis',
    educationalScope:
      'Teach Dermatitis herpetiformis as a pruritic grouped vesicular eruption that links skin morphology, gluten-sensitive enteropathy, and immunopathology.',
    learningGoals: [
      'Recognize Dermatitis herpetiformis from intensely pruritic grouped papulovesicles on extensor elbows, knees, buttocks, or scalp.',
      'Distinguish Dermatitis herpetiformis from bullous pemphigoid using grouped excoriated morphology, extensor distribution, and granular IgA on direct immunofluorescence.',
      'Explain why absent gastrointestinal symptoms do not exclude Dermatitis herpetiformis when the dermatologic and immunofluorescence pattern fits.',
    ],
    coreClinicalPattern:
      'Intensely itchy grouped papules and vesicles on extensor surfaces with excoriations, often with few gastrointestinal symptoms despite gluten-sensitive disease.',
    importantMimics: [
      {
        diagnosis: 'Bullous pemphigoid',
        whyConfused:
          'Both can present with pruritic blistering eruptions in adults.',
        keyDiscriminator:
          'Dermatitis herpetiformis favors grouped extensor papulovesicles and granular IgA in dermal papillae.',
      },
      {
        diagnosis: 'Scabies',
        whyConfused:
          'Both may cause intense itch with excoriated papules and sleep disruption.',
        keyDiscriminator:
          'Scabies favors burrows and household spread rather than extensor grouped vesicles with IgA deposition.',
      },
    ],
    highValueFindings: [
      {
        finding: 'Grouped extensor papulovesicles',
        diagnosticRole: 'Raises illness-script suspicion',
        whyItMatters:
          'The distribution and grouping separate it from many nonspecific itchy eruptions.',
      },
      {
        finding: 'Excoriations with few intact vesicles',
        diagnosticRole: 'Explains why morphology may be partly obscured',
        whyItMatters:
          'Severe itch can erase obvious vesicles and tempt premature eczema labeling.',
      },
    ],
    keyInvestigations: [
      {
        investigation: 'Perilesional direct immunofluorescence',
        role: 'Confirmatory discriminator',
        expectedInterpretation: 'Granular IgA deposition in dermal papillae',
        caution:
          'Biopsy site matters; routine lesional histology alone is not the core discriminator.',
      },
    ],
    managementAnchors: [
      {
        principle:
          'Separate rapid symptom control from long-term gluten-free disease modification',
        reason:
          'Symptom relief and prevention of ongoing disease activity are different teaching points.',
        scope:
          'Educational anchor only; exact regimen requires evidence review.',
      },
    ],
    pitfalls: [
      {
        mistakenReasoning:
          'Excluding the diagnosis because gastrointestinal symptoms are absent',
        correctivePrinciple:
          'Keep suspicion when the extensor grouped eruption and immunopathology fit.',
      },
    ],
    difficultyGuidance: [
      'Early clues should foreground itch and distribution before confirmatory immunofluorescence.',
    ],
    caseGenerationGuidance: [
      'Keep bullous pemphigoid plausible until morphology and immunofluorescence separate it.',
    ],
    educationGuidance: [
      'Teach investigation role and biopsy context rather than naming direct immunofluorescence alone.',
    ],
    uncertainties: [],
  };
}

function genericProviderPayload() {
  return {
    targetDiagnosis: 'Dermatitis herpetiformis',
    educationalScope: 'Recognize common clinical features.',
    learningGoals: [
      'Recognize common clinical features.',
      'Consider relevant differentials.',
      'Use appropriate investigations.',
    ],
    coreClinicalPattern: 'Clinical features and investigations.',
    importantMimics: [
      {
        diagnosis: 'Condition A',
        whyConfused: 'Similar symptoms.',
        keyDiscriminator: 'Appropriate tests.',
      },
    ],
    highValueFindings: [],
    keyInvestigations: [
      {
        investigation: 'Relevant test',
        role: 'Use appropriate investigations.',
        expectedInterpretation: 'Relevant result',
        caution: 'Interpret carefully.',
      },
    ],
    managementAnchors: [
      {
        principle: 'Manage according to severity.',
        reason: 'Provide supportive care.',
        scope: 'Clinical context.',
      },
    ],
    pitfalls: [
      {
        mistakenReasoning: 'Avoid premature diagnosis.',
        correctivePrinciple: 'Consider all data.',
      },
    ],
    difficultyGuidance: [],
    caseGenerationGuidance: [],
    educationGuidance: [],
    uncertainties: [],
  };
}
