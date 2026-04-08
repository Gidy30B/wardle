import { Module } from '@nestjs/common';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { PrismaService } from '../../core/db/prisma.service';
import { ExplanationService } from '../ai/explanation.service';
import { HintService } from '../ai/hint.service';
import { AiProcessor } from './processors/ai.processor';

@Module({
  providers: [
    AiProcessor,
    HintService,
    ExplanationService,
    PrismaService,
    RedisCacheService,
  ],
})
export class AiWorkerModule {}
