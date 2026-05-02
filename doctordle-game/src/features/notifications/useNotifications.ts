import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
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
  const { request } = useApi()
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<NotificationCreatedPayload | null>(null)

  const notificationsQuery = useQuery({
    queryKey: notificationsKey,
    queryFn: () => getNotificationsApi(request, { limit: 40 }),
    staleTime: 30_000,
  })

  const unreadCountQuery = useQuery({
    queryKey: unreadCountKey,
    queryFn: () => getUnreadCountApi(request),
    staleTime: 15_000,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationReadApi(request, id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<NotificationsResponse>(
        notificationsKey,
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
      queryClient.invalidateQueries({ queryKey: unreadCountKey })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsReadApi(request),
    onSuccess: () => {
      const now = new Date().toISOString()
      queryClient.setQueryData<NotificationsResponse>(
        notificationsKey,
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
      queryClient.setQueryData<UnreadCountResponse>(unreadCountKey, {
        unreadCount: 0,
      })
    },
  })

  useEffect(() => {
    return subscribeNotificationCreated((payload) => {
      queryClient.setQueryData<NotificationsResponse>(
        notificationsKey,
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
      queryClient.setQueryData<UnreadCountResponse>(unreadCountKey, {
        unreadCount: payload.unreadCount,
      })
      setToast(payload)
    })
  }, [queryClient])

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
