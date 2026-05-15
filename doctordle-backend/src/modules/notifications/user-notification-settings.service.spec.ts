import { NotificationSettingPreferenceKey } from './notification-settings.contract';
import { UserNotificationSettingsService } from './user-notification-settings.service';

describe('UserNotificationSettingsService', () => {
  function createService(settingsByKey: Record<string, boolean> = {}) {
    const preferencesService = {
      listSettingsForUser: jest.fn().mockResolvedValue({
        [NotificationSettingPreferenceKey.StreakReminders]:
          settingsByKey[NotificationSettingPreferenceKey.StreakReminders] ??
          true,
        [NotificationSettingPreferenceKey.ChallengeAlerts]:
          settingsByKey[NotificationSettingPreferenceKey.ChallengeAlerts] ??
          true,
        [NotificationSettingPreferenceKey.WeeklyDigest]:
          settingsByKey[NotificationSettingPreferenceKey.WeeklyDigest] ?? true,
        [NotificationSettingPreferenceKey.ProductAnnouncements]:
          settingsByKey[
            NotificationSettingPreferenceKey.ProductAnnouncements
          ] ?? true,
      }),
      updateSettingsForUser: jest.fn().mockImplementation((_userId, patches) =>
        Promise.resolve(
          patches.reduce(
            (acc: Record<string, boolean>, patch: { key: string; inAppEnabled: boolean }) => {
              acc[patch.key] = patch.inAppEnabled;
              return acc;
            },
            {
              [NotificationSettingPreferenceKey.StreakReminders]: true,
              [NotificationSettingPreferenceKey.ChallengeAlerts]: true,
              [NotificationSettingPreferenceKey.WeeklyDigest]: true,
              [NotificationSettingPreferenceKey.ProductAnnouncements]: true,
            },
          ),
        ),
      ),
    };

    return {
      service: new UserNotificationSettingsService(
        preferencesService as never,
      ),
      preferencesService,
    };
  }

  it('returns current UI fields plus pushNotifications=false', async () => {
    const { service } = createService({
      [NotificationSettingPreferenceKey.ChallengeAlerts]: false,
    });

    await expect(service.getForUser('user-1')).resolves.toEqual({
      settings: {
        streakReminders: true,
        challengeAlerts: false,
        weeklyDigest: true,
        productAnnouncements: true,
        pushNotifications: false,
      },
    });
  });

  it('GET returns defaults for a new user', async () => {
    const { service, preferencesService } = createService();

    await expect(service.getForUser('new-user')).resolves.toEqual({
      settings: {
        streakReminders: true,
        challengeAlerts: true,
        weeklyDigest: true,
        productAnnouncements: true,
        pushNotifications: false,
      },
    });
    expect(preferencesService.listSettingsForUser).toHaveBeenCalledWith(
      'new-user',
    );
  });

  it('translates setting updates into internal preference keys', async () => {
    const { service, preferencesService } = createService();

    await service.updateForUser('user-1', {
      streakReminders: false,
      challengeAlerts: true,
      productAnnouncements: false,
    });

    expect(preferencesService.updateSettingsForUser).toHaveBeenCalledWith(
      'user-1',
      [
        {
          key: NotificationSettingPreferenceKey.StreakReminders,
          inAppEnabled: false,
        },
        {
          key: NotificationSettingPreferenceKey.ChallengeAlerts,
          inAppEnabled: true,
        },
        {
          key: NotificationSettingPreferenceKey.ProductAnnouncements,
          inAppEnabled: false,
        },
      ],
    );
  });

  it('ignores pushNotifications on patch and always returns false', async () => {
    const { service, preferencesService } = createService();

    await expect(
      service.updateForUser('user-1', {
        pushNotifications: true,
      }),
    ).resolves.toEqual({
      settings: {
        streakReminders: true,
        challengeAlerts: true,
        weeklyDigest: true,
        productAnnouncements: true,
        pushNotifications: false,
      },
    });
    expect(preferencesService.updateSettingsForUser).not.toHaveBeenCalled();
  });

  it('PATCH persists preferences and GET after PATCH returns saved values', async () => {
    const state: Record<string, boolean> = {
      [NotificationSettingPreferenceKey.StreakReminders]: true,
      [NotificationSettingPreferenceKey.ChallengeAlerts]: true,
      [NotificationSettingPreferenceKey.WeeklyDigest]: true,
      [NotificationSettingPreferenceKey.ProductAnnouncements]: true,
    };
    const preferencesService = {
      listSettingsForUser: jest.fn().mockImplementation(() =>
        Promise.resolve({
          ...state,
        }),
      ),
      updateSettingsForUser: jest.fn().mockImplementation((_userId, patches) => {
        for (const patch of patches as Array<{
          key: string;
          inAppEnabled: boolean;
        }>) {
          state[patch.key] = patch.inAppEnabled;
        }
        return Promise.resolve({
          ...state,
        });
      }),
    };
    const service = new UserNotificationSettingsService(
      preferencesService as never,
    );

    await expect(
      service.updateForUser('user-1', {
        challengeAlerts: false,
        weeklyDigest: false,
      }),
    ).resolves.toMatchObject({
      settings: {
        challengeAlerts: false,
        weeklyDigest: false,
      },
    });

    await expect(service.getForUser('user-1')).resolves.toEqual({
      settings: {
        streakReminders: true,
        challengeAlerts: false,
        weeklyDigest: false,
        productAnnouncements: true,
        pushNotifications: false,
      },
    });
  });
});
