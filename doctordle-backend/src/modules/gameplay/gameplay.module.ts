import { Module } from '@nestjs/common';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { CasesModule } from '../cases/cases.module';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';
import { QueueModule } from '../queue/queue.module';
import { AttemptService } from './attempt.service';
import { DailyLimitService } from './daily-limit.service';
import { GameController } from './game.controller';
import { GameSessionService } from './game-session.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { LeaderboardService } from './leaderboard.service';
import { RankService } from './rank.service';
import { ScoringService } from './scoring.service';
import { StreakService } from './streak.service';
import { UserProgressService } from './user-progress.service';
import { UserProgressController } from './user-progress.controller';
import { XpService } from './xp.service';

@Module({
  imports: [CasesModule, DiagnosticsModule, QueueModule],
  controllers: [GameController, UserProgressController],
  providers: [
    GameSessionService,
    AttemptService,
    DailyLimitService,
    ScoringService,
    StreakService,
    LeaderboardService,
    XpService,
    RankService,
    UserProgressService,
    RateLimitGuard,
    RedisCacheService,
    PrismaService,
    AppLoggerService,
    MetricsService,
  ],
  exports: [UserProgressService, StreakService, LeaderboardService, XpService],
})
export class GameplayModule {}
