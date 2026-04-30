import type { RequestJson } from '../../lib/api'
import type { BackendProfile, UserSettings, UserSettingsUpdate } from './profile.types'

export async function getBackendProfileApi(request: RequestJson): Promise<BackendProfile> {
  return request<BackendProfile>('/users/me/profile')
}

export async function updateBackendProfileApi(
  request: RequestJson,
  payload: {
    displayName?: string
    trainingLevel?: string
    country?: string
    individualMode?: boolean
    organizationId?: string | null
  },
): Promise<BackendProfile> {
  return request<BackendProfile>('/users/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function getUserSettingsApi(request: RequestJson): Promise<UserSettings> {
  return request<UserSettings>('/users/me/settings')
}

export async function updateUserSettingsApi(
  request: RequestJson,
  payload: UserSettingsUpdate,
): Promise<UserSettings> {
  return request<UserSettings>('/users/me/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
