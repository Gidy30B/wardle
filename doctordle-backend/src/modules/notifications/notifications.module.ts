import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module';
import { RedisModule } from '../../core/redis/redis.module';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsController } from './notifications.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationProducerService } from './notification-producer.service';
import { NotificationRealtimePublisher } from './notification-realtime.publisher';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [DatabaseModule, RedisModule, QueueModule, RealtimeModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationPreferencesService,
    NotificationProducerService,
    NotificationRealtimePublisher,
  ],
  exports: [
    NotificationsService,
    NotificationPreferencesService,
    NotificationProducerService,
    NotificationRealtimePublisher,
  ],
})
export class NotificationsModule {}
