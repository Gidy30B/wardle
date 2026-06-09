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

// ─── Design tokens — extracted directly from ReactGamePlaySurface ────────────
//
// Shell:        bg-[var(--wardle-color-charcoal)]          deepest layer
// Surface card: bg-[linear-gradient(145deg,rgba(26,60,94,0.28),rgba(30,30,44,0.92))]
// Surface inset: bg-[rgba(26,60,94,0.5)]                   Pill / icon bg
// Border soft:  border-white/[0.07]
// Border mid:   border-white/10
// Border teal:  border-[rgba(0,180,166,0.28)]
// Accent teal:  var(--wardle-color-teal)   (#00b4a6-ish)
// Accent mint:  var(--wardle-color-mint)   (brighter teal — headlines)
// Accent amber: var(--wardle-color-amber)
// Mono label:   font-brand-mono text-[10px] tracking-[0.18em] text-[var(--wardle-color-teal)]/85

const SURFACE_CARD    = "linear-gradient(145deg,rgba(26,60,94,0.28),rgba(30,30,44,0.92))";
const SURFACE_INSET   = "rgba(26,60,94,0.5)";
const SURFACE_INSET_SOFT = "rgba(26,60,94,0.28)";
const BORDER_SOFT     = "rgba(255,255,255,0.07)";
const BORDER_MID      = "rgba(255,255,255,0.10)";
const BORDER_TEAL     = "rgba(0,180,166,0.28)";

const CATEGORY_META: Record<
  NotificationCategory,
  { icon: AppIconKey; color: string; bg: string; accent: string; border: string }
> = {
  GAMEPLAY:    { icon: "play",     color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  accent: "#f59e0b", border: "rgba(245,158,11,0.22)"  },
  REWARD:      { icon: "rank",     color: "#a78bfa", bg: "rgba(167,139,250,0.12)", accent: "#a78bfa", border: "rgba(167,139,250,0.22)" },
  LEARNING:    { icon: "learn",    color: "#34d399", bg: "rgba(52,211,153,0.12)",  accent: "#34d399", border: "rgba(52,211,153,0.22)"  },
  LEADERBOARD: { icon: "rank",     color: "#38bdf8", bg: "rgba(56,189,248,0.12)",  accent: "#38bdf8", border: "rgba(56,189,248,0.22)"  },
  STREAK:      { icon: "streak",   color: "#fb923c", bg: "rgba(251,146,60,0.12)",  accent: "#fb923c", border: "rgba(251,146,60,0.22)"  },
  CONTENT:     { icon: "clues",    color: "#cbd5e1", bg: "rgba(203,213,225,0.08)", accent: "#cbd5e1", border: "rgba(203,213,225,0.14)" },
  SOCIAL:      { icon: "settings", color: "#f472b6", bg: "rgba(244,114,182,0.12)", accent: "#f472b6", border: "rgba(244,114,182,0.22)" },
  BILLING:     { icon: "settings", color: "#4ade80", bg: "rgba(74,222,128,0.12)",  accent: "#4ade80", border: "rgba(74,222,128,0.22)"  },
  ADMIN:       { icon: "settings", color: "#f87171", bg: "rgba(248,113,113,0.12)", accent: "#f87171", border: "rgba(248,113,113,0.22)" },
  SYSTEM:      { icon: "settings", color: "#94a3b8", bg: "rgba(148,163,184,0.08)", accent: "#94a3b8", border: "rgba(148,163,184,0.14)" },
};

const NOTIFICATION_MODAL_HISTORY_KEY = "__wardleNotificationModal";

