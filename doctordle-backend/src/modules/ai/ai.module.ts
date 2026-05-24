import { Module } from '@nestjs/common';
import { RedisCacheModule } from '../../core/cache/redis-cache.module';
import { DatabaseModule } from '../../core/db/database.module';
import { QueueModule } from '../queue/queue.module';
import { AIContentService } from './ai-content.service';
import { ExplanationService } from './explanation.service';
import { HintService } from './hint.service';

@Module({
  imports: [DatabaseModule, QueueModule, RedisCacheModule],
  providers: [AIContentService, HintService, ExplanationService],
  exports: [AIContentService, HintService, ExplanationService],
})
export class AiModule {}
