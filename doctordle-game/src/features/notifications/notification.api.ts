import type { RequestJson } from '../../lib/api'
import type {
  NotificationPreferencesResponse,
  NotificationsResponse,
  UnreadCountResponse,
} from './notification.types'

export function getNotificationsApi(
  request: RequestJson,
  options: { limit?: number; unreadOnly?: boolean } = {},
) {
  const params = new URLSearchParams()
  if (options.limit) {
    params.set('limit', String(options.limit))
  }
  if (options.unreadOnly) {
    params.set('unreadOnly', 'true')
  }

  const suffix = params.toString() ? `?${params.toString()}` : ''
  return request<NotificationsResponse>(`/notifications${suffix}`)
}

export function getUnreadCountApi(request: RequestJson) {
  return request<UnreadCountResponse>('/notifications/unread-count')
}

export function markNotificationReadApi(request: RequestJson, id: string) {
  return request<{ notification: unknown }>(`/notifications/${id}/read`, {
    method: 'PATCH',
  })
}

export function markAllNotificationsReadApi(request: RequestJson) {
  return request<{ updatedCount: number }>('/notifications/read-all', {
    method: 'PATCH',
  })
}

export function getNotificationPreferencesApi(request: RequestJson) {
  return request<NotificationPreferencesResponse>('/notifications/preferences')
}

export function updateNotificationPreferencesApi(
  request: RequestJson,
  preferences: NotificationPreferencesResponse['preferences'],
) {
  return request<NotificationPreferencesResponse>('/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ preferences }),
  })
}
