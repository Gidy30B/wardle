import { Module } from '@nestjs/common';
import { InternalApiGuard } from '../../auth/internal-api.guard';
import { DatabaseModule } from '../../core/db/database.module';
import { RedisModule } from '../../core/redis/redis.module';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { FcmPushProvider } from './fcm-push.provider';
import { InternalNotificationCampaignController } from './internal-notification-campaign.controller';
import { InternalNotificationPushTestController } from './internal-notification-push-test.controller';
import { NotificationCampaignScheduler } from './notification-campaign.scheduler';
import { NotificationCampaignService } from './notification-campaign.service';
import { NotificationsController } from './notifications.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationProducerService } from './notification-producer.service';
import { NotificationRealtimePublisher } from './notification-realtime.publisher';
import { NotificationsService } from './notifications.service';
import { PushDeviceTokensController } from './push-device-tokens.controller';
import { PushDeviceTokensService } from './push-device-tokens.service';
import { PushNotificationsService } from './push-notifications.service';
import { UserNotificationSettingsController } from './user-notification-settings.controller';
import { UserNotificationSettingsService } from './user-notification-settings.service';

@Module({
  imports: [DatabaseModule, RedisModule, QueueModule, RealtimeModule],
  controllers: [
    NotificationsController,
    PushDeviceTokensController,
    UserNotificationSettingsController,
    InternalNotificationCampaignController,
    InternalNotificationPushTestController,
  ],
  providers: [
    FcmPushProvider,
    InternalApiGuard,
    NotificationCampaignScheduler,
    NotificationCampaignService,
    NotificationsService,
    NotificationPreferencesService,
    NotificationProducerService,
    NotificationRealtimePublisher,
    PushDeviceTokensService,
    PushNotificationsService,
    UserNotificationSettingsService,
  ],
  exports: [
    NotificationsService,
    NotificationPreferencesService,
    NotificationProducerService,
    NotificationRealtimePublisher,
    NotificationCampaignService,
    UserNotificationSettingsService,
  ],
})
export class NotificationsModule {}
