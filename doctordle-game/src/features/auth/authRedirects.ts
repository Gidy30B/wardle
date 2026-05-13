export const CLERK_OAUTH_CALLBACK_PATH = '/sso-callback'
export const NATIVE_AUTH_CUSTOM_SCHEME = 'app.wardle.medcase'
export const NATIVE_AUTH_CALLBACK_HOST = 'sso-callback'
export const NATIVE_AUTH_COMPLETE_HOST = 'oauth-complete'
export const ROOT_PATH = '/'
export const PRODUCTION_WEB_ORIGIN = 'https://wardle-nu.vercel.app'
const NATIVE_CALLBACK_MARKER = 'native'

type ClerkOAuthRedirects = {
  redirectUrl: string
  redirectUrlComplete: string
  kind: 'web' | 'native'
}

export function getClerkOAuthRedirects(): ClerkOAuthRedirects {
  if (isNativeRuntime()) {
    return {
      redirectUrl: buildNativeWebCallbackUrl(),
      redirectUrlComplete: PRODUCTION_WEB_ORIGIN,
      kind: 'native',
    }
  }

  return {
    redirectUrl: buildSameOriginUrl(CLERK_OAUTH_CALLBACK_PATH),
    redirectUrlComplete: buildSameOriginUrl(ROOT_PATH),
    kind: 'web',
  }
}

export function getClerkFallbackRedirectUrl() {
  return isNativeRuntime() ? ROOT_PATH : buildSameOriginUrl(ROOT_PATH)
}

export function isNativeRuntime() {
  return Boolean(
    typeof window !== 'undefined' &&
      (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
        ?.isNativePlatform?.(),
  )
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

  if (isCustomSchemeComplete(parsedUrl)) {
    return withSearchAndHash(ROOT_PATH, parsedUrl)
  }

  if (parsedUrl.origin !== getWindowOrigin()) {
    return null
  }

  return withSearchAndHash(normalizePath(parsedUrl.pathname), parsedUrl)
}

export function shouldBounceOAuthCallbackToNativeApp() {
  if (typeof window === 'undefined') {
    return false
  }

  if (!isClerkOAuthCallbackPath(window.location.pathname)) {
    return false
  }

  if (isNativeRuntime()) {
    return false
  }

  return new URLSearchParams(window.location.search).get(NATIVE_CALLBACK_MARKER) === '1'
}

export function getNativeOAuthCallbackUrl() {
  if (typeof window === 'undefined') {
    return `${NATIVE_AUTH_CUSTOM_SCHEME}://${NATIVE_AUTH_CALLBACK_HOST}`
  }

  return `${NATIVE_AUTH_CUSTOM_SCHEME}://${NATIVE_AUTH_CALLBACK_HOST}${window.location.search}${window.location.hash}`
}

export function isClerkOAuthCallbackPath(pathname: string) {
  return normalizePath(pathname) === CLERK_OAUTH_CALLBACK_PATH
}

function buildSameOriginUrl(path: string) {
  return new URL(path, getWindowOrigin()).toString()
}

function buildNativeWebCallbackUrl() {
  const url = new URL(CLERK_OAUTH_CALLBACK_PATH, PRODUCTION_WEB_ORIGIN)
  url.searchParams.set(NATIVE_CALLBACK_MARKER, '1')
  return url.toString()
}

function withSearchAndHash(path: string, url: URL) {
  return `${path}${url.search}${url.hash}`
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function getWindowOrigin() {
  return typeof window === 'undefined' ? PRODUCTION_WEB_ORIGIN : window.location.origin
}

function isCustomSchemeCallback(url: URL) {
  return url.protocol === `${NATIVE_AUTH_CUSTOM_SCHEME}:` && url.host === NATIVE_AUTH_CALLBACK_HOST
}

function isCustomSchemeComplete(url: URL) {
  return url.protocol === `${NATIVE_AUTH_CUSTOM_SCHEME}:` && url.host === NATIVE_AUTH_COMPLETE_HOST
}
