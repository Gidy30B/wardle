import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import {
  NOTIFICATION_CATEGORIES,
  NotificationCategory,
  type NotificationCategoryValue,
} from './notification.types';

type PreferencePatch = {
  category: NotificationCategoryValue;
  inAppEnabled?: boolean;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
};

type NotificationPreferenceView = {
  category: NotificationCategoryValue;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
};

const DEFAULT_DISABLED_CATEGORIES = new Set<NotificationCategoryValue>([
  NotificationCategory.Admin,
]);

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<NotificationPreferenceView[]> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
      select: {
        category: true,
        inAppEnabled: true,
        pushEnabled: true,
        emailEnabled: true,
      },
    });

    const byCategory = new Map(rows.map((row) => [row.category, row]));

    return NOTIFICATION_CATEGORIES.map((category) => {
      const existing = byCategory.get(category);
      if (existing) {
        return {
          category: category as NotificationCategoryValue,
          inAppEnabled: existing.inAppEnabled,
          pushEnabled: existing.pushEnabled,
          emailEnabled: existing.emailEnabled,
        };
      }

      return this.getDefaultPreference(category as NotificationCategoryValue);
    });
  }

  async isInAppEnabled(
    userId: string,
    category: NotificationCategoryValue,
  ): Promise<boolean> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_category: {
          userId,
          category,
        },
      },
      select: {
        inAppEnabled: true,
      },
    });

    return preference?.inAppEnabled ?? this.getDefaultPreference(category).inAppEnabled;
  }

  async updateForUser(
    userId: string,
    patches: PreferencePatch[],
  ): Promise<NotificationPreferenceView[]> {
    await this.prisma.$transaction(
      patches.map((patch) =>
        this.prisma.notificationPreference.upsert({
          where: {
            userId_category: {
              userId,
              category: patch.category,
            },
          },
          create: {
            userId,
            category: patch.category,
            inAppEnabled: patch.inAppEnabled ?? this.getDefaultPreference(patch.category).inAppEnabled,
            pushEnabled: false,
            emailEnabled: false,
          },
          update: {
            ...(typeof patch.inAppEnabled === 'boolean'
              ? { inAppEnabled: patch.inAppEnabled }
              : {}),
            // Push/email are reserved for future phases. Keep them false even
            // if older clients optimistically send these flags.
            pushEnabled: false,
            emailEnabled: false,
          },
        }),
      ),
    );

    return this.listForUser(userId);
  }

  private getDefaultPreference(
    category: NotificationCategoryValue,
  ): NotificationPreferenceView {
    return {
      category,
      inAppEnabled: !DEFAULT_DISABLED_CATEGORIES.has(category),
      pushEnabled: false,
      emailEnabled: false,
    };
  }
}
