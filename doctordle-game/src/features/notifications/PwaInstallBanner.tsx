import { useEffect, useMemo, useState } from 'react'
import { usePwaInstallPrompt } from './pwaInstall'
import type { AppGameTab } from '../game/react/AppBottomNav'

const DISMISS_STORAGE_KEY = 'wardle.pwaInstallBannerDismissedAt'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function PwaInstallBanner({
  activeTab,
  completed,
  delayMs = 1500,
}: {
  activeTab: AppGameTab
  completed: boolean
  delayMs?: number
}) {
  const pwaInstall = usePwaInstallPrompt()
  const [delayElapsed, setDelayElapsed] = useState(false)
  const [dismissedAt, setDismissedAt] = useState<number | null>(() =>
    getStoredDismissedAt(),
  )

  const dismissedRecently = useMemo(() => {
    if (!dismissedAt) return false
    return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS
  }, [dismissedAt])

  const eligible =
    completed &&
    pwaInstall.shouldShowInstallButton &&
    !pwaInstall.isIos &&
    !pwaInstall.isNative &&
    !pwaInstall.isStandalone &&
    !dismissedRecently

  useEffect(() => {
    if (!eligible) {
      setDelayElapsed(false)
      return
    }

    let completedDelay = false
    setDelayElapsed(false)
    console.log('[pwa-install] post-case card delay started')

    const timeout = window.setTimeout(() => {
      completedDelay = true
      setDelayElapsed(true)
      console.log('[pwa-install] post-case card delay completed')
    }, delayMs)

    return () => {
      window.clearTimeout(timeout)
      if (!completedDelay) {
        console.log('[pwa-install] post-case card delay cancelled')
      }
    }
  }, [activeTab, delayMs, eligible])

  const visible = eligible && delayElapsed

  useEffect(() => {
    console.log('[pwa-install] post-case card visibility', {
      activeTab,
      completed,
      canPromptInstall: pwaInstall.canPromptInstall,
      isStandalone: pwaInstall.isStandalone,
      dismissedRecently,
      delayElapsed,
      delayMs,
    })

    if (visible) {
      console.log('[pwa-install] banner shown')
    }
  }, [
    activeTab,
    completed,
    delayElapsed,
    delayMs,
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] max-lg:bottom-[var(--wardle-bottom-nav-height)] sm:px-4 lg:bottom-0">
      <div className="pointer-events-auto mx-auto flex max-w-[300px] items-start gap-3 overflow-hidden rounded-2xl border border-white/[0.07] border-l-[3px] bg-[var(--wardle-surface-sticky-solid)] p-4">
        <img
          src="/wardle-icon.png"
          alt=""
          className="h-10 w-10 shrink-0 rounded-[10px]"
        />

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black leading-[1.3] text-[var(--wardle-color-mint)]">
            Install Wardle
          </p>
          <p className="mt-1 text-[12px] leading-[1.4] text-white/52">
            Keep your streak going.
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
