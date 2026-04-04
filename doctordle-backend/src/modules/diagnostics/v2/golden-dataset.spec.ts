import { Test, TestingModule } from '@nestjs/testing';
import { RedisCacheService } from '../../../core/cache/redis-cache.service';
import { PrismaService } from '../../../core/db/prisma.service';
import { AppLoggerService } from '../../../core/logger/app-logger.service';
import { MetricsService } from '../../../core/logger/metrics.service';
import { EmbeddingService } from '../../../infra/embedding/embedding.service';
import { OntologyService } from '../../knowledge/ontology.service';
import { SynonymService } from '../../knowledge/synonym.service';
import { LlmFallbackService } from '../llm/llm-fallback.service';
import { RetrievalService } from '../services/retrieval.service';
import { EvaluatorV2Service } from './evaluator-v2.service';

describe('EvaluatorV2 golden dataset', () => {
  let evaluator: EvaluatorV2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn().mockResolvedValue([]),
            diagnosis: {
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 'd-1',
                  name: 'myocardial infarction',
                  synonyms: [{ term: 'mi' }, { term: 'heart attack' }],
                },
                {
                  id: 'd-2',
                  name: 'pneumonia',
                  synonyms: [{ term: 'lung infection' }],
                },
                {
                  id: 'd-3',
                  name: 'tuberculosis',
                  synonyms: [{ term: 'tb' }],
                },
              ]),
            },
          },
        },
        {
          provide: RedisCacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            embed: jest.fn().mockResolvedValue(Array.from({ length: 8 }, () => 0)),
          },
        },
        AppLoggerService,
        SynonymService,
        OntologyService,
        RetrievalService,
        LlmFallbackService,
        EvaluatorV2Service,
      ],
    }).compile();

    evaluator = module.get(EvaluatorV2Service);
  });

  it('maps heart attack to myocardial infarction', async () => {
    const result = await evaluator.evaluate(
      'heart attack',
      'myocardial infarction',
    );
    expect(result.label).toBe('correct');
  });

  it('maps tb close to pneumonia by ontology', async () => {
    const result = await evaluator.evaluate('tb', 'pneumonia');
    expect(['close', 'correct']).toContain(result.label);
  });
});
