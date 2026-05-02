export const NotificationCategory = {
  Gameplay: 'GAMEPLAY',
  Reward: 'REWARD',
  Learning: 'LEARNING',
  Leaderboard: 'LEADERBOARD',
  Streak: 'STREAK',
  Content: 'CONTENT',
  Social: 'SOCIAL',
  Billing: 'BILLING',
  Admin: 'ADMIN',
  System: 'SYSTEM',
} as const;

export type NotificationCategoryValue =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NOTIFICATION_CATEGORIES = Object.values(NotificationCategory);

export type NotificationPriority = 'low' | 'normal' | 'high';

export function isNotificationCategory(
  value: string,
): value is NotificationCategoryValue {
  return (NOTIFICATION_CATEGORIES as string[]).includes(value);
}

export type NotificationCreatedRealtimePayload = {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  priority: NotificationPriority;
  createdAt: string;
  unreadCount: number;
};

export const NOTIFICATION_V1_CREATED_EVENT = 'notification.v1.created';
