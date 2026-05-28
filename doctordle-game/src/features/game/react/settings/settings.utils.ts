import type { BackendProfile } from '../../../profile/profile.types'
import type { UserOrganizationMembership } from '../../../organizations/organization.types'
import { DIFFICULTY_OPTIONS } from './settings.constants'

export function getUsername(backendProfile: BackendProfile | null | undefined) {
  return backendProfile?.username?.trim() || ''
}

export function getMembershipLabel(memberships: UserOrganizationMembership[]) {
  return memberships.length > 0
    ? `${memberships.length} organization${memberships.length === 1 ? '' : 's'}`
    : 'Individual'
}

export function getNextDifficultyPreference(current: string) {
  const currentIndex = DIFFICULTY_OPTIONS.findIndex(
    (option) => option.value === current,
  )
  return DIFFICULTY_OPTIONS[(currentIndex + 1) % DIFFICULTY_OPTIONS.length].value
}
