import { Module } from '@nestjs/common';
import { NotificationsModule } from './notifications.module';
import { NotificationProcessor } from './processors/notification.processor';

@Module({
  imports: [NotificationsModule],
  providers: [NotificationProcessor],
})
export class NotificationWorkerModule {}
