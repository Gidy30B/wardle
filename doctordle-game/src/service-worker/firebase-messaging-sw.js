import {
  cleanupOutdatedCaches,
  matchPrecache,
  precache,
} from 'workbox-precaching'

const SHELL_URLS = ['/index.html', 'index.html']
const OFFLINE_URLS = ['/offline.html', 'offline.html']
const OLD_WARDLE_CACHE_PREFIXES = ['wardle-shell-', 'wardle-pwa-']

precache(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('activate', (event) => {
  event.waitUntil(
    cleanupOldWardleRuntimeCaches().then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (!isSameOrigin(url) || isApiRequest(url)) {
    return
  }

  if (isNavigationRequest(request) && !isWorkerRequest(url)) {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  event.respondWith(precacheFirst(request))
})

async function precacheFirst(request) {
  const precachedResponse = await matchPrecache(request)
  if (precachedResponse) {
    return precachedResponse
  }

  return fetch(request)
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  const notification = payload.notification ?? {}
  const data = payload.data ?? {}
  const title = notification.title ?? 'Wardle'
  const body = notification.body ?? ''

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data,
      icon: '/wardle-icon.png',
      badge: '/wardle-icon.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existingClient = clients.find((client) => 'focus' in client)
        if (existingClient) {
          return existingClient.focus()
        }

        return self.clients.openWindow('/')
      }),
  )
})

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)

    if (response.ok) {
      return response
    }
  } catch (_) {
    // Fall through to the precached shell or static offline fallback.
  }

  const cachedShell = await firstPrecacheMatch(SHELL_URLS)
  if (cachedShell) {
    return cachedShell
  }

  const offlineFallback = await firstPrecacheMatch(OFFLINE_URLS)
  if (offlineFallback) {
    return offlineFallback
  }

  return fetch(request)
}

async function firstPrecacheMatch(urls) {
  for (const url of urls) {
    const response = await matchPrecache(url)
    if (response) {
      return response
    }
  }

  return undefined
}

async function cleanupOldWardleRuntimeCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(
    cacheNames.map((cacheName) => {
      if (!isOldWardleRuntimeCache(cacheName)) {
        return undefined
      }

      return caches.delete(cacheName)
    }),
  )
}

function isSameOrigin(url) {
  return url.origin === self.location.origin
}

function isApiRequest(url) {
  return url.pathname === '/api' || url.pathname.startsWith('/api/')
}

function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' &&
      (request.headers.get('accept') ?? '').includes('text/html'))
  )
}

function isWorkerRequest(url) {
  return url.pathname === '/firebase-messaging-sw.js'
}

function isOldWardleRuntimeCache(cacheName) {
  return OLD_WARDLE_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix))
}
