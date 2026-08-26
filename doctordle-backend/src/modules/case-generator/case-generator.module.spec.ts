import { Test } from '@nestjs/testing';
import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { CaseGeneratorModule } from './case-generator.module';
import { DiagnosisEditorialBriefService } from '../education/diagnosis-editorial-brief.service';
import { DiagnosisEditorialBriefGenerationService } from '../education/diagnosis-editorial-brief-generation.service';

describe('CaseGeneratorModule', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
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
      OPENAI_API_KEY: '',
    };
    resetEnvCacheForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvCacheForTests();
  });

  it('resolves the editorial brief generator chain used by case generation', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CaseGeneratorModule],
    }).compile();

    expect(moduleRef.get(DiagnosisEditorialBriefService, { strict: false }))
      .toBeInstanceOf(DiagnosisEditorialBriefService);
    expect(
      moduleRef.get(DiagnosisEditorialBriefGenerationService, {
        strict: false,
      }),
    ).toBeInstanceOf(DiagnosisEditorialBriefGenerationService);

    await moduleRef.close();
  });
});
