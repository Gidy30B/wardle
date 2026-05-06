export const CLERK_OAUTH_CALLBACK_PATH = '/sso-callback'
export const NATIVE_AUTH_CUSTOM_SCHEME = 'app.wardle.medcase'
export const NATIVE_AUTH_CALLBACK_HOST = 'sso-callback'
export const NATIVE_AUTH_COMPLETE_HOST = 'oauth-complete'
export const ROOT_PATH = '/'

type ClerkOAuthRedirects = {
  redirectUrl: string
  redirectUrlComplete: string
  kind: 'same-origin'
}

export function getClerkOAuthRedirects(): ClerkOAuthRedirects {
  return {
    redirectUrl: buildSameOriginUrl(CLERK_OAUTH_CALLBACK_PATH),
    redirectUrlComplete: buildSameOriginUrl(ROOT_PATH),
    kind: 'same-origin',
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

  if (hasCapacitorNativeBridge()) {
    return false
  }

  return isLikelyMobileBrowser()
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

function withSearchAndHash(path: string, url: URL) {
  return `${path}${url.search}${url.hash}`
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function getWindowOrigin() {
  return typeof window === 'undefined' ? 'https://wardle-nu.vercel.app' : window.location.origin
}

function isCustomSchemeCallback(url: URL) {
  return url.protocol === `${NATIVE_AUTH_CUSTOM_SCHEME}:` && url.host === NATIVE_AUTH_CALLBACK_HOST
}

function isCustomSchemeComplete(url: URL) {
  return url.protocol === `${NATIVE_AUTH_CUSTOM_SCHEME}:` && url.host === NATIVE_AUTH_COMPLETE_HOST
}

function hasCapacitorNativeBridge() {
  return Boolean(
    (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.(),
  )
}

function isLikelyMobileBrowser() {
  return /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent)
}
