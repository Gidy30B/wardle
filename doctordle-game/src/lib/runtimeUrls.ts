import { Capacitor } from '@capacitor/core'

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
    return '/api'
  }

  return normalizeWebApiBaseUrl(webApiUrl)
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

  return ''
}

function normalizeWebApiBaseUrl(apiUrl: string) {
  if (apiUrl.startsWith('/')) {
    return withoutTrailingSlash(apiUrl)
  }

  if (typeof window !== 'undefined' && /^https?:\/\//i.test(apiUrl)) {
    try {
      const parsed = new URL(apiUrl)
      if (parsed.origin === window.location.origin) {
        return withoutTrailingSlash(parsed.pathname || '/api')
      }
    } catch {
      return withoutTrailingSlash(apiUrl)
    }
  }

  return withoutTrailingSlash(apiUrl)
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
