import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('top-wrong')
  getTopWrong(@Query('limit') limit?: string) {
    return this.service.getTopWrongGuesses(limit ? Number(limit) : 10);
  }

  @Get('accuracy')
  getAccuracy() {
    return this.service.getAccuracyPerCase();
  }

  @Get('signals')
  getSignals() {
    return this.service.getSignalStats();
  }

  @Get('fallback-rate')
  getFallback() {
    return this.service.getFallbackRate();
  }

  @Get('attempts-over-time')
  getAttempts() {
    return this.service.getAttemptsOverTime();
  }

  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboard();
  }
}
