import { Injectable } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { NotificationCategory } from './notification.types';
import { NotificationType } from './notification-type.constants';

@Injectable()
export class NotificationProducerService {
  constructor(private readonly queueService: QueueService) {}

  async rewardXpAwarded(input: {
    userId: string;
    sessionId: string;
    xp: number;
    streak?: number;
  }): Promise<void> {
    await this.queueService.enqueueNotification({
      userId: input.userId,
      type: NotificationType.RewardXpAwarded,
      category: NotificationCategory.Reward,
      title: 'XP earned',
      body: `+${input.xp} XP added to your progress`,
      data: {
        xp: input.xp,
        streak: input.streak ?? null,
        sessionId: input.sessionId,
      },
      priority: 'normal',
      idempotencyKey: `${NotificationType.RewardXpAwarded}:${input.sessionId}:${input.userId}`,
      correlationId: input.sessionId,
    });
  }

  async enqueueStreakReminder(input: {
    userId: string;
    reminderDate: string;
  }): Promise<void> {
    await this.queueService.enqueueNotification({
      userId: input.userId,
      type: NotificationType.StreakReminder,
      category: NotificationCategory.Streak,
      title: 'Keep your streak alive',
      body: "Complete today's case before your streak resets",
      data: {
        reminderDate: input.reminderDate,
      },
      priority: 'normal',
      idempotencyKey: `${NotificationType.StreakReminder}:${input.reminderDate}:${input.userId}`,
      correlationId: input.reminderDate,
    });
  }

  async enqueueStreakMilestone(input: {
    userId: string;
    sessionId: string;
    streak: number;
  }): Promise<void> {
    await this.queueService.enqueueNotification({
      userId: input.userId,
      type: NotificationType.StreakMilestone,
      category: NotificationCategory.Streak,
      title: `${input.streak}-day streak`,
      body: `You reached a ${input.streak}-day diagnostic streak`,
      data: {
        streak: input.streak,
        sessionId: input.sessionId,
      },
      priority: 'normal',
      idempotencyKey: `${NotificationType.StreakMilestone}:${input.streak}:${input.sessionId}:${input.userId}`,
      correlationId: input.sessionId,
    });
  }

  async enqueueDailyCaseAvailable(input: {
    userId: string;
    dailyCaseId: string;
    date: string;
  }): Promise<void> {
    await this.queueService.enqueueNotification({
      userId: input.userId,
      type: NotificationType.GameplayDailyCaseAvailable,
      category: NotificationCategory.Gameplay,
      title: 'Daily case available',
      body: 'A new Wardle case is ready to play',
      data: {
        dailyCaseId: input.dailyCaseId,
        date: input.date,
      },
      priority: 'normal',
      idempotencyKey: `${NotificationType.GameplayDailyCaseAvailable}:${input.dailyCaseId}:${input.userId}`,
      correlationId: input.dailyCaseId,
    });
  }

  async enqueueLeaderboardRankChanged(input: {
    userId: string;
    leaderboardId: string;
    rank: number;
    previousRank?: number | null;
  }): Promise<void> {
    await this.queueService.enqueueNotification({
      userId: input.userId,
      type: NotificationType.LeaderboardRankChanged,
      category: NotificationCategory.Leaderboard,
      title: 'Leaderboard rank changed',
      body: `You are now ranked #${input.rank}`,
      data: {
        leaderboardId: input.leaderboardId,
        rank: input.rank,
        previousRank: input.previousRank ?? null,
      },
      priority: 'normal',
      idempotencyKey: `${NotificationType.LeaderboardRankChanged}:${input.leaderboardId}:${input.rank}:${input.userId}`,
      correlationId: input.leaderboardId,
    });
  }

  async enqueueLeaderboardWeeklySummary(input: {
    userId: string;
    weekStart: string;
    rank?: number | null;
  }): Promise<void> {
    await this.queueService.enqueueNotification({
      userId: input.userId,
      type: NotificationType.LeaderboardWeeklySummary,
      category: NotificationCategory.Leaderboard,
      title: 'Weekly leaderboard summary',
      body: input.rank
        ? `You finished the week ranked #${input.rank}`
        : 'Your weekly leaderboard summary is ready',
      data: {
        weekStart: input.weekStart,
        rank: input.rank ?? null,
      },
      priority: 'normal',
      idempotencyKey: `${NotificationType.LeaderboardWeeklySummary}:${input.weekStart}:${input.userId}`,
      correlationId: input.weekStart,
    });
  }

  async enqueueLearningWeeklyDigest(input: {
    userId: string;
    weekStart: string;
    reviewedCount: number;
  }): Promise<void> {
    await this.queueService.enqueueNotification({
      userId: input.userId,
      type: NotificationType.LearningWeeklyDigest,
      category: NotificationCategory.Learning,
      title: 'Weekly learning digest',
      body: `You reviewed ${input.reviewedCount} case${input.reviewedCount === 1 ? '' : 's'} this week`,
      data: {
        weekStart: input.weekStart,
        reviewedCount: input.reviewedCount,
      },
      priority: 'normal',
      idempotencyKey: `${NotificationType.LearningWeeklyDigest}:${input.weekStart}:${input.userId}`,
      correlationId: input.weekStart,
    });
  }

  async enqueueProductAnnouncement(input: {
    userId: string;
    announcementId: string;
    title: string;
    body: string;
  }): Promise<void> {
    await this.queueService.enqueueNotification({
      userId: input.userId,
      type: NotificationType.ContentProductAnnouncement,
      category: NotificationCategory.Content,
      title: input.title,
      body: input.body,
      data: {
        announcementId: input.announcementId,
      },
      priority: 'normal',
      idempotencyKey: `${NotificationType.ContentProductAnnouncement}:${input.announcementId}:${input.userId}`,
      correlationId: input.announcementId,
    });
  }

  async explanationReady(input: {
    userId: string;
    caseId: string;
  }): Promise<void> {
    await this.queueService.enqueueNotification({
      userId: input.userId,
      type: NotificationType.LearningExplanationReady,
      category: NotificationCategory.Learning,
      title: 'Explanation ready',
      body: 'Your case explanation is ready to review',
      data: {
        caseId: input.caseId,
      },
      priority: 'normal',
      idempotencyKey: `${NotificationType.LearningExplanationReady}:${input.caseId}:${input.userId}`,
      correlationId: input.caseId,
    });
  }
}
