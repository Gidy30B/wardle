export const NotificationSettingPreferenceKey = {
  StreakReminders: 'setting.streak_reminders',
  ChallengeAlerts: 'setting.challenge_alerts',
  WeeklyDigest: 'setting.weekly_digest',
  ProductAnnouncements: 'setting.product_announcements',
} as const;

export type NotificationSettingsKey =
  | 'streakReminders'
  | 'challengeAlerts'
  | 'weeklyDigest'
  | 'productAnnouncements';

export type NotificationSettingsView = Record<
  NotificationSettingsKey,
  boolean
> & {
  pushNotifications: false;
};

export const NOTIFICATION_SETTINGS_PREFERENCE_KEY_MAP = {
  streakReminders: NotificationSettingPreferenceKey.StreakReminders,
  challengeAlerts: NotificationSettingPreferenceKey.ChallengeAlerts,
  weeklyDigest: NotificationSettingPreferenceKey.WeeklyDigest,
  productAnnouncements: NotificationSettingPreferenceKey.ProductAnnouncements,
} as const satisfies Record<
  NotificationSettingsKey,
  (typeof NotificationSettingPreferenceKey)[keyof typeof NotificationSettingPreferenceKey]
>;

export const NOTIFICATION_SETTINGS_KEYS = Object.keys(
  NOTIFICATION_SETTINGS_PREFERENCE_KEY_MAP,
) as NotificationSettingsKey[];

// XP reward notifications are intentionally not exposed in the current Settings
// UI. They remain controlled only by the lower-level raw REWARD category
// preference API.
