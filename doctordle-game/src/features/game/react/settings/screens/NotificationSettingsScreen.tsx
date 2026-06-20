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
import { usePwaInstallPrompt } from '../../../../notifications/pwaInstall'
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
const IOS_HOME_SCREEN_PUSH_COPY =
  'On iPhone, notifications work after Wardle is added to your Home Screen.'
const IOS_HOME_SCREEN_STEPS = [
  'Tap Share',
  'Tap Add to Home Screen',
  'Open Wardle from the new icon',
  'Return here and enable notifications',
]

export function NotificationSettingsScreen({ onBack }: { onBack: () => void }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const pwaInstall = usePwaInstallPrompt()
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
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })

  const notificationPreferencesQuery = useQuery({
    queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
    queryFn: async () => getNotificationPreferencesApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
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
  const pushPermissionDenied =
    pushSupported && pushCapability.permission === 'denied'
  const pushEnabled =
    pushSupported && hasLocalPushToken && wardlePushPreferenceEnabled
  const pushDisabled =
    pushCapability === null ||
    pushCapability.supported === false ||
    pushPermissionDenied
  const requiresIosHomeScreenPwa =
    pushCapability?.supported === false &&
    pushCapability.reason === 'ios_requires_home_screen_pwa'
  const showIosInstallPrompt =
    requiresIosHomeScreenPwa && !pwaInstall.isNative && !pwaInstall.isStandalone
  const showBrowserInstallPrompt =
    !showIosInstallPrompt &&
    !pwaInstall.isNative &&
    !pwaInstall.isStandalone &&
    pwaInstall.canPrompt
  const pushSublabel =
    pushStatusMessage ??
    (pushCapability === null
      ? 'Checking mobile support...'
        : pushCapability.supported === false
        ? getPushUnsupportedSublabel(pushCapability.reason)
        : pushPermissionDenied
          ? pushCapability.platform === 'web'
            ? 'Notifications are blocked in this browser'
            : 'Notifications are blocked on this device'
        : pushEnabled
          ? 'Enabled on this device'
          : pushCapability.platform === 'web'
            ? 'Enable browser alerts for daily cases and streaks'
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
      setPushCapability((current) =>
        current?.supported
          ? { ...current, permission: 'granted' }
          : { supported: true, permission: 'granted', platform: 'web' },
      )
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
        {showIosInstallPrompt ? (
          <PwaInstallCard variant="ios" />
        ) : (
          <SettingsToggleRow
          icon="📲"
          iconBg="rgba(0,180,166,0.15)"
          label="Push notifications"
          sublabel={pushSublabel}
          on={requiresIosHomeScreenPwa ? false : pushEnabled}
          onToggle={() => void togglePushNotifications()}
          disabled={
            requiresIosHomeScreenPwa ||
            pushDisabled ||
            pushPreferencesMutation.isPending
          }
          />
        )}
        {showBrowserInstallPrompt ? (
          <PwaInstallCard
            variant="prompt"
            onInstall={() => void pwaInstall.promptInstall()}
          />
        ) : null}
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

function PwaInstallCard({
  variant,
  onInstall,
}: {
  variant: 'ios' | 'prompt'
  onInstall?: () => void
}) {
  const isIos = variant === 'ios'

  return (
    <div className="border-b border-white/[0.04] px-4 pb-4 pt-1">
      <div className="rounded-[16px] border border-[rgba(0,180,166,0.16)] bg-[rgba(0,180,166,0.055)] px-4 py-3">
        <p className="text-[13px] font-black text-[var(--wardle-color-mint)]">
          {isIos
            ? 'Install Wardle to enable notifications'
            : 'Install Wardle'}
        </p>
        <p className="text-[12px] leading-5 text-white/58">
          {isIos
            ? IOS_HOME_SCREEN_PUSH_COPY
            : 'Add Wardle to your device for a faster app-like experience.'}
        </p>
        {isIos ? (
          <ol className="mt-3 space-y-1.5">
            {IOS_HOME_SCREEN_STEPS.map((step, index) => (
              <li
                key={step}
                className="grid grid-cols-[20px_minmax(0,1fr)] gap-2 text-[12px] leading-5 text-white/52"
              >
                <span className="font-brand-mono text-[10px] font-black text-[var(--wardle-color-teal)]/70">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        ) : (
          <button
            type="button"
            onClick={onInstall}
            className="mt-3 rounded-full border border-[var(--wardle-color-teal)]/24 bg-[var(--wardle-color-teal)]/10 px-4 py-2 text-[12px] font-black text-[var(--wardle-color-teal)] transition hover:border-[var(--wardle-color-teal)]/36 hover:bg-[var(--wardle-color-teal)]/14"
          >
            Install Wardle
          </button>
        )}
      </div>
    </div>
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

function getPushUnsupportedSublabel(
  reason: Extract<PushCapability, { supported: false }>['reason'],
) {
  switch (reason) {
    case 'config_missing':
      return 'Notifications are not configured for this build.'
    case 'ios_requires_home_screen_pwa':
      return IOS_HOME_SCREEN_PUSH_COPY
    case 'browser_unsupported':
    case 'firebase_unsupported':
      return 'Push notifications are not supported in this browser.'
    case 'service_worker_unavailable':
      return 'Notification worker is unavailable in this build.'
    case 'permission_denied':
      return 'Notifications are blocked in this browser'
    case 'unsupported':
    default:
      return 'Not supported on this device'
  }
}
