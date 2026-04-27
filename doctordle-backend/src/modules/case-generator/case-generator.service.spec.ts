import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { CaseGeneratorService } from './case-generator.service';

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

  it('writes diagnosisRegistryId when persisting a generated case', async () => {
    const tx: any = {
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
    const prisma: any = {
      case: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (handler: (transaction: any) => unknown) =>
        handler(tx),
      ),
    };
    const caseValidationOrchestrator = {
      runShadowForGeneratedCaseInTransaction: jest.fn().mockResolvedValue(undefined),
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

    await service.saveCase({
      answer: 'Asthma',
      clues: [
        { type: 'history', value: 'Exercise intolerance', order: 0 },
        { type: 'symptom', value: 'Wheezing', order: 1 },
        { type: 'exam', value: 'Prolonged expiratory phase', order: 2 },
      ],
      differentials: ['COPD'],
      explanation: {
        diagnosis: 'Asthma',
        summary: 'Summary',
        reasoning: ['Reasoning'],
        keyFindings: ['Finding'],
      },
    });

    expect(diagnosisRegistryLinkService.resolveForWrite).toHaveBeenCalledWith(
      {
        diagnosisId: 'diagnosis-1',
      },
      tx,
    );
    expect(tx.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
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
});
