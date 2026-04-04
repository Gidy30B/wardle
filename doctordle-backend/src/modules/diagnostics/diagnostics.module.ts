import { Module } from '@nestjs/common';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { EmbeddingService } from '../../infra/embedding/embedding.service';
import { CasesModule } from '../cases/cases.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LlmFallbackService } from './llm/llm-fallback.service';
import { EvaluatorApiService } from './services/evaluator-api.service';
import { EvaluatorEngineService } from './services/evaluator-engine.service';
import { RetrievalService } from './services/retrieval.service';
import { EvaluatorV1Service } from './v1/evaluator-v1.service';
import { EvaluatorV2Service } from './v2/evaluator-v2.service';

@Module({
  imports: [CasesModule, KnowledgeModule],
  providers: [
    RedisCacheService,
    PrismaService,
    AppLoggerService,
    MetricsService,
    EmbeddingService,
    RetrievalService,
    EvaluatorV1Service,
    EvaluatorV2Service,
    EvaluatorEngineService,
    EvaluatorApiService,
    LlmFallbackService,
  ],
  exports: [EvaluatorApiService],
})
export class DiagnosticsModule {}
