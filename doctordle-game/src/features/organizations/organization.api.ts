import type { RequestJson } from '../../lib/api'
import type {
  Organization,
  OrganizationType,
  UserOrganizationMembership,
} from './organization.types'

export function searchOrganizationsApi(
  request: RequestJson,
  query: string,
): Promise<Organization[]> {
  const params = new URLSearchParams()
  if (query.trim()) {
    params.set('query', query.trim())
  }

  return request<Organization[]>(`/organizations?${params.toString()}`)
}

export function createOrganizationApi(
  request: RequestJson,
  payload: { name: string; type: OrganizationType },
): Promise<UserOrganizationMembership> {
  return request<UserOrganizationMembership>('/organizations', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name.trim(),
      type: payload.type,
    }),
  })
}

export function getMyOrganizationsApi(
  request: RequestJson,
): Promise<UserOrganizationMembership[]> {
  return request<UserOrganizationMembership[] | { memberships?: UserOrganizationMembership[] }>(
    '/organizations/me',
  ).then((payload) => {
    if (Array.isArray(payload)) {
      return payload
    }

    return Array.isArray(payload.memberships) ? payload.memberships : []
  })
}

export function joinOrganizationApi(
  request: RequestJson,
  organizationId: string,
): Promise<UserOrganizationMembership> {
  return request<UserOrganizationMembership>(`/organizations/${organizationId}/join`, {
    method: 'POST',
  })
}
