import type { ReactNode } from 'react'

export function SettingsSection({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        margin: '0 16px',
        background: 'rgba(26,60,94,0.22)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

export function SettingsSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--wardle-color-gray)',
        textTransform: 'uppercase',
        letterSpacing: 1.4,
        padding: '16px 20px 8px',
      }}
    >
      {children}
    </div>
  )
}

export function SettingsSubHero({
  icon,
  title,
  desc,
}: {
  icon: string
  title: string
  desc: string
}) {
  return (
    <div style={{ padding: '20px 20px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: 'var(--wardle-color-mint)',
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--wardle-color-gray)',
          lineHeight: 1.5,
        }}
      >
        {desc}
      </div>
    </div>
  )
}

