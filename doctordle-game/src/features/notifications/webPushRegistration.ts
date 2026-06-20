import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { isIos, isStandalonePwa } from './pwaInstall'

const FIREBASE_MESSAGING_SW_PATH = '/firebase-messaging-sw.js'
const FIREBASE_MESSAGING_SW_SCOPE = '/'

export type WebPushUnsupportedReason =
  | 'config_missing'
  | 'browser_unsupported'
  | 'ios_requires_home_screen_pwa'
  | 'service_worker_unavailable'
  | 'firebase_unsupported'
  | 'permission_denied'
  | 'unsupported'

type WebPushCapability =
  | { supported: false; reason: WebPushUnsupportedReason }
  | { supported: true; permission: NotificationPermission; platform: 'web' }

export type WebPushProvider = 'firebase_fcm' | 'web_push_vapid'

export type WebPushDiagnostics = {
  isIosWeb: boolean
  isStandalonePwa: boolean
  isSecureContext: boolean
  hasNotification: boolean
  hasServiceWorker: boolean
  hasPushManager: boolean
  notificationPermission: NotificationPermission | 'unavailable'
  firebaseConfigPresent: boolean
  serviceWorkerPath: string
  expectedServiceWorkerScope: string
  activeServiceWorkerScope: string | null
  serviceWorkerReachable: boolean | null
  firebaseMessagingSupported: boolean | null
  recommendedProvider: WebPushProvider | null
  finalReason: WebPushUnsupportedReason | null
}

type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  messagingSenderId: string
  appId: string
  vapidKey?: string
}

export async function getWebPushCapability(): Promise<WebPushCapability> {
  const diagnostics = await getWebPushDiagnostics()
  devLog('support diagnostics', diagnostics)

  if (diagnostics.finalReason === 'ios_requires_home_screen_pwa') {
    const capability = {
      supported: false,
      reason: 'ios_requires_home_screen_pwa',
    } as const
    devLog('final capability', capability)
    return capability
  }

  if (diagnostics.finalReason === 'browser_unsupported') {
    const capability = {
      supported: false,
      reason: 'browser_unsupported',
    } as const
    devLog('final capability', capability)
    return capability
  }

  if (diagnostics.finalReason === 'config_missing') {
    const capability = {
      supported: false,
      reason: 'config_missing',
    } as const
    devLog('final capability', capability)
    return capability
  }

  if (diagnostics.finalReason === 'service_worker_unavailable') {
    const capability = {
      supported: false,
      reason: 'service_worker_unavailable',
    } as const
    devLog('final capability', capability)
    return capability
  }

  if (diagnostics.finalReason === 'firebase_unsupported') {
    const capability = {
      supported: false,
      reason: 'firebase_unsupported',
    } as const
    devLog('final capability', capability)
    return capability
  }

  if (diagnostics.finalReason === 'permission_denied') {
    const capability = {
      supported: false,
      reason: 'permission_denied',
    } as const
    devLog('final capability', capability)
    return capability
  }

  const capability = {
    supported: true,
    permission: Notification.permission,
    platform: 'web',
  } as const
  devLog('final capability', capability)

  return capability
}

export async function registerWebPushToken(): Promise<string> {
  if (isIosWebBrowser() && !isStandaloneWebApp()) {
    throw new Error(
      'On iPhone, install Wardle to your Home Screen first, then open it from the Home Screen icon to enable notifications.',
    )
  }

  if (!canUseBrowserPush()) {
    throw new Error('Push notifications are not supported in this browser.')
  }

  const firebaseConfig = getFirebaseWebConfig()
  if (!firebaseConfig) {
    throw new Error('Browser push is not configured for this environment.')
  }

  const supported = await isSupported().catch(() => false)
  if (!supported) {
    if (isIosWebBrowser() && isStandaloneWebApp()) {
      throw new Error(
        'Wardle is installed, but Firebase Messaging did not initialize on this iOS web app. Browser push diagnostics can confirm whether a Web Push fallback is needed.',
      )
    }

    throw new Error('Push notifications are not supported in this browser.')
  }

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }

  if (permission !== 'granted') {
    throw new Error('Browser push permission was not granted.')
  }

  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    FIREBASE_MESSAGING_SW_PATH,
    { scope: FIREBASE_MESSAGING_SW_SCOPE },
  )
  devLog('service worker registration scope', serviceWorkerRegistration.scope)
  const app = getFirebaseApp(firebaseConfig)
  const messaging = getMessaging(app)
  const token = await getToken(messaging, {
    ...(firebaseConfig.vapidKey ? { vapidKey: firebaseConfig.vapidKey } : {}),
    serviceWorkerRegistration,
  })

  if (!token) {
    throw new Error('Firebase did not return a browser push token.')
  }

  return token
}

