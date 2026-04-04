import { Module } from '@nestjs/common';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { CasesModule } from '../cases/cases.module';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';
import { AttemptService } from './attempt.service';
import { DailyLimitService } from './daily-limit.service';
import { GameController } from './game.controller';
import { GameEventsService } from './events/game-events.service';
import { GameSessionService } from './game-session.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { LeaderboardService } from './leaderboard.service';
import { PostGameProcessor } from './post-game.processor';
import { RankService } from './rank.service';
import { ScoringService } from './scoring.service';
import { StreakService } from './streak.service';
import { UserProgressService } from './user-progress.service';
import { UserProgressController } from './user-progress.controller';
import { XpService } from './xp.service';

@Module({
  imports: [CasesModule, DiagnosticsModule],
  controllers: [GameController, UserProgressController],
  providers: [
    GameSessionService,
    AttemptService,
    DailyLimitService,
    ScoringService,
    GameEventsService,
    PostGameProcessor,
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
  exports: [UserProgressService],
})
export class GameplayModule {}
