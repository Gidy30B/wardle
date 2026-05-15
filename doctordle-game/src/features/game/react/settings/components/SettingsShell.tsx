import type { CSSProperties, ReactNode } from 'react'

const SETTINGS_SCROLL_STYLE: CSSProperties = {
  background: 'var(--wardle-color-charcoal)',
  flex: 1,
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
  width: '100%',
}

const SETTINGS_SCROLLER_STYLE: CSSProperties = {
  inset: 0,
  minHeight: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  paddingBottom: 24,
  position: 'absolute',
  WebkitOverflowScrolling: 'touch',
}

export function SettingsShell({
  children,
  contentStyle,
}: {
  children: ReactNode
  contentStyle?: CSSProperties
}) {
  return (
    <main style={SETTINGS_SCROLL_STYLE}>
      <div style={{ ...SETTINGS_SCROLLER_STYLE, ...contentStyle }}>
        {children}
      </div>
    </main>
  )
}

