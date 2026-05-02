import { Module } from '@nestjs/common';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { DatabaseModule } from '../../core/db/database.module';
import { EventsModule } from '../../core/events/events.module';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { RedisModule } from '../../core/redis/redis.module';
import { CasesModule } from '../cases/cases.module';
import { GameplayEventLogger } from '../gameplay/gameplay-event-logger.service';
import { LeaderboardService } from '../gameplay/leaderboard.service';
import { RewardOrchestrator } from '../gameplay/reward-orchestrator.service';
import { StreakService } from '../gameplay/streak.service';
import { XpService } from '../gameplay/xp.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueProcessor } from './queue.processor';

@Module({
  imports: [
    DatabaseModule,
    CasesModule,
    EventsModule,
    RealtimeModule,
    NotificationsModule,
    RedisModule,
  ],
  providers: [
    QueueProcessor,
    RewardOrchestrator,
    GameplayEventLogger,
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
