import { useEffect, useRef, useState } from "react";
import {
  Bell, // TODO: add to icons.ts
  BellRing, // TODO: add to icons.ts
  CheckCheck, // TODO: add to icons.ts
  X, // TODO: add to icons.ts
  ChevronLeft, // TODO: add to icons.ts
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
  { icon: AppIconKey; color: string; bg: string; accent: string }
> = {
  GAMEPLAY:    { icon: "play",     color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  accent: "#f59e0b" },
  REWARD:      { icon: "rank",     color: "#a78bfa", bg: "rgba(167,139,250,0.10)", accent: "#a78bfa" },
  LEARNING:    { icon: "learn",    color: "#34d399", bg: "rgba(52,211,153,0.10)",  accent: "#34d399" },
  LEADERBOARD: { icon: "rank",     color: "#38bdf8", bg: "rgba(56,189,248,0.10)",  accent: "#38bdf8" },
  STREAK:      { icon: "streak",   color: "#fb923c", bg: "rgba(251,146,60,0.10)",  accent: "#fb923c" },
  CONTENT:     { icon: "clues",    color: "#cbd5e1", bg: "rgba(203,213,225,0.07)", accent: "#cbd5e1" },
  SOCIAL:      { icon: "settings", color: "#f472b6", bg: "rgba(244,114,182,0.10)", accent: "#f472b6" },
  BILLING:     { icon: "settings", color: "#4ade80", bg: "rgba(74,222,128,0.10)",  accent: "#4ade80" },
  ADMIN:       { icon: "settings", color: "#f87171", bg: "rgba(248,113,113,0.10)", accent: "#f87171" },
  SYSTEM:      { icon: "settings", color: "#94a3b8", bg: "rgba(148,163,184,0.07)", accent: "#94a3b8" },
};

const NOTIFICATION_MODAL_HISTORY_KEY = "__wardleNotificationModal";

const PRIORITY_RING: Record<NotificationPriority, string> = {
  low:    "transparent",
  normal: "transparent",
  high:   "rgba(251,146,60,0.6)",
};

type NotificationGroup = {
  label: "TODAY" | "YESTERDAY" | "EARLIER";
  items: WardleNotification[];
};

function getNotificationDayGroup(value: string): NotificationGroup["label"] {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "EARLIER";
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (date >= startOfToday) return "TODAY";
  if (date >= startOfYesterday) return "YESTERDAY";
  return "EARLIER";
}

function groupNotifications(notifications: WardleNotification[]): NotificationGroup[] {
  const groups: Record<NotificationGroup["label"], WardleNotification[]> = {
    TODAY: [], YESTERDAY: [], EARLIER: [],
  };
  notifications.forEach((n) => {
    groups[getNotificationDayGroup(n.createdAt)].push(n);
  });
  return (["TODAY", "YESTERDAY", "EARLIER"] as const)
    .map((label) => ({ label, items: groups[label] }))
    .filter((g) => g.items.length > 0);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onRead,
  index = 0,
}: {
  notification: WardleNotification;
  onRead: (id: string) => void;
  index?: number;
}) {
  const unread = !notification.readAt;
  const meta = CATEGORY_META[notification.category] ?? CATEGORY_META.SYSTEM;
  const icon = APP_ICONS[meta.icon];
  const isHigh = notification.priority === "high";

  return (
    <button
      type="button"
      onClick={() => unread && onRead(notification.id)}
      style={{
        animationDelay: `${index * 40}ms`,
        boxShadow: isHigh ? `0 0 0 1px ${PRIORITY_RING.high}, 0 4px 20px rgba(251,146,60,0.08)` : undefined,
      }}
      className="wardle-notif-item group relative w-full text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
    >
      {/* Left accent stripe for unread */}
      {unread && (
        <span
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
          style={{ background: meta.accent }}
        />
      )}

      <div
        className="flex items-start gap-3 rounded-2xl px-4 py-3.5 transition-colors duration-150"
        style={{
          background: unread ? "rgba(255,255,255,0.04)" : "transparent",
          border: `1px solid ${unread ? "rgba(255,255,255,0.07)" : "transparent"}`,
        }}
      >
        {/* Icon */}
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] text-[16px] leading-none transition-transform duration-200 group-hover:scale-110"
          style={{ background: meta.bg, color: meta.color }}
          aria-hidden="true"
        >
          {icon}
        </span>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className="text-[13px] font-semibold leading-snug tracking-[-0.01em]"
              style={{ color: unread ? "#f1f5f9" : "#64748b" }}
            >
              {notification.title}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-white/20 tabular-nums whitespace-nowrap">
                {formatRelativeTime(notification.createdAt)}
              </span>
              {unread && (
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: meta.accent }}
                />
              )}
            </div>
          </div>

          <p className="mt-1 line-clamp-2 text-[12px] leading-[1.55] text-white/35">
            {notification.body}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <span
              className="rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]"
              style={{ color: meta.color, background: meta.bg }}
            >
              {notification.category.toLowerCase()}
            </span>
            {isHigh && (
              <span className="rounded-lg bg-[rgba(251,146,60,0.12)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#fb923c]">
                urgent
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.03] text-white/10 border border-white/[0.05]">
        <Bell size={26} strokeWidth={1.3} />
      </span>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-white/25 tracking-tight">All clear</p>
        <p className="text-[11px] text-white/15">No notifications yet</p>
      </div>
    </div>
  );
}

