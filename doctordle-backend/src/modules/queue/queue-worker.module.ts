import { Module } from '@nestjs/common';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { DatabaseModule } from '../../core/db/database.module';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { LeaderboardService } from '../gameplay/leaderboard.service';
import { StreakService } from '../gameplay/streak.service';
import { XpService } from '../gameplay/xp.service';
import { QueueProcessor } from './queue.processor';

@Module({
  imports: [DatabaseModule],
  providers: [
    QueueProcessor,
    StreakService,
    XpService,
    LeaderboardService,
    RedisCacheService,
    PrismaService,
    AppLoggerService,
    MetricsService,
  ],
})
export class QueueWorkerModule {}
