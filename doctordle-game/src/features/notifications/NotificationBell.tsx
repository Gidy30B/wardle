import { useEffect, useRef, useState } from "react";
import {
  Bell, // TODO: add to icons.ts
  BellRing, // TODO: add to icons.ts
  CheckCheck, // TODO: add to icons.ts
  X, // TODO: add to icons.ts
} from "lucide-react";
import { APP_ICONS, type AppIconKey } from "../../theme/icons";
import { useNotifications } from "./useNotifications";
import type {
  NotificationCategory,
  NotificationPriority,
  WardleNotification,
} from "./notification.types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const CATEGORY_META: Record<
  NotificationCategory,
  { icon: AppIconKey; color: string; bg: string }
> = {
  GAMEPLAY: { icon: "play", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  REWARD: { icon: "rank", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  LEARNING: { icon: "learn", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  LEADERBOARD: { icon: "rank", color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  STREAK: { icon: "streak", color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  CONTENT: { icon: "clues", color: "#e2e8f0", bg: "rgba(226,232,240,0.08)" }, // Approximate: no document icon in icons.ts.
  SOCIAL: { icon: "settings", color: "#f472b6", bg: "rgba(244,114,182,0.12)" }, // Approximate: no social/users icon in icons.ts.
  BILLING: { icon: "settings", color: "#4ade80", bg: "rgba(74,222,128,0.12)" }, // Approximate: no billing/card icon in icons.ts.
  ADMIN: { icon: "settings", color: "#f87171", bg: "rgba(248,113,113,0.12)" }, // Approximate: no shield/admin icon in icons.ts.
  SYSTEM: { icon: "settings", color: "#94a3b8", bg: "rgba(148,163,184,0.08)" },
};

const NOTIFICATION_MODAL_HISTORY_KEY = "__wardleNotificationModal";

const PRIORITY_RING: Record<NotificationPriority, string> = {
  low: "transparent",
  normal: "transparent",
  high: "rgba(251,146,60,0.55)",
};

type NotificationGroup = {
  label: "TODAY" | "YESTERDAY" | "EARLIER";
  items: WardleNotification[];
};

function getNotificationDayGroup(value: string): NotificationGroup["label"] {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "EARLIER";

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return "TODAY";
  if (date >= startOfYesterday) return "YESTERDAY";
  return "EARLIER";
}

function groupNotifications(
  notifications: WardleNotification[],
): NotificationGroup[] {
  const groups: Record<NotificationGroup["label"], WardleNotification[]> = {
    TODAY: [],
    YESTERDAY: [],
    EARLIER: [],
  };

  notifications.forEach((notification) => {
    groups[getNotificationDayGroup(notification.createdAt)].push(notification);
  });

  return (["TODAY", "YESTERDAY", "EARLIER"] as const)
    .map((label) => ({ label, items: groups[label] }))
    .filter((group) => group.items.length > 0);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onRead,
}: {
  notification: WardleNotification;
  onRead: (id: string) => void;
}) {
  const unread = !notification.readAt;
  const meta = CATEGORY_META[notification.category] ?? CATEGORY_META.SYSTEM;
  const icon = APP_ICONS[meta.icon];

  return (
    <button
      type="button"
      onClick={() => unread && onRead(notification.id)}
      style={{
        background: unread ? "rgba(255,255,255,0.045)" : "transparent",
        borderColor: unread ? "rgba(255,255,255,0.09)" : "transparent",
        boxShadow:
          notification.priority === "high"
            ? `0 0 0 1px ${PRIORITY_RING.high}`
            : undefined,
      }}
      className="group relative w-full rounded-2xl border px-3.5 py-3 text-left transition-all duration-150 hover:bg-white/[0.05] hover:border-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
    >
      <div className="flex items-start gap-3">
        {/* Category icon pill */}
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: meta.bg }}
        >
          <span
            aria-hidden="true"
            style={{ color: meta.color, fontSize: 15, lineHeight: 1 }}
          >
            {icon}
          </span>
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className="text-[13px] font-semibold leading-snug"
              style={{ color: unread ? "#f1f5f9" : "#94a3b8" }}
            >
              {notification.title}
            </p>
            {unread && (
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#38bdf8]" />
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-white/40">
            {notification.body}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: meta.color, background: meta.bg }}
            >
              {notification.category.toLowerCase()}
            </span>
            <span className="text-[10px] text-white/25 tabular-nums">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-white/20">
        <Bell size={22} strokeWidth={1.5} />
      </span>
      <div className="text-center">
        <p className="text-sm font-semibold text-white/30">All clear</p>
        <p className="mt-0.5 text-[11px] text-white/20">No notifications yet</p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type NotificationBellProps = {
  compact?: boolean;
};

export default function NotificationBell({
  compact = false,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pushedModalHistoryRef = useRef(false);

  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    toast,
    dismissToast,
  } = useNotifications();

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(dismissToast, 4200);
    return () => window.clearTimeout(t);
  }, [dismissToast, toast]);

  // Close on browser back
  useEffect(() => {
    if (!open) return;

    if (!window.history.state?.[NOTIFICATION_MODAL_HISTORY_KEY]) {
      window.history.pushState(
        {
          ...(window.history.state && typeof window.history.state === "object"
            ? window.history.state
            : {}),
          [NOTIFICATION_MODAL_HISTORY_KEY]: true,
        },
        "",
        window.location.href,
      );
      pushedModalHistoryRef.current = true;
    }

    function handlePopState() {
      pushedModalHistoryRef.current = false;
      setOpen(false);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const hasUnread = unreadCount > 0;
  const notificationGroups = groupNotifications(notifications);

  function closeNotificationsModal() {
    if (pushedModalHistoryRef.current) {
      pushedModalHistoryRef.current = false;
      window.history.back();
    }

    setOpen(false);
  }

  return (
    <>
      {/* ── Bell button ── */}
      <div className="relative inline-block">
        <button
          ref={buttonRef}
          type="button"
          aria-label={`Notifications${hasUnread ? `, ${unreadCount} unread` : ""}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{
            background: open ? "rgba(56,189,248,0.10)" : "rgba(15,23,42,0.60)",
            borderColor: open
              ? "rgba(56,189,248,0.30)"
              : "rgba(255,255,255,0.08)",
          }}
          className={`relative flex items-center justify-center border backdrop-blur-sm transition-all duration-200 hover:border-[rgba(56,189,248,0.25)] hover:bg-[rgba(56,189,248,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(56,189,248,0.4)] ${
            compact ? "h-9 w-9 rounded-xl" : "h-10 w-10 rounded-[14px]"
          }`}
        >
          {hasUnread ? (
            <BellRing
              size={compact ? 17 : 18}
              strokeWidth={2}
              className="text-[#38bdf8]"
              style={{
                animation: hasUnread ? "bell-ring 0.6s ease" : undefined,
              }}
            />
          ) : (
            <Bell
              size={compact ? 17 : 18}
              strokeWidth={2}
              className="text-white/50"
            />
          )}

          {hasUnread && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f87171] px-1 text-[9px] font-black leading-none text-white shadow-[0_0_0_2px_rgba(15,23,42,0.8)]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* ── Notification modal ── */}
        {open && (
          <div
            ref={panelRef}
            className="fixed inset-0 z-[60] overflow-y-auto backdrop-blur-xl scrollbar-none"
            style={{
              background: "rgba(10,14,26,0.97)",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              animation: "slide-up 300ms cubic-bezier(0.32,0.72,0,1)",
            }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.06] px-4 py-3 backdrop-blur-xl">
              <button
                type="button"
                aria-label="Back"
                onClick={closeNotificationsModal}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/45 transition hover:border-white/[0.12] hover:bg-white/[0.07] hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                <X size={16} strokeWidth={2.5} />
              </button>

              <div className="min-w-0 text-center">
                <p className="text-[13px] font-bold text-white/90 tracking-tight">
                  Notifications
                </p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  {hasUnread ? `${unreadCount} unread` : "You're all caught up"}
                </p>
              </div>

              <button
                type="button"
                disabled={!hasUnread}
                onClick={() => markAllRead()}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-white/40 transition hover:border-white/[0.12] hover:bg-white/[0.07] hover:text-white/60 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <CheckCheck size={11} strokeWidth={2.5} />
                Mark all read
              </button>
            </div>

            {/* List */}
            <div className="mx-auto max-w-2xl p-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] space-y-0.5">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-[72px] animate-pulse rounded-2xl bg-white/[0.04]"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState />
              ) : (
                notificationGroups.map((group) => (
                  <section key={group.label} className="space-y-1.5">
                    <div className="sticky top-[65px] z-[5] -mx-1 bg-[rgba(10,14,26,0.94)] px-1 py-2 backdrop-blur-xl">
                      <p className="text-[10px] font-black uppercase tracking-wider text-white/25">
                        {group.label}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((n) => (
                        <NotificationItem
                          key={n.id}
                          notification={n}
                          onRead={markRead}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>

            {/* Footer hint */}
            {!loading && notifications.length > 0 && (
              <div className="border-t border-white/[0.05] px-4 py-2.5">
                <p className="text-[10px] text-white/20 text-center">
                  Showing last {notifications.length} notification
                  {notifications.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed right-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[70] w-[min(21rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/[0.10] shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
          style={{
            background: "rgba(10,14,26,0.97)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            animation: "toast-in 0.28s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Accent bar */}
          <div className="absolute left-0 top-0 h-full w-[3px] rounded-l-2xl bg-gradient-to-b from-[#38bdf8] to-[#818cf8]" />

          <div className="flex items-start gap-3 p-4 pl-5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[rgba(56,189,248,0.12)]">
              <BellRing size={14} color="#38bdf8" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1 pr-6">
              <p className="text-[13px] font-semibold text-white/90 leading-snug">
                {toast.title}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-white/40">
                {toast.body}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismissToast}
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-lg text-white/25 transition hover:bg-white/[0.06] hover:text-white/50"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bell-ring {
          0%,100% { transform: rotate(0deg); }
          20%      { transform: rotate(-12deg); }
          40%      { transform: rotate(10deg); }
          60%      { transform: rotate(-8deg); }
          80%      { transform: rotate(6deg); }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { scrollbar-width: none; }
      `}</style>
    </>
  );
}
