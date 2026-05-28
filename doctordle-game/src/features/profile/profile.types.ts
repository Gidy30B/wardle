import type { UserProgress } from '../game/game.types'
import type {
  Organization,
  OrganizationType,
  UserOrganizationMembership,
} from '../organizations/organization.types'

export type BackendProfile = {
  clerkId: string
  email?: string | null
  role?: string | null
  userId: string
  username?: string | null
  normalizedUsername?: string | null
  trainingLevel?: string | null
  country?: string | null
  individualMode?: boolean
  onboardingStatus?: UserOnboardingStatus
  onboardingCompletedAt?: string | null
  primaryOrganizationId?: string | null
  primaryOrganization?: Organization | null
  activeOrganization?: Organization | null
  memberships?: UserOrganizationMembership[]
  progress?: UserProgress | null
}

export type UserOnboardingStatus =
  | 'PROFILE_REQUIRED'
  | 'ORGANIZATION_REQUIRED'
  | 'COMPLETE'

export type UserOnboardingState = {
  userId: string
  email: string | null
  username: string | null
  normalizedUsername: string | null
  onboardingStatus: UserOnboardingStatus
  individualMode: boolean
  primaryOrganizationId: string | null
  primaryOrganization: Pick<Organization, 'id' | 'name' | 'slug' | 'type'> | null
  memberships: Array<{
    organizationId: string
    name: string
    slug: string | null
    type: OrganizationType
    role: string
    status: string
  }>
}

export type DifficultyPreference = 'BEGINNER' | 'STANDARD' | 'HARD' | 'EXPERT'

export type UserSettings = {
  showTimer: boolean
  hintsEnabled: boolean
  autocompleteEnabled: boolean
  difficultyPreference: DifficultyPreference
  spacedRepetitionEnabled: boolean
  createdAt?: string
  updatedAt?: string
}

export type UserSettingsUpdate = Partial<
  Pick<
    UserSettings,
    | 'showTimer'
    | 'hintsEnabled'
    | 'autocompleteEnabled'
    | 'difficultyPreference'
    | 'spacedRepetitionEnabled'
  >
>

export type WardleProfileOnboarding = {
  username: string
  university: string
  organizationId?: string | null
  organizationName?: string | null
  organizationType?: OrganizationType | null
  skipped: boolean
  completedAt: string | null
}

export type WardleProfileCompletionPayload = {
  username: string
  university?: string
  organization?: Organization | null
}
