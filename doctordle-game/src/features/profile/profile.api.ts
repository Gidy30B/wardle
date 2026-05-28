import type { RequestJson } from '../../lib/api'
import type {
  BackendProfile,
  UserOnboardingState,
  UserSettings,
  UserSettingsUpdate,
} from './profile.types'

export async function getBackendProfileApi(request: RequestJson): Promise<BackendProfile> {
  return request<BackendProfile>('/users/me/profile')
}

export async function updateBackendProfileApi(
  request: RequestJson,
  payload: {
    username?: string
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

export async function getUserOnboardingApi(
  request: RequestJson,
): Promise<UserOnboardingState> {
  return request<UserOnboardingState>('/users/me/onboarding')
}

export async function saveOnboardingProfileApi(
  request: RequestJson,
  payload: { username: string },
): Promise<UserOnboardingState> {
  return request<UserOnboardingState>('/users/me/onboarding/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function completeOnboardingIndividualApi(
  request: RequestJson,
): Promise<UserOnboardingState> {
  return request<UserOnboardingState>('/users/me/onboarding/individual', {
    method: 'POST',
  })
}

export async function completeOnboardingOrganizationApi(
  request: RequestJson,
  payload: { organizationId: string },
): Promise<UserOnboardingState> {
  return request<UserOnboardingState>('/users/me/onboarding/organization', {
    method: 'POST',
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
