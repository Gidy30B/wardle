import type { UserOnboardingState, UserOnboardingStatus } from './profile.types'

type OnboardingDecisionInput = {
  authLoaded: boolean
  signedIn: boolean
  userId?: string | null
  queryPending: boolean
  querySuccess: boolean
  queryError: unknown
  onboarding?: Pick<UserOnboardingState, 'onboardingStatus'> | null
}

export type OnboardingDecision = {
  loading: boolean
  hasError: boolean
  shouldShowOnboarding: boolean
}

export function requiresUserOnboarding(
  status: UserOnboardingStatus | null | undefined,
) {
  return status === 'PROFILE_REQUIRED' || status === 'ORGANIZATION_REQUIRED'
}

export function getOnboardingDecision({
  authLoaded,
  signedIn,
  userId,
  queryPending,
  querySuccess,
  queryError,
  onboarding,
}: OnboardingDecisionInput): OnboardingDecision {
  if (!authLoaded) {
    return { loading: true, hasError: false, shouldShowOnboarding: false }
  }

  if (!signedIn) {
    return { loading: false, hasError: false, shouldShowOnboarding: false }
  }

  if (!userId || queryPending) {
    return { loading: true, hasError: false, shouldShowOnboarding: false }
  }

  if (queryError || !querySuccess || !onboarding) {
    return { loading: false, hasError: true, shouldShowOnboarding: false }
  }

  return {
    loading: false,
    hasError: false,
    shouldShowOnboarding: requiresUserOnboarding(onboarding.onboardingStatus),
  }
}
