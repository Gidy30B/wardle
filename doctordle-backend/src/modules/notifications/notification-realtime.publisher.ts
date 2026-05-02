import { Injectable, Logger } from '@nestjs/common';
import { RedisPubSubService } from '../../core/redis/redis-pubsub.service';
import {
  NOTIFICATION_V1_CREATED_EVENT,
  type NotificationCreatedRealtimePayload,
} from './notification.types';

@Injectable()
export class NotificationRealtimePublisher {
  private readonly logger = new Logger(NotificationRealtimePublisher.name);
  private readonly channelName = 'ws:events';

  constructor(private readonly redisPubSub: RedisPubSubService) {}

  async publishCreated(
    userId: string,
    payload: NotificationCreatedRealtimePayload,
  ): Promise<void> {
    this.logger.log({
      event: 'notification.ws.publish',
      type: NOTIFICATION_V1_CREATED_EVENT,
      userId,
      notificationId: payload.id,
      notificationType: payload.type,
    });

    await this.redisPubSub.publish(this.channelName, {
      type: NOTIFICATION_V1_CREATED_EVENT,
      userId,
      payload,
    });
  }
}
