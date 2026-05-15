import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { InternalApiGuard } from '../../auth/internal-api.guard';
import { Public } from '../../auth/public.decorator';
import { NotificationType } from './notification-type.constants';
import { NotificationCategory } from './notification.types';
import { NotificationsService } from './notifications.service';

class InternalPushTestDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsString()
  targetUserId!: string;

  @IsString()
  title!: string;

  @IsString()
  body!: string;
}

@Controller('internal/notifications/push')
@Public()
@UseGuards(InternalApiGuard)
export class InternalNotificationPushTestController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test')
  async sendTest(@Body() body: InternalPushTestDto) {
    if (body.dryRun) {
      return {
        dryRun: true,
        targetUserId: body.targetUserId,
        type: NotificationType.SystemPushTest,
        category: NotificationCategory.System,
        title: body.title,
        body: body.body,
        created: false,
      };
    }

    const result = await this.notificationsService.createIfEnabled({
      userId: body.targetUserId,
      type: NotificationType.SystemPushTest,
      category: NotificationCategory.System,
      title: body.title,
      body: body.body,
      data: {
        test: true,
      },
      priority: 'normal',
      idempotencyKey: `${NotificationType.SystemPushTest}:${body.targetUserId}:${Date.now()}`,
    });

    return {
      dryRun: false,
      targetUserId: body.targetUserId,
      created: result.created,
      reason: result.created ? undefined : result.reason,
      notificationId: result.notification?.id ?? null,
    };
  }
}