function GroupLabel({ label }: { label: NotificationGroup["label"] }) {
  const LABELS = { TODAY: "Today", YESTERDAY: "Yesterday", EARLIER: "Earlier" };
  return (
    <div className="sticky top-[61px] z-[5] w-full py-2.5 pl-[4.25rem] pr-4"
      style={{ background: "rgba(19,22,30,0.94)", backdropFilter: "blur(16px)" }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/20">
        {LABELS[label]}
      </p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type NotificationBellProps = { compact?: boolean };

export default function NotificationBell({ compact = false }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pushedModalHistoryRef = useRef(false);

  const { notifications, unreadCount, loading, markRead, markAllRead, toast, dismissToast } =
    useNotifications();

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(dismissToast, 4200);
    return () => window.clearTimeout(t);
  }, [dismissToast, toast]);

  // Browser back
  useEffect(() => {
    if (!open) return;
    if (!window.history.state?.[NOTIFICATION_MODAL_HISTORY_KEY]) {
      window.history.pushState(
        { ...(typeof window.history.state === "object" ? window.history.state : {}), [NOTIFICATION_MODAL_HISTORY_KEY]: true },
        "", window.location.href,
      );
      pushedModalHistoryRef.current = true;
    }
    function handlePopState() { pushedModalHistoryRef.current = false; setOpen(false); }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  function closeModal() {
    if (pushedModalHistoryRef.current) { pushedModalHistoryRef.current = false; window.history.back(); }
    setOpen(false);
  }

  const hasUnread = unreadCount > 0;
  const notificationGroups = groupNotifications(notifications);
  let itemIndex = 0;

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
            background: open ? "rgba(56,189,248,0.10)" : "rgba(255,255,255,0.04)",
            borderColor: open ? "rgba(56,189,248,0.28)" : "rgba(255,255,255,0.07)",
          }}
          className={`relative flex items-center justify-center border transition-all duration-200 hover:border-[rgba(56,189,248,0.22)] hover:bg-[rgba(56,189,248,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(56,189,248,0.4)] ${
            compact ? "h-9 w-9 rounded-xl" : "h-10 w-10 rounded-[14px]"
          }`}
        >
          {hasUnread ? (
            <BellRing size={compact ? 17 : 18} strokeWidth={2} color="#38bdf8"
              style={{ animation: "bell-ring 0.7s cubic-bezier(0.36,0.07,0.19,0.97)" }} />
          ) : (
            <Bell size={compact ? 17 : 18} strokeWidth={1.8} className="text-white/40" />
          )}
          {hasUnread && (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-black leading-none text-white shadow-[0_0_0_2px_rgba(19,22,30,1)]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* ── Full-screen modal ── */}
        {open && (
          <div
            className="fixed inset-0 z-[60] flex flex-col scrollbar-none"
            style={{
              background: "rgb(19,22,30)",
              animation: "slide-up 280ms cubic-bezier(0.32,0.72,0,1)",
            }}
          >
            {/* Subtle top gradient */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[180px] opacity-30"
              style={{ background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(56,189,248,0.12), transparent)" }} />

            {/* Sticky header */}
            <header
              className="sticky top-0 z-10 shrink-0 border-b px-4 py-3"
              style={{
                background: "rgba(19,22,30,0.96)",
                borderColor: "rgba(255,255,255,0.055)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="mx-auto flex max-w-2xl items-center gap-3">
                {/* Back */}
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={closeModal}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/40 transition-all duration-150 hover:border-white/[0.12] hover:bg-white/[0.07] hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                >
                  <ChevronLeft size={18} strokeWidth={2.2} />
                </button>

                {/* Title */}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-white/85 tracking-[-0.02em]">
                    Notifications
                  </p>
                  <p className="text-[11px] text-white/28 mt-px">
                    {hasUnread ? `${unreadCount} unread` : "You're all caught up"}
                  </p>
                </div>

                {/* Mark all */}
                <button
                  type="button"
                  disabled={!hasUnread}
                  onClick={() => markAllRead()}
                  className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/35 transition-all duration-150 hover:border-white/[0.12] hover:bg-white/[0.07] hover:text-white/60 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  <CheckCheck size={11} strokeWidth={2.5} />
                  <span className="hidden sm:inline">Mark all read</span>
                  <span className="sm:hidden">Read all</span>
                </button>
              </div>
            </header>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto scrollbar-none">
              <div className="mx-auto max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                {loading ? (
                  <div className="space-y-2 pt-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-[80px] animate-pulse rounded-2xl bg-white/[0.03]"
                        style={{ animationDelay: `${i * 60}ms` }} />
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-6 pt-2">
                    {notificationGroups.map((group) => (
                      <section key={group.label}>
                        <GroupLabel label={group.label} />
                        <div className="space-y-1 pt-1">
                          {group.items.map((n) => (
                            <NotificationItem
                              key={n.id}
                              notification={n}
                              onRead={markRead}
                              index={itemIndex++}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer count */}
            {!loading && notifications.length > 0 && (
              <div className="shrink-0 border-t px-4 py-3 text-center"
                style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(19,22,30,0.96)" }}>
                <p className="text-[10px] text-white/18">
                  {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed right-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[70] w-[min(21rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
          style={{
            background: "rgba(24,27,36,0.98)",
            borderColor: "rgba(56,189,248,0.18)",
            backdropFilter: "blur(24px)",
            animation: "toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <div className="absolute left-0 top-0 h-full w-[3px] rounded-l-2xl bg-gradient-to-b from-[#38bdf8] to-[#818cf8]" />
          <div className="flex items-start gap-3 p-4 pl-5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[rgba(56,189,248,0.10)]">
              <BellRing size={14} color="#38bdf8" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1 pr-6">
              <p className="text-[13px] font-semibold text-white/88 leading-snug tracking-tight">
                {toast.title}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-white/38">{toast.body}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismissToast}
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-lg text-white/22 transition hover:bg-white/[0.06] hover:text-white/50"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bell-ring {
          0%,100% { transform: rotate(0); }
          15%     { transform: rotate(-14deg); }
          30%     { transform: rotate(12deg); }
          45%     { transform: rotate(-9deg); }
          60%     { transform: rotate(6deg); }
          75%     { transform: rotate(-3deg); }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes wardle-notif-item-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .wardle-notif-item {
          animation: wardle-notif-item-in 220ms cubic-bezier(0.22,1,0.36,1) both;
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { scrollbar-width: none; }
      `}</style>
    </>
  );
}
