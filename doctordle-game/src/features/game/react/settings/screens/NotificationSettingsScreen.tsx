import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useApi } from '../../../../../lib/api'
import {
  getNotificationPreferencesApi,
  updateNotificationPreferencesApi,
} from '../../../../notifications/notification.api'
import type {
  NotificationCategory,
  NotificationPreference,
  NotificationPreferencesResponse,
  NotificationPreferenceUpdate,
} from '../../../../notifications/notification.types'
import {
  ensurePushDeviceRegistered,
  getPushCapability,
  type PushCapability,
} from '../../../../notifications/pushRegistration'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import { SettingsRow } from '../components/SettingsRow'
import {
  SettingsSection,
  SettingsSectionLabel,
  SettingsSubHero,
} from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'
import { SettingsToggle } from '../components/SettingsToggleRow'

const NOTIFICATION_PREFERENCES_QUERY_KEY = [
  'notification-preferences',
  'me',
] as const

const SUPPORTED_NOTIFICATION_CATEGORIES: Array<{
  category: NotificationCategory
  icon: string
  iconBg: string
  label: string
  sublabel: string
}> = [
  {
    category: 'GAMEPLAY',
    icon: 'G',
    iconBg: 'rgba(0,180,166,0.15)',
    label: 'Gameplay',
    sublabel: 'Daily case alerts and play reminders',
  },
  {
    category: 'STREAK',
    icon: 'S',
    iconBg: 'rgba(244,162,97,0.15)',
    label: 'Streak',
    sublabel: 'Streak reminders and milestones',
  },
  {
    category: 'LEARNING',
    icon: 'L',
    iconBg: 'rgba(140,100,210,0.15)',
    label: 'Learning',
    sublabel: 'Weekly digest and explanation updates',
  },
  {
    category: 'SYSTEM',
    icon: '!',
    iconBg: 'rgba(26,60,94,0.55)',
    label: 'System',
    sublabel: 'Account and service notices',
  },
]

function defaultPreference(
  category: NotificationCategory,
): NotificationPreference {
  return {
    category,
    inAppEnabled: true,
    pushEnabled: false,
    emailEnabled: false,
  }
}

