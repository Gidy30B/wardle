import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { GameEventsService } from './events/game-events.service';
import { LeaderboardService } from './leaderboard.service';
import { StreakService } from './streak.service';
import { GameCompletedEvent } from './events/game-completed.event';
import { XpService } from './xp.service';

@Injectable()
export class PostGameProcessor implements OnModuleInit {
  constructor(
    private readonly gameEvents: GameEventsService,
    private readonly leaderboardService: LeaderboardService,
    private readonly streakService: StreakService,
    private readonly xpService: XpService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    this.gameEvents.onGameCompleted((event) => {
      void this.process(event);
    });
  }

  private async process(event: GameCompletedEvent): Promise<void> {
    try {
      const streak = await this.streakService.updateOnCompletion({
        userId: event.userId,
        completedAt: event.completedAt,
      });

      await this.xpService.awardXpForSession({
        sessionId: event.sessionId,
        userId: event.userId,
        streak,
        attemptsCount: event.attemptsCount,
      });

      await this.leaderboardService.upsertCompletion({
        userId: event.userId,
        dailyCaseId: event.dailyCaseId,
        score: event.score,
        attemptsCount: event.attemptsCount,
        completedAt: event.completedAt,
      });

      this.metrics.increment('postgame.processed');
    } catch (error) {
      this.metrics.increment('postgame.error');
      this.logger.error(
        {
          sessionId: event.sessionId,
          userId: event.userId,
          dailyCaseId: event.dailyCaseId,
          error,
        },
        'postgame.processor_failed',
      );
    }
  }
}
