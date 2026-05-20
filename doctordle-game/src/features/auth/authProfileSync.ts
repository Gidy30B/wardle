type PendingAuthProfile = {
  email: string
  displayName: string
  createdAt: string
}

const PENDING_PROFILE_PREFIX = 'wardle:pending-auth-profile:'

export function savePendingAuthProfile(profile: {
  email: string
  displayName: string
}) {
  if (typeof window === 'undefined') {
    return
  }

  // Signup can complete before the app has a fully active session. Keep this
  // durable until the backend confirms profile persistence.
  const payload: PendingAuthProfile = {
    email: normalizeEmail(profile.email),
    displayName: profile.displayName.trim(),
    createdAt: new Date().toISOString(),
  }

  window.localStorage.setItem(getPendingProfileKey(payload.email), JSON.stringify(payload))
}

export function consumePendingAuthProfile(userId: string, email: string | null | undefined) {
  if (typeof window === 'undefined' || !email) {
    return null
  }

  const normalizedEmail = normalizeEmail(email)
  const key = getPendingProfileKey(normalizedEmail)
  const rawValue = window.localStorage.getItem(key)

  if (!rawValue) {
    return null
  }

  try {
    const pending = JSON.parse(rawValue) as Partial<PendingAuthProfile>
    if (!pending.displayName?.trim()) {
      return null
    }

    return {
      ...pending,
      userId,
      displayName: pending.displayName.trim(),
    }
  } catch {
    window.localStorage.removeItem(key)
    return null
  }
}

export function clearPendingAuthProfile(email: string | null | undefined) {
  if (typeof window === 'undefined' || !email) {
    return
  }

  window.localStorage.removeItem(getPendingProfileKey(normalizeEmail(email)))
}

function getPendingProfileKey(email: string) {
  return `${PENDING_PROFILE_PREFIX}${email}`
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