const PRIORITY_RING: Record<NotificationPriority, string> = {
  low:    "transparent",
  normal: "transparent",
  high:   "rgba(251,146,60,0.55)",
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
  notifications.forEach((n) => groups[getNotificationDayGroup(n.createdAt)].push(n));
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
      style={{ animationDelay: `${index * 45}ms` }}
      className="wardle-notif-item group relative w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,180,166,0.4)]"
    >
      {/* Unread accent stripe — category-colored */}
      {unread && (
        <span
          className="absolute left-0 top-[12px] bottom-[12px] w-[3px] rounded-r-full"
          style={{ background: meta.accent }}
        />
      )}

      {/*
        Card: mirrors StateCard from ReactGamePlaySurface exactly —
        rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,...)]
        Unread: border gets the category teal tint instead of white/10
        High priority: amber glow ring via box-shadow
      */}
      <div
        className="rounded-[22px] border px-4 py-4 transition-all duration-150"
        style={{
          background: SURFACE_CARD,
          borderColor: unread ? meta.border : BORDER_SOFT,
          boxShadow: isHigh
            ? `0 0 0 1px ${PRIORITY_RING.high}, 0 6px 28px rgba(251,146,60,0.08)`
            : undefined,
        }}
      >
        <div className="flex items-start gap-3">
          {/*
            Icon pill: mirrors the Pill component — bg-[rgba(26,60,94,0.5)]
            with a category-tinted border, same rounded-full shape language
          */}
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] text-[15px] leading-none transition-transform duration-200 group-hover:scale-110"
            style={{
              background: meta.bg,
              color: meta.color,
              border: `1px solid ${meta.border}`,
            }}
            aria-hidden="true"
          >
            {icon}
          </span>

          <div className="min-w-0 flex-1">
            {/* Title + timestamp row */}
            <div className="flex items-start justify-between gap-2">
              <p
                className="text-[13px] font-black leading-snug tracking-tight"
                style={{ color: unread ? "var(--wardle-color-mint)" : "rgba(255,255,255,0.38)" }}
              >
                {notification.title}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                {/* Timestamp — mirrors caseCode label style */}
                <span className="font-brand-mono whitespace-nowrap text-[10px] text-white/30">
                  {formatRelativeTime(notification.createdAt)}
                </span>
                {unread && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: meta.accent }}
                  />
                )}
              </div>
            </div>

            {/* Body */}
            <p className="mt-1 line-clamp-2 text-[12px] leading-[1.6] text-white/55">
              {notification.body}
            </p>

            {/* Chips row — mirrors attempt history pill language */}
            <div className="mt-2.5 flex items-center gap-1.5">
              {/* Category chip */}
              <span
                className="font-brand-mono rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
              >
                {notification.category.toLowerCase()}
              </span>
              {isHigh && (
                <span className="font-brand-mono rounded-full border border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.12)] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--wardle-color-amber)]">
                  urgent
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// Empty state — mirrors StateCard layout from ReactGamePlaySurface
function EmptyState() {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(26,60,94,0.28),rgba(30,30,44,0.92))] px-5 py-10">
      <div className="flex flex-col items-center gap-4">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10"
          style={{ background: SURFACE_INSET_SOFT }}
        >
          <Bell size={24} strokeWidth={1.4} className="text-white/20" />
        </span>
        <div className="space-y-1 text-center">
          <p className="text-sm font-black text-white/30">All clear</p>
          <p className="text-[11px] text-white/20">No notifications yet</p>
        </div>
      </div>
    </div>
  );
}

