import { Capacitor } from '@capacitor/core'

export const CLERK_OAUTH_CALLBACK_PATH = '/sso-callback'
export const NATIVE_AUTH_CUSTOM_SCHEME = 'app.wardle.medcase'
export const NATIVE_AUTH_CUSTOM_CALLBACK_URL = `${NATIVE_AUTH_CUSTOM_SCHEME}://sso-callback`

type ClerkOAuthRedirects = {
  redirectUrl: string
  redirectUrlComplete: string
}

const ROOT_PATH = '/'

export function getClerkOAuthRedirects(): ClerkOAuthRedirects {
  if (typeof window === 'undefined') {
    return {
      redirectUrl: CLERK_OAUTH_CALLBACK_PATH,
      redirectUrlComplete: ROOT_PATH,
    }
  }

  if (!Capacitor.isNativePlatform()) {
    return {
      redirectUrl: buildWebUrl(CLERK_OAUTH_CALLBACK_PATH),
      redirectUrlComplete: buildWebUrl(ROOT_PATH),
    }
  }

  return {
    redirectUrl: getNativeOAuthCallbackUrl(),
    // Keep the post-callback navigation inside the already-mounted WebView.
    // The native handoff only needs to happen for the Clerk callback itself.
    redirectUrlComplete: ROOT_PATH,
  }
}

export function mapNativeAuthUrlToInternalPath(appUrl: string): string | null {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(appUrl)
  } catch (_) {
    return null
  }

  if (isCustomSchemeCallback(parsedUrl)) {
    return withSearchAndHash(CLERK_OAUTH_CALLBACK_PATH, parsedUrl)
  }

  if (!isConfiguredNativeHttpsAppLink(parsedUrl)) {
    return null
  }

  const path =
    parsedUrl.pathname === ROOT_PATH && parsedUrl.searchParams.has('__clerk_handshake')
      ? CLERK_OAUTH_CALLBACK_PATH
      : normalizePath(parsedUrl.pathname)

  return withSearchAndHash(path, parsedUrl)
}

export function getNativeAuthAppLinkHost(): string | null {
  const origin = getConfiguredNativeHttpsOrigin()
  return origin ? new URL(origin).host : null
}

function getNativeOAuthCallbackUrl() {
  const explicitUrl = sanitizeUrl(getEnv('VITE_NATIVE_AUTH_REDIRECT_URL'))
  if (explicitUrl) {
    return explicitUrl
  }

  const nativeHttpsOrigin = getConfiguredNativeHttpsOrigin()
  if (nativeHttpsOrigin) {
    return new URL(CLERK_OAUTH_CALLBACK_PATH, nativeHttpsOrigin).toString()
  }

  const customUrl = sanitizeUrl(getEnv('VITE_NATIVE_AUTH_CUSTOM_CALLBACK_URL'))
  return customUrl ?? NATIVE_AUTH_CUSTOM_CALLBACK_URL
}

function getConfiguredNativeHttpsOrigin() {
  return sanitizeHttpsOrigin(
    getEnv('VITE_NATIVE_AUTH_APP_LINK_ORIGIN') ??
      getEnv('VITE_NATIVE_AUTH_REDIRECT_ORIGIN'),
  )
}

function isCustomSchemeCallback(url: URL) {
  return url.protocol === `${NATIVE_AUTH_CUSTOM_SCHEME}:` && url.host === 'sso-callback'
}

function isConfiguredNativeHttpsAppLink(url: URL) {
  if (url.protocol !== 'https:') {
    return false
  }

  const nativeHttpsOrigin = getConfiguredNativeHttpsOrigin()
  return nativeHttpsOrigin ? url.origin === nativeHttpsOrigin : false
}

function buildWebUrl(path: string) {
  return new URL(path, window.location.origin).toString()
}

function withSearchAndHash(path: string, url: URL) {
  return `${path}${url.search}${url.hash}`
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function sanitizeUrl(value: string | undefined) {
  if (!value) {
    return null
  }

  try {
    return new URL(value.trim()).toString()
  } catch (_) {
    return null
  }
}

function sanitizeHttpsOrigin(value: string | undefined) {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') {
      return null
    }

    return url.origin
  } catch (_) {
    return null
  }
}

function getEnv(key: string) {
  return (import.meta.env[key] as string | undefined)?.trim() || undefined
}
