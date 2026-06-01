import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { CaseGeneratorService } from './case-generator.service';
import type {
  CaseGenerationFailureCategory,
  DifferentialPreflightCritique,
  GeneratedCase,
  PlannedGenerationSlot,
} from './case-generator.types';

type TransactionMock = {
  case: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
  };
  diagnosis: {
    upsert: jest.Mock;
  };
};

function mockCompletion(payload: unknown) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(payload),
        },
      },
    ],
  };
}

function buildCritique(
  overrides: Partial<{
    passed: boolean;
    score: number;
    clinicalAccuracyScore: number;
    clueProgressionScore: number;
    differentialQualityScore: number;
    differentialRuleOutScore: number;
    differentialPlausibilityScore: number;
    differentialDiscriminationScore: number;
    clinicalEdgeValidityScore: number;
    invalidReasoningEdges: Array<{
      differential: string;
      clueOrder: number;
      evidence: string;
      claimedEffect: 'weakens' | 'rules_out';
      verdict: 'valid' | 'weak_or_neutral' | 'backwards' | 'unsupported';
      issue: string;
    }>;
    educationalValueScore: number;
    graphConsistencyScore: number;
    ambiguitySuitabilityScore: number;
    issues: string[];
    recommendations: string[];
  }> = {},
) {
  return {
    passed: overrides.passed ?? true,
    score: overrides.score ?? 92,
    clinicalAccuracyScore: overrides.clinicalAccuracyScore ?? 96,
    clueProgressionScore: overrides.clueProgressionScore ?? 88,
    differentialQualityScore: overrides.differentialQualityScore ?? 90,
    differentialRuleOutScore: overrides.differentialRuleOutScore ?? 86,
    differentialPlausibilityScore:
      overrides.differentialPlausibilityScore ?? 88,
    differentialDiscriminationScore:
      overrides.differentialDiscriminationScore ?? 87,
    clinicalEdgeValidityScore: overrides.clinicalEdgeValidityScore ?? 90,
    invalidReasoningEdges: overrides.invalidReasoningEdges ?? [],
    educationalValueScore: overrides.educationalValueScore ?? 84,
    graphConsistencyScore: overrides.graphConsistencyScore ?? 82,
    ambiguitySuitabilityScore: overrides.ambiguitySuitabilityScore ?? 84,
    issues: overrides.issues ?? [],
    recommendations: overrides.recommendations ?? [],
  };
}

function buildDifferentialPreflight(
  differentials: string[] = [
    'Chronic obstructive pulmonary disease',
    'Vocal cord dysfunction',
    'Heart failure',
  ],
  overrides: Partial<DifferentialPreflightCritique> = {},
): DifferentialPreflightCritique {
  return {
    passed: overrides.passed ?? true,
    score: overrides.score ?? 92,
    issues: overrides.issues ?? [],
    recommendations: overrides.recommendations ?? [],
    assessments:
      overrides.assessments ??
      differentials.map((diagnosis) => ({
        diagnosis,
        category: 'competing_diagnosis',
        plausibleFromClues0To2: true,
        fitsDemographics: true,
        fitsTimelineAcuitySetting: true,
        sharesEarlyFeatures: true,
        separableByLaterClues: true,
        verdict: 'valid',
        issue: null,
      })),
  };
}

function mockRepeatedGenerationCritique(
  generatedCase: GeneratedCase,
  critique: ReturnType<typeof buildCritique>,
  preflight = buildDifferentialPreflight(generatedCase.differentials),
) {
  const create = jest.fn();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    create
      .mockResolvedValueOnce(mockCompletion(generatedCase))
      .mockResolvedValueOnce(mockCompletion(preflight))
      .mockResolvedValueOnce(mockCompletion(critique));
  }

  return create;
}

function mockRepeatedGenerationPreflight(
  generatedCase: GeneratedCase,
  preflight: DifferentialPreflightCritique,
) {
  const create = jest.fn();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    create
      .mockResolvedValueOnce(mockCompletion(generatedCase))
      .mockResolvedValueOnce(mockCompletion(preflight));
  }

  return create;
}

function buildInvalidReasoningEdge(
  overrides: Partial<
    ReturnType<typeof buildCritique>['invalidReasoningEdges'][number]
  > = {},
): ReturnType<typeof buildCritique>['invalidReasoningEdges'][number] {
  return {
    differential: overrides.differential ?? 'Pulmonary embolism',
    clueOrder: overrides.clueOrder ?? 2,
    evidence: overrides.evidence ?? 'Oxygen saturation is 88% on room air',
    claimedEffect: overrides.claimedEffect ?? 'weakens',
    verdict: overrides.verdict ?? 'backwards',
    issue:
      overrides.issue ??
      'Hypoxia does not weaken pulmonary embolism; it can support it.',
  };
}

function classifyFailure(
  service: CaseGeneratorService,
  message: string,
): CaseGenerationFailureCategory {
  return (
    service as unknown as {
      classifyGenerationFailure(error: Error): CaseGenerationFailureCategory;
    }
  ).classifyGenerationFailure(new Error(message));
}

