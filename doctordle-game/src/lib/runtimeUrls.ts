import { Capacitor } from '@capacitor/core'

const DEFAULT_DEV_SOCKET_URL = 'http://localhost:3000'

export function getApiBaseUrl() {
  const webApiUrl = import.meta.env.VITE_API_URL?.trim()
  const nativeApiUrl =
    import.meta.env.VITE_NATIVE_API_URL?.trim() ??
    import.meta.env.VITE_CAPACITOR_API_URL?.trim() ??
    ''

  if (Capacitor.isNativePlatform()) {
    if (nativeApiUrl) {
      return withoutTrailingSlash(nativeApiUrl)
    }

    if (webApiUrl && /^https?:\/\//i.test(webApiUrl)) {
      return withoutTrailingSlash(webApiUrl)
    }

    throw new Error('Missing VITE_NATIVE_API_URL for Capacitor native build')
  }

  if (!webApiUrl) {
    throw new Error('Missing VITE_API_URL')
  }

  return withoutTrailingSlash(webApiUrl)
}

export function getSocketServerUrl() {
  const webSocketUrl = import.meta.env.VITE_WS_URL?.trim()
  const nativeSocketUrl = import.meta.env.VITE_NATIVE_WS_URL?.trim()

  if (Capacitor.isNativePlatform()) {
    if (nativeSocketUrl) {
      return withoutTrailingSlash(nativeSocketUrl)
    }

    const nativeApiUrl =
      import.meta.env.VITE_NATIVE_API_URL?.trim() ??
      import.meta.env.VITE_CAPACITOR_API_URL?.trim() ??
      ''

    return apiUrlToOrigin(nativeApiUrl)
  }

  if (webSocketUrl) {
    return withoutTrailingSlash(webSocketUrl)
  }

  return import.meta.env.DEV ? DEFAULT_DEV_SOCKET_URL : ''
}

function apiUrlToOrigin(apiUrl: string) {
  if (!apiUrl || !/^https?:\/\//i.test(apiUrl)) {
    return ''
  }

  return withoutTrailingSlash(apiUrl.replace(/\/api\/?$/i, ''))
}

function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}
