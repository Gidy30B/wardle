import { Injectable } from '@nestjs/common';
import {
  NOTIFICATION_SETTINGS_KEYS,
  NOTIFICATION_SETTINGS_PREFERENCE_KEY_MAP,
  type NotificationSettingsView,
} from './notification-settings.contract';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateUserNotificationSettingsDto } from './dto/update-user-notification-settings.dto';

@Injectable()
export class UserNotificationSettingsService {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  async getForUser(
    userId: string,
  ): Promise<{ settings: NotificationSettingsView }> {
    const preferences = await this.preferencesService.listSettingsForUser(userId);
    return { settings: this.toSettings(preferences) };
  }

  async updateForUser(
    userId: string,
    updates: UpdateUserNotificationSettingsDto,
  ): Promise<{ settings: NotificationSettingsView }> {
    const patches: Array<{ key: string; inAppEnabled: boolean }> = [];

    for (const key of NOTIFICATION_SETTINGS_KEYS) {
      const enabled = updates[key];

      if (typeof enabled !== 'boolean') {
        continue;
      }

      patches.push({
        key: NOTIFICATION_SETTINGS_PREFERENCE_KEY_MAP[key],
        inAppEnabled: enabled,
      });
    }

    const preferences =
      patches.length > 0
        ? await this.preferencesService.updateSettingsForUser(userId, patches)
        : await this.preferencesService.listSettingsForUser(userId);

    return { settings: this.toSettings(preferences) };
  }

  private toSettings(preferences: Record<string, boolean>): NotificationSettingsView {
    return NOTIFICATION_SETTINGS_KEYS.reduce((settings, key) => {
      settings[key] =
        preferences[NOTIFICATION_SETTINGS_PREFERENCE_KEY_MAP[key]] === true;
      return settings;
    }, { pushNotifications: false } as NotificationSettingsView);
  }
}
