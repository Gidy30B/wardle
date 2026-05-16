import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useApi } from '../../../../../lib/api'
import {
  getNotificationPreferencesApi,
  updateNotificationPreferencesApi,
} from '../../../../notifications/notification.api'
import type {
  NotificationPreferenceUpdate,
  NotificationPreferencesResponse,
} from '../../../../notifications/notification.types'
import {
  ensurePushDeviceRegistered,
  getPushCapability,
  hasRegisteredPushToken,
  type PushCapability,
} from '../../../../notifications/pushRegistration'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import { SettingsSection, SettingsSubHero } from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'
import { SettingsToggleRow } from '../components/SettingsToggleRow'
import {
  getUserNotificationSettingsApi,
  updateUserNotificationSettingsApi,
} from '../settings.api'
import { DEFAULT_USER_NOTIFICATION_SETTINGS } from '../settings.constants'
import type {
  UpdateUserNotificationSettingsPayload,
  UserNotificationSettings,
} from '../settings.types'

const NOTIFICATION_SETTINGS_QUERY_KEY = ['notification-settings', 'me'] as const
const NOTIFICATION_PREFERENCES_QUERY_KEY = [
  'notification-preferences',
  'me',
] as const
const PUSH_CATEGORY_UPDATES: NotificationPreferenceUpdate[] = [
  { category: 'GAMEPLAY', pushEnabled: true },
  { category: 'STREAK', pushEnabled: true },
]
const PUSH_CATEGORY_DISABLES: NotificationPreferenceUpdate[] = [
  { category: 'GAMEPLAY', pushEnabled: false },
  { category: 'STREAK', pushEnabled: false },
]

