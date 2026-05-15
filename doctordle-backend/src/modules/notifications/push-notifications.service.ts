import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { FcmPushProvider } from './fcm-push.provider';
import { NotificationPreferencesService } from './notification-preferences.service';
import {
  isNotificationCategory,
  type NotificationCategoryValue,
} from './notification.types';

type PushNotificationRow = {
  id: string;
  userId: string;
  type: string;
  category: string;
  title: string;
  body: string;
  data: Prisma.JsonValue | null;
};

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: NotificationPreferencesService,
    private readonly provider: FcmPushProvider,
  ) {}

  async sendForNotification(notification: PushNotificationRow) {
    if (!isNotificationCategory(notification.category)) {
      this.logger.warn(
        JSON.stringify({
          event: 'push.notification.skipped',
          reason: 'invalid_category',
          notificationId: notification.id,
          category: notification.category,
        }),
      );
      return {
        sent: false as const,
        reason: 'invalid_category' as const,
      };
    }

    const category = notification.category as NotificationCategoryValue;
    const pushEnabled = await this.preferences.isPushEnabled(
      notification.userId,
      category,
    );

    if (!pushEnabled) {
      return {
        sent: false as const,
        reason: 'preference_disabled' as const,
      };
    }

    const deviceTokens = await this.prisma.pushDeviceToken.findMany({
      where: {
        userId: notification.userId,
        disabledAt: null,
      },
      select: {
        token: true,
      },
    });

    const tokens = deviceTokens.map((deviceToken) => deviceToken.token);
    if (tokens.length === 0) {
      return {
        sent: false as const,
        reason: 'no_active_tokens' as const,
      };
    }

    try {
      const result = await this.provider.sendMulticast({
        tokens,
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification.id,
          type: notification.type,
          category: notification.category,
          metadata: JSON.stringify(notification.data ?? {}),
        },
      });

      if (result.invalidTokens.length > 0) {
        await this.prisma.pushDeviceToken.updateMany({
          where: {
            userId: notification.userId,
            token: {
              in: result.invalidTokens,
            },
            disabledAt: null,
          },
          data: {
            disabledAt: new Date(),
          },
        });
      }

      return {
        sent: true as const,
        successCount: result.successCount,
        failureCount: result.failureCount,
        invalidTokenCount: result.invalidTokens.length,
      };
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'push.notification.failed',
          notificationId: notification.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );

      return {
        sent: false as const,
        reason: 'provider_error' as const,
      };
    }
  }
}
