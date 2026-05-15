export type NotificationCategory =
  | 'GAMEPLAY'
  | 'REWARD'
  | 'LEARNING'
  | 'LEADERBOARD'
  | 'STREAK'
  | 'CONTENT'
  | 'SOCIAL'
  | 'BILLING'
  | 'ADMIN'
  | 'SYSTEM'

export type NotificationPriority = 'low' | 'normal' | 'high'

export type WardleNotification = {
  id: string
  type: string
  category: NotificationCategory
  title: string
  body: string
  data?: Record<string, unknown> | null
  priority: NotificationPriority
  readAt?: string | null
  seenAt?: string | null
  createdAt: string
  expiresAt?: string | null
}

export type NotificationCreatedPayload = Omit<
  WardleNotification,
  'readAt' | 'seenAt' | 'expiresAt'
> & {
  unreadCount: number
}

export type NotificationPreference = {
  category: NotificationCategory
  inAppEnabled: boolean
  pushEnabled: boolean
  emailEnabled: boolean
}

export type NotificationPreferenceUpdate = {
  category: NotificationCategory
  inAppEnabled?: boolean
  pushEnabled?: boolean
  emailEnabled?: boolean
}

export type NotificationPreferencesResponse = {
  preferences: NotificationPreference[]
}

export type NotificationsResponse = {
  notifications: WardleNotification[]
}

export type UnreadCountResponse = {
  unreadCount: number
}
