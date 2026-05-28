import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useApi } from '../../../../lib/api'
import {
  getBackendProfileApi,
} from '../../../profile/profile.api'
import { cleanupRegisteredPushToken } from '../../../notifications/pushRegistration'
import type { SettingsPageProps, SettingsScreenId } from './settings.types'
import {
  getUsername,
  getMembershipLabel,
} from './settings.utils'
import { AccountSettingsScreen } from './screens/AccountSettingsScreen'
import { LegalSettingsScreen } from './screens/LegalSettingsScreen'
import { NotificationSettingsScreen } from './screens/NotificationSettingsScreen'
import { SettingsHomeScreen } from './screens/SettingsHomeScreen'
import { StatsSettingsScreen } from './screens/StatsSettingsScreen'

export default function SettingsPage({
  currentStreak,
  bestStreak,
  xpTotal,
  organizationName,
  memberships,
  statsReport,
  statsLoading,
  statsError,
  onRetryStats,
}: SettingsPageProps) {
  const { isLoaded, isSignedIn, signOut, userId } = useAuth()
  const { request } = useApi()
  const [subScreen, setSubScreen] = useState<SettingsScreenId | null>(null)

  const profileQuery = useQuery({
    queryKey: ['profile', 'me', userId],
    queryFn: async () => getBackendProfileApi(request),
    enabled: isLoaded && isSignedIn && Boolean(userId),
    placeholderData: (previousData) => previousData,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  })

  const backendProfile = profileQuery.data
  const username = getUsername(backendProfile)
  const trainingLevel = backendProfile?.trainingLevel?.trim() || null
  const organizationLabel = organizationName ?? getMembershipLabel(memberships)

  const goHome = () => setSubScreen(null)
  const handleSignOut = async () => {
    await cleanupRegisteredPushToken(request).catch(() => undefined)
    await signOut()
  }

  switch (subScreen) {
    // TODO: Re-enable after production-ready appearance/gameplay/premium systems ship.
    // case 'gameplay':
    //   return (
    //     <GameplaySettingsScreen
    //       onBack={goHome}
    //       settings={settings}
    //       saving={settingsMutation.isPending}
    //       onUpdate={(payload) => settingsMutation.mutate(payload)}
    //     />
    //   )
    case 'notifications':
      return <NotificationSettingsScreen onBack={goHome} />
    // case 'appearance':
    //   return <AppearanceSettingsScreen onBack={goHome} />
    case 'stats':
      return (
        <StatsSettingsScreen
          onBack={goHome}
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          xpTotal={xpTotal}
          statsReport={statsReport}
          loading={statsLoading}
          error={statsError}
          onRetry={onRetryStats}
        />
      )
    case 'account':
      return (
        <AccountSettingsScreen
          onBack={goHome}
          onSignOut={() => void handleSignOut()}
          organizationName={organizationName}
        />
      )
    case 'legal':
      return <LegalSettingsScreen onBack={goHome} />
    default:
      return (
        <SettingsHomeScreen
          username={username}
          organizationLabel={organizationLabel}
          trainingLevel={trainingLevel}
          currentStreak={currentStreak}
          onSelectScreen={setSubScreen}
        />
      )
  }
}
