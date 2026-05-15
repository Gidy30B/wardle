import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import {
  NOTIFICATION_CATEGORIES,
  NotificationCategory,
  type NotificationCategoryValue,
} from './notification.types';
import { NotificationType } from './notification-type.constants';
import { NotificationSettingPreferenceKey } from './notification-settings.contract';

export type PreferencePatch = {
  category: string;
  inAppEnabled?: boolean;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
};

export type NotificationPreferenceView = {
  category: NotificationCategoryValue;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
};

const DEFAULT_DISABLED_CATEGORIES = new Set<NotificationCategoryValue>([
  NotificationCategory.Admin,
]);

const DEFAULT_ENABLED_SETTING_KEYS = new Set<string>(
  Object.values(NotificationSettingPreferenceKey),
);

const NOTIFICATION_TYPE_SETTING_KEY_MAP: Record<string, string | undefined> = {
  [NotificationType.LearningWeeklyDigest]:
    NotificationSettingPreferenceKey.WeeklyDigest,
  [NotificationType.StreakReminder]:
    NotificationSettingPreferenceKey.StreakReminders,
  [NotificationType.StreakMilestone]:
    NotificationSettingPreferenceKey.StreakReminders,
  [NotificationType.GameplayDailyCaseAvailable]:
    NotificationSettingPreferenceKey.ChallengeAlerts,
  [NotificationType.LeaderboardRankChanged]:
    NotificationSettingPreferenceKey.ChallengeAlerts,
  [NotificationType.LeaderboardWeeklySummary]:
    NotificationSettingPreferenceKey.ChallengeAlerts,
  [NotificationType.ContentProductAnnouncement]:
    NotificationSettingPreferenceKey.ProductAnnouncements,
};

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
    return this.isPreferenceEnabled(userId, category);
  }

  async isPushEnabled(
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
        pushEnabled: true,
      },
    });

    return preference?.pushEnabled ?? false;
  }

  async isNotificationEnabled(input: {
    userId: string;
    type: string;
    category: NotificationCategoryValue;
  }): Promise<boolean> {
    const categoryEnabled = await this.isPreferenceEnabled(
      input.userId,
      input.category,
    );

    if (!categoryEnabled) {
      return false;
    }

    const settingPreferenceKey = NOTIFICATION_TYPE_SETTING_KEY_MAP[input.type];

    if (!settingPreferenceKey) {
      return true;
    }

    return this.isPreferenceEnabled(input.userId, settingPreferenceKey);
  }

  async listSettingsForUser(
    userId: string,
  ): Promise<Record<string, boolean>> {
    const settings: Record<string, boolean> = {};

    for (const key of Object.values(NotificationSettingPreferenceKey)) {
      settings[key] = await this.isPreferenceEnabled(userId, key);
    }

    return settings;
  }

  async updateSettingsForUser(
    userId: string,
    patches: Array<{ key: string; inAppEnabled: boolean }>,
  ): Promise<Record<string, boolean>> {
    await this.updateForUser(
      userId,
      patches.map((patch) => ({
        category: patch.key,
        inAppEnabled: patch.inAppEnabled,
        pushEnabled: false,
        emailEnabled: false,
      })),
    );

    return this.listSettingsForUser(userId);
  }

  private async isPreferenceEnabled(
    userId: string,
    category: string,
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

    return preference?.inAppEnabled ?? this.getDefaultInAppEnabled(category);
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
            inAppEnabled:
              patch.inAppEnabled ?? this.getDefaultInAppEnabled(patch.category),
            pushEnabled: patch.pushEnabled ?? false,
            emailEnabled: false,
          },
          update: {
            ...(typeof patch.inAppEnabled === 'boolean'
              ? { inAppEnabled: patch.inAppEnabled }
              : {}),
            ...(typeof patch.pushEnabled === 'boolean'
              ? { pushEnabled: patch.pushEnabled }
              : {}),
            // Email is reserved for a future phase.
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
      inAppEnabled: this.getDefaultInAppEnabled(category),
      pushEnabled: false,
      emailEnabled: false,
    };
  }

  private getDefaultInAppEnabled(category: string): boolean {
    if (DEFAULT_ENABLED_SETTING_KEYS.has(category)) {
      return true;
    }

    return !DEFAULT_DISABLED_CATEGORIES.has(
      category as NotificationCategoryValue,
    );
  }
}
