import { Capacitor } from '@capacitor/core'
import { useCallback, useEffect, useMemo, useState } from 'react'

type BeforeInstallPromptChoice = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

type BeforeInstallPromptEvent = Event & {
  platforms?: string[]
  userChoice: Promise<BeforeInstallPromptChoice>
  prompt: () => Promise<void>
}

export type PwaInstallState = {
  isNative: boolean
  isIos: boolean
  isSafari: boolean
  isStandalone: boolean
  canPrompt: boolean
  isAndroidChrome: boolean
}

export function isIos() {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent
  const platform = navigator.platform
  const maxTouchPoints = navigator.maxTouchPoints ?? 0

  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  )
}

export function isSafari() {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent
  return (
    /Safari/i.test(userAgent) &&
    !/Chrome|CriOS|FxiOS|Edg|OPR|Android/i.test(userAgent)
  )
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean
  }

  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigatorWithStandalone.standalone === true
  )
}

export function canPromptInstall(event?: BeforeInstallPromptEvent | null) {
  return Boolean(event)
}

export function getPwaInstallState(
  installPromptEvent?: BeforeInstallPromptEvent | null,
): PwaInstallState {
  const userAgent =
    typeof navigator === 'undefined' ? '' : navigator.userAgent
  const isAndroidChrome =
    /Android/i.test(userAgent) && /Chrome/i.test(userAgent) && !/Edg|OPR/i.test(userAgent)

  return {
    isNative: Capacitor.isNativePlatform(),
    isIos: isIos(),
    isSafari: isSafari(),
    isStandalone: isStandalonePwa(),
    canPrompt: canPromptInstall(installPromptEvent),
    isAndroidChrome,
  }
}

export function usePwaInstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalonePwa)

  useEffect(() => {
    if (Capacitor.isNativePlatform() || typeof window === 'undefined') {
      return
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPromptEvent(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstalled(true)
      setInstallPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia?.('(display-mode: standalone)')
    if (!mediaQuery) return

    const handleChange = () => setInstalled(isStandalonePwa())
    mediaQuery.addEventListener?.('change', handleChange)

    return () => {
      mediaQuery.removeEventListener?.('change', handleChange)
    }
  }, [])

  const state = useMemo(() => {
    const nextState = getPwaInstallState(installPromptEvent)
    return {
      ...nextState,
      isStandalone: installed || nextState.isStandalone,
    }
  }, [installPromptEvent, installed])

  const promptInstall = useCallback(async () => {
    if (!installPromptEvent) return null

    await installPromptEvent.prompt()
    const choice = await installPromptEvent.userChoice
    setInstallPromptEvent(null)

    if (choice.outcome === 'accepted') {
      setInstalled(true)
    }

    return choice
  }, [installPromptEvent])

  return {
    ...state,
    promptInstall,
  }
}
