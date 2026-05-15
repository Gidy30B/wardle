import { Job } from 'bullmq';
import {
  NOTIFICATION_CREATE_JOB_NAME,
} from '../../queue/queue.constants';
import type { NotificationCreateJobPayload } from '../../queue/queue.service';
import { NotificationType } from '../notification-type.constants';
import { NotificationCategory } from '../notification.types';
import { NotificationProcessor } from './notification.processor';

describe('NotificationProcessor', () => {
  it('handles queued notification jobs and publishes created rows to the recipient', async () => {
    const payload: NotificationCreateJobPayload = {
      userId: 'user-1',
      type: NotificationType.GameplayDailyCaseAvailable,
      category: NotificationCategory.Gameplay,
      title: 'Daily case available',
      body: 'A new Wardle case is ready to play',
      data: {
        dailyCaseId: 'daily-case-1',
      },
      idempotencyKey: 'gameplay.daily_case_available:daily-case-1:user-1',
    };
    const notification = {
      id: 'notification-1',
      userId: payload.userId,
      type: payload.type,
      category: payload.category,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      priority: 'normal',
      createdAt: new Date('2026-05-14T09:00:00.000Z'),
    };
    const realtimePayload = {
      id: notification.id,
      type: notification.type,
      category: notification.category,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      priority: notification.priority,
      createdAt: notification.createdAt.toISOString(),
      unreadCount: 1,
    };
    const notificationsService = {
      createIfEnabled: jest.fn().mockResolvedValue({
        created: true,
        notification,
      }),
      buildRealtimePayload: jest.fn().mockResolvedValue(realtimePayload),
    };
    const realtimePublisher = {
      publishCreated: jest.fn().mockResolvedValue(undefined),
    };
    const processor = {
      notificationsService,
      realtimePublisher,
      logger: {
        warn: jest.fn(),
        debug: jest.fn(),
      },
    };

    await NotificationProcessor.prototype['process'].call(processor, {
      name: NOTIFICATION_CREATE_JOB_NAME,
      data: payload,
    } as Job<NotificationCreateJobPayload>);

    expect(notificationsService.createIfEnabled).toHaveBeenCalledWith({
      userId: 'user-1',
      type: NotificationType.GameplayDailyCaseAvailable,
      category: NotificationCategory.Gameplay,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      priority: payload.priority,
      idempotencyKey: payload.idempotencyKey,
    });
    expect(notificationsService.buildRealtimePayload).toHaveBeenCalledWith(
      notification,
    );
    expect(realtimePublisher.publishCreated).toHaveBeenCalledWith(
      'user-1',
      realtimePayload,
    );
  });

  it('does not emit realtime events for disabled categories', async () => {
    const payload: NotificationCreateJobPayload = {
      userId: 'user-1',
      type: NotificationType.LearningExplanationReady,
      category: NotificationCategory.Learning,
      title: 'Explanation ready',
      body: 'Your explanation is ready.',
      idempotencyKey: 'learning.explanation_ready:case-1:user-1',
    };
    const notificationsService = {
      createIfEnabled: jest.fn().mockResolvedValue({
        created: false,
        reason: 'preference_disabled',
      }),
      buildRealtimePayload: jest.fn(),
    };
    const realtimePublisher = {
      publishCreated: jest.fn(),
    };
    const logger = {
      warn: jest.fn(),
      debug: jest.fn(),
    };
    const processor = {
      notificationsService,
      realtimePublisher,
      logger,
    };

    await NotificationProcessor.prototype['process'].call(processor, {
      name: NOTIFICATION_CREATE_JOB_NAME,
      data: payload,
    } as Job<NotificationCreateJobPayload>);

    expect(notificationsService.createIfEnabled).toHaveBeenCalledWith({
      userId: payload.userId,
      type: payload.type,
      category: payload.category,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      priority: payload.priority,
      idempotencyKey: payload.idempotencyKey,
    });
    expect(notificationsService.buildRealtimePayload).not.toHaveBeenCalled();
    expect(realtimePublisher.publishCreated).not.toHaveBeenCalled();
  });
});
