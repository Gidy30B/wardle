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
  console.log('[push] native platform check', {
    capacitorPlatform: Capacitor.getPlatform(),
    nativePushPlatform: platform,
  })

  if (!platform) {
    console.warn('[push] native push unavailable on this platform')
    throw new Error('Push notifications are available in the mobile app.')
  }

  console.log('[push] checking permissions')
  let permissions = await PushNotifications.checkPermissions()
  console.log('[push] permission check result', permissions)

  if (permissions.receive !== 'granted') {
    console.log('[push] requesting permissions')
    permissions = await PushNotifications.requestPermissions()
    console.log('[push] permission request result', permissions)
  }

  if (permissions.receive !== 'granted') {
    console.warn('[push] permission not granted', permissions)
    throw new Error('Push notification permission was not granted.')
  }

  console.log('[push] registering native push token')
  const token = await registerNativePushToken()
  console.log('[push] native token received', describePushToken(token.value))

  const existingToken = getStoredPushToken()
  console.log('[push] stored token check', {
    hasStoredToken: Boolean(existingToken),
    sameToken: existingToken === token.value,
  })

  if (existingToken === token.value) {
    console.log('[push] token already registered locally; skipping POST')
    return token.value
  }

  const appInfo = await App.getInfo().catch(() => null)
  const payload = {
    token: token.value,
    platform,
    ...(appInfo?.version ? { appVersion: appInfo.version } : {}),
  }

  console.log('[push] posting token to backend', {
    ...payload,
    token: describePushToken(token.value),
  })

  try {
    await registerPushDeviceTokenApi(request, payload)
    console.log('[push] backend token registration succeeded')
  } catch (error) {
    console.error('[push] backend token registration failed', error)
    throw error
  }

  storePushToken(token.value)
  console.log('[push] token stored locally')
  return token.value
}

export async function cleanupRegisteredPushToken(request: RequestJson) {
  const token = getStoredPushToken()
  if (!token) {
    console.log('[push] cleanup skipped; no local token')
    return
  }

  try {
    console.log('[push] deleting token from backend', describePushToken(token))
    await deletePushDeviceTokenApi(request, token)
    console.log('[push] backend token delete succeeded')
  } catch (error) {
    console.error('[push] backend token delete failed', error)
    throw error
  } finally {
    clearStoredPushToken()
    console.log('[push] local token cleared')
  }
}

export function hasRegisteredPushToken() {
  return Boolean(getStoredPushToken())
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

    console.log('[push] adding registration listeners')
    void PushNotifications.addListener('registration', (token) => {
      console.log(
        '[push] registration listener fired',
        describePushToken(token.value),
      )
      settle(() => resolve(token))
    }).then((handle) => {
      registrationHandle = handle
      console.log('[push] registration listener attached')
    })

    void PushNotifications.addListener('registrationError', (error) => {
      console.error('[push] registrationError listener fired', error)
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
      console.log('[push] registrationError listener attached')
    })

    console.log('[push] calling PushNotifications.register()')
    void PushNotifications.register().catch((error: unknown) => {
      console.error('[push] PushNotifications.register() rejected', error)
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

function describePushToken(token: string) {
  return {
    length: token.length,
    prefix: token.slice(0, 12),
    suffix: token.slice(-8),
  }
}
