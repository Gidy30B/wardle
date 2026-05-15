import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../../../../lib/api'
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

export function NotificationSettingsScreen({ onBack }: { onBack: () => void }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()

  const notificationSettingsQuery = useQuery({
    queryKey: NOTIFICATION_SETTINGS_QUERY_KEY,
    queryFn: async () => getUserNotificationSettingsApi(request),
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

  const notifications =
    notificationSettingsQuery.data ?? DEFAULT_USER_NOTIFICATION_SETTINGS

  const toggle = (key: keyof UpdateUserNotificationSettingsPayload) => {
    notificationSettingsMutation.mutate({ [key]: !notifications[key] })
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
          sublabel="Coming later"
          on={notifications.pushNotifications}
          onToggle={() => {}}
          disabled
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
