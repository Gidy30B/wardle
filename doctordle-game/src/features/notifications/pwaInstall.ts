import { Capacitor } from '@capacitor/core'
import { useCallback, useEffect, useMemo, useState } from 'react'

const PWA_SERVICE_WORKER_PATH = '/firebase-messaging-sw.js'
const PWA_SERVICE_WORKER_SCOPE = '/'

export type PwaInstallState = {
  isNative: boolean
  isIos: boolean
  isSafari: boolean
  isStandalone: boolean
  canPrompt: boolean
  canPromptInstall: boolean
  shouldShowInstallButton: boolean
  isAndroidChrome: boolean
}

let installed = false
let listenersMounted = false
const subscribers = new Set<() => void>()

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

export function canPromptInstall() {
  return false
}

export function getPwaInstallState(): PwaInstallState {
  const userAgent =
    typeof navigator === 'undefined' ? '' : navigator.userAgent
  const isAndroidChrome =
    /Android/i.test(userAgent) &&
    /Chrome/i.test(userAgent) &&
    !/Edg|OPR/i.test(userAgent)
  const isNative = Capacitor.isNativePlatform()
  const standalone = installed || isStandalonePwa()
  const promptAvailable = canPromptInstall()

  return {
    isNative,
    isIos: isIos(),
    isSafari: isSafari(),
    isStandalone: standalone,
    canPrompt: promptAvailable,
    canPromptInstall: promptAvailable,
    shouldShowInstallButton: false,
    isAndroidChrome,
  }
}

export function initPwaInstallPrompt() {
  if (
    listenersMounted ||
    Capacitor.isNativePlatform() ||
    typeof window === 'undefined'
  ) {
    return
  }

  listenersMounted = true
  installed = isStandalonePwa()

  const handleBeforeInstallPrompt = () => {
    console.log(
      '[pwa-install] beforeinstallprompt fired; allowing browser native prompt',
    )
    notifyPwaInstallSubscribers()
  }

  const handleAppInstalled = () => {
    installed = true
    notifyPwaInstallSubscribers()
  }

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)

  const mediaQuery = window.matchMedia?.('(display-mode: standalone)')
  mediaQuery?.addEventListener?.('change', () => {
    installed = isStandalonePwa()
    notifyPwaInstallSubscribers()
  })

  void registerPwaServiceWorker()
}

export async function promptPwaInstall() {
  return null
}

export function usePwaInstallPrompt() {
  const [snapshot, setSnapshot] = useState(getPwaInstallState)

  useEffect(() => {
    initPwaInstallPrompt()
    const handleChange = () => setSnapshot(getPwaInstallState())
    subscribers.add(handleChange)
    handleChange()
    return () => {
      subscribers.delete(handleChange)
    }
  }, [])

  const state = useMemo(() => snapshot, [snapshot])

  const promptInstall = useCallback(async () => {
    return promptPwaInstall()
  }, [])

  return {
    ...state,
    promptInstall,
  }
}

async function registerPwaServiceWorker() {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !window.isSecureContext
  ) {
    return
  }

  try {
    await navigator.serviceWorker.register(
      PWA_SERVICE_WORKER_PATH,
      { scope: PWA_SERVICE_WORKER_SCOPE },
    )
  } catch (error) {
    console.warn('[pwa-install] service worker registration failed', error)
  }
}

function notifyPwaInstallSubscribers() {
  subscribers.forEach((listener) => listener())
}
