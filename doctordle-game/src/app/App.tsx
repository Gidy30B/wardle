import { AuthenticateWithRedirectCallback, useAuth } from '@clerk/clerk-react'
import { AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import GamePage from '../pages/GamePage'
import LandingScreen from './components/LandingScreen'
import WardleLoadingScreen from './components/WardleLoadingScreen'
import AnimatedScreen from './components/AnimatedScreen'
import { disconnectSocket, initSocket } from '../game/ws-client'
import ProfileOnboardingScreen from '../features/profile/ProfileOnboardingScreen'
import { useProfileOnboarding } from '../features/profile/useProfileOnboarding'

type EntryScreen = 'loading' | 'profile-onboarding' | 'signed-in' | 'signed-out'

export default function App() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth()
  const profileOnboarding = useProfileOnboarding()
  const isOAuthCallback = window.location.pathname === '/sso-callback'

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log({ isLoaded, isSignedIn })
      console.log('[WS USER ID]', userId)
    }
  }, [isLoaded, isSignedIn, userId])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (!isSignedIn || !userId) {
      disconnectSocket()
      return
    }

    let active = true

    async function connectSocket() {
      const token = await getToken({
        template: import.meta.env.VITE_CLERK_JWT_AUDIENCE,
      })

      if (!active || !token) {
        if (active) {
          disconnectSocket()
        }
        return
      }

      initSocket(token)
    }

    void connectSocket()

    return () => {
      active = false
    }
  }, [getToken, isLoaded, isSignedIn, userId])

  const screen: EntryScreen = !isLoaded
    ? 'loading'
    : isSignedIn !== true
      ? 'signed-out'
      : profileOnboarding.loading
        ? 'loading'
        : profileOnboarding.shouldShowOnboarding
          ? 'profile-onboarding'
          : 'signed-in'

  return (
    <AnimatePresence initial={false}>
      {isOAuthCallback ? (
        <AnimatedScreen screenKey="oauth-callback">
          <WardleLoadingScreen />
          <AuthenticateWithRedirectCallback />
        </AnimatedScreen>
      ) : screen === 'loading' ? (
        <AnimatedScreen screenKey="loading">
          <WardleLoadingScreen />
        </AnimatedScreen>
      ) : screen === 'signed-out' ? (
        <AnimatedScreen screenKey="signed-out">
          <LandingScreen />
        </AnimatedScreen>
      ) : screen === 'profile-onboarding' ? (
        <AnimatedScreen screenKey="profile-onboarding">
          <ProfileOnboardingScreen
            suggestedDisplayName={profileOnboarding.suggestedDisplayName}
            onComplete={profileOnboarding.saveProfile}
            onSkip={profileOnboarding.skipProfile}
          />
        </AnimatedScreen>
      ) : (
        <AnimatedScreen screenKey="signed-in">
          <GamePage />
        </AnimatedScreen>
      )}
    </AnimatePresence>
  )
}
