import { useAuth } from '@clerk/clerk-react'
import { AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import GamePage from '../pages/GamePage'
import LandingScreen from './components/LandingScreen'
import AuthLoadingScreen from './components/AuthLoadingScreen'
import AnimatedScreen from './components/AnimatedScreen'
import { disconnectSocket, initSocket } from '../game/ws-client'

type EntryScreen = 'loading' | 'signed-in' | 'signed-out'

export default function App() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth()

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
    : isSignedIn === true
      ? 'signed-in'
      : 'signed-out'

  return (
    <AnimatePresence initial={false}>
      {screen === 'loading' ? (
        <AnimatedScreen screenKey="loading">
          <AuthLoadingScreen />
        </AnimatedScreen>
      ) : !isSignedIn ? (
        <AnimatedScreen screenKey="signed-out">
          <LandingScreen />
        </AnimatedScreen>
      ) : (
        <AnimatedScreen screenKey="signed-in">
          <GamePage />
        </AnimatedScreen>
      )}
    </AnimatePresence>
  )
}
