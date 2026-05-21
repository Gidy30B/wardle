import { Module } from '@nestjs/common';
import { InternalApiGuard } from '../../auth/internal-api.guard';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { DatabaseModule } from '../../core/db/database.module';
import { DevOnlyGuard } from '../cases/guards/dev-only.guard';
import { CaseAssignmentService } from './case-assignment.service';
import { DailyCaseSchedulerService } from './daily-case-scheduler.service';
import { DailyCasesService } from './daily-cases.service';
import { DailyLimitService } from './daily-limit.service';
import { InternalDailyCasesController } from './internal-daily-cases.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [InternalDailyCasesController],
  providers: [
    CaseAssignmentService,
    DailyCasesService,
    DailyCaseSchedulerService,
    DailyLimitService,
    DevOnlyGuard,
    InternalApiGuard,
    RedisCacheService,
  ],
  exports: [CaseAssignmentService, DailyCasesService, DailyCaseSchedulerService],
})
export class DailyCasesModule {}
