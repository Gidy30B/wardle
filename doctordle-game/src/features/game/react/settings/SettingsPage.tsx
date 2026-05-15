import { useAuth, useUser } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useApi } from '../../../../lib/api'
import {
  getBackendProfileApi,
  getUserSettingsApi,
  updateUserSettingsApi,
} from '../../../profile/profile.api'
import type { UserSettings } from '../../../profile/profile.types'
import { DEFAULT_USER_SETTINGS } from './settings.constants'
import type { SettingsPageProps, SettingsScreenId } from './settings.types'
import {
  getDisplayName,
  getFallbackDisplayName,
  getMembershipLabel,
} from './settings.utils'
import { AccountSettingsScreen } from './screens/AccountSettingsScreen'
import { AppearanceSettingsScreen } from './screens/AppearanceSettingsScreen'
import { GameplaySettingsScreen } from './screens/GameplaySettingsScreen'
import { LegalSettingsScreen } from './screens/LegalSettingsScreen'
import { NotificationSettingsScreen } from './screens/NotificationSettingsScreen'
import { SettingsHomeScreen } from './screens/SettingsHomeScreen'
import { StatsSettingsScreen } from './screens/StatsSettingsScreen'

export default function SettingsPage({
  currentStreak,
  xpTotal,
  organizationName,
  memberships,
}: SettingsPageProps) {
  const { isLoaded, isSignedIn, signOut } = useAuth()
  const { user } = useUser()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const [subScreen, setSubScreen] = useState<SettingsScreenId | null>(null)

  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => getBackendProfileApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  const settingsQuery = useQuery({
    queryKey: ['settings', 'me'],
    queryFn: async () => getUserSettingsApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  const settingsMutation = useMutation({
    mutationFn: async (payload: Partial<UserSettings>) =>
      updateUserSettingsApi(request, payload),
    onSuccess: (settings) => {
      queryClient.setQueryData(['settings', 'me'], settings)
    },
  })

  const backendProfile = profileQuery.data
  const settings = settingsQuery.data ?? DEFAULT_USER_SETTINGS
  const fallbackDisplayName = getFallbackDisplayName({
    fullName: user?.fullName,
    username: user?.username,
    email: user?.primaryEmailAddress?.emailAddress,
  })
  const displayName = getDisplayName(backendProfile, fallbackDisplayName)
  const trainingLevel = backendProfile?.trainingLevel?.trim() || null
  const organizationLabel = organizationName ?? getMembershipLabel(memberships)

  const goHome = () => setSubScreen(null)

  switch (subScreen) {
    case 'gameplay':
      return (
        <GameplaySettingsScreen
          onBack={goHome}
          settings={settings}
          saving={settingsMutation.isPending}
          onUpdate={(payload) => settingsMutation.mutate(payload)}
        />
      )
    case 'notifications':
      return <NotificationSettingsScreen onBack={goHome} />
    case 'appearance':
      return <AppearanceSettingsScreen onBack={goHome} />
    case 'stats':
      return (
        <StatsSettingsScreen
          onBack={goHome}
          currentStreak={currentStreak}
          xpTotal={xpTotal}
        />
      )
    case 'account':
      return (
        <AccountSettingsScreen
          onBack={goHome}
          onSignOut={() => void signOut()}
          organizationName={organizationName}
        />
      )
    case 'legal':
      return <LegalSettingsScreen onBack={goHome} />
    default:
      return (
        <SettingsHomeScreen
          displayName={displayName}
          organizationLabel={organizationLabel}
          trainingLevel={trainingLevel}
          currentStreak={currentStreak}
          onSelectScreen={setSubScreen}
        />
      )
  }
}

