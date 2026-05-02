import { useEffect, useState } from 'react'
import { useNotifications } from './useNotifications'
import type { WardleNotification } from './notification.types'

function formatNotificationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function categoryLabel(notification: WardleNotification) {
  if (notification.type === 'reward.xp_awarded') {
    return 'Reward'
  }

  if (notification.type === 'learning.explanation_ready') {
    return 'Learning'
  }

  return notification.category.toLowerCase()
}

type NotificationBellProps = {
  compact?: boolean
}

export default function NotificationBell({ compact = false }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    toast,
    dismissToast,
  } = useNotifications()

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeout = window.setTimeout(dismissToast, 4200)
    return () => window.clearTimeout(timeout)
  }, [dismissToast, toast])

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        onClick={() => setOpen((value) => !value)}
        className={`relative grid place-items-center border border-white/10 bg-[rgba(26,60,94,0.38)] text-[var(--wardle-color-mint)] shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition hover:border-[rgba(0,180,166,0.35)] hover:bg-[rgba(0,180,166,0.12)] ${
          compact ? 'h-11 w-11 rounded-[16px]' : 'h-12 w-full rounded-[18px]'
        }`}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          🔔
        </span>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--wardle-color-red)] px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[22px] border border-white/10 bg-[rgba(30,30,44,0.98)] shadow-[0_26px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-black text-[var(--wardle-color-mint)]">
                Notifications
              </p>
              <p className="text-[11px] text-white/45">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
            <button
              type="button"
              disabled={unreadCount === 0}
              onClick={() => markAllRead()}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-[var(--wardle-color-teal)] transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Read all
            </button>
          </div>

          <div className="max-h-[26rem] overflow-y-auto p-2">
            {loading ? (
              <div className="px-3 py-8 text-center text-sm text-white/45">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-white/45">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notification) => {
                const unread = !notification.readAt

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => {
                      if (unread) {
                        markRead(notification.id)
                      }
                    }}
                    className={`mb-2 w-full rounded-[16px] border p-3 text-left transition last:mb-0 ${
                      unread
                        ? 'border-[rgba(0,180,166,0.24)] bg-[rgba(0,180,166,0.10)]'
                        : 'border-white/[0.06] bg-[rgba(26,60,94,0.22)] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[var(--wardle-color-mint)]">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-white/58">
                          {notification.body}
                        </p>
                      </div>
                      {unread ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--wardle-color-teal)]" />
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                        {categoryLabel(notification)}
                      </span>
                      <span className="font-brand-mono text-[10px] text-white/35">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed right-4 top-[calc(env(safe-area-inset-top)+4rem)] z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-[18px] border border-[rgba(0,180,166,0.28)] bg-[rgba(30,30,44,0.98)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-xl">
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={dismissToast}
            className="absolute right-3 top-3 text-sm text-white/45 hover:text-white/75"
          >
            x
          </button>
          <p className="pr-6 text-sm font-black text-[var(--wardle-color-mint)]">
            {toast.title}
          </p>
          <p className="mt-1 pr-6 text-xs leading-5 text-white/58">{toast.body}</p>
        </div>
      ) : null}
    </div>
  )
}
