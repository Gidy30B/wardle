import {
  readProfileOnboarding,
  writeProfileOnboarding,
} from '../profile/profileOnboarding.storage'

type PendingAuthProfile = {
  email: string
  displayName: string
  university: string
  createdAt: string
}

const PENDING_PROFILE_PREFIX = 'wardle:pending-auth-profile:'

export function savePendingAuthProfile(profile: {
  email: string
  displayName: string
  university: string
}) {
  if (typeof window === 'undefined') {
    return
  }

  // Signup can complete before the app has a fully active session; cache the
  // profile fields briefly and apply them after Clerk session bootstrap.
  const payload: PendingAuthProfile = {
    email: normalizeEmail(profile.email),
    displayName: profile.displayName.trim(),
    university: profile.university.trim(),
    createdAt: new Date().toISOString(),
  }

  window.sessionStorage.setItem(getPendingProfileKey(payload.email), JSON.stringify(payload))
}

export function consumePendingAuthProfile(userId: string, email: string | null | undefined) {
  if (typeof window === 'undefined' || !email) {
    return null
  }

  const normalizedEmail = normalizeEmail(email)
  const key = getPendingProfileKey(normalizedEmail)
  const rawValue = window.sessionStorage.getItem(key)

  if (!rawValue || readProfileOnboarding(userId)) {
    return null
  }

  try {
    const pending = JSON.parse(rawValue) as Partial<PendingAuthProfile>
    if (!pending.displayName?.trim() || !pending.university?.trim()) {
      return null
    }

    writeProfileOnboarding(userId, {
      displayName: pending.displayName.trim(),
      university: pending.university.trim(),
      organizationId: null,
      organizationName: null,
      organizationType: null,
      skipped: false,
      completedAt: new Date().toISOString(),
    })

    window.sessionStorage.removeItem(key)
    return pending
  } catch {
    window.sessionStorage.removeItem(key)
    return null
  }
}

function getPendingProfileKey(email: string) {
  return `${PENDING_PROFILE_PREFIX}${email}`
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
