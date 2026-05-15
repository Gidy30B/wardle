import type { RequestJson } from '../../lib/api'
import type {
  NotificationPreferencesResponse,
  NotificationPreferenceUpdate,
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
  preferences: NotificationPreferenceUpdate[],
) {
  return request<NotificationPreferencesResponse>('/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ preferences }),
  })
}

export function registerPushDeviceTokenApi(
  request: RequestJson,
  payload: {
    token: string
    platform: 'android' | 'ios' | 'web'
    deviceId?: string
    appVersion?: string
  },
) {
  return request<{ token: unknown }>('/notifications/push-tokens', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deletePushDeviceTokenApi(request: RequestJson, token: string) {
  return request<{ disabled: boolean }>(
    `/notifications/push-tokens/${encodeURIComponent(token)}`,
    {
      method: 'DELETE',
    },
  )
}
