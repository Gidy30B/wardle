import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'

const FIREBASE_MESSAGING_SW_PATH = '/firebase-messaging-sw.js'

type WebPushCapability =
  | { supported: false; reason: 'unsupported' }
  | { supported: true; permission: NotificationPermission; platform: 'web' }

type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  messagingSenderId: string
  appId: string
  vapidKey: string
}

export async function getWebPushCapability(): Promise<WebPushCapability> {
  if (!canUseBrowserPush()) {
    return { supported: false, reason: 'unsupported' }
  }

  const supported = await isSupported().catch(() => false)
  if (!supported || !getFirebaseWebConfig()) {
    return { supported: false, reason: 'unsupported' }
  }

  return {
    supported: true,
    permission: Notification.permission,
    platform: 'web',
  }
}

export async function registerWebPushToken(): Promise<string> {
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
    vapidKey: firebaseConfig.vapidKey,
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
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
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

  return Object.values(config).every(Boolean) ? config : null
}
