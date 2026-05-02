import { Injectable } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { NotificationCategory } from './notification.types';

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
      type: 'reward.xp_awarded',
      category: NotificationCategory.Reward,
      title: 'XP earned',
      body: `+${input.xp} XP added to your progress`,
      data: {
        xp: input.xp,
        streak: input.streak ?? null,
        sessionId: input.sessionId,
      },
      priority: 'normal',
      idempotencyKey: `reward.xp_awarded:${input.sessionId}:${input.userId}`,
      correlationId: input.sessionId,
    });
  }

  async explanationReady(input: {
    userId: string;
    caseId: string;
  }): Promise<void> {
    await this.queueService.enqueueNotification({
      userId: input.userId,
      type: 'learning.explanation_ready',
      category: NotificationCategory.Learning,
      title: 'Explanation ready',
      body: 'Your case explanation is ready to review',
      data: {
        caseId: input.caseId,
      },
      priority: 'normal',
      idempotencyKey: `learning.explanation_ready:${input.caseId}:${input.userId}`,
      correlationId: input.caseId,
    });
  }
}
