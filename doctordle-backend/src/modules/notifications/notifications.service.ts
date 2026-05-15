import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import type { NotificationCategoryValue, NotificationPriority } from './notification.types';
import { PushNotificationsService } from './push-notifications.service';

export type CreateNotificationInput = {
  userId: string;
  type: string;
  category: NotificationCategoryValue;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  idempotencyKey: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: NotificationPreferencesService,
    @Optional()
    private readonly pushNotifications?: PushNotificationsService,
  ) {}

  async listForUser(input: {
    userId: string;
    limit?: number;
    unreadOnly?: boolean;
  }) {
    const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 50)));

    const notifications = await this.prisma.notification.findMany({
      where: {
        userId: input.userId,
        ...(input.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return {
      notifications: notifications.map((notification) =>
        this.toNotificationDto(notification),
      ),
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });

    return { unreadCount };
  }

  async markRead(userId: string, notificationId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    if (updated.count === 0) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!existing) {
        throw new NotFoundException('Notification not found');
      }

      return this.toNotificationDto(existing);
    }

    const notification = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
    });

    return this.toNotificationDto(notification);
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      updatedCount: result.count,
    };
  }

  async createIfEnabled(input: CreateNotificationInput) {
    const enabled = await this.preferences.isNotificationEnabled({
      userId: input.userId,
      type: input.type,
      category: input.category,
    });

    if (!enabled) {
      return {
        created: false as const,
        reason: 'preference_disabled' as const,
      };
    }

    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          category: input.category,
          title: input.title,
          body: input.body,
          data: input.data as Prisma.InputJsonValue | undefined,
          priority: input.priority ?? 'normal',
          idempotencyKey: input.idempotencyKey,
        },
      });

      await this.pushNotifications
        ?.sendForNotification(notification)
        .catch((error) => {
          this.logger.warn(
            JSON.stringify({
              event: 'notification.push.side_effect.failed',
              notificationId: notification.id,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        });

      return {
        created: true as const,
        notification,
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const existing = await this.prisma.notification.findUnique({
          where: {
            idempotencyKey: input.idempotencyKey,
          },
        });

        return {
          created: false as const,
          reason: 'duplicate' as const,
          notification: existing,
        };
      }

      throw error;
    }
  }

  async buildRealtimePayload(notification: {
    id: string;
    userId: string;
    type: string;
    category: string;
    title: string;
    body: string;
    data: Prisma.JsonValue | null;
    priority: string;
    createdAt: Date;
  }) {
    const unreadCount = await this.prisma.notification.count({
      where: {
        userId: notification.userId,
        readAt: null,
      },
    });

    return {
      id: notification.id,
      type: notification.type,
      category: notification.category,
      title: notification.title,
      body: notification.body,
      data: notification.data as Record<string, unknown> | null,
      priority: this.normalizePriority(notification.priority),
      createdAt: notification.createdAt.toISOString(),
      unreadCount,
    };
  }

  private toNotificationDto(notification: {
    id: string;
    type: string;
    category: string;
    title: string;
    body: string;
    data: Prisma.JsonValue | null;
    priority: string;
    readAt: Date | null;
    seenAt: Date | null;
    createdAt: Date;
    expiresAt: Date | null;
  }) {
    return {
      id: notification.id,
      type: notification.type,
      category: notification.category,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      priority: this.normalizePriority(notification.priority),
      readAt: notification.readAt?.toISOString() ?? null,
      seenAt: notification.seenAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
      expiresAt: notification.expiresAt?.toISOString() ?? null,
    };
  }

  private normalizePriority(priority: string): NotificationPriority {
    if (priority === 'low' || priority === 'high') {
      return priority;
    }

    return 'normal';
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
