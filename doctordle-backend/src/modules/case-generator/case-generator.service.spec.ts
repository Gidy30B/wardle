import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { CaseGeneratorService } from './case-generator.service';
import type {
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

    const service = new CaseGeneratorService(
      prisma as never,
      caseValidationOrchestrator as never,
      diagnosisRegistryLinkService as never,
      generationPlannerService as never,
    );

    return {
      tx,
      prisma,
      caseValidationOrchestrator,
      diagnosisRegistryLinkService,
      generationPlannerService,
      service,
    };
  };

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

  it('uses fixed diagnosis prompt and registry save path when registryFirst is enabled', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
    const { service } = buildService();
    const targetCase = buildGeneratedCase();
    const create = jest
      .fn()
      .mockResolvedValueOnce(mockCompletion(targetCase))
      .mockResolvedValueOnce(
        mockCompletion({
          passed: true,
          score: 92,
          clinicalAccuracyScore: 96,
          clueProgressionScore: 88,
          differentialQualityScore: 90,
          ambiguitySuitabilityScore: 84,
          issues: [],
          recommendations: [],
        }),
      );
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
    expect(registrySaveSpy).toHaveBeenCalledTimes(1);
    expect(saveCaseSpy).not.toHaveBeenCalled();
    expect(result.created).toBe(1);
    expect(result.plannerDiagnostics[0].diagnosis?.displayLabel).toBe(
      'Asthma',
    );
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
        mockCompletion({
          passed: true,
          score: 92,
          clinicalAccuracyScore: 96,
          clueProgressionScore: 88,
          differentialQualityScore: 90,
          ambiguitySuitabilityScore: 84,
          issues: [],
          recommendations: [],
        }),
      );
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
    expect(saveCaseSpy).toHaveBeenCalledTimes(2);
  });
});
