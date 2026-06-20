self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // The app handles navigation/data fetching itself; this makes the service
  // worker eligible to control pages without changing response behavior.
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