// GroupLabel — full-bleed sticky divider matching the surface hierarchy
// Uses the same mono label style as caseCode / "Your guesses" section headers
function GroupLabel({ label }: { label: NotificationGroup["label"] }) {
  const LABELS = { TODAY: "Today", YESTERDAY: "Yesterday", EARLIER: "Earlier" };
  return (
    <div
      className="sticky top-0 z-[5] -mx-4 flex items-center gap-3 px-4 py-2"
      style={{
        background: "var(--wardle-color-charcoal)",
        borderBottom: `1px solid ${BORDER_MID}`,
      }}
    >
      <span className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/70">
        {LABELS[label]}
      </span>
      <span className="h-px flex-1" style={{ background: BORDER_MID }} />
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

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(dismissToast, 4200);
    return () => window.clearTimeout(t);
  }, [dismissToast, toast]);

  useEffect(() => {
    if (!open) return;
    if (!window.history.state?.[NOTIFICATION_MODAL_HISTORY_KEY]) {
      window.history.pushState(
        { ...(typeof window.history.state === "object" ? window.history.state : {}), [NOTIFICATION_MODAL_HISTORY_KEY]: true },
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  function closeModal() {
    if (pushedModalHistoryRef.current) {
      pushedModalHistoryRef.current = false;
      window.history.back();
    }
    setOpen(false);
  }

  const hasUnread = unreadCount > 0;
  const notificationGroups = groupNotifications(notifications);
  let itemIndex = 0;

  return (
    <>
      {/* ── Bell button ──
          Mirrors the Pill component: rounded-full, border, bg-[rgba(26,60,94,0.5)]
          Active state uses teal border + tint, matching the teal accent system
      ── */}
      <div className="relative inline-block">
        <button
          ref={buttonRef}
          type="button"
          aria-label={`Notifications${hasUnread ? `, ${unreadCount} unread` : ""}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{
            background: open ? "rgba(0,180,166,0.12)" : SURFACE_INSET,
            borderColor: open ? BORDER_TEAL : BORDER_SOFT,
          }}
          className={`relative flex items-center justify-center border transition-all duration-200 hover:border-[rgba(0,180,166,0.22)] hover:bg-[rgba(0,180,166,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,180,166,0.4)] ${
            compact ? "h-9 w-9 rounded-[16px]" : "h-10 w-10 rounded-[18px]"
          }`}
        >
          {hasUnread ? (
            <BellRing
              size={compact ? 17 : 18}
              strokeWidth={2}
              className="text-[var(--wardle-color-mint)]"
              style={{ animation: "wardle-bell-ring 0.7s cubic-bezier(0.36,0.07,0.19,0.97)" }}
            />
          ) : (
            <Bell size={compact ? 17 : 18} strokeWidth={1.8} className="text-white/40" />
          )}
          {hasUnread && (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--wardle-color-red,#ef4444)] px-1 text-[9px] font-black leading-none text-white shadow-[0_0_0_2px_var(--wardle-color-charcoal)]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* ── Full-screen modal ──
            Shell: bg-[var(--wardle-color-charcoal)] — exact match to ReactGamePlaySurface root
            Header: mirrors the sticky <header> in ReactGamePlaySurface exactly
            Slide-up animation: same feel as clue cards revealing
        ── */}
        {open && (
          <div
            className="fixed inset-0 z-[60] flex flex-col bg-[var(--wardle-color-charcoal)] text-white"
            style={{ animation: "wardle-notif-slide-up 300ms cubic-bezier(0.32,0.72,0,1)" }}
          >
            {/* Ambient glow — subtle mint radial, same depth cue as the game */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[200px] opacity-30"
              style={{ background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(0,180,166,0.12), transparent)" }}
            />

            {/*
              Header — mirrors ReactGamePlaySurface <header> exactly:
              sticky top-0 z-20 bg-[var(--wardle-color-charcoal)] px-5 pt-3
              with a border-b matching border-white/10
            */}
            <header className="sticky top-0 z-20 shrink-0 border-b border-white/10 bg-[var(--wardle-color-charcoal)] px-5 py-3">
              <div className="mx-auto flex max-w-3xl items-center gap-3">
                {/* Back — same inset surface as the Pill / NotificationBell button */}
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={closeModal}
                  style={{ background: SURFACE_INSET, borderColor: BORDER_SOFT }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] border text-white/45 transition-all duration-150 hover:border-[rgba(0,180,166,0.28)] hover:text-[var(--wardle-color-mint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,180,166,0.4)]"
                >
                  <ChevronLeft size={18} strokeWidth={2.2} />
                </button>

                {/* Title — mirrors ReactGamePlaySurface heading block */}
                <div className="min-w-0 flex-1">
                  <p className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/85">
                    Inbox
                  </p>
                  <h1 className="mt-0.5 text-[17px] font-black text-[var(--wardle-color-mint)]">
                    Notifications
                  </h1>
                </div>

                {/* Mark all — same Pill surface as header pills */}
                <button
                  type="button"
                  disabled={!hasUnread}
                  onClick={() => markAllRead()}
                  style={{ background: SURFACE_INSET, borderColor: BORDER_SOFT }}
                  className="flex items-center gap-1.5 rounded-[14px] border px-3 py-2 text-[11px] font-semibold text-white/40 transition-all duration-150 hover:border-[rgba(0,180,166,0.28)] hover:text-[var(--wardle-color-mint)] disabled:cursor-not-allowed disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,180,166,0.4)]"
                >
                  <CheckCheck size={11} strokeWidth={2.5} />
                  <span className="hidden sm:inline">Mark all read</span>
                  <span className="sm:hidden">Read all</span>
                </button>
              </div>

              {/* Unread count sub-label — mirrors attempts row */}
              {hasUnread && (
                <div className="mx-auto mt-2 max-w-3xl">
                  <p className="text-[11px] text-white/38">
                    {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </header>

            {/* Scrollable body — mirrors the main scroll container */}
            <div className="flex-1 overflow-y-auto scrollbar-none">
              <div className="mx-auto w-full max-w-3xl px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:px-5">
                {loading ? (
                  // Skeleton — uses StateCard shape: rounded-[22px] border bg-gradient
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(26,60,94,0.28),rgba(30,30,44,0.92))]"
                        style={{ height: 88, animationDelay: `${i * 70}ms` }}
                      />
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-1">
                    {notificationGroups.map((group) => (
                      <section key={group.label} className="mb-4">
                        <GroupLabel label={group.label} />
                        {/* space-y-3 mirrors the clue card section gap */}
                        <div className="mt-2 space-y-3">
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

            {/* Footer — mirrors "next case" panel: rounded-[18px] border-white/[0.07] bg-white/[0.03] */}
            {!loading && notifications.length > 0 && (
              <div className="shrink-0 border-t border-white/10 bg-[var(--wardle-color-charcoal)] px-5 py-3 text-center">
                <p className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/25">
                  {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Toast ──
          Mirrors StateCard surface: rounded-[22px] border border-white/10 bg-gradient
          with a mint teal left accent bar matching the teal accent system
      ── */}
      {toast && (
        <div
          className="fixed right-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[70] w-[min(21rem,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] border border-[rgba(0,180,166,0.28)] shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          style={{
            background: SURFACE_CARD,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            animation: "wardle-toast-in 0.32s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Mint accent bar */}
          <div className="absolute left-0 top-0 h-full w-[3px] bg-[linear-gradient(to_bottom,var(--wardle-color-teal),rgba(129,140,248,0.8))]" />
          <div className="flex items-start gap-3 p-4 pl-5">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[12px] border border-[rgba(0,180,166,0.22)]"
              style={{ background: "rgba(0,180,166,0.10)" }}
            >
              <BellRing size={14} className="text-[var(--wardle-color-mint)]" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1 pr-6">
              <p className="text-[13px] font-black leading-snug tracking-tight text-[var(--wardle-color-mint)]">
                {toast.title}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-white/55">{toast.body}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismissToast}
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-[10px] text-white/25 transition hover:bg-white/[0.06] hover:text-white/55"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes wardle-bell-ring {
          0%,100% { transform: rotate(0); }
          15%     { transform: rotate(-14deg); }
          30%     { transform: rotate(12deg); }
          45%     { transform: rotate(-9deg); }
          60%     { transform: rotate(6deg); }
          75%     { transform: rotate(-3deg); }
        }
        @keyframes wardle-toast-in {
          from { opacity: 0; transform: translateY(-10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wardle-notif-slide-up {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes wardle-notif-item-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .wardle-notif-item {
          animation: wardle-notif-item-in 240ms cubic-bezier(0.22,1,0.36,1) both;
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { scrollbar-width: none; }
      `}</style>
    </>
  );
}