import type { ReactNode } from 'react'
import AppBottomNav, { appNavItems, type AppGameTab } from './AppBottomNav'
import { APP_ICONS } from '../../../theme/icons'

type AppGameShellProps = {
  activeTab: AppGameTab
  canOpenLearn: boolean
  onChangeTab: (tab: AppGameTab) => void
  children: ReactNode
  streak: number | null
  xpTotal: number | null
  organizationName?: string | null
}

export default function AppGameShell({
  activeTab,
  canOpenLearn,
  onChangeTab,
  children,
  streak,
  xpTotal,
  organizationName,
}: AppGameShellProps) {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--wardle-color-charcoal)] text-[var(--wardle-color-mint)]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[244px] shrink-0 border-r border-white/10 bg-[var(--wardle-color-charcoal)] px-4 pb-5 pt-4 lg:flex lg:flex-col">
          <nav aria-label="Game tabs" className="space-y-2">
            {appNavItems.map((item) => {
              const disabled = item.id === 'learn' && !canOpenLearn
              const isActive = activeTab === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  disabled={disabled}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-[rgba(0,180,166,0.38)] bg-[rgba(0,180,166,0.14)] text-[var(--wardle-color-teal)] shadow-[0_12px_34px_rgba(0,180,166,0.12)]'
                      : 'border-transparent text-white/58 hover:border-white/10 hover:bg-white/[0.06] hover:text-white/78'
                  } disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  <span aria-hidden="true" className="text-xl leading-none">
                    {item.icon}
                  </span>
                  <span className="text-sm font-bold">{item.label}</span>
                </button>
              )
            })}
          </nav>

          {(streak != null || xpTotal != null || organizationName) ? (
            <div className="mt-auto rounded-[20px] border border-[rgba(244,162,97,0.24)] bg-[rgba(244,162,97,0.08)] p-4">
              <p className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-amber)]">
                Progress
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-lg font-black text-[var(--wardle-color-mint)]">
                    {streak != null ? streak : '--'}
                  </p>
                  <p className="text-[10px] text-white/45">{APP_ICONS.streak} Streak</p>
                </div>
                <div>
                  <p className="text-lg font-black text-[var(--wardle-color-mint)]">
                    {xpTotal != null ? xpTotal : '--'}
                  </p>
                  <p className="text-[10px] text-white/45">{APP_ICONS.rank} XP</p>
                </div>
              </div>
              {organizationName ? (
                <div className="mt-3 rounded-[14px] border border-[rgba(0,180,166,0.2)] bg-[rgba(0,180,166,0.09)] px-3 py-2">
                  <p className="truncate text-xs font-bold text-[var(--wardle-color-teal)]">
                    {organizationName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/42">Organization</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>

        <main className="flex min-w-0 flex-1 basis-0 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 basis-0 items-stretch overflow-hidden px-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:px-3 sm:pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:px-6 lg:pb-6 lg:pt-[calc(env(safe-area-inset-top)+1.5rem)]">
            <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 basis-0 items-stretch overflow-hidden">
              {children}
            </div>
          </div>

          <footer className="wardle-bottom-nav-shell lg:hidden">
            <AppBottomNav
              activeTab={activeTab}
              canOpenLearn={canOpenLearn}
              onChangeTab={onChangeTab}
            />
          </footer>
        </main>
      </div>
    </div>
  )
}
