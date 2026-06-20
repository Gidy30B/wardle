import { useEffect, useMemo, useState } from 'react'
import { usePwaInstallPrompt } from './pwaInstall'

const DISMISS_STORAGE_KEY = 'wardle.pwaInstallBannerDismissedAt'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function PwaInstallBanner() {
  const pwaInstall = usePwaInstallPrompt()
  const [dismissedAt, setDismissedAt] = useState<number | null>(() =>
    getStoredDismissedAt(),
  )

  const dismissedRecently = useMemo(() => {
    if (!dismissedAt) return false
    return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS
  }, [dismissedAt])

  const visible =
    pwaInstall.shouldShowInstallButton &&
    !pwaInstall.isIos &&
    !pwaInstall.isNative &&
    !pwaInstall.isStandalone &&
    !dismissedRecently

  useEffect(() => {
    if (visible) {
      console.log('[pwa-install] banner shown')
    }
  }, [visible])

  if (!visible) return null

  async function install() {
    await pwaInstall.promptInstall()
  }

  function dismiss() {
    const timestamp = Date.now()
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(timestamp))
    } catch (_) {
      // Storage can be blocked in some privacy modes; still hide for this tab.
    }
    setDismissedAt(timestamp)
    console.log('[pwa-install] banner dismissed')
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] sm:px-4">
      {/*
        Lighter "toast" treatment, not a modal-adjacent card: smaller icon,
        tighter padding, a quiet border instead of backdrop-blur + heavy
        shadow, and "Install" as plain text rather than a competing pill
        so the row reads as one quick line, not two stacked decisions.
      */}
      <div className="pointer-events-auto mx-auto flex max-w-[380px] items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-[var(--wardle-surface-sticky-solid)] px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
        <img
          src="/wardle-icon.png"
          alt=""
          className="h-7 w-7 shrink-0 rounded-[8px]"
        />
        <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-[var(--wardle-color-mint)]">
          Install Wardle for quicker daily access
        </p>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={dismiss}
            className="text-[11px] font-bold text-white/40 transition hover:text-white/64"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void install()}
            className="text-[11px] font-bold text-[var(--wardle-color-teal)] transition hover:text-[var(--wardle-color-teal)]/80"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}

function getStoredDismissedAt() {
  if (typeof localStorage === 'undefined') return null

  try {
    const value = Number(localStorage.getItem(DISMISS_STORAGE_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch (_) {
    return null
  }
}