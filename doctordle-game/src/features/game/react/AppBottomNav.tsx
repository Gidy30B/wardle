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
      className="wardle-bottom-nav"
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
            className="wardle-bottom-nav__item"
            data-active={isActive ? 'true' : 'false'}
          >
            <span aria-hidden="true" className="wardle-bottom-nav__icon">
              {item.icon}
            </span>
            <span className="wardle-bottom-nav__label">
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
