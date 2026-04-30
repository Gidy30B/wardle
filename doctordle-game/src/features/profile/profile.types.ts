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
  displayName?: string | null
  trainingLevel?: string | null
  country?: string | null
  individualMode?: boolean
  activeOrganization?: Organization | null
  memberships?: UserOrganizationMembership[]
  progress?: UserProgress | null
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
  displayName: string
  university: string
  organizationId?: string | null
  organizationName?: string | null
  organizationType?: OrganizationType | null
  skipped: boolean
  completedAt: string | null
}

export type WardleProfileCompletionPayload = {
  displayName: string
  university?: string
  organization?: Organization | null
}
