import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { CaseGeneratorService } from './case-generator.service';
import type { GeneratedCase } from './case-generator.types';

type TransactionMock = {
  case: {
    findFirst: jest.Mock;
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

  const buildService = () => {
    const tx: TransactionMock = {
      case: {
        findFirst: jest.fn().mockResolvedValue(null),
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
      },
      diagnosisRegistry: {
        findFirst: jest.fn().mockResolvedValue(null),
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

    const service = new CaseGeneratorService(
      prisma as never,
      caseValidationOrchestrator as never,
      diagnosisRegistryLinkService as never,
    );

    return {
      tx,
      prisma,
      caseValidationOrchestrator,
      diagnosisRegistryLinkService,
      service,
    };
  };

  it('writes diagnosisRegistryId when persisting a generated case', async () => {
    const { tx, diagnosisRegistryLinkService, service } = buildService();

    await service.saveCase(buildGeneratedCase());

    expect(diagnosisRegistryLinkService.resolveForWrite).toHaveBeenCalledWith(
      {
        diagnosisId: 'diagnosis-1',
      },
      tx,
    );
    expect(tx.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are typed as any in this nested object.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          diagnosisId: 'diagnosis-1',
          diagnosisRegistryId: 'registry-1',
          proposedDiagnosisText: 'asthma',
          diagnosisMappingStatus: 'MATCHED',
          diagnosisMappingMethod: 'LEGACY_BACKFILL',
          diagnosisMappingConfidence: 1,
        }),
      }),
    );
  });

  it('assigns the next public number when persisting a generated case', async () => {
    const { tx, service } = buildService();
    tx.case.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ publicNumber: 237 });

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
            generationQuality: expect.objectContaining({
              critiqueScore: 94,
              critiquePassed: true,
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
        mockCompletion({
          passed: true,
          score: 92,
          clinicalAccuracyScore: 96,
          clueProgressionScore: 88,
          differentialQualityScore: 90,
          ambiguitySuitabilityScore: 84,
          issues: [],
          recommendations: ['Ready for editorial review'],
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

    const result = await service.generateCase();
    const explanation = result.explanation as GeneratedCase['explanation'] & {
      generationQuality?: {
        critiqueScore: number;
        critiquePassed: boolean;
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

    expect(create).toHaveBeenCalledTimes(3);
    expect(prisma.diagnosisRegistry.findFirst).toHaveBeenCalled();
    expect(explanation.generationQuality).toEqual(
      expect.objectContaining({
        critiqueScore: 92,
        critiquePassed: true,
        estimatedDifficulty: 'medium',
        estimatedSolveClue: 5,
        specialty: null,
        acuity: 'low',
        hasLabs: true,
        hasImaging: false,
        hasVitals: true,
        differentialCount: 3,
        qualityScore: 91,
      }),
    );
  });

  it('returns batch quality summary counts and average quality score', async () => {
    const { service } = buildService();
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
    });

    expect(result.requested).toBe(2);
    expect(result.generated).toBe(2);
    expect(result.accepted).toBe(2);
    expect(result.rejected).toBe(0);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.averageQualityScore).toBe(92);
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
    });

    expect(result.generated).toBe(4);
    expect(result.accepted).toBe(2);
    expect(result.rejected).toBe(2);
    expect(result.created).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.averageQualityScore).toBe(90);
    expect(saveCaseSpy).toHaveBeenCalledTimes(2);
  });
});