export function NotificationSettingsScreen({ onBack }: { onBack: () => void }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const [pushCapability, setPushCapability] =
    useState<PushCapability | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

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

  const preferencesQuery = useQuery({
    queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
    queryFn: async () => getNotificationPreferencesApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  const preferencesMutation = useMutation({
    mutationFn: async (patches: NotificationPreferenceUpdate[]) =>
      updateNotificationPreferencesApi(request, patches),
    onMutate: async (patches) => {
      setStatusMessage(null)
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
          preferences: mergePreferencePatches(
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
      setStatusMessage('Notification settings could not be saved.')
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, preferences)
    },
  })

  const preferences = useMemo(() => {
    const byCategory = new Map(
      (preferencesQuery.data?.preferences ?? []).map((preference) => [
        preference.category,
        preference,
      ]),
    )

    return SUPPORTED_NOTIFICATION_CATEGORIES.map((item) => ({
      ...item,
      preference:
        byCategory.get(item.category) ?? defaultPreference(item.category),
    }))
  }, [preferencesQuery.data?.preferences])

  const pushSupported = pushCapability?.supported === true
  const pushGranted = pushSupported && pushCapability.permission === 'granted'
  const pushUnsupportedMessage =
    pushCapability?.supported === false && pushCapability.reason === 'web'
      ? 'Push notifications available on mobile app'
      : 'Push notifications are not supported on this device'

  const updatePreference = (patch: NotificationPreferenceUpdate) => {
    preferencesMutation.mutate([patch])
  }

  const togglePush = async (preference: NotificationPreference) => {
    if (preference.pushEnabled) {
      updatePreference({
        category: preference.category,
        pushEnabled: false,
      })
      return
    }

    try {
      await ensurePushDeviceRegistered(request)
      setPushCapability({ supported: true, permission: 'granted' })
      updatePreference({
        category: preference.category,
        pushEnabled: true,
      })
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Push registration failed. Try again later.',
      )
    }
  }

  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Notifications" />
      <SettingsSubHero
        icon="N"
        title="Notification settings"
        desc="Control in-app alerts and mobile push delivery"
      />

      {pushSupported && !pushGranted ? (
        <SettingsSection>
          <SettingsRow
            icon="P"
            iconBg="rgba(0,180,166,0.15)"
            label="Enable push notifications"
            sublabel="Allow Wardle to send alerts to this device"
            right={
              <button
                type="button"
                onClick={() => {
                  const firstDisabled = preferences.find(
                    (item) => !item.preference.pushEnabled,
                  )
                  if (firstDisabled) {
                    void togglePush(firstDisabled.preference)
                  }
                }}
                style={{
                  border: '1px solid rgba(0,180,166,0.28)',
                  borderRadius: 10,
                  background: 'rgba(0,180,166,0.12)',
                  color: 'var(--wardle-color-teal)',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '7px 10px',
                  whiteSpace: 'nowrap',
                }}
              >
                Enable
              </button>
            }
            style={{ borderBottom: 'none' }}
          />
        </SettingsSection>
      ) : null}

      {!pushSupported && pushCapability ? (
        <SettingsSection>
          <SettingsRow
            icon="P"
            iconBg="rgba(26,60,94,0.55)"
            label={pushUnsupportedMessage}
            sublabel="In-app notifications can still be managed below"
            style={{ borderBottom: 'none' }}
          />
        </SettingsSection>
      ) : null}

      {statusMessage ? (
        <div
          style={{
            margin: '10px 16px 0',
            border: '1px solid rgba(244,162,97,0.22)',
            borderRadius: 12,
            background: 'rgba(244,162,97,0.08)',
            color: 'var(--wardle-color-amber)',
            fontSize: 12,
            fontWeight: 700,
            padding: '10px 12px',
          }}
        >
          {statusMessage}
        </div>
      ) : null}

      <SettingsSectionLabel>Categories</SettingsSectionLabel>
      <SettingsSection>
        {preferences.map(({ category, icon, iconBg, label, sublabel, preference }, index) => (
          <NotificationCategoryRow
            key={category}
            icon={icon}
            iconBg={iconBg}
            label={label}
            sublabel={sublabel}
            preference={preference}
            pushSupported={pushSupported}
            onToggleInApp={() =>
              updatePreference({
                category,
                inAppEnabled: !preference.inAppEnabled,
              })
            }
            onTogglePush={() => void togglePush(preference)}
            style={{
              borderBottom:
                index < preferences.length - 1
                  ? '1px solid rgba(255,255,255,0.04)'
                  : 'none',
            }}
          />
        ))}
      </SettingsSection>
    </SettingsShell>
  )
}

function NotificationCategoryRow({
  icon,
  iconBg,
  label,
  sublabel,
  preference,
  pushSupported,
  onToggleInApp,
  onTogglePush,
  style,
}: {
  icon: string
  iconBg: string
  label: string
  sublabel: string
  preference: NotificationPreference
  pushSupported: boolean
  onToggleInApp: () => void
  onTogglePush: () => void
  style?: CSSProperties
}) {
  return (
    <SettingsRow
      icon={icon}
      iconBg={iconBg}
      label={label}
      sublabel={sublabel}
      style={style}
      right={
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: 10,
          }}
        >
          <ToggleGroup
            label="In-app"
            on={preference.inAppEnabled}
            onToggle={onToggleInApp}
          />
          {pushSupported ? (
            <ToggleGroup
              label="Push"
              on={preference.pushEnabled}
              onToggle={onTogglePush}
            />
          ) : null}
        </div>
      }
    />
  )
}

function ToggleGroup({
  label,
  on,
  onToggle,
  disabled,
}: {
  label: string
  on: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          color: 'var(--wardle-color-gray)',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.6,
          marginBottom: 4,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <SettingsToggle on={on} onToggle={onToggle} disabled={disabled} />
    </div>
  )
}

function mergePreferencePatches(
  preferences: NotificationPreference[],
  patches: NotificationPreferenceUpdate[],
): NotificationPreference[] {
  const byCategory = new Map(
    preferences.map((preference) => [preference.category, preference]),
  )

  for (const patch of patches) {
    const current = byCategory.get(patch.category) ?? defaultPreference(patch.category)
    byCategory.set(patch.category, {
      ...current,
      ...patch,
      emailEnabled: false,
    })
  }

  return Array.from(byCategory.values())
}
