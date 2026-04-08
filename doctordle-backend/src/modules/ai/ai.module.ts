import { Module } from '@nestjs/common';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { DatabaseModule } from '../../core/db/database.module';
import { ExplanationService } from './explanation.service';
import { HintService } from './hint.service';

@Module({
  imports: [DatabaseModule],
  providers: [HintService, ExplanationService, RedisCacheService],
  exports: [HintService, ExplanationService],
})
export class AiModule {}
