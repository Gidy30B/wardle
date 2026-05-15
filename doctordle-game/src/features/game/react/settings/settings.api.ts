import type { RequestJson } from '../../../../lib/api'
import type {
  UpdateUserNotificationSettingsPayload,
  UserNotificationSettings,
} from './settings.types'

type UserNotificationSettingsResponse = {
  settings: Omit<UserNotificationSettings, 'pushNotifications'>
}

function withClientOnlyNotificationFields(
  settings: UserNotificationSettingsResponse['settings'],
): UserNotificationSettings {
  return {
    ...settings,
    pushNotifications: false,
  }
}

export async function getUserNotificationSettingsApi(
  request: RequestJson,
): Promise<UserNotificationSettings> {
  const response = await request<UserNotificationSettingsResponse>(
    '/user/notification-settings',
  )

  return withClientOnlyNotificationFields(response.settings)
}

export async function updateUserNotificationSettingsApi(
  request: RequestJson,
  payload: UpdateUserNotificationSettingsPayload,
): Promise<UserNotificationSettings> {
  const response = await request<UserNotificationSettingsResponse>(
    '/user/notification-settings',
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )

  return withClientOnlyNotificationFields(response.settings)
}
