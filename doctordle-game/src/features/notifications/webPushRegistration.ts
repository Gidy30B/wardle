import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { isIos, isStandalonePwa } from './pwaInstall'

const FIREBASE_MESSAGING_SW_PATH = '/firebase-messaging-sw.js'

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

type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  messagingSenderId: string
  appId: string
  vapidKey?: string
}

export async function getWebPushCapability(): Promise<WebPushCapability> {
  const isIosWeb = isIosWebBrowser()
  const isStandalonePwa = isStandaloneWebApp()
  devLog('support check started')
  devLog('isIosWeb', isIosWeb)
  devLog('isStandalonePwa', isStandalonePwa)
  devLog('has Notification', hasNotificationApi())
  devLog('has serviceWorker', hasServiceWorkerApi())
  devLog('has PushManager', hasPushManagerApi())

  if (isIosWeb && !isStandalonePwa) {
    const capability = {
      supported: false,
      reason: 'ios_requires_home_screen_pwa',
    } as const
    devLog('final capability', capability)
    return capability
  }

  if (!canUseBrowserPush()) {
    const capability = {
      supported: false,
      reason: 'browser_unsupported',
    } as const
    devLog('final capability', capability)
    return capability
  }

  const firebaseConfig = getFirebaseWebConfig()
  devLog('firebase config present', Boolean(firebaseConfig))
  if (!firebaseConfig) {
    const capability = {
      supported: false,
      reason: 'config_missing',
    } as const
    devLog('final capability', capability)
    return capability
  }

  const serviceWorkerReachable = await isServiceWorkerReachable()
  devLog('service worker reachable', serviceWorkerReachable)
  if (!serviceWorkerReachable) {
    const capability = {
      supported: false,
      reason: 'service_worker_unavailable',
    } as const
    devLog('final capability', capability)
    return capability
  }

  const supported = await isSupported().catch(() => false)
  devLog('firebase messaging isSupported result', supported)

  if (!supported) {
    const capability = {
      supported: false,
      reason: 'firebase_unsupported',
    } as const
    devLog('final capability', capability)
    return capability
  }

  if (Notification.permission === 'denied') {
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
  )
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
