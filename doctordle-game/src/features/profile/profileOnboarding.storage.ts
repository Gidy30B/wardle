import type { WardleProfileOnboarding } from './profile.types'

const STORAGE_PREFIX = 'wardle:profile-onboarding:'

export function getProfileOnboardingStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`
}

export function readProfileOnboarding(userId: string): WardleProfileOnboarding | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawValue = window.localStorage.getItem(getProfileOnboardingStorageKey(userId))
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<WardleProfileOnboarding>
    return {
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
      university: typeof parsed.university === 'string' ? parsed.university : '',
      skipped: parsed.skipped === true,
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
    }
  } catch {
    return null
  }
}

export function writeProfileOnboarding(
  userId: string,
  profile: WardleProfileOnboarding,
) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    getProfileOnboardingStorageKey(userId),
    JSON.stringify(profile),
  )
}
