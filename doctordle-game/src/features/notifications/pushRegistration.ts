import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import {
  PushNotifications,
  type Token,
} from '@capacitor/push-notifications'
import type { RequestJson } from '../../lib/api'
import {
  deletePushDeviceTokenApi,
  registerPushDeviceTokenApi,
} from './notification.api'

const PUSH_TOKEN_STORAGE_KEY = 'wardle.pushToken'

export type PushCapability =
  | { supported: false; reason: 'web' | 'unsupported' }
  | { supported: true; permission: string }

export function getNativePushPlatform(): 'android' | 'ios' | null {
  const platform = Capacitor.getPlatform()
  return platform === 'android' || platform === 'ios' ? platform : null
}

export async function getPushCapability(): Promise<PushCapability> {
  const platform = getNativePushPlatform()
  if (!platform) {
    return {
      supported: false,
      reason: Capacitor.getPlatform() === 'web' ? 'web' : 'unsupported',
    }
  }

  const permissions = await PushNotifications.checkPermissions()
  return {
    supported: true,
    permission: permissions.receive,
  }
}

export async function ensurePushDeviceRegistered(request: RequestJson) {
  const platform = getNativePushPlatform()
  if (!platform) {
    throw new Error('Push notifications are available in the mobile app.')
  }

  let permissions = await PushNotifications.checkPermissions()
  if (permissions.receive !== 'granted') {
    permissions = await PushNotifications.requestPermissions()
  }

  if (permissions.receive !== 'granted') {
    throw new Error('Push notification permission was not granted.')
  }

  const token = await registerNativePushToken()
  const existingToken = getStoredPushToken()
  if (existingToken === token.value) {
    return token.value
  }

  const appInfo = await App.getInfo().catch(() => null)
  await registerPushDeviceTokenApi(request, {
    token: token.value,
    platform,
    ...(appInfo?.version ? { appVersion: appInfo.version } : {}),
  })
  storePushToken(token.value)
  return token.value
}

export async function cleanupRegisteredPushToken(request: RequestJson) {
  const token = getStoredPushToken()
  if (!token) {
    return
  }

  try {
    await deletePushDeviceTokenApi(request, token)
  } finally {
    clearStoredPushToken()
  }
}

function registerNativePushToken(): Promise<Token> {
  return new Promise((resolve, reject) => {
    let settled = false
    let registrationHandle: { remove: () => Promise<void> } | null = null
    let errorHandle: { remove: () => Promise<void> } | null = null

    const cleanup = () => {
      void registrationHandle?.remove()
      void errorHandle?.remove()
    }

    const settle = (callback: () => void) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      callback()
    }

    void PushNotifications.addListener('registration', (token) => {
      settle(() => resolve(token))
    }).then((handle) => {
      registrationHandle = handle
    })

    void PushNotifications.addListener('registrationError', (error) => {
      settle(() =>
        reject(
          new Error(
            typeof error.error === 'string'
              ? error.error
              : 'Push registration failed.',
          ),
        ),
      )
    }).then((handle) => {
      errorHandle = handle
    })

    void PushNotifications.register().catch((error: unknown) => {
      settle(() =>
        reject(error instanceof Error ? error : new Error(String(error))),
      )
    })
  })
}

function getStoredPushToken() {
  return localStorage.getItem(PUSH_TOKEN_STORAGE_KEY)
}

function storePushToken(token: string) {
  localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token)
}

function clearStoredPushToken() {
  localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY)
}