export function NotificationSettingsScreen({ onBack }: { onBack: () => void }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const [pushCapability, setPushCapability] =
    useState<PushCapability | null>(null)
  const [hasLocalPushToken, setHasLocalPushToken] = useState(
    hasRegisteredPushToken,
  )
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(
    null,
  )

  useEffect(() => {
    let mounted = true

    void getPushCapability()
      .then((capability) => {
        if (mounted) {
          setPushCapability(capability)
        }
      })
      .catch(() => {
        if (mounted) {
          setPushCapability({ supported: false, reason: 'unsupported' })
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const notificationSettingsQuery = useQuery({
    queryKey: NOTIFICATION_SETTINGS_QUERY_KEY,
    queryFn: async () => getUserNotificationSettingsApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  const notificationPreferencesQuery = useQuery({
    queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
    queryFn: async () => getNotificationPreferencesApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  const notificationSettingsMutation = useMutation({
    mutationFn: async (payload: UpdateUserNotificationSettingsPayload) =>
      updateUserNotificationSettingsApi(request, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({
        queryKey: NOTIFICATION_SETTINGS_QUERY_KEY,
      })
      const previousSettings =
        queryClient.getQueryData<UserNotificationSettings>(
          NOTIFICATION_SETTINGS_QUERY_KEY,
        )

      queryClient.setQueryData<UserNotificationSettings>(
        NOTIFICATION_SETTINGS_QUERY_KEY,
        {
          ...(previousSettings ?? DEFAULT_USER_NOTIFICATION_SETTINGS),
          ...payload,
          pushNotifications: false,
        },
      )

      return { previousSettings }
    },
    onError: (_error, _payload, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(
          NOTIFICATION_SETTINGS_QUERY_KEY,
          context.previousSettings,
        )
      }
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(NOTIFICATION_SETTINGS_QUERY_KEY, settings)
    },
  })

  const pushPreferencesMutation = useMutation({
    mutationFn: async (patches: NotificationPreferenceUpdate[]) =>
      updateNotificationPreferencesApi(request, patches),
    onMutate: async (patches) => {
      setPushStatusMessage(null)
      await queryClient.cancelQueries({
        queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
      })
      const previousPreferences =
        queryClient.getQueryData<NotificationPreferencesResponse>(
          NOTIFICATION_PREFERENCES_QUERY_KEY,
        )

      queryClient.setQueryData<NotificationPreferencesResponse>(
        NOTIFICATION_PREFERENCES_QUERY_KEY,
        (current) => ({
          preferences: mergePushPreferencePatches(
            current?.preferences ?? previousPreferences?.preferences ?? [],
            patches,
          ),
        }),
      )

      return { previousPreferences }
    },
    onError: (_error, _patches, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(
          NOTIFICATION_PREFERENCES_QUERY_KEY,
          context.previousPreferences,
        )
      }
      setPushStatusMessage('Mobile push settings could not be saved.')
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, preferences)
    },
  })

  const notifications =
    notificationSettingsQuery.data ?? DEFAULT_USER_NOTIFICATION_SETTINGS
  const wardlePushPreferenceEnabled = useMemo(() => {
    const preferences = notificationPreferencesQuery.data?.preferences ?? []
    const gameplay = preferences.find(
      (preference) => preference.category === 'GAMEPLAY',
    )
    const streak = preferences.find(
      (preference) => preference.category === 'STREAK',
    )

    return Boolean(gameplay?.pushEnabled || streak?.pushEnabled)
  }, [notificationPreferencesQuery.data?.preferences])
  const pushSupported = pushCapability?.supported === true
  const pushEnabled =
    pushSupported && hasLocalPushToken && wardlePushPreferenceEnabled
  const pushDisabled =
    pushCapability === null || pushCapability.supported === false
  const pushSublabel =
    pushStatusMessage ??
    (pushCapability === null
      ? 'Checking mobile support...'
      : pushCapability.supported === false
        ? pushCapability.reason === 'web'
          ? 'Available in the mobile app'
          : 'Not supported on this device'
        : pushEnabled
          ? 'Enabled on this device'
          : 'Enable mobile alerts for daily cases and streaks')

  const toggle = (key: keyof UpdateUserNotificationSettingsPayload) => {
    notificationSettingsMutation.mutate({ [key]: !notifications[key] })
  }

  const togglePushNotifications = async () => {
    if (!pushSupported) return

    setPushStatusMessage(null)

    try {
      if (pushEnabled) {
        await pushPreferencesMutation.mutateAsync(PUSH_CATEGORY_DISABLES)
        return
      }

      await ensurePushDeviceRegistered(request)
      setHasLocalPushToken(true)
      setPushCapability({ supported: true, permission: 'granted' })
      await pushPreferencesMutation.mutateAsync(PUSH_CATEGORY_UPDATES)
    } catch (error) {
      setPushStatusMessage(
        error instanceof Error
          ? error.message
          : pushEnabled
            ? 'Mobile push could not be disabled. Try again later.'
            : 'Mobile push could not be enabled. Try again later.',
      )
    }
  }

  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Notifications" />
      <SettingsSubHero
        icon="🔔"
        title="Notification settings"
        desc="Control when and how Wardle reaches you"
      />
      <SettingsSection>
        <SettingsToggleRow
          icon="📲"
          iconBg="rgba(0,180,166,0.15)"
          label="Push notifications"
          sublabel={pushSublabel}
          on={pushEnabled}
          onToggle={() => void togglePushNotifications()}
          disabled={pushDisabled || pushPreferencesMutation.isPending}
        />
        <SettingsToggleRow
          icon="🔥"
          iconBg="rgba(244,162,97,0.15)"
          label="Streak reminders"
          sublabel="Alert before midnight if not played"
          on={notifications.streakReminders}
          onToggle={() => toggle('streakReminders')}
        />
        <SettingsToggleRow
          icon="🏆"
          iconBg="rgba(244,162,97,0.15)"
          label="Weekly leaderboard digest"
          sublabel="Your rank summary every Monday at 9 AM"
          on={notifications.weeklyDigest}
          onToggle={() => toggle('weeklyDigest')}
        />
        <SettingsToggleRow
          icon="⚔️"
          iconBg="rgba(140,100,210,0.15)"
          label="Challenge alerts"
          sublabel="When a friend challenges you"
          on={notifications.challengeAlerts}
          onToggle={() => toggle('challengeAlerts')}
        />
        <SettingsToggleRow
          icon="📣"
          iconBg="rgba(26,60,94,0.55)"
          label="Product announcements"
          sublabel="New features & case packs"
          on={notifications.productAnnouncements}
          onToggle={() => toggle('productAnnouncements')}
          style={{ borderBottom: 'none' }}
        />
      </SettingsSection>
    </SettingsShell>
  )
}

function mergePushPreferencePatches(
  preferences: NotificationPreferencesResponse['preferences'],
  patches: NotificationPreferenceUpdate[],
): NotificationPreferencesResponse['preferences'] {
  const byCategory = new Map(
    preferences.map((preference) => [preference.category, preference]),
  )

  for (const patch of patches) {
    const current = byCategory.get(patch.category) ?? {
      category: patch.category,
      inAppEnabled: true,
      pushEnabled: false,
      emailEnabled: false,
    }

    byCategory.set(patch.category, {
      ...current,
      ...patch,
      emailEnabled: false,
    })
  }

  return Array.from(byCategory.values())
}
