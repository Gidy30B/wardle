import type { RequestJson } from '../../lib/api'
import type { BackendProfile } from './profile.types'

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
