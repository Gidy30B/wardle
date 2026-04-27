import { APP_ICONS } from '../../../theme/icons'

export type AppGameTab = 'play' | 'learn' | 'rank' | 'settings'

export type AppNavItem = {
  id: AppGameTab
  label: string
  icon: string
}

type AppBottomNavProps = {
  activeTab: AppGameTab
  canOpenLearn: boolean
  onChangeTab: (tab: AppGameTab) => void
}

export const appNavItems: AppNavItem[] = [
  { id: 'play', label: 'Play', icon: APP_ICONS.play },
  { id: 'learn', label: 'Learn', icon: APP_ICONS.learn },
  { id: 'rank', label: 'Rank', icon: APP_ICONS.rank },
  { id: 'settings', label: 'Settings', icon: APP_ICONS.settings },
]

export default function AppBottomNav({
  activeTab,
  canOpenLearn,
  onChangeTab,
}: AppBottomNavProps) {
  return (
    <nav
      aria-label="Game tabs"
      className="mx-auto flex w-full max-w-[760px] items-center justify-between rounded-[28px] border border-white/10 bg-[rgba(28,28,40,0.96)] px-2 py-2 shadow-[0_28px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl"
    >
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
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[18px] px-2 py-2 text-center transition ${
              isActive
                ? 'bg-[rgba(0,180,166,0.14)] text-[var(--wardle-color-teal)]'
                : 'text-white/52 hover:bg-white/5 hover:text-white/74'
            } disabled:cursor-not-allowed disabled:opacity-35`}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {item.icon}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
