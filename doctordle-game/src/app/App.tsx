import { useAuth } from '@clerk/clerk-react'
import { AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import GamePage from '../pages/GamePage'
import LandingScreen from './components/LandingScreen'
import AuthLoadingScreen from './components/AuthLoadingScreen'
import AnimatedScreen from './components/AnimatedScreen'

type EntryScreen = 'loading' | 'signed-in' | 'signed-out'

export default function App() {
  const { isLoaded, isSignedIn } = useAuth()

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log({ isLoaded, isSignedIn })
    }
  }, [isLoaded, isSignedIn])

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