describe('CaseGeneratorService', () => {
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

  beforeEach(() => {
    Object.entries(requiredEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
    resetEnvCacheForTests();
  });

  afterEach(() => {
    Object.keys(requiredEnv).forEach((key) => {
      delete process.env[key];
    });
    resetEnvCacheForTests();
  });

  const buildDifferentialAnalysis = (
    differentials: string[] = [
      'Chronic obstructive pulmonary disease',
      'Vocal cord dysfunction',
      'Heart failure',
    ],
  ): GeneratedCase['explanation']['differentialAnalysis'] =>
    differentials.map((diagnosis) => ({
      diagnosis,
      whyPlausibleEarly: `${diagnosis} is plausible early because cough, wheeze, and chest tightness can overlap with the broad opening presentation.`,
      ruledOutByClues: [
        {
          clueOrder: 5,
          evidence:
            'Spirometry shows reversible airflow obstruction with FEV1 increase of 15%',
          reason: `The reversible obstructive spirometry result supports asthma more strongly than ${diagnosis}.`,
        },
      ],
      finalReasonLessLikely: `${diagnosis} is less likely because reversible airflow obstruction and bronchodilator response fit asthma better.`,
    }));

  const buildGeneratedCase = (
    overrides: Partial<GeneratedCase> = {},
  ): GeneratedCase => ({
    answer: 'Asthma',
    clues: [
      {
        type: 'history',
        value:
          'Child with intermittent cough after exercise and cold air exposure',
        order: 0,
      },
      {
        type: 'symptom',
        value: 'Episodic nocturnal wheezing with chest tightness',
        order: 1,
      },
      {
        type: 'vital',
        value: 'Oxygen saturation is 96% on room air with mild tachypnea',
        order: 2,
      },
      {
        type: 'exam',
        value: 'Diffuse expiratory wheezes with a prolonged expiratory phase',
        order: 3,
      },
      {
        type: 'lab',
        value:
          'Peak expiratory flow improves by 18% after inhaled bronchodilator',
        order: 4,
      },
      {
        type: 'lab',
        value:
          'Spirometry shows reversible airflow obstruction with FEV1 increase of 15%',
        order: 5,
      },
    ],
    differentials: [
      'Chronic obstructive pulmonary disease',
      'Vocal cord dysfunction',
      'Heart failure',
    ],
    explanation: {
      diagnosis: 'Asthma',
      summary: 'Reversible episodic bronchoconstriction explains the symptoms.',
      reasoning: [
        'Exercise-triggered nocturnal wheezing, diffuse expiratory wheezes, and reversible obstruction support the diagnosis over the listed alternatives.',
      ],
      keyFindings: [
        'Nocturnal wheeze',
        'Bronchodilator response',
        'Reversible airflow obstruction',
      ],
      differentialAnalysis: buildDifferentialAnalysis(overrides.differentials),
    },
    ...overrides,
  });

  const withGenerationQuality = (
    generatedCase: GeneratedCase,
    overrides: Partial<{
      estimatedDifficulty: 'easy' | 'medium' | 'hard';
      specialty: string | null;
      qualityScore: number;
    }> = {},
  ): GeneratedCase =>
    ({
      ...generatedCase,
      explanation: {
        ...generatedCase.explanation,
        generationQuality: {
          version: 'case-generator:v2',
          critiqueScore: overrides.qualityScore ?? 92,
          critiquePassed: true,
          critiqueIssues: [],
          critiqueRecommendations: [],
          estimatedDifficulty: overrides.estimatedDifficulty ?? 'medium',
          estimatedSolveClue: 5,
          specialty: overrides.specialty ?? null,
          acuity: 'low',
          hasLabs: true,
          hasImaging: false,
          hasVitals: true,
          differentialCount: generatedCase.differentials.length,
          qualityScore: overrides.qualityScore ?? 92,
        },
      },
    }) as GeneratedCase;

  const buildPlannedDiagnosis = () => ({
    diagnosisRegistryId: 'registry-1',
    legacyDiagnosisId: 'diagnosis-1',
    displayLabel: 'Asthma',
    canonicalName: 'asthma',
    acceptedAliases: ['Reactive airway disease'],
    specialty: 'Pulmonology',
    category: 'Obstructive',
    bodySystem: 'Respiratory',
    difficultyBand: 'INTERMEDIATE',
    existingCaseCount: 0,
    lastGeneratedAt: null,
    recentUsePenaltyApplied: false,
  });

  const buildRegistryFindResult = () => ({
    id: 'registry-1',
    legacyDiagnosisId: 'diagnosis-1',
    displayLabel: 'Asthma',
    canonicalName: 'asthma',
    aliases: [{ term: 'Reactive airway disease' }],
    specialty: 'Pulmonology',
    category: 'Obstructive',
    bodySystem: 'Respiratory',
    difficultyBand: 'INTERMEDIATE',
  });

  const buildService = () => {
    const tx: TransactionMock = {
      case: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'case-1',
          title: 'asthma',
          difficulty: 'medium',
          date: new Date('2026-04-20T00:00:00.000Z'),
        }),
      },
      diagnosis: {
        upsert: jest.fn().mockResolvedValue({
          id: 'diagnosis-1',
        }),
      },
    };
    const prisma = {
      case: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      diagnosisRegistry: {
        findFirst: jest.fn().mockResolvedValue(buildRegistryFindResult()),
        findMany: jest.fn().mockResolvedValue([
          {
            id: '11111111-1111-4111-8111-111111111111',
            legacyDiagnosisId: 'diagnosis-1',
            displayLabel: 'Asthma',
            canonicalName: 'asthma',
            aliases: [{ term: 'Reactive airway disease' }],
            specialty: 'Pulmonology',
            category: 'Obstructive',
            bodySystem: 'Respiratory',
            difficultyBand: 'INTERMEDIATE',
            _count: { cases: 0 },
            cases: [],
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            legacyDiagnosisId: 'diagnosis-2',
            displayLabel: 'Appendicitis',
            canonicalName: 'appendicitis',
            aliases: [],
            specialty: 'General Surgery',
            category: 'Inflammatory',
            bodySystem: 'Gastrointestinal',
            difficultyBand: 'BASIC',
            _count: { cases: 0 },
            cases: [],
          },
        ]),
      },
      $transaction: jest.fn(
        (handler: (transaction: TransactionMock) => unknown) => handler(tx),
      ),
    };
    const caseValidationOrchestrator = {
      runShadowForGeneratedCaseInTransaction: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    const diagnosisRegistryLinkService = {
      resolveForWrite: jest.fn().mockResolvedValue({
        diagnosisId: 'diagnosis-1',
        diagnosisName: 'Asthma',
        diagnosisRegistryId: 'registry-1',
      }),
    };
    const generationPlannerService = {
      createShadowPlan: jest.fn(
        async ({
          batchId,
          options,
        }: {
          batchId: string;
          options: { count: number };
        }) =>
          Array.from({ length: options.count }, (_, index) => ({
            batchId,
            index,
            diagnosis: {
              diagnosisRegistryId: `registry-${index + 1}`,
              legacyDiagnosisId: `diagnosis-${index + 1}`,
              displayLabel: index === 0 ? 'Asthma' : 'Appendicitis',
              canonicalName: index === 0 ? 'asthma' : 'appendicitis',
              acceptedAliases:
                index === 0 ? ['Reactive airway disease'] : [],
              specialty: index === 0 ? 'Pulmonology' : 'General Surgery',
              category: index === 0 ? 'Obstructive' : 'Inflammatory',
              bodySystem: index === 0 ? 'Respiratory' : 'Gastrointestinal',
              difficultyBand: 'INTERMEDIATE',
              existingCaseCount: 0,
              lastGeneratedAt: null,
              recentUsePenaltyApplied: false,
            },
            duplicatePrevented: false,
            selectionStatus: 'selected',
            repeatReason: null,
            existingCaseCount: 0,
            recentUsePenaltyApplied: false,
            diagnostics: {
              candidateCount: options.count,
              unusedCandidateCount: options.count,
              repeatedCandidateCount: 0,
              selectedUnusedCount: options.count,
              selectedRepeatCount: 0,
              repeatReason: null,
              existingCaseCountByDiagnosis: Object.fromEntries(
                Array.from({ length: options.count }, (_value, slotIndex) => [
                  `registry-${slotIndex + 1}`,
                  0,
                ]),
              ),
              recentUsePenaltyApplied: false,
            },
          })),
      ),
      compareAnswerToPlannedDiagnosis: jest.fn(
        ({
          slot,
          aiAnswer,
        }: {
          slot: PlannedGenerationSlot;
          aiAnswer: string;
        }) => {
          const normalizedAiAnswer = aiAnswer.toLowerCase();
          const normalizedPlannerDiagnosis =
            slot.diagnosis?.displayLabel.toLowerCase() ?? '';

          return {
            ...slot,
            comparison: {
              aiAnswer,
              normalizedAiAnswer,
              normalizedPlannerDiagnosis,
              matchesPlanner:
                normalizedAiAnswer === normalizedPlannerDiagnosis,
            },
          };
        },
      ),
    };
    const generationContextBuilder = {
      build: jest.fn().mockResolvedValue({
        diagnosis: {
          id: '11111111-1111-4111-8111-111111111111',
          displayLabel: 'Asthma',
          canonicalName: 'asthma',
          aliases: ['Reactive airway disease'],
        },
        requiredTeachingUnits: [],
        suggestedManifestations: [],
        difficultyStrategy: {
          targetDifficulty: 'medium',
          revealCoreUnitByClue: 3,
          avoidTooEarly: [],
          allowAlternativeManifestations: true,
        },
        difficultyGuidance: {
          baselineDifficulty: 'INTERMEDIATE',
          targetDifficulty: 'medium',
          targetSolveClue: null,
          forbiddenEarlyClues: [],
          keepAliveDifferentials: [],
        },
      }),
    };

    const service = new CaseGeneratorService(
      prisma as never,
      caseValidationOrchestrator as never,
      diagnosisRegistryLinkService as never,
      generationPlannerService as never,
      generationContextBuilder as never,
    );

    return {
      tx,
      prisma,
      caseValidationOrchestrator,
      diagnosisRegistryLinkService,
      generationPlannerService,
      generationContextBuilder,
      service,
    };
  };

  it('classifies generation failure messages', () => {
    const { service } = buildService();

    expect(
      classifyFailure(
        service,
        'Lab, imaging, or vital clue at order 2 must include a realistic objective finding',
      ),
    ).toBe('objective_detail');
    expect(
      classifyFailure(
        service,
        'Clue at order 2 leaks the final diagnosis before the confirmatory clue',
      ),
    ).toBe('answer_leakage');
    expect(
      classifyFailure(
        service,
        'Generated case failed differential preflight: COPD is not plausible',
      ),
    ).toBe('differential_preflight');
    expect(
      classifyFailure(
        service,
        'DifferentialAnalysis rule-out evidence must be copied or tightly paraphrased from the referenced clue',
      ),
    ).toBe('differential_grounding');
    expect(
      classifyFailure(service, 'Generated case failed critique: weak mimic'),
    ).toBe('full_critique');
    expect(
      classifyFailure(
        service,
        'Generated case answer "Mass" does not match fixed diagnosis "Asthma"',
      ),
    ).toBe('registry_target_mismatch');
    expect(
      classifyFailure(service, 'OpenAI returned an empty case payload'),
    ).toBe('openai_empty_response');
    expect(classifyFailure(service, 'Connection error.')).toBe(
      'connection_error',
    );
    expect(classifyFailure(service, 'fetch failed')).toBe('connection_error');
    expect(classifyFailure(service, 'Rate limit exceeded: 429')).toBe(
      'connection_error',
    );
    expect(
      classifyFailure(service, 'Failed to parse generated case JSON: bad'),
    ).toBe('json_parse');
    expect(
      classifyFailure(service, 'schema is invalid for this response'),
    ).toBe('schema_invalid');
    expect(classifyFailure(service, 'Something surprising happened')).toBe(
      'unknown',
    );
  });

  it('persists a generated case through an existing registry target', async () => {
    const { tx, diagnosisRegistryLinkService, service } = buildService();

    await service.saveCase(buildGeneratedCase());

    expect(diagnosisRegistryLinkService.resolveForWrite).not.toHaveBeenCalled();
    expect(tx.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are typed as any in this nested object.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          diagnosisId: 'diagnosis-1',
          diagnosisRegistryId: 'registry-1',
          proposedDiagnosisText: 'Asthma',
          diagnosisMappingStatus: 'MATCHED',
          diagnosisMappingMethod: 'EDITOR_SELECTED',
          diagnosisMappingConfidence: 1,
        }),
      }),
    );
  });

  it('assigns the next public number when persisting a generated case', async () => {
    const { tx, service } = buildService();
    tx.case.findFirst.mockResolvedValueOnce({ publicNumber: 237 });

    await service.saveCase(buildGeneratedCase());

    expect(tx.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicNumber: 238,
        }),
      }),
    );
  });

  it('rejects generated cases that do not include exactly 6 clues', () => {
    const { service } = buildService();

    expect(() =>
      service.validateCase(
        buildGeneratedCase({
          clues: buildGeneratedCase().clues.slice(0, 5),
        }),
      ),
    ).toThrow('Generated case must include exactly 6 clues');
  });

  it('rejects generated cases with too few differentials', () => {
    const { service } = buildService();

    expect(() =>
      service.validateCase(
        buildGeneratedCase({
          differentials: ['Chronic obstructive pulmonary disease'],
        }),
      ),
    ).toThrow('Generated case must include 3-5 plausible differentials');
  });

  it('accepts valid generated cases with differential analysis', () => {
    const { service } = buildService();

    expect(() => service.validateCase(buildGeneratedCase())).not.toThrow();
  });

  it('rejects sex-specific differentials that conflict with patient sex', () => {
    const { service } = buildService();
    const differentials = [
      'Gastroenteritis',
      'Renal colic',
      'Ovarian torsion',
    ];
    const generatedCase = buildGeneratedCase({
      answer: 'Appendicitis',
      clues: [
        {
          type: 'history',
          value:
            'A 24-year-old male presents with periumbilical abdominal pain migrating to the right lower quadrant',
          order: 0,
        },
        {
          type: 'vital',
          value: 'Temperature is 100.8°F, HR is 104/min, and BP is 122/76 mmHg',
          order: 1,
        },
        {
          type: 'exam',
          value:
            'Right lower quadrant tenderness is present with guarding at McBurney point',
          order: 2,
        },
        {
          type: 'lab',
          value: 'WBC is 15,600/mm3 with 84% neutrophils',
          order: 3,
        },
        {
          type: 'imaging',
          value:
            'CT abdomen shows a 9 mm inflamed appendix with periappendiceal fat stranding',
          order: 4,
        },
        {
          type: 'lab',
          value: 'C-reactive protein is 74 mg/L',
          order: 5,
        },
      ],
      differentials,
      explanation: {
        diagnosis: 'Appendicitis',
        summary:
          'Migratory right lower quadrant pain with neutrophilic leukocytosis and CT inflammation supports appendicitis.',
        reasoning: [
          'The migratory pain, focal guarding, leukocytosis, and CT findings distinguish appendicitis from the listed mimics.',
        ],
        keyFindings: [
          'Migratory right lower quadrant pain',
          'Neutrophilic leukocytosis',
          'Inflamed appendix on CT',
        ],
        differentialAnalysis: differentials.map((diagnosis) => ({
          diagnosis,
          whyPlausibleEarly: `${diagnosis} can initially overlap with right lower quadrant abdominal pain before localization and imaging clarify the diagnosis.`,
          ruledOutByClues: [
            {
              clueOrder: 4,
              evidence:
                'CT abdomen shows a 9 mm inflamed appendix with periappendiceal fat stranding',
              reason: `The inflamed appendix on CT supports appendicitis more strongly than ${diagnosis}.`,
            },
          ],
          finalReasonLessLikely: `${diagnosis} is less likely because CT localizes inflammation to the appendix.`,
        })),
      },
    });

    expect(() => service.validateCase(generatedCase)).toThrow(
      'Demographic-incompatible differential',
    );
  });

  it('allows ovarian torsion as a differential when patient sex is compatible', () => {
    const { service } = buildService();
    const differentials = [
      'Gastroenteritis',
      'Renal colic',
      'Ovarian torsion',
    ];
    const generatedCase = buildGeneratedCase({
      answer: 'Appendicitis',
      clues: [
        {
          type: 'history',
          value:
            'A 24-year-old female presents with periumbilical abdominal pain migrating to the right lower quadrant',
          order: 0,
        },
        {
          type: 'vital',
          value: 'Temperature is 100.8°F, HR is 104/min, and BP is 122/76 mmHg',
          order: 1,
        },
        {
          type: 'exam',
          value:
            'Right lower quadrant tenderness is present with guarding at McBurney point',
          order: 2,
        },
        {
          type: 'lab',
          value: 'WBC is 15,600/mm3 with 84% neutrophils',
          order: 3,
        },
        {
          type: 'imaging',
          value:
            'CT abdomen shows a 9 mm inflamed appendix with periappendiceal fat stranding',
          order: 4,
        },
        {
          type: 'lab',
          value: 'C-reactive protein is 74 mg/L',
          order: 5,
        },
      ],
      differentials,
      explanation: {
        diagnosis: 'Appendicitis',
        summary:
          'Migratory right lower quadrant pain with neutrophilic leukocytosis and CT inflammation supports appendicitis.',
        reasoning: [
          'The migratory pain, focal guarding, leukocytosis, and CT findings distinguish appendicitis from the listed mimics.',
        ],
        keyFindings: [
          'Migratory right lower quadrant pain',
          'Neutrophilic leukocytosis',
          'Inflamed appendix on CT',
        ],
        differentialAnalysis: differentials.map((diagnosis) => ({
          diagnosis,
          whyPlausibleEarly: `${diagnosis} can initially overlap with right lower quadrant abdominal pain before localization and imaging clarify the diagnosis.`,
          ruledOutByClues: [
            {
              clueOrder: 4,
              evidence:
                'CT abdomen shows a 9 mm inflamed appendix with periappendiceal fat stranding',
              reason: `The inflamed appendix on CT supports appendicitis more strongly than ${diagnosis}.`,
            },
          ],
          finalReasonLessLikely: `${diagnosis} is less likely because CT localizes inflammation to the appendix.`,
        })),
      },
    });

    expect(() => service.validateCase(generatedCase)).not.toThrow();
  });

  it('classifies sex-specific differential violations clearly', () => {
    const { service } = buildService();

    expect(
      classifyFailure(
        service,
        'Demographic-incompatible differential: "Ovarian torsion" is not compatible with male patient sex',
      ),
    ).toBe('demographic_incompatible_differential');
  });

  it('rejects vague lab clues without objective values', () => {
    const { service } = buildService();

    expect(() =>
      service.validateCase(
        buildGeneratedCase({
          clues: buildGeneratedCase().clues.map((clue) =>
            clue.order === 4
              ? { ...clue, value: 'BNP is elevated' }
              : clue,
          ),
        }),
      ),
    ).toThrow('must include a realistic objective finding');
  });

  it('rejects vague imaging clues without objective findings', () => {
    const { service } = buildService();

    expect(() =>
      service.validateCase(
        buildGeneratedCase({
          clues: buildGeneratedCase().clues.map((clue) =>
            clue.order === 4
              ? { type: 'imaging', value: 'Chest X-ray is abnormal', order: 4 }
              : clue,
          ),
        }),
      ),
    ).toThrow('must include a realistic objective finding');
  });

  it('rejects vague vital clues without vital sign values', () => {
    const { service } = buildService();

    expect(() =>
      service.validateCase(
        buildGeneratedCase({
          clues: buildGeneratedCase().clues.map((clue) =>
            clue.order === 2
              ? { ...clue, value: 'Vitals are unstable' }
              : clue,
          ),
        }),
      ),
    ).toThrow('must include a realistic objective finding');
  });

  it('accepts realistic objective lab, vital, and imaging clues', () => {
    const { service } = buildService();

    expect(() =>
      service.validateCase(
        buildGeneratedCase({
          clues: buildGeneratedCase().clues.map((clue) => {
            if (clue.order === 2) {
              return {
                ...clue,
                value: 'BP is 118/72 mmHg, HR is 96/min, and RR is 22/min',
              };
            }

            if (clue.order === 4) {
              return {
                type: 'imaging',
                value:
                  'Chest X-ray shows bilateral perihilar opacities and small pleural effusions',
                order: 4,
              };
            }

            return clue;
          }),
        }),
      ),
    ).not.toThrow();
  });

  it('rejects missing differential analysis', () => {
    const { service } = buildService();
    const generatedCase = buildGeneratedCase();

    expect(() =>
      service.validateCase({
        ...generatedCase,
        explanation: {
          ...generatedCase.explanation,
          differentialAnalysis: undefined as never,
        },
      }),
    ).toThrow('Generated case schema is invalid');
  });

  it('rejects mismatch between differentials and differentialAnalysis', () => {
    const { service } = buildService();
    const generatedCase = buildGeneratedCase();

    expect(() =>
      service.validateCase({
        ...generatedCase,
        explanation: {
          ...generatedCase.explanation,
          differentialAnalysis:
            generatedCase.explanation.differentialAnalysis.slice(0, 2),
        },
      }),
    ).toThrow('exactly one item per differential');
  });

  it('rejects extra diagnosis in differentialAnalysis', () => {
    const { service } = buildService();
    const generatedCase = buildGeneratedCase();

    expect(() =>
      service.validateCase({
        ...generatedCase,
        explanation: {
          ...generatedCase.explanation,
          differentialAnalysis: [
            ...generatedCase.explanation.differentialAnalysis.slice(0, 2),
            {
              ...generatedCase.explanation.differentialAnalysis[2],
              diagnosis: 'Pneumonia',
            },
          ],
        },
      }),
    ).toThrow('contains extra diagnosis');
  });

  it('rejects final diagnosis inside differentialAnalysis', () => {
    const { service } = buildService();
    const generatedCase = buildGeneratedCase();

    expect(() =>
      service.validateCase({
        ...generatedCase,
        explanation: {
          ...generatedCase.explanation,
          differentialAnalysis: [
            ...generatedCase.explanation.differentialAnalysis.slice(0, 2),
            {
              ...generatedCase.explanation.differentialAnalysis[2],
              diagnosis: 'Asthma',
            },
          ],
        },
      }),
    ).toThrow('must not include the final diagnosis');
  });

  it('rejects empty or generic rule-out reasoning', () => {
    const { service } = buildService();
    const generatedCase = buildGeneratedCase();

    expect(() =>
      service.validateCase({
        ...generatedCase,
        explanation: {
          ...generatedCase.explanation,
          differentialAnalysis: [
            {
              ...generatedCase.explanation.differentialAnalysis[0],
              ruledOutByClues: [
                {
                  ...generatedCase.explanation.differentialAnalysis[0]
                    .ruledOutByClues[0],
                  reason: 'less likely clinically',
                },
              ],
            },
            ...generatedCase.explanation.differentialAnalysis.slice(1),
          ],
        },
      }),
    ).toThrow('rule-out reason must be non-empty and case-specific');
  });

  it('rejects invalid differentialAnalysis clueOrder', () => {
    const { service } = buildService();
    const generatedCase = buildGeneratedCase();

    expect(() =>
      service.validateCase({
        ...generatedCase,
        explanation: {
          ...generatedCase.explanation,
          differentialAnalysis: [
            {
              ...generatedCase.explanation.differentialAnalysis[0],
              ruledOutByClues: [
                {
                  ...generatedCase.explanation.differentialAnalysis[0]
                    .ruledOutByClues[0],
                  clueOrder: 9,
                },
              ],
            },
            ...generatedCase.explanation.differentialAnalysis.slice(1),
          ],
        },
      }),
    ).toThrow('references invalid clueOrder 9');
  });

  it('rejects answer leakage before the confirmatory clue', () => {
    const { service } = buildService();
    const generatedCase = buildGeneratedCase({
      clues: buildGeneratedCase().clues.map((clue) =>
        clue.order === 2
          ? { ...clue, value: 'Asthma symptoms worsen after exercise' }
          : clue,
      ),
    });

    expect(() => service.validateCase(generatedCase)).toThrow(
      'leaks the final diagnosis before the confirmatory clue',
    );
  });

  it('accepts the confirmatory clue naming the diagnosis', () => {
    const { service } = buildService();
    const generatedCase = buildGeneratedCase({
      clues: buildGeneratedCase().clues.map((clue) =>
        clue.order === 5
          ? {
              ...clue,
              value:
                'Spirometry shows reversible airflow obstruction consistent with asthma and FEV1 increase of 15%',
            }
          : clue,
      ),
    });

    expect(() => service.validateCase(generatedCase)).not.toThrow();
  });

  it('rejects registry alias leakage before the confirmatory clue', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findFirst.mockResolvedValue({
      canonicalName: 'Pulmonary Embolism',
      displayLabel: 'Pulmonary Embolism',
      aliases: [{ term: 'PE' }],
    });

    await expect(
      service.saveCase(
        buildGeneratedCase({
          answer: 'Pulmonary Embolism',
          clues: buildGeneratedCase().clues.map((clue) =>
            clue.order === 2
              ? { ...clue, value: 'CTA is ordered because PE is likely' }
              : clue,
          ),
          explanation: {
            ...buildGeneratedCase().explanation,
            diagnosis: 'Pulmonary Embolism',
          },
        }),
      ),
    ).rejects.toThrow('leaks the final diagnosis before the confirmatory clue');
  });

  it('persists generation quality metadata in the explanation JSON', async () => {
    const { tx, service } = buildService();

    await service.saveCase({
      ...buildGeneratedCase(),
      explanation: {
        ...buildGeneratedCase().explanation,
        generationQuality: {
          version: 'case-generator:v2',
          critiqueScore: 94,
          critiquePassed: true,
          critiqueIssues: [],
          critiqueRecommendations: [],
          differentialRuleOutScore: 88,
          differentialPlausibilityScore: 89,
          differentialDiscriminationScore: 87,
          clinicalEdgeValidityScore: 90,
          invalidReasoningEdges: [],
          educationalValueScore: 86,
          graphConsistencyScore: 84,
          estimatedDifficulty: 'medium',
          estimatedSolveClue: 5,
          specialty: null,
          acuity: 'low',
          hasLabs: true,
          hasImaging: false,
          hasVitals: true,
          differentialCount: 3,
          qualityScore: 94,
        },
      },
    } as GeneratedCase);

    expect(tx.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are typed as any in this nested object.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          explanation: expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            differentialAnalysis: expect.arrayContaining([
              expect.objectContaining({
                diagnosis: 'Chronic obstructive pulmonary disease',
                ruledOutByClues: expect.arrayContaining([
                  expect.objectContaining({
                    clueOrder: 5,
                  }),
                ]) as unknown,
              }),
            ]),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            generationQuality: expect.objectContaining({
              critiqueScore: 94,
              critiquePassed: true,
              differentialRuleOutScore: 88,
              differentialPlausibilityScore: 89,
              differentialDiscriminationScore: 87,
              clinicalEdgeValidityScore: 90,
              invalidReasoningEdges: [],
              educationalValueScore: 86,
              graphConsistencyScore: 84,
              estimatedDifficulty: 'medium',
              estimatedSolveClue: 5,
              hasLabs: true,
              hasImaging: false,
              hasVitals: true,
              differentialCount: 3,
              qualityScore: 94,
            }),
          }),
        }),
      }),
    );
  });

  it('saves registry-first cases against the planned diagnosis label and registry link', async () => {
    const { diagnosisRegistryLinkService, tx, service } = buildService();
    const target = buildPlannedDiagnosis();

    await service.saveCaseForRegistryTarget(buildGeneratedCase(), target);

    expect(diagnosisRegistryLinkService.resolveForWrite).not.toHaveBeenCalled();
    expect(tx.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Asthma',
          diagnosisId: 'diagnosis-1',
          diagnosisRegistryId: 'registry-1',
          proposedDiagnosisText: 'Asthma',
          diagnosisMappingStatus: 'MATCHED',
          diagnosisMappingMethod: 'EDITOR_SELECTED',
          diagnosisMappingConfidence: 1,
        }),
      }),
    );
  });

  it('allows registry-first cases for the same diagnosis when the scenario differs', async () => {
    const { prisma, tx, service } = buildService();
    const target = buildPlannedDiagnosis();
    const existingCase = buildGeneratedCase({
      clues: buildGeneratedCase().clues.map((clue) =>
        clue.order === 0
          ? {
              ...clue,
              value:
                'Older adult with chronic productive cough after decades of smoking',
            }
          : clue,
      ),
    });
    const existingCaseRow = {
      id: 'existing-case',
      title: 'Asthma',
      history: existingCase.clues[0].value,
      symptoms: [],
      clues: existingCase.clues,
    };
    prisma.case.findMany.mockResolvedValue([existingCaseRow]);
    tx.case.findMany.mockResolvedValue([existingCaseRow]);

    await expect(
      service.saveCaseForRegistryTarget(buildGeneratedCase(), target),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'case-1',
      }),
    );
    expect(tx.case.create).toHaveBeenCalled();
  });

  it('rejects registry-first cases for the same diagnosis and same scenario', async () => {
    const { prisma, tx, service } = buildService();
    const target = buildPlannedDiagnosis();
    const generatedCase = buildGeneratedCase();
    const existingCaseRow = {
      id: 'existing-case',
      title: 'Asthma',
      history: generatedCase.clues[0].value,
      symptoms: [],
      clues: generatedCase.clues,
    };
    prisma.case.findMany.mockResolvedValue([existingCaseRow]);
    tx.case.findMany.mockResolvedValue([existingCaseRow]);

    await expect(
      service.saveCaseForRegistryTarget(generatedCase, target),
    ).resolves.toBeNull();
    expect(tx.case.create).not.toHaveBeenCalled();
  });

  it('rejects registry-first answer drift before persistence', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const create = jest.fn().mockResolvedValue(
      mockCompletion({
        ...buildGeneratedCase(),
        answer: 'Intracranial mass with associated edema due to primary brain tumor',
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(
      service.generateCaseForRegistryTarget({
        target: buildPlannedDiagnosis(),
        generation: {
          difficulty: 'medium',
        },
      }),
    ).rejects.toThrow('does not match fixed diagnosis');
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('rejects registry-first differentials that include accepted aliases', async () => {
    const { service } = buildService();

    await expect(
      service.saveCaseForRegistryTarget(
        buildGeneratedCase({
          differentials: [
            'Reactive airway disease',
            'Chronic obstructive pulmonary disease',
            'Vocal cord dysfunction',
          ],
        }),
        buildPlannedDiagnosis(),
      ),
    ).rejects.toThrow(
      'Differentials must not include the fixed diagnosis or accepted aliases',
    );
  });

  it('rejects registry-first explanation diagnosis drift', async () => {
    const { service } = buildService();

    await expect(
      service.saveCaseForRegistryTarget(
        buildGeneratedCase({
          explanation: {
            ...buildGeneratedCase().explanation,
            diagnosis: 'Chronic obstructive pulmonary disease',
          },
        }),
        buildPlannedDiagnosis(),
      ),
    ).rejects.toThrow('explanation diagnosis');
  });

  it('rejects registry-first lab, imaging, or vital clues without objective findings', async () => {
    const { service } = buildService();

    await expect(
      service.saveCaseForRegistryTarget(
        buildGeneratedCase({
          clues: buildGeneratedCase().clues.map((clue) =>
            clue.order === 2
              ? { ...clue, value: 'Vital signs show mild tachypnea' }
              : clue,
          ),
        }),
        buildPlannedDiagnosis(),
      ),
    ).rejects.toThrow(
      'Lab, imaging, or vital clue at order 2 must include a realistic objective finding',
    );
  });

  it('retries failed generations and attaches passing critique metadata', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { prisma, service } = buildService();
    const generatedCase = buildGeneratedCase();
    const create = jest
      .fn()
      .mockResolvedValueOnce(
        mockCompletion({
          ...generatedCase,
          clues: generatedCase.clues.slice(0, 5),
        }),
      )
      .mockResolvedValueOnce(mockCompletion(generatedCase))
      .mockResolvedValueOnce(
        mockCompletion(buildDifferentialPreflight(generatedCase.differentials)),
      )
      .mockResolvedValueOnce(
        mockCompletion(buildCritique({
          recommendations: ['Ready for editorial review'],
        })),
      );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    const result = await service.generateCase();
    const explanation = result.explanation as GeneratedCase['explanation'] & {
      generationQuality?: {
        critiqueScore: number;
        critiquePassed: boolean;
        differentialRuleOutScore: number;
        differentialPlausibilityScore: number;
        differentialDiscriminationScore: number;
        clinicalEdgeValidityScore: number;
        invalidReasoningEdges: unknown[];
        educationalValueScore: number;
        graphConsistencyScore: number;
        estimatedDifficulty: string;
        estimatedSolveClue: number;
        specialty: string | null;
        acuity: string | null;
        hasLabs: boolean;
        hasImaging: boolean;
        hasVitals: boolean;
        differentialCount: number;
        qualityScore: number;
      };
    };

    expect(create).toHaveBeenCalledTimes(4);
    expect(prisma.diagnosisRegistry.findFirst).toHaveBeenCalled();
    expect(explanation.generationQuality).toEqual(
      expect.objectContaining({
        critiqueScore: 92,
        critiquePassed: true,
        differentialRuleOutScore: 86,
        differentialPlausibilityScore: 88,
        differentialDiscriminationScore: 87,
        clinicalEdgeValidityScore: 90,
        invalidReasoningEdges: [],
        educationalValueScore: 84,
        graphConsistencyScore: 82,
        estimatedDifficulty: 'medium',
        estimatedSolveClue: 5,
        specialty: null,
        acuity: 'low',
        hasLabs: true,
        hasImaging: false,
        hasVitals: true,
        differentialCount: 3,
        qualityScore: 89,
      }),
    );
  });

  it('attaches teaching alignment metadata when generation context selects units', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const generatedCase = buildGeneratedCase();
    const create = mockRepeatedGenerationCritique(
      generatedCase,
      buildCritique(),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    const result = await service.generateCase({
      difficulty: 'medium',
      generationContext: {
        diagnosis: {
          id: 'registry-asthma',
          displayLabel: 'Asthma',
          canonicalName: 'asthma',
          aliases: [],
        },
        requiredTeachingUnits: [
          {
            id: 'reversible_airflow_obstruction',
            label: 'Reversible airflow obstruction',
            category: 'investigation_concept',
            importance: 'critical',
            rationale: 'Bronchodilator response supports asthma.',
            acceptableManifestations: [
              'bronchodilator response',
              'reversible airflow obstruction',
            ],
            appliesToEducation: true,
            appliesToCaseGeneration: true,
          },
        ],
        difficultyStrategy: {
          targetDifficulty: 'medium',
          revealCoreUnitByClue: 3,
          avoidTooEarly: [],
          allowAlternativeManifestations: true,
        },
        difficultyGuidance: {
          baselineDifficulty: 'INTERMEDIATE',
          targetDifficulty: 'medium',
          targetSolveClue: null,
          forbiddenEarlyClues: [],
          keepAliveDifferentials: ['Vocal cord dysfunction'],
        },
      } as never,
    });
    const explanation = result.explanation as GeneratedCase['explanation'] & {
      generationQuality?: {
        teachingAlignment?: {
          selectedUnits: Array<{ id: string; covered: boolean }>;
          playability: { score: number; difficultyFit: string };
          warnings: string[];
        };
      };
    };

    expect(explanation.generationQuality?.teachingAlignment).toEqual(
      expect.objectContaining({
        selectedUnits: [
          expect.objectContaining({
            id: 'reversible_airflow_obstruction',
            covered: true,
          }),
        ],
        playability: expect.objectContaining({
          score: expect.any(Number),
        }),
      }),
    );
  });

  it('persists targeted teaching unit and mimic metadata', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const generatedCase = buildGeneratedCase();
    const create = mockRepeatedGenerationCritique(
      generatedCase,
      buildCritique(),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    const result = await service.generateCase({
      difficulty: 'medium',
      targetedTeachingUnitIds: ['reversible_airflow_obstruction'],
      targetedMimics: [
        {
          diagnosisRegistryId: '22222222-2222-4222-8222-222222222222',
          diagnosis: 'Vocal cord dysfunction',
        },
      ],
      clueRevealStrategy: 'late_discriminator',
      generationContext: {
        diagnosis: {
          id: 'registry-asthma',
          displayLabel: 'Asthma',
          canonicalName: 'asthma',
          aliases: [],
        },
        requiredTeachingUnits: [
          {
            id: 'reversible_airflow_obstruction',
            label: 'Reversible airflow obstruction',
            category: 'investigation_concept',
            importance: 'critical',
            rationale: 'Bronchodilator response supports asthma.',
            acceptableManifestations: [
              'bronchodilator response',
              'reversible airflow obstruction',
            ],
            appliesToEducation: true,
            appliesToCaseGeneration: true,
          },
        ],
        difficultyStrategy: {
          targetDifficulty: 'medium',
          revealCoreUnitByClue: 3,
          avoidTooEarly: [],
          allowAlternativeManifestations: true,
        },
        difficultyGuidance: {
          baselineDifficulty: 'INTERMEDIATE',
          targetDifficulty: 'medium',
          targetSolveClue: null,
          forbiddenEarlyClues: [],
          keepAliveDifferentials: ['Vocal cord dysfunction'],
        },
      } as never,
    });
    const explanation = result.explanation as GeneratedCase['explanation'] & {
      generationQuality?: {
        targetedGeneration?: {
          teachingUnitIds: string[];
          mimicDiagnosisIds: string[];
          mimics: string[];
          clueRevealStrategy: string;
        };
      };
    };

    expect(explanation.generationQuality?.targetedGeneration).toEqual(
      expect.objectContaining({
        teachingUnitIds: ['reversible_airflow_obstruction'],
        mimicDiagnosisIds: ['22222222-2222-4222-8222-222222222222'],
        mimics: ['Vocal cord dysfunction'],
        clueRevealStrategy: 'late_discriminator',
      }),
    );
  });

  it('rejects COPD in a pediatric asthma case during differential preflight', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const generatedCase = buildGeneratedCase();
    const preflight = buildDifferentialPreflight(generatedCase.differentials, {
      passed: false,
      score: 61,
      issues: [
        'COPD is not a realistic competing diagnosis for a child with episodic exercise-triggered wheeze.',
      ],
      assessments: [
        {
          diagnosis: 'Chronic obstructive pulmonary disease',
          category: 'competing_diagnosis',
          plausibleFromClues0To2: false,
          fitsDemographics: false,
          fitsTimelineAcuitySetting: false,
          sharesEarlyFeatures: true,
          separableByLaterClues: true,
          verdict: 'invalid',
          issue:
            'A pediatric asthma presentation lacks the age and exposure history needed for COPD.',
        },
        ...buildDifferentialPreflight([
          'Vocal cord dysfunction',
          'Heart failure',
        ]).assessments,
      ],
    });
    const create = jest.fn();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      create
        .mockResolvedValueOnce(mockCompletion(generatedCase))
        .mockResolvedValueOnce(mockCompletion(preflight));
    }
    const fullCritiqueSpy = jest.spyOn(service, 'critiqueGeneratedCase');

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
    expect(create).toHaveBeenCalledTimes(6);
    expect(fullCritiqueSpy).not.toHaveBeenCalled();
  });

  it('allows COPD in an older smoker obstructive case during differential preflight', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const differentials = [
      'Chronic obstructive pulmonary disease',
      'Heart failure',
      'Vocal cord dysfunction',
    ];
    const generatedCase = buildGeneratedCase({
      clues: buildGeneratedCase().clues.map((clue) =>
        clue.order === 0
          ? {
              ...clue,
              value:
                'Older adult with exertional dyspnea, wheeze, and a 40 pack-year smoking history',
            }
          : clue,
      ),
      differentials,
      explanation: {
        ...buildGeneratedCase().explanation,
        differentialAnalysis: buildDifferentialAnalysis(differentials),
      },
    });
    const create = jest
      .fn()
      .mockResolvedValueOnce(mockCompletion(generatedCase))
      .mockResolvedValueOnce(
        mockCompletion(buildDifferentialPreflight(differentials)),
      )
      .mockResolvedValueOnce(mockCompletion(buildCritique()));

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).resolves.toEqual(
      expect.objectContaining({ answer: 'asthma' }),
    );
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('rejects AKI with prerenal azotemia as a competing differential during preflight', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const differentials = [
      'Prerenal azotemia',
      'Acute tubular necrosis',
      'Obstructive uropathy',
    ];
    const generatedCase = buildGeneratedCase({
      answer: 'Acute kidney injury',
      differentials,
      explanation: {
        ...buildGeneratedCase().explanation,
        diagnosis: 'Acute kidney injury',
        differentialAnalysis: buildDifferentialAnalysis(differentials),
      },
    });
    const create = mockRepeatedGenerationPreflight(
      generatedCase,
      buildDifferentialPreflight(differentials, {
        passed: false,
        score: 64,
        issues: [
          'Prerenal azotemia is a mechanism/subtype within AKI rather than a competing diagnosis.',
        ],
        assessments: [
          {
            diagnosis: 'Prerenal azotemia',
            category: 'cause_mechanism',
            plausibleFromClues0To2: true,
            fitsDemographics: true,
            fitsTimelineAcuitySetting: true,
            sharesEarlyFeatures: true,
            separableByLaterClues: false,
            verdict: 'invalid',
            issue:
              'Prerenal azotemia describes AKI physiology rather than a separate diagnosis competing with AKI.',
          },
          ...buildDifferentialPreflight([
            'Acute tubular necrosis',
            'Obstructive uropathy',
          ]).assessments,
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('rejects asthma exacerbation listed against asthma during preflight', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const differentials = [
      'Asthma exacerbation',
      'Vocal cord dysfunction',
      'Foreign body aspiration',
    ];
    const generatedCase = buildGeneratedCase({
      differentials,
      explanation: {
        ...buildGeneratedCase().explanation,
        differentialAnalysis: buildDifferentialAnalysis(differentials),
      },
    });
    const create = mockRepeatedGenerationPreflight(
      generatedCase,
      buildDifferentialPreflight(differentials, {
        passed: false,
        score: 68,
        issues: [
          'Asthma exacerbation is a severity/state label for asthma, not a competing diagnosis.',
        ],
        assessments: [
          {
            diagnosis: 'Asthma exacerbation',
            category: 'severity_label',
            plausibleFromClues0To2: true,
            fitsDemographics: true,
            fitsTimelineAcuitySetting: true,
            sharesEarlyFeatures: true,
            separableByLaterClues: false,
            verdict: 'invalid',
            issue:
              'Asthma exacerbation narrows the final diagnosis rather than competing with it.',
          },
          ...buildDifferentialPreflight([
            'Vocal cord dysfunction',
            'Foreign body aspiration',
          ]).assessments,
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('rejects broadly related differentials during preflight', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const differentials = [
      'Seasonal allergic rhinitis',
      'Vocal cord dysfunction',
      'Foreign body aspiration',
    ];
    const generatedCase = buildGeneratedCase({
      differentials,
      explanation: {
        ...buildGeneratedCase().explanation,
        differentialAnalysis: buildDifferentialAnalysis(differentials),
      },
    });
    const create = mockRepeatedGenerationPreflight(
      generatedCase,
      buildDifferentialPreflight(differentials, {
        passed: false,
        score: 72,
        issues: [
          'Seasonal allergic rhinitis is broadly related to atopy but does not share enough early lower-airway features.',
        ],
        assessments: [
          {
            diagnosis: 'Seasonal allergic rhinitis',
            category: 'broadly_related_only',
            plausibleFromClues0To2: false,
            fitsDemographics: true,
            fitsTimelineAcuitySetting: true,
            sharesEarlyFeatures: false,
            separableByLaterClues: true,
            verdict: 'invalid',
            issue:
              'Allergic rhinitis is related to atopy but is not a strong competing diagnosis for nocturnal wheeze and chest tightness.',
          },
          ...buildDifferentialPreflight([
            'Vocal cord dysfunction',
            'Foreign body aspiration',
          ]).assessments,
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('runs answer leakage guards before differential preflight', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const generatedCase = buildGeneratedCase({
      clues: buildGeneratedCase().clues.map((clue) =>
        clue.order === 2
          ? { ...clue, value: 'Asthma symptoms worsen after exercise' }
          : clue,
      ),
    });
    const create = jest.fn().mockResolvedValue(mockCompletion(generatedCase));
    const fullCritiqueSpy = jest.spyOn(service, 'critiqueGeneratedCase');

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
    expect(create).toHaveBeenCalledTimes(3);
    expect(fullCritiqueSpy).not.toHaveBeenCalled();
  });

  it('retries batch generation after a differential preflight failure', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const generatedCase = buildGeneratedCase();
    const failingPreflight = buildDifferentialPreflight(
      generatedCase.differentials,
      {
        passed: false,
        score: 70,
        issues: ['Heart failure is too broad for the early pediatric wheeze.'],
        assessments: [
          ...buildDifferentialPreflight([
            'Chronic obstructive pulmonary disease',
            'Vocal cord dysfunction',
          ]).assessments,
          {
            diagnosis: 'Heart failure',
            category: 'broadly_related_only',
            plausibleFromClues0To2: false,
            fitsDemographics: false,
            fitsTimelineAcuitySetting: false,
            sharesEarlyFeatures: false,
            separableByLaterClues: true,
            verdict: 'invalid',
            issue:
              'Heart failure does not fit the early child exercise-triggered wheeze scenario.',
          },
        ],
      },
    );
    const create = jest
      .fn()
      .mockResolvedValueOnce(mockCompletion(generatedCase))
      .mockResolvedValueOnce(mockCompletion(failingPreflight))
      .mockResolvedValueOnce(mockCompletion(generatedCase))
      .mockResolvedValueOnce(
        mockCompletion(buildDifferentialPreflight(generatedCase.differentials)),
      )
      .mockResolvedValueOnce(mockCompletion(buildCritique()));

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    const result = await service.generateBatch({
      count: 1,
      concurrency: 1,
      registryFirst: false,
    });

    expect(result.created).toBe(1);
    expect(result.failureSummary?.byCategory.differential_preflight).toBe(1);
    expect(result.failureSummary?.samples).toEqual([
      expect.objectContaining({
        index: 0,
        category: 'differential_preflight',
        attempt: 1,
      }),
    ]);
    expect(create).toHaveBeenCalledTimes(5);
  });

  it('returns failureCategory for a failed batch slot', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const generatedCase = buildGeneratedCase({
      clues: buildGeneratedCase().clues.map((clue) =>
        clue.order === 2
          ? { ...clue, value: 'Vital signs show mild tachypnea' }
          : clue,
      ),
    });
    const create = jest.fn();
    for (let attempt = 0; attempt < 9; attempt += 1) {
      create.mockResolvedValueOnce(mockCompletion(generatedCase));
    }

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    const result = await service.generateBatch({
      count: 1,
      concurrency: 1,
      registryFirst: false,
    });

    expect(result.failed).toBe(1);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        status: 'failed',
        failureCategory: 'objective_detail',
      }),
    );
    expect(result.failureSummary?.byCategory.objective_detail).toBe(9);
    expect(result.failureSummary?.samples[0]).toEqual(
      expect.objectContaining({
        category: 'objective_detail',
        attempt: 1,
      }),
    );
  });

  it('rejects COPD in a pediatric asthma case when plausibility is low', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const create = mockRepeatedGenerationCritique(
      buildGeneratedCase(),
      buildCritique({
        differentialPlausibilityScore: 45,
        issues: [
          'COPD is not a realistic competing differential for a 12-year-old with exercise-triggered episodic asthma symptoms.',
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
    expect(create).toHaveBeenCalledTimes(9);
  });

  it('rejects mechanism or hierarchy conflicts such as AKI versus prerenal azotemia', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const differentials = [
      'Prerenal azotemia',
      'Acute tubular necrosis',
      'Obstructive uropathy',
    ];
    const generatedCase = buildGeneratedCase({
      answer: 'Acute kidney injury',
      differentials,
      explanation: {
        ...buildGeneratedCase().explanation,
        diagnosis: 'Acute kidney injury',
        differentialAnalysis: buildDifferentialAnalysis(differentials),
      },
    });
    const create = mockRepeatedGenerationCritique(
      generatedCase,
      buildCritique({
        differentialPlausibilityScore: 74,
        differentialDiscriminationScore: 52,
        issues: [
          'Prerenal azotemia is a mechanism/subtype of AKI rather than a clean competing diagnosis.',
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('rejects copied clue evidence when the rule-out is medically invalid', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const create = mockRepeatedGenerationCritique(
      buildGeneratedCase(),
      buildCritique({
        differentialDiscriminationScore: 60,
        issues: [
          'The evidence is copied from the clue, but it does not medically rule out the listed mimic.',
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('rejects cases solved too early by clue 1 or 2', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const create = mockRepeatedGenerationCritique(
      buildGeneratedCase(),
      buildCritique({
        clueProgressionScore: 65,
        ambiguitySuitabilityScore: 68,
        issues: [
          'The case is effectively solved before clue 4 and does not preserve progressive ambiguity.',
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('rejects explanations that restate clues without teaching discriminators', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const create = mockRepeatedGenerationCritique(
      buildGeneratedCase(),
      buildCritique({
        educationalValueScore: 62,
        issues: [
          'The explanation restates clue text without teaching discriminators between the final answer and mimics.',
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('rejects component scores below threshold even when passed is true', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const create = mockRepeatedGenerationCritique(
      buildGeneratedCase(),
      buildCritique({
        passed: true,
        score: 93,
        graphConsistencyScore: 69,
        issues: [],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('rejects pneumonia cases that claim hypoxia weakens pulmonary embolism', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const create = mockRepeatedGenerationCritique(
      buildGeneratedCase({
        answer: 'Pneumonia',
        differentials: [
          'Pulmonary embolism',
          'Heart failure',
          'Asthma exacerbation',
        ],
        explanation: {
          diagnosis: 'Pneumonia',
          summary:
            'Fever, productive cough, focal crackles, and lobar consolidation support pneumonia.',
          reasoning: [
            'Lobar consolidation with infectious symptoms distinguishes pneumonia from pulmonary embolism and heart failure.',
          ],
          keyFindings: ['Fever', 'Productive cough', 'Lobar consolidation'],
          differentialAnalysis: buildDifferentialAnalysis([
            'Pulmonary embolism',
            'Heart failure',
            'Asthma exacerbation',
          ]),
        },
      }),
      buildCritique({
        score: 96,
        clinicalEdgeValidityScore: 60,
        invalidReasoningEdges: [
          buildInvalidReasoningEdge({
            differential: 'Pulmonary embolism',
            evidence: 'Oxygen saturation is 88% on room air',
            verdict: 'backwards',
          }),
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('allows pneumonia cases that use lobar consolidation to weaken pulmonary embolism', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const generatedCase = buildGeneratedCase({
      answer: 'Pneumonia',
      differentials: [
        'Pulmonary embolism',
        'Heart failure',
        'Asthma exacerbation',
      ],
      clues: buildGeneratedCase().clues.map((clue) =>
        clue.order === 5
          ? {
              ...clue,
              type: 'imaging',
              value:
                'Chest radiograph shows right lower lobe consolidation with air bronchograms',
            }
          : clue,
      ),
      explanation: {
        diagnosis: 'Pneumonia',
        summary:
          'Fever, productive cough, focal crackles, and lobar consolidation support pneumonia.',
        reasoning: [
          'Lobar consolidation with infectious symptoms distinguishes pneumonia from pulmonary embolism and heart failure.',
        ],
        keyFindings: ['Fever', 'Productive cough', 'Lobar consolidation'],
        differentialAnalysis: [
          {
            diagnosis: 'Pulmonary embolism',
            whyPlausibleEarly:
              'Pulmonary embolism can present with dyspnea, hypoxia, and chest symptoms early in the case.',
            ruledOutByClues: [
              {
                clueOrder: 5,
                evidence:
                  'Chest radiograph shows right lower lobe consolidation with air bronchograms',
                reason:
                  'Focal lobar consolidation with air bronchograms supports pneumonia more strongly than pulmonary embolism.',
              },
            ],
            finalReasonLessLikely:
              'Pulmonary embolism is less likely because focal infectious consolidation explains the presentation better.',
          },
          {
            diagnosis: 'Heart failure',
            whyPlausibleEarly:
              'Heart failure is plausible early because dyspnea, hypoxia, and chest symptoms can overlap with the opening presentation.',
            ruledOutByClues: [
              {
                clueOrder: 5,
                evidence:
                  'Chest radiograph shows right lower lobe consolidation with air bronchograms',
                reason:
                  'Focal lobar consolidation with air bronchograms supports pneumonia more strongly than pulmonary edema from heart failure.',
              },
            ],
            finalReasonLessLikely:
              'Heart failure is less likely because the focal consolidation pattern explains the presentation better.',
          },
          {
            diagnosis: 'Asthma exacerbation',
            whyPlausibleEarly:
              'Asthma exacerbation is plausible early because cough and dyspnea can overlap with pneumonia.',
            ruledOutByClues: [
              {
                clueOrder: 5,
                evidence:
                  'Chest radiograph shows right lower lobe consolidation with air bronchograms',
                reason:
                  'Focal lobar consolidation with air bronchograms supports pneumonia more strongly than asthma exacerbation.',
              },
            ],
            finalReasonLessLikely:
              'Asthma exacerbation is less likely because focal consolidation is not the expected primary finding.',
          },
        ],
      },
    });
    const create = jest
      .fn()
      .mockResolvedValueOnce(mockCompletion(generatedCase))
      .mockResolvedValueOnce(
        mockCompletion(buildDifferentialPreflight(generatedCase.differentials)),
      )
      .mockResolvedValueOnce(mockCompletion(buildCritique()));

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).resolves.toEqual(
      expect.objectContaining({ answer: 'pneumonia' }),
    );
  });

  it('rejects cases that claim bronchodilator reversibility weakens asthma', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const create = mockRepeatedGenerationCritique(
      buildGeneratedCase({
        answer: 'Vocal cord dysfunction',
        differentials: ['Asthma', 'Panic attack', 'Foreign body aspiration'],
        explanation: {
          diagnosis: 'Vocal cord dysfunction',
          summary:
            'Inspiratory throat tightness and laryngoscopy findings support vocal cord dysfunction.',
          reasoning: [
            'Laryngoscopy during symptoms is the key discriminator for vocal cord dysfunction.',
          ],
          keyFindings: ['Inspiratory stridor', 'Normal oxygen saturation'],
          differentialAnalysis: buildDifferentialAnalysis([
            'Asthma',
            'Panic attack',
            'Foreign body aspiration',
          ]),
        },
      }),
      buildCritique({
        score: 95,
        clinicalEdgeValidityScore: 58,
        invalidReasoningEdges: [
          buildInvalidReasoningEdge({
            differential: 'Asthma',
            clueOrder: 4,
            evidence:
              'Peak expiratory flow improves by 18% after inhaled bronchodilator',
            verdict: 'backwards',
            issue:
              'Bronchodilator response supports asthma rather than weakening it.',
          }),
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('allows asthma cases that use bronchodilator response to weaken vocal cord dysfunction', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const generatedCase = buildGeneratedCase({
      differentials: [
        'Vocal cord dysfunction',
        'Foreign body aspiration',
        'Heart failure',
      ],
      explanation: {
        ...buildGeneratedCase().explanation,
        differentialAnalysis: buildDifferentialAnalysis([
          'Vocal cord dysfunction',
          'Foreign body aspiration',
          'Heart failure',
        ]),
      },
    });
    const create = jest
      .fn()
      .mockResolvedValueOnce(mockCompletion(generatedCase))
      .mockResolvedValueOnce(
        mockCompletion(buildDifferentialPreflight(generatedCase.differentials)),
      )
      .mockResolvedValueOnce(mockCompletion(buildCritique()));

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).resolves.toEqual(
      expect.objectContaining({ answer: 'asthma' }),
    );
  });

  it('rejects AKI cases that use normal ultrasound to rule out prerenal azotemia', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const differentials = [
      'Prerenal azotemia',
      'Acute tubular necrosis',
      'Obstructive uropathy',
    ];
    const create = mockRepeatedGenerationCritique(
      buildGeneratedCase({
        answer: 'Acute kidney injury',
        differentials,
        explanation: {
          ...buildGeneratedCase().explanation,
          diagnosis: 'Acute kidney injury',
          differentialAnalysis: buildDifferentialAnalysis(differentials),
        },
      }),
      buildCritique({
        score: 95,
        clinicalEdgeValidityScore: 54,
        invalidReasoningEdges: [
          buildInvalidReasoningEdge({
            differential: 'Prerenal azotemia',
            clueOrder: 5,
            evidence: 'Renal ultrasound shows no hydronephrosis',
            claimedEffect: 'rules_out',
            verdict: 'unsupported',
            issue:
              'Normal renal ultrasound does not rule out prerenal azotemia.',
          }),
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('allows AKI cases that use low urine sodium and concentrated urine to weaken ATN', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const differentials = [
      'Acute tubular necrosis',
      'Obstructive uropathy',
      'Glomerulonephritis',
    ];
    const generatedCase = buildGeneratedCase({
      answer: 'Prerenal acute kidney injury',
      differentials,
      clues: buildGeneratedCase().clues.map((clue) =>
        clue.order === 5
          ? {
              ...clue,
              type: 'lab',
              value:
                'Urine sodium is 8 mEq/L with concentrated urine osmolality of 650 mOsm/kg',
            }
          : clue,
      ),
      explanation: {
        diagnosis: 'Prerenal acute kidney injury',
        summary:
          'Low urine sodium and concentrated urine support preserved tubular sodium reabsorption in prerenal AKI.',
        reasoning: [
          'Concentrated urine and low urine sodium distinguish prerenal physiology from acute tubular necrosis.',
        ],
        keyFindings: ['Low urine sodium', 'Concentrated urine'],
        differentialAnalysis: [
          {
            diagnosis: 'Acute tubular necrosis',
            whyPlausibleEarly:
              'Acute tubular necrosis is plausible early because both it and prerenal AKI can present with an acute creatinine rise.',
            ruledOutByClues: [
              {
                clueOrder: 5,
                evidence:
                  'Urine sodium is 8 mEq/L with concentrated urine osmolality of 650 mOsm/kg',
                reason:
                  'Low urine sodium and concentrated urine favor prerenal sodium retention over tubular injury from ATN.',
              },
            ],
            finalReasonLessLikely:
              'ATN is less likely because tubular injury usually impairs sodium reabsorption and urine concentration.',
          },
          {
            diagnosis: 'Obstructive uropathy',
            whyPlausibleEarly:
              'Obstructive uropathy is plausible early because it can also present with an acute creatinine rise.',
            ruledOutByClues: [
              {
                clueOrder: 5,
                evidence:
                  'Urine sodium is 8 mEq/L with concentrated urine osmolality of 650 mOsm/kg',
                reason:
                  'Low urine sodium and concentrated urine support prerenal physiology rather than postrenal obstruction as the main driver.',
              },
            ],
            finalReasonLessLikely:
              'Obstructive uropathy is less likely because the urine indices fit prerenal sodium avidity better.',
          },
          {
            diagnosis: 'Glomerulonephritis',
            whyPlausibleEarly:
              'Glomerulonephritis is plausible early because it can also present with acute kidney injury.',
            ruledOutByClues: [
              {
                clueOrder: 5,
                evidence:
                  'Urine sodium is 8 mEq/L with concentrated urine osmolality of 650 mOsm/kg',
                reason:
                  'Low urine sodium and concentrated urine favor prerenal physiology rather than inflammatory glomerular injury.',
              },
            ],
            finalReasonLessLikely:
              'Glomerulonephritis is less likely because the urine indices point to prerenal sodium avidity.',
          },
        ],
      },
    });
    const create = jest
      .fn()
      .mockResolvedValueOnce(mockCompletion(generatedCase))
      .mockResolvedValueOnce(
        mockCompletion(buildDifferentialPreflight(generatedCase.differentials)),
      )
      .mockResolvedValueOnce(mockCompletion(buildCritique()));

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).resolves.toEqual(
      expect.objectContaining({ answer: 'prerenal acute kidney injury' }),
    );
  });

  it('rejects invalidReasoningEdges even when overall score is high and issues are empty', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const create = mockRepeatedGenerationCritique(
      buildGeneratedCase(),
      buildCritique({
        passed: true,
        score: 98,
        clinicalAccuracyScore: 98,
        clinicalEdgeValidityScore: 91,
        issues: [],
        invalidReasoningEdges: [
          buildInvalidReasoningEdge({
            differential: 'Pulmonary embolism',
            verdict: 'weak_or_neutral',
            issue:
              'The cited clue is too weak to meaningfully decrease pulmonary embolism probability.',
          }),
        ],
      }),
    );

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await expect(service.generateCase()).rejects.toThrow(
      'Failed to generate a valid case',
    );
  });

  it('includes differential preflight rules in the legacy generation prompt', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const generatedCase = buildGeneratedCase();
    const create = jest
      .fn()
      .mockResolvedValueOnce(mockCompletion(generatedCase))
      .mockResolvedValueOnce(
        mockCompletion(buildDifferentialPreflight(generatedCase.differentials)),
      )
      .mockResolvedValueOnce(mockCompletion(buildCritique()));

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    await service.generateCase();

    const generationCall = create.mock.calls[0][0] as {
      messages: Array<{ content: string }>;
    };
    const prompt = generationCall.messages[1].content;
    expect(prompt).toContain(
      'not be a subtype, cause/mechanism, complication, severity label',
    );
    expect(prompt).toContain(
      'Acute Kidney Injury with Prerenal Azotemia as a competing differential',
    );
    expect(prompt).toContain(
      'for broad syndrome diagnoses, choose competing diagnoses that mimic the syndrome',
    );
    expect(prompt).toContain(
      'do not include ovarian, uterine, pregnancy-related, or gynecologic diagnoses for male patients',
    );
    expect(prompt).toContain(
      'appendicitis competitors: gastroenteritis, renal colic, mesenteric adenitis',
    );
    expect(prompt).toContain('BNP is 1,250 pg/mL');
    expect(prompt).toContain('type 2 diabetes mellitus competitors');
  });

  it('uses fixed diagnosis prompt and registry save path when registryFirst is enabled', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const targetCase = buildGeneratedCase();
    const create = jest
      .fn()
      .mockResolvedValueOnce(mockCompletion(targetCase))
      .mockResolvedValueOnce(
        mockCompletion(buildDifferentialPreflight(targetCase.differentials)),
      )
      .mockResolvedValueOnce(mockCompletion(buildCritique()));
    const saveCaseSpy = jest.spyOn(service, 'saveCase');
    const registrySaveSpy = jest.spyOn(service, 'saveCaseForRegistryTarget');

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    const result = await service.generateBatch({
      count: 1,
      concurrency: 1,
      registryFirst: true,
    });

    const generationCall = create.mock.calls[0][0] as {
      messages: Array<{ content: string }>;
    };
    expect(generationCall.messages[1].content).toContain(
      'The final diagnosis is fixed:',
    );
    expect(generationCall.messages[1].content).toContain(
      'diagnosisRegistryId: registry-1',
    );
    expect(generationCall.messages[1].content).toContain(
      'Do not replace the diagnosis.',
    );
    expect(generationCall.messages[1].content).toContain(
      'not be a subtype, cause/mechanism, complication, severity label',
    );
    expect(generationCall.messages[1].content).toContain(
      'Acute Kidney Injury with Prerenal Azotemia as a competing differential',
    );
    expect(generationCall.messages[1].content).toContain(
      'for broad syndrome diagnoses, choose competing diagnoses that mimic the syndrome',
    );
    expect(generationCall.messages[1].content).toContain(
      'do not include ovarian, uterine, pregnancy-related, or gynecologic diagnoses for male patients',
    );
    expect(generationCall.messages[1].content).toContain(
      'appendicitis competitors: gastroenteritis, renal colic, mesenteric adenitis',
    );
    expect(generationCall.messages[1].content).toContain('BNP is 1,250 pg/mL');
    expect(generationCall.messages[1].content).toContain(
      'type 2 diabetes mellitus competitors',
    );
    expect(registrySaveSpy).toHaveBeenCalledTimes(1);
    expect(saveCaseSpy).not.toHaveBeenCalled();
    expect(result.created).toBe(1);
    expect(result.plannerDiagnostics[0].diagnosis?.displayLabel).toBe(
      'Asthma',
    );
  });

  it('generates a targeted registry-first case for one diagnosisRegistryId', async () => {
    const { generationContextBuilder, generationPlannerService, service } =
      buildService();
    const saveCaseSpy = jest.spyOn(service, 'saveCaseForRegistryTarget');
    const legacySaveSpy = jest.spyOn(service, 'saveCase');
    const generateTargetSpy = jest
      .spyOn(service, 'generateCaseForRegistryTarget')
      .mockResolvedValueOnce(withGenerationQuality(buildGeneratedCase()));

    const result = await service.generateBatch({
      count: 1,
      concurrency: 1,
      diagnosisRegistryIds: ['11111111-1111-4111-8111-111111111111'],
    });

    expect(generationPlannerService.createShadowPlan).not.toHaveBeenCalled();
    expect(generateTargetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          diagnosisRegistryId: '11111111-1111-4111-8111-111111111111',
          displayLabel: 'Asthma',
        }),
        generation: expect.objectContaining({
          generationContext: expect.any(Object),
        }),
      }),
      expect.any(Object),
    );
    expect(generationContextBuilder.build).toHaveBeenCalledWith({
      diagnosisRegistryId: '11111111-1111-4111-8111-111111111111',
      purpose: 'case',
    });
    expect(saveCaseSpy).toHaveBeenCalledTimes(1);
    expect(legacySaveSpy).not.toHaveBeenCalled();
    expect(result.created).toBe(1);
    expect(result.plannerDiagnostics[0].diagnosis?.diagnosisRegistryId).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('generates only supplied targeted diagnoses for multiple diagnosisRegistryIds', async () => {
    const { service } = buildService();
    jest
      .spyOn(service, 'generateCaseForRegistryTarget')
      .mockImplementation(async ({ target }) =>
        withGenerationQuality(
          buildGeneratedCase({
            answer: target?.displayLabel ?? 'Asthma',
            explanation: {
              ...buildGeneratedCase().explanation,
              diagnosis: target?.displayLabel ?? 'Asthma',
            },
          }),
        ),
      );

    const result = await service.generateBatch({
      count: 2,
      concurrency: 1,
      diagnosisRegistryIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
    });

    expect(result.created).toBe(2);
    expect(
      result.plannerDiagnostics.map(
        (slot) => slot.diagnosis?.diagnosisRegistryId,
      ),
    ).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('rejects inactive or nonexistent targeted diagnosisRegistryIds', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findMany.mockResolvedValueOnce([]);

    await expect(
      service.generateBatch({
        count: 1,
        concurrency: 1,
        diagnosisRegistryIds: ['11111111-1111-4111-8111-111111111111'],
      }),
    ).rejects.toThrow('Diagnosis registry IDs are not active or do not exist');
  });

  it('keeps the legacy generator and save path when registryFirst is false', async () => {
    const { service } = buildService();
    const saveCaseSpy = jest.spyOn(service, 'saveCase').mockResolvedValue({
      id: 'case-1',
      title: 'asthma',
      difficulty: 'medium',
      date: new Date('2026-04-20T00:00:00.000Z'),
    });
    const registrySaveSpy = jest.spyOn(service, 'saveCaseForRegistryTarget');

    jest
      .spyOn(service, 'generateCase')
      .mockResolvedValueOnce(withGenerationQuality(buildGeneratedCase()));

    const result = await service.generateBatch({
      count: 1,
      concurrency: 1,
      registryFirst: false,
    });

    expect(saveCaseSpy).toHaveBeenCalledTimes(1);
    expect(registrySaveSpy).not.toHaveBeenCalled();
    expect(result.created).toBe(1);
  });

  it('uses registry-first generation by default', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const create = jest
      .fn()
      .mockResolvedValueOnce(mockCompletion(buildGeneratedCase()))
      .mockResolvedValueOnce(
        mockCompletion(buildDifferentialPreflight(buildGeneratedCase().differentials)),
      )
      .mockResolvedValueOnce(mockCompletion(buildCritique()));
    const saveCaseSpy = jest.spyOn(service, 'saveCase');
    const registrySaveSpy = jest.spyOn(service, 'saveCaseForRegistryTarget');

    Object.defineProperty(service, 'openaiClient', {
      value: {
        chat: {
          completions: {
            create,
          },
        },
      },
    });

    const result = await service.generateBatch({
      count: 1,
      concurrency: 1,
    });

    expect(registrySaveSpy).toHaveBeenCalledTimes(1);
    expect(saveCaseSpy).not.toHaveBeenCalled();
    expect(result.created).toBe(1);
  });

  it('returns batch quality summary counts and average quality score', async () => {
    const { generationPlannerService, service } = buildService();
    const firstCase = withGenerationQuality(buildGeneratedCase(), {
      estimatedDifficulty: 'easy',
      qualityScore: 90,
    });
    const secondCase = withGenerationQuality(
      buildGeneratedCase({
        answer: 'Appendicitis',
        explanation: {
          ...buildGeneratedCase().explanation,
          diagnosis: 'Appendicitis',
        },
      }),
      {
        estimatedDifficulty: 'hard',
        qualityScore: 94,
      },
    );

    jest
      .spyOn(service, 'generateCase')
      .mockResolvedValueOnce(firstCase)
      .mockResolvedValueOnce(secondCase);
    jest
      .spyOn(service, 'saveCase')
      .mockResolvedValueOnce({
        id: 'case-1',
        title: 'asthma',
        difficulty: 'medium',
        date: new Date('2026-04-20T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'case-2',
        title: 'appendicitis',
        difficulty: 'medium',
        date: new Date('2026-04-21T00:00:00.000Z'),
      });

    const result = await service.generateBatch({
      count: 2,
      concurrency: 1,
      registryFirst: false,
    });

    expect(result.requested).toBe(2);
    expect(result.generated).toBe(2);
    expect(result.accepted).toBe(2);
    expect(result.rejected).toBe(0);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.averageQualityScore).toBe(92);
    expect(result.plannerDiagnostics).toHaveLength(2);
    expect(result.plannerDiagnostics[0]).toEqual(
      expect.objectContaining({
        diagnosis: expect.objectContaining({
          diagnosisRegistryId: 'registry-1',
          displayLabel: 'Asthma',
        }) as unknown,
        comparison: expect.objectContaining({
          aiAnswer: 'Asthma',
          matchesPlanner: true,
        }) as unknown,
      }),
    );
    expect(generationPlannerService.createShadowPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          count: 2,
        }) as unknown,
      }),
    );
    expect(
      generationPlannerService.compareAnswerToPlannedDiagnosis,
    ).toHaveBeenCalledTimes(2);
  });

  it('rejects duplicate and low-quality batch candidates before accepting a retry', async () => {
    const { service } = buildService();
    const acceptedCase = withGenerationQuality(buildGeneratedCase(), {
      qualityScore: 91,
    });
    const duplicateCase = withGenerationQuality(buildGeneratedCase(), {
      qualityScore: 93,
    });
    const lowQualityCase = withGenerationQuality(
      buildGeneratedCase({
        answer: 'Appendicitis',
        explanation: {
          ...buildGeneratedCase().explanation,
          diagnosis: 'Appendicitis',
        },
      }),
      {
        qualityScore: 72,
      },
    );
    const retryCase = withGenerationQuality(
      buildGeneratedCase({
        answer: 'Pulmonary Embolism',
        explanation: {
          ...buildGeneratedCase().explanation,
          diagnosis: 'Pulmonary Embolism',
        },
      }),
      {
        qualityScore: 89,
      },
    );

    jest
      .spyOn(service, 'generateCase')
      .mockResolvedValueOnce(acceptedCase)
      .mockResolvedValueOnce(duplicateCase)
      .mockResolvedValueOnce(lowQualityCase)
      .mockResolvedValueOnce(retryCase);
    const saveCaseSpy = jest
      .spyOn(service, 'saveCase')
      .mockResolvedValueOnce({
        id: 'case-1',
        title: 'asthma',
        difficulty: 'medium',
        date: new Date('2026-04-20T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'case-2',
        title: 'pulmonary embolism',
        difficulty: 'medium',
        date: new Date('2026-04-21T00:00:00.000Z'),
      });

    const result = await service.generateBatch({
      count: 2,
      concurrency: 1,
      registryFirst: false,
    });

    expect(result.generated).toBe(4);
    expect(result.accepted).toBe(2);
    expect(result.rejected).toBe(2);
    expect(result.created).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.averageQualityScore).toBe(90);
    expect(result.failureSummary?.byCategory.duplicate_answer).toBe(1);
    expect(result.failureSummary?.byCategory.low_quality).toBe(1);
    expect(result.failureSummary?.samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'duplicate_answer',
          answer: 'asthma',
        }),
        expect.objectContaining({
          category: 'low_quality',
          answer: 'appendicitis',
        }),
      ]),
    );
    expect(saveCaseSpy).toHaveBeenCalledTimes(2);
  });
});
