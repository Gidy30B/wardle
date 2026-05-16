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
import {
  getWebPushCapability,
  registerWebPushToken,
} from './webPushRegistration'

const LEGACY_PUSH_TOKEN_STORAGE_KEY = 'wardle.pushToken'
const PUSH_TOKEN_STORAGE_KEY_PREFIX = 'wardle.pushToken'

type PushPlatform = 'android' | 'ios' | 'web'

export type PushCapability =
  | { supported: false; reason: 'unsupported' }
  | { supported: true; permission: string; platform: PushPlatform }

export function getNativePushPlatform(): 'android' | 'ios' | null {
  const platform = Capacitor.getPlatform()
  return platform === 'android' || platform === 'ios' ? platform : null
}

export async function getPushCapability(): Promise<PushCapability> {
  const platform = getNativePushPlatform()
  if (platform) {
    const permissions = await PushNotifications.checkPermissions()
    return {
      supported: true,
      permission: permissions.receive,
      platform,
    }
  }

  return getWebPushCapability()
}

export async function ensurePushDeviceRegistered(request: RequestJson) {
  const platform = getNativePushPlatform()
  console.log('[push] native platform check', {
    capacitorPlatform: Capacitor.getPlatform(),
    nativePushPlatform: platform,
  })

  if (!platform) {
    return ensureWebPushRegistered(request)
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

  const existingToken = getStoredPushToken(platform)
  console.log('[push] stored token check', {
    hasStoredToken: Boolean(existingToken),
    sameToken: existingToken === token.value,
  })

  if (existingToken === token.value) {
    console.log('[push] token already registered locally; skipping POST')
    return token.value
  }

  const appInfo = await App.getInfo().catch(() => null)
  const payload: {
    token: string
    platform: PushPlatform
    appVersion?: string
  } = {
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

  storePushToken(platform, token.value)
  console.log('[push] token stored locally')
  return token.value
}

export async function cleanupRegisteredPushToken(request: RequestJson) {
  const entries = getStoredPushTokenEntries()
  if (entries.length === 0) {
    console.log('[push] cleanup skipped; no local token')
    return
  }

  for (const { key, token, platform } of entries) {
    try {
      console.log('[push] deleting token from backend', {
        platform,
        token: describePushToken(token),
      })
      await deletePushDeviceTokenApi(request, token)
      console.log('[push] backend token delete succeeded', { platform })
    } catch (error) {
      console.error('[push] backend token delete failed', error)
      throw error
    } finally {
      clearStoredPushToken(key)
      console.log('[push] local token cleared', { platform })
    }
  }
}

export function hasRegisteredPushToken() {
  const platform = getCurrentPushPlatform()
  return Boolean(platform ? getStoredPushToken(platform) : null)
}

async function ensureWebPushRegistered(request: RequestJson) {
  console.log('[push] registering web push token')
  const token = await registerWebPushToken()
  console.log('[push] web token received', describePushToken(token))

  const existingToken = getStoredPushToken('web')
  console.log('[push] stored web token check', {
    hasStoredToken: Boolean(existingToken),
    sameToken: existingToken === token,
  })

  if (existingToken === token) {
    console.log('[push] web token already registered locally; skipping POST')
    return token
  }

  try {
    console.log('[push] posting web token to backend', {
      token: describePushToken(token),
      platform: 'web',
    })
    await registerPushDeviceTokenApi(request, {
      token,
      platform: 'web',
    })
    console.log('[push] backend web token registration succeeded')
  } catch (error) {
    console.error('[push] backend web token registration failed', error)
    throw error
  }

  storePushToken('web', token)
  console.log('[push] web token stored locally')
  return token
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

function getCurrentPushPlatform(): PushPlatform | null {
  return getNativePushPlatform() ?? 'web'
}

function getStoredPushToken(platform: PushPlatform) {
  return (
    localStorage.getItem(getPushTokenStorageKey(platform)) ??
    (platform === getNativePushPlatform()
      ? localStorage.getItem(LEGACY_PUSH_TOKEN_STORAGE_KEY)
      : null)
  )
}

function storePushToken(platform: PushPlatform, token: string) {
  localStorage.setItem(getPushTokenStorageKey(platform), token)
  if (platform === getNativePushPlatform()) {
    localStorage.removeItem(LEGACY_PUSH_TOKEN_STORAGE_KEY)
  }
}

function clearStoredPushToken(key: string) {
  localStorage.removeItem(key)
}

function getPushTokenStorageKey(platform: PushPlatform) {
  return `${PUSH_TOKEN_STORAGE_KEY_PREFIX}.${platform}`
}

function getStoredPushTokenEntries() {
  const platforms: PushPlatform[] = ['android', 'ios', 'web']
  const entries = platforms.flatMap((platform) => {
    const key = getPushTokenStorageKey(platform)
    const token = localStorage.getItem(key)
    return token ? [{ key, platform, token }] : []
  })
  const legacyToken = localStorage.getItem(LEGACY_PUSH_TOKEN_STORAGE_KEY)

  return legacyToken
    ? [
        ...entries,
        {
          key: LEGACY_PUSH_TOKEN_STORAGE_KEY,
          platform: 'android' as const,
          token: legacyToken,
        },
      ]
    : entries
}

function describePushToken(token: string) {
  return {
    length: token.length,
    prefix: token.slice(0, 12),
    suffix: token.slice(-8),
  }
}