function canUseBrowserPush() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    hasNotificationApi() &&
    hasServiceWorkerApi() &&
    hasPushManagerApi()
  )
}

function hasNotificationApi() {
  return typeof window !== 'undefined' && 'Notification' in window
}

function hasServiceWorkerApi() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

function hasPushManagerApi() {
  return typeof window !== 'undefined' && 'PushManager' in window
}

export function isIosWebBrowser() {
  return isIos()
}

export function isStandaloneWebApp() {
  return isStandalonePwa()
}

export async function getWebPushDiagnostics(): Promise<WebPushDiagnostics> {
  const isIosWeb = isIosWebBrowser()
  const isStandalonePwa = isStandaloneWebApp()
  const isSecureContext =
    typeof window !== 'undefined' && window.isSecureContext
  const hasNotification = hasNotificationApi()
  const hasServiceWorker = hasServiceWorkerApi()
  const hasPushManager = hasPushManagerApi()
  const notificationPermission: WebPushDiagnostics['notificationPermission'] =
    hasNotification ? Notification.permission : 'unavailable'
  const firebaseConfigPresent = Boolean(getFirebaseWebConfig())
  const expectedServiceWorkerScope =
    typeof window !== 'undefined'
      ? new URL(FIREBASE_MESSAGING_SW_SCOPE, window.location.origin).href
      : FIREBASE_MESSAGING_SW_SCOPE
  const activeServiceWorkerScope = await getActiveServiceWorkerScope()
  let serviceWorkerReachable: boolean | null = null
  let firebaseMessagingSupported: boolean | null = null
  let recommendedProvider: WebPushProvider | null = null
  let finalReason: WebPushUnsupportedReason | null = null

  if (isIosWeb && !isStandalonePwa) {
    finalReason = 'ios_requires_home_screen_pwa'
  } else if (
    !isSecureContext ||
    !hasNotification ||
    !hasServiceWorker ||
    !hasPushManager
  ) {
    finalReason = 'browser_unsupported'
  } else if (!firebaseConfigPresent) {
    finalReason = 'config_missing'
  } else {
    serviceWorkerReachable = await isServiceWorkerReachable()

    if (!serviceWorkerReachable) {
      finalReason = 'service_worker_unavailable'
    } else {
      firebaseMessagingSupported = await isSupported().catch(() => false)

      if (firebaseMessagingSupported) {
        recommendedProvider = 'firebase_fcm'
      } else if (isIosWeb && isStandalonePwa) {
        recommendedProvider = 'web_push_vapid'
      }

      if (!firebaseMessagingSupported) {
        finalReason = 'firebase_unsupported'
      } else if (notificationPermission === 'denied') {
        finalReason = 'permission_denied'
      }
    }
  }

  const diagnostics: WebPushDiagnostics = {
    isIosWeb,
    isStandalonePwa,
    isSecureContext,
    hasNotification,
    hasServiceWorker,
    hasPushManager,
    notificationPermission,
    firebaseConfigPresent,
    serviceWorkerPath: FIREBASE_MESSAGING_SW_PATH,
    expectedServiceWorkerScope,
    activeServiceWorkerScope,
    serviceWorkerReachable,
    firebaseMessagingSupported,
    recommendedProvider,
    finalReason,
  }

  devLog('diagnostics result', diagnostics)
  return diagnostics
}

async function getActiveServiceWorkerScope() {
  if (!hasServiceWorkerApi()) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(
      FIREBASE_MESSAGING_SW_PATH,
    )
    return registration?.scope ?? null
  } catch (_) {
    return null
  }
}

async function isServiceWorkerReachable() {
  try {
    const headResponse = await fetch(FIREBASE_MESSAGING_SW_PATH, {
      cache: 'no-store',
      method: 'HEAD',
    })
    if (headResponse.ok) {
      return true
    }

    const getResponse = await fetch(FIREBASE_MESSAGING_SW_PATH, {
      cache: 'no-store',
    })
    return getResponse.ok
  } catch (_) {
    return false
  }
}

function devLog(message: string, value?: unknown) {
  if (!import.meta.env.DEV) {
    return
  }

  if (arguments.length === 1) {
    console.log(`[web-push] ${message}`)
    return
  }

  console.log(`[web-push] ${message}`, value)
}

function getFirebaseApp(config: FirebaseWebConfig) {
  return (
    getApps()[0] ??
    initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    })
  )
}

function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '',
    messagingSenderId:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? '',
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim() ?? '',
  }

  const { vapidKey, ...requiredConfig } = config

  return Object.values(requiredConfig).every(Boolean)
    ? {
        ...requiredConfig,
        ...(vapidKey ? { vapidKey } : {}),
      }
    : null
}
