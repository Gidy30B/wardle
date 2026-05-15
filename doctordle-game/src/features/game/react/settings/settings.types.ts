import type { CSSProperties, ReactNode } from 'react'
import type { UserOrganizationMembership } from '../../../organizations/organization.types'
import type {
  DifficultyPreference,
  UserSettings,
} from '../../../profile/profile.types'

export type SettingsPageProps = {
  currentStreak: number | null
  xpTotal: number | null
  organizationName: string | null
  memberships: UserOrganizationMembership[]
}

export type SettingsScreenId =
  | 'gameplay'
  | 'notifications'
  | 'appearance'
  | 'stats'
  | 'account'
  | 'legal'

export type SettingsUpdateHandler = (payload: Partial<UserSettings>) => void

export type SettingsRowProps = {
  icon: ReactNode
  iconBg: string
  label: string
  sublabel?: string
  right?: ReactNode
  onClick?: () => void
  redLabel?: boolean
  style?: CSSProperties
}

export type MockNotificationSettings = {
  push: boolean
  streak: boolean
  digest: boolean
  challenge: boolean
  announcements: boolean
}

export type UserNotificationSettings = {
  streakReminders: boolean
  challengeAlerts: boolean
  weeklyDigest: boolean
  productAnnouncements: boolean
  pushNotifications: boolean
}

export type UpdateUserNotificationSettingsPayload = Partial<
  Omit<UserNotificationSettings, 'pushNotifications'>
>

export type MockAppearanceSettings = {
  theme: 'dark' | 'light'
  textSize: 'S' | 'M' | 'L'
  animations: boolean
  colorBlind: boolean
  haptics: boolean
}

export type MockPrivacySettings = {
  publicProfile: boolean
  anonData: boolean
}

export type DifficultyColorMap = Record<DifficultyPreference, string>
