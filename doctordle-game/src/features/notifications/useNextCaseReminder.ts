import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../../lib/api'
import {
  getNotificationPreferencesApi,
  updateNotificationPreferencesApi,
} from './notification.api'
import {
  ensurePushDeviceRegistered,
  getPushCapability,
  type PushCapability,
} from './pushRegistration'

type ReminderPermission = 'unknown' | 'granted' | 'denied' | 'prompt'

const NOTIFICATION_PREFERENCES_QUERY_KEY = [
  'notification-preferences',
  'me',
] as const
const NEXT_CASE_REMINDER_CATEGORY = 'GAMEPLAY' as const
const DENIED_MESSAGE = 'Notifications are off. Enable them in settings.'

export function useNextCaseReminder() {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const [capability, setCapability] = useState<PushCapability | null>(null)
  const [permission, setPermission] = useState<ReminderPermission>('unknown')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    void getPushCapability()
      .then((nextCapability) => {
        if (!mounted) return
        setCapability(nextCapability)
        setPermission(getPermissionFromCapability(nextCapability))
      })
      .catch(() => {
        if (!mounted) return
        setCapability({ supported: false, reason: 'unsupported' })
        setPermission('unknown')
      })

    return () => {
      mounted = false
    }
  }, [])

  const preferencesQuery = useQuery({
    queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
    queryFn: async () => getNotificationPreferencesApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })

  const preferenceEnabled = useMemo(() => {
    const preferences = preferencesQuery.data?.preferences ?? []
    return Boolean(
      preferences.find(
        (preference) => preference.category === NEXT_CASE_REMINDER_CATEGORY,
      )?.pushEnabled,
    )
  }, [preferencesQuery.data?.preferences])

  const enabled = preferenceEnabled && permission === 'granted'

  const enableReminder = useCallback(async () => {
    if (loading) return

    setLoading(true)
    setError(null)

    try {
      const latestCapability = capability ?? await getPushCapability()
      setCapability(latestCapability)

      if (
        latestCapability.supported === false &&
        latestCapability.reason === 'permission_denied'
      ) {
        setPermission('denied')
        setError(DENIED_MESSAGE)
        return
      }

      if (latestCapability.supported === false) {
        setPermission('unknown')
        setError('Notifications are not available on this device yet.')
        return
      }

      if (getPermissionFromCapability(latestCapability) === 'denied') {
        setPermission('denied')
        setError(DENIED_MESSAGE)
        return
      }

      await ensurePushDeviceRegistered(request)
      setPermission('granted')
      setCapability({ ...latestCapability, permission: 'granted' })

      const nextPreferences = await updateNotificationPreferencesApi(request, [
        { category: NEXT_CASE_REMINDER_CATEGORY, pushEnabled: true },
      ])
      queryClient.setQueryData(
        NOTIFICATION_PREFERENCES_QUERY_KEY,
        nextPreferences,
      )
    } catch (exception) {
      const message = getReminderSetupErrorMessage(exception)
      setError(message)
      if (message === DENIED_MESSAGE) {
        setPermission('denied')
      }
    } finally {
      setLoading(false)
    }
  }, [capability, loading, queryClient, request])

  return {
    enabled,
    permission,
    loading,
    error,
    enableReminder,
  }
}

function getPermissionFromCapability(
  capability: PushCapability | null,
): ReminderPermission {
  if (!capability) {
    return 'unknown'
  }

  if (capability.supported === false) {
    return capability.reason === 'permission_denied' ? 'denied' : 'unknown'
  }

  return normalizePermission(capability.permission)
}

function normalizePermission(permission: string): ReminderPermission {
  if (permission === 'granted') return 'granted'
  if (permission === 'denied') return 'denied'
  if (permission === 'prompt' || permission === 'default') return 'prompt'
  return 'unknown'
}

function getReminderSetupErrorMessage(exception: unknown) {
  const message = exception instanceof Error ? exception.message : ''
  const normalized = message.toLowerCase()

  if (
    normalized.includes('permission') &&
    (normalized.includes('not granted') ||
      normalized.includes('denied') ||
      normalized.includes('blocked'))
  ) {
    return DENIED_MESSAGE
  }

  return message || 'Reminder could not be enabled. Try again later.'
}

export type { ReminderPermission }
