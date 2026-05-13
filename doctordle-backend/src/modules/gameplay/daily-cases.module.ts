import { Module } from '@nestjs/common';
import { InternalApiGuard } from '../../auth/internal-api.guard';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { DatabaseModule } from '../../core/db/database.module';
import { DevOnlyGuard } from '../cases/guards/dev-only.guard';
import { DailyCaseSchedulerService } from './daily-case-scheduler.service';
import { DailyCasesService } from './daily-cases.service';
import { DailyLimitService } from './daily-limit.service';
import { InternalDailyCasesController } from './internal-daily-cases.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [InternalDailyCasesController],
  providers: [
    DailyCasesService,
    DailyCaseSchedulerService,
    DailyLimitService,
    DevOnlyGuard,
    InternalApiGuard,
    RedisCacheService,
  ],
  exports: [DailyCasesService, DailyCaseSchedulerService],
})
export class DailyCasesModule {}
