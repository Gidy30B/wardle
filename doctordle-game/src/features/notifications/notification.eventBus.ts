import type { NotificationCreatedPayload } from './notification.types'

type NotificationListener = (payload: NotificationCreatedPayload) => void

const listeners = new Set<NotificationListener>()

export function subscribeNotificationCreated(listener: NotificationListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitNotificationCreated(payload: NotificationCreatedPayload) {
  listeners.forEach((listener) => listener(payload))
}
