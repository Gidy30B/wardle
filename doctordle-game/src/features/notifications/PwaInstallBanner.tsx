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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:px-4">
      <div className="pointer-events-auto mx-auto flex max-w-[440px] items-center gap-3 rounded-[18px] border border-white/[0.08] bg-[var(--wardle-surface-sticky-solid)] px-3.5 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.36)] backdrop-blur">
        <img
          src="/wardle-icon.png"
          alt=""
          className="h-10 w-10 shrink-0 rounded-[12px]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black leading-4 text-[var(--wardle-color-mint)]">
            Install Wardle
          </p>
          <p className="mt-0.5 break-words text-[12px] leading-4 text-white/56">
            Get daily cases and reminders from your home screen.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full px-2.5 py-2 text-[11px] font-black text-white/44 transition hover:text-white/68"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void install()}
            className="rounded-full border border-[var(--wardle-color-teal)]/24 bg-[var(--wardle-color-teal)]/12 px-3 py-2 text-[11px] font-black text-[var(--wardle-color-teal)] transition hover:border-[var(--wardle-color-teal)]/36 hover:bg-[var(--wardle-color-teal)]/16"
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
