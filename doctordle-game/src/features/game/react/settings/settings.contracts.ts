import type { UserSettings } from '../../../profile/profile.types'

export type SettingsRepository = {
  getUserSettings: () => Promise<UserSettings>
  updateUserSettings: (payload: Partial<UserSettings>) => Promise<UserSettings>
}

export type MockSettingsScope =
  | 'notifications'
  | 'appearance'
  | 'privacy'
  | 'legal'

