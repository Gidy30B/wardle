import { AuthenticateWithRedirectCallback, useAuth } from '@clerk/clerk-react'
import { AnimatePresence } from 'framer-motion'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import GamePage from '../pages/GamePage'
import LandingScreen from './components/LandingScreen'
import WardleLoadingScreen from './components/WardleLoadingScreen'
import AnimatedScreen from './components/AnimatedScreen'
import { disconnectSocket, initSocket } from '../game/ws-client'
import ProfileOnboardingScreen from '../features/profile/ProfileOnboardingScreen'
import { useUserOnboarding } from '../features/profile/useUserOnboarding'
import {
  ROOT_PATH,
  getNativeOAuthCallbackUrl,
  isClerkOAuthCallbackPath,
  shouldBounceOAuthCallbackToNativeApp,
} from '../features/auth/authRedirects'
import { initPwaInstallPrompt } from '../features/notifications/pwaInstall'

type EntryScreen =
  | 'loading'
  | 'onboarding-error'
  | 'profile-onboarding'
  | 'signed-in'
  | 'signed-out'

export default function App() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth()
  const userOnboarding = useUserOnboarding()
  const isOAuthCallback = isClerkOAuthCallbackPath(window.location.pathname)
  const shouldBounceToNative = shouldBounceOAuthCallbackToNativeApp()

  useEffect(() => {
    initPwaInstallPrompt()
  }, [])

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
      disconnectSocket()
    }
  }, [getToken, isLoaded, isSignedIn, userId])

  useEffect(() => {
    if (!shouldBounceToNative) {
      return
    }

    window.location.replace(getNativeOAuthCallbackUrl())
  }, [shouldBounceToNative])

  const screen: EntryScreen = !isLoaded
    ? 'loading'
      : isSignedIn !== true
        ? 'signed-out'
      : userOnboarding.loading
        ? 'loading'
        : userOnboarding.hasError
          ? 'onboarding-error'
        : userOnboarding.shouldShowOnboarding
          ? 'profile-onboarding'
          : 'signed-in'

  return (
    <AnimatePresence initial={false}>
      {isOAuthCallback && shouldBounceToNative ? (
        <AnimatedScreen screenKey="oauth-native-bounce">
          <WardleLoadingScreen />
        </AnimatedScreen>
      ) : isOAuthCallback ? (
        <AnimatedScreen screenKey="oauth-callback">
          <WardleLoadingScreen />
          <AuthenticateWithRedirectCallback
            signInFallbackRedirectUrl={ROOT_PATH}
            signUpFallbackRedirectUrl={ROOT_PATH}
            signInForceRedirectUrl={ROOT_PATH}
            signUpForceRedirectUrl={ROOT_PATH}
            signInUrl={ROOT_PATH}
            signUpUrl={ROOT_PATH}
            continueSignUpUrl={ROOT_PATH}
            verifyEmailAddressUrl={ROOT_PATH}
          />
        </AnimatedScreen>
      ) : screen === 'loading' ? (
        <AnimatedScreen screenKey="loading">
          <WardleLoadingScreen />
        </AnimatedScreen>
      ) : screen === 'signed-out' ? (
        <AnimatedScreen screenKey="signed-out">
          <LandingScreen />
        </AnimatedScreen>
      ) : screen === 'onboarding-error' ? (
        <AnimatedScreen screenKey="onboarding-error">
          <OnboardingRecoveryScreen onRetry={() => void userOnboarding.refetch()} />
        </AnimatedScreen>
      ) : screen === 'profile-onboarding' ? (
        <AnimatedScreen screenKey="profile-onboarding">
          {userOnboarding.onboarding ? (
            <ProfileOnboardingScreen
              suggestedUsername={userOnboarding.suggestedUsername}
              onboardingStatus={userOnboarding.onboarding.onboardingStatus}
              onComplete={userOnboarding.saveProfile}
            />
          ) : (
            <OnboardingRecoveryScreen onRetry={() => void userOnboarding.refetch()} />
          )}
        </AnimatedScreen>
      ) : (
        <AnimatedScreen screenKey="signed-in">
          <GamePage />
        </AnimatedScreen>
      )}
    </AnimatePresence>
  )
}

function OnboardingRecoveryScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--wardle-color-charcoal)] px-5 py-[calc(env(safe-area-inset-top)+2rem)] text-white">
      <section className="w-full max-w-sm text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-[14px] border border-[rgba(224,92,92,0.34)] bg-[rgba(224,92,92,0.12)] text-[var(--wardle-color-red)]">
          <AlertTriangle aria-hidden="true" size={24} strokeWidth={2.4} />
        </div>
        <h1 className="mt-5 text-xl font-black text-[var(--wardle-color-mint)]">
          We could not load your profile
        </h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-white/58">
          Check your connection or sign in again, then retry before continuing.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[var(--wardle-color-teal)] px-5 text-sm font-black text-[var(--wardle-color-charcoal)] shadow-[0_16px_36px_rgba(0,180,166,0.24)] transition hover:bg-[var(--wardle-color-teal-light)] focus:outline-none focus:ring-2 focus:ring-[var(--wardle-color-teal-light)] focus:ring-offset-2 focus:ring-offset-[var(--wardle-color-charcoal)]"
        >
          <RefreshCw aria-hidden="true" size={18} strokeWidth={2.6} />
          Retry profile
        </button>
      </section>
    </main>
  )
}
