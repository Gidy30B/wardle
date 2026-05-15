import type { UserSettings } from '../../../profile/profile.types'
import type {
  DifficultyColorMap,
  MockAppearanceSettings,
  MockNotificationSettings,
  MockPrivacySettings,
  UserNotificationSettings,
} from './settings.types'

export const DEFAULT_USER_SETTINGS: UserSettings = {
  showTimer: true,
  hintsEnabled: true,
  autocompleteEnabled: true,
  difficultyPreference: 'STANDARD',
  spacedRepetitionEnabled: false,
}

export const DIFFICULTY_OPTIONS = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'HARD', label: 'Hard' },
  { value: 'EXPERT', label: 'Expert' },
] as const

export const DIFFICULTY_LABELS = {
  BEGINNER: 'Beginner',
  STANDARD: 'Standard',
  HARD: 'Hard',
  EXPERT: 'Expert',
} as const

export const DIFFICULTY_COLORS: DifficultyColorMap = {
  BEGINNER: 'var(--wardle-color-gray)',
  STANDARD: 'var(--wardle-color-teal)',
  HARD: 'var(--wardle-color-amber)',
  EXPERT: '#E05C5C',
}

export const DEFAULT_MOCK_NOTIFICATION_SETTINGS: MockNotificationSettings = {
  push: true,
  streak: true,
  digest: true,
  challenge: false,
  announcements: true,
}

export const DEFAULT_USER_NOTIFICATION_SETTINGS: UserNotificationSettings = {
  pushNotifications: false,
  streakReminders: true,
  challengeAlerts: true,
  weeklyDigest: true,
  productAnnouncements: true,
}

export const DEFAULT_MOCK_APPEARANCE_SETTINGS: MockAppearanceSettings = {
  theme: 'dark',
  textSize: 'M',
  animations: true,
  colorBlind: false,
  haptics: true,
}

export const DEFAULT_MOCK_PRIVACY_SETTINGS: MockPrivacySettings = {
  publicProfile: true,
  anonData: true,
}

export const SETTINGS_VERSION_LABEL = 'WARDLE v1.0.3 · BUILD 2026.04'
