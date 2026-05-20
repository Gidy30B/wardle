import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { AdminGuard } from '../admin/admin.guard';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AdminGuard,
    PrismaService,
    AppLoggerService,
    MetricsService,
  ],
})
export class AnalyticsModule {}
