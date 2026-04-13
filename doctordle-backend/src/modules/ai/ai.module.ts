import { Module } from '@nestjs/common';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { DatabaseModule } from '../../core/db/database.module';
import { QueueModule } from '../queue/queue.module';
import { AIContentService } from './ai-content.service';
import { ExplanationService } from './explanation.service';
import { HintService } from './hint.service';

@Module({
  imports: [DatabaseModule, QueueModule],
  providers: [AIContentService, HintService, ExplanationService, RedisCacheService],
  exports: [AIContentService, HintService, ExplanationService],
})
export class AiModule {}
