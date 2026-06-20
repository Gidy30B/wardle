import { useEffect, useMemo, useState } from 'react'
import { usePwaInstallPrompt } from './pwaInstall'

const DISMISS_STORAGE_KEY = 'wardle.pwaInstallBannerDismissedAt'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function PwaInstallBanner({ completed }: { completed: boolean }) {
  const pwaInstall = usePwaInstallPrompt()
  const [dismissedAt, setDismissedAt] = useState<number | null>(() =>
    getStoredDismissedAt(),
  )

  const dismissedRecently = useMemo(() => {
    if (!dismissedAt) return false
    return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS
  }, [dismissedAt])

  const visible =
    completed &&
    pwaInstall.shouldShowInstallButton &&
    !pwaInstall.isIos &&
    !pwaInstall.isNative &&
    !pwaInstall.isStandalone &&
    !dismissedRecently

  useEffect(() => {
    console.log('[pwa-install] post-case card visibility', {
      completed,
      canPromptInstall: pwaInstall.canPromptInstall,
      isStandalone: pwaInstall.isStandalone,
      dismissedRecently,
    })

    if (visible) {
      console.log('[pwa-install] banner shown')
    }
  }, [
    completed,
    dismissedRecently,
    pwaInstall.canPromptInstall,
    pwaInstall.isStandalone,
    visible,
  ])

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
      <div className="pointer-events-auto mx-auto flex max-w-[400px] items-start gap-3 overflow-hidden rounded-2xl border border-white/[0.07] border-l-[3px] border-l-[var(--wardle-color-teal)]/60 bg-[var(--wardle-surface-sticky-solid)] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.32)]">
        <img
          src="/wardle-icon.png"
          alt=""
          className="h-10 w-10 shrink-0 rounded-[10px]"
        />

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--wardle-color-teal)]">
            ✓ Case solved
          </p>
          <p className="mt-1 text-[13px] font-black leading-[1.3] text-[var(--wardle-color-mint)]">
            Keep the streak going — install Wardle
          </p>
          <p className="mt-1 text-[12px] leading-[1.4] text-white/52">
            One tap from your home screen, with reminders so you never miss
            a day.
          </p>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void install()}
              className="rounded-full bg-[var(--wardle-color-teal)] px-4 py-2 text-[12px] font-black text-[var(--wardle-color-charcoal)] transition hover:bg-[var(--wardle-color-teal)]/88"
            >
              Install
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-[12px] font-bold text-white/40 transition hover:text-white/64"
            >
              Not now
            </button>
          </div>
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