import { Module } from '@nestjs/common';
import { MetricsService } from '../../core/logger/metrics.service.js';
import { EditorialMetricsService } from './editorial-metrics.service.js';

@Module({
  providers: [MetricsService, EditorialMetricsService],
  exports: [MetricsService, EditorialMetricsService],
})
export class EditorialObservabilityModule {}
