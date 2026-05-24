import { useAuth } from '@clerk/clerk-react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiRequestError, useApi } from '../../lib/api'
import {
  getNotificationsApi,
  getUnreadCountApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
} from './notification.api'
import { subscribeNotificationCreated } from './notification.eventBus'
import type {
  NotificationCreatedPayload,
  NotificationsResponse,
  UnreadCountResponse,
  WardleNotification,
} from './notification.types'

const notificationsKey = ['notifications'] as const
const unreadCountKey = ['notifications', 'unread-count'] as const

function payloadToNotification(
  payload: NotificationCreatedPayload,
): WardleNotification {
  return {
    id: payload.id,
    type: payload.type,
    category: payload.category,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    priority: payload.priority,
    createdAt: payload.createdAt,
    readAt: null,
    seenAt: null,
    expiresAt: null,
  }
}

export function useNotifications() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<NotificationCreatedPayload | null>(null)
  const queriesEnabled = isLoaded && isSignedIn === true && Boolean(userId)

  const notificationsQuery = useQuery({
    queryKey: [...notificationsKey, userId],
    queryFn: async () => {
      if (import.meta.env.DEV) console.debug('[notifications-query] list start')
      return getNotificationsApi(request, { limit: 40 })
    },
    enabled: queriesEnabled,
    staleTime: 120_000,
    gcTime: 10 * 60_000,
    retry: shouldRetryNotificationQuery,
  })

  const unreadCountQuery = useQuery({
    queryKey: [...unreadCountKey, userId],
    queryFn: async () => {
      if (import.meta.env.DEV) console.debug('[notifications-query] unread start')
      return getUnreadCountApi(request)
    },
    enabled: queriesEnabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: shouldRetryNotificationQuery,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationReadApi(request, id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<NotificationsResponse>(
        [...notificationsKey, userId],
        (current) => {
          if (!current) {
            return current
          }

          return {
            notifications: current.notifications.map((notification) =>
              notification.id === id
                ? { ...notification, readAt: new Date().toISOString() }
                : notification,
            ),
          }
        },
      )
      queryClient.invalidateQueries({ queryKey: [...unreadCountKey, userId] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsReadApi(request),
    onSuccess: () => {
      const now = new Date().toISOString()
      queryClient.setQueryData<NotificationsResponse>(
        [...notificationsKey, userId],
        (current) =>
          current
            ? {
                notifications: current.notifications.map((notification) => ({
                  ...notification,
                  readAt: notification.readAt ?? now,
                })),
              }
            : current,
      )
      queryClient.setQueryData<UnreadCountResponse>([...unreadCountKey, userId], {
        unreadCount: 0,
      })
    },
  })

  useEffect(() => {
    return subscribeNotificationCreated((payload) => {
      queryClient.setQueryData<NotificationsResponse>(
        [...notificationsKey, userId],
        (current) => {
          const notification = payloadToNotification(payload)

          if (!current) {
            return { notifications: [notification] }
          }

          if (current.notifications.some((item) => item.id === payload.id)) {
            return current
          }

          return {
            notifications: [notification, ...current.notifications].slice(0, 40),
          }
        },
      )
      queryClient.setQueryData<UnreadCountResponse>([...unreadCountKey, userId], {
        unreadCount: payload.unreadCount,
      })
      setToast(payload)
    })
  }, [queryClient, userId])

  const notifications = notificationsQuery.data?.notifications ?? []
  const unreadCount = unreadCountQuery.data?.unreadCount ?? 0

  return useMemo(
    () => ({
      notifications,
      unreadCount,
      loading: notificationsQuery.isLoading || unreadCountQuery.isLoading,
      error: notificationsQuery.error ?? unreadCountQuery.error ?? null,
      markRead: markReadMutation.mutate,
      markAllRead: markAllReadMutation.mutate,
      toast,
      dismissToast: () => setToast(null),
    }),
    [
      notifications,
      unreadCount,
      notificationsQuery.isLoading,
      unreadCountQuery.isLoading,
      notificationsQuery.error,
      unreadCountQuery.error,
      markReadMutation.mutate,
      markAllReadMutation.mutate,
      toast,
    ],
  )
}

function shouldRetryNotificationQuery(failureCount: number, error: Error) {
  if (error instanceof ApiRequestError && [401, 403, 404].includes(error.status)) {
    return false
  }

  return failureCount < 1
}
