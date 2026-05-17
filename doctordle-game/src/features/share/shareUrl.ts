export const CANONICAL_PUBLIC_SHARE_BASE_URL = 'https://wardle-nu.vercel.app'

const CANONICAL_PUBLIC_SHARE_HOST = 'wardle-nu.vercel.app'
const PLACEHOLDER_HOSTS = new Set(['your-app.vercel.app', 'example.com'])
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
const PREVIEW_HOST_SUFFIXES = [
  '.vercel.app',
  '.netlify.app',
  '.pages.dev',
  '.railway.app',
  '.render.com',
]

export function getPublicShareBaseUrl() {
  const env = (import.meta as {
    env?: Record<string, string | boolean | undefined>
  }).env
  const isProduction = env?.PROD === true || env?.MODE === 'production'
  const envUrl = typeof env?.VITE_SHARE_URL === 'string' ? env.VITE_SHARE_URL.trim() : ''

  if (envUrl && isValidPublicShareBaseUrl(envUrl, { allowLocal: !isProduction })) {
    return normalizeShareBaseUrl(envUrl)
  }

  if (isProduction) {
    return CANONICAL_PUBLIC_SHARE_BASE_URL
  }

  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    isValidPublicShareBaseUrl(window.location.origin, { allowLocal: true })
  ) {
    return normalizeShareBaseUrl(window.location.origin)
  }

  return CANONICAL_PUBLIC_SHARE_BASE_URL
}

export function buildShareUrl(
  path = '/',
  params: Record<string, string | null | undefined> = {},
) {
  const url = new URL(path, getPublicShareBaseUrl())

  for (const [key, value] of Object.entries(params)) {
    if (value != null && value.trim().length > 0) {
      url.searchParams.set(key, value)
    }
  }

  return url.toString()
}

export function getPublicShareHostLabel() {
  return new URL(getPublicShareBaseUrl()).host
}

function isValidPublicShareBaseUrl(
  url: string,
  { allowLocal }: { allowLocal: boolean },
): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    if (parsed.protocol !== 'https:' && !(allowLocal && parsed.protocol === 'http:')) {
      return false
    }

    if (PLACEHOLDER_HOSTS.has(hostname)) {
      return false
    }

    if (hostname.includes('your-app') || hostname.includes('example')) {
      return false
    }

    if (!allowLocal && isLocalHost(hostname)) {
      return false
    }

    if (hostname === CANONICAL_PUBLIC_SHARE_HOST) {
      return true
    }

    if (!allowLocal && isPreviewHost(hostname)) {
      return false
    }

    return true
  } catch {
    return false
  }
}

function normalizeShareBaseUrl(url: string) {
  const parsed = new URL(url)
  parsed.pathname = '/'
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString().replace(/\/$/, '')
}

function isLocalHost(hostname: string) {
  return LOCAL_HOSTS.has(hostname.toLowerCase())
}

function isPreviewHost(hostname: string) {
  return PREVIEW_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
}
