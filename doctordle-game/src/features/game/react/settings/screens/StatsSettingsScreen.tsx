import { SettingsActionRow } from '../components/SettingsActionRow'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import {
  SettingsSection,
  SettingsSectionLabel,
  SettingsSubHero,
} from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'

export function StatsSettingsScreen({
  onBack,
  currentStreak,
  xpTotal,
}: {
  onBack: () => void
  currentStreak: number | null
  xpTotal: number | null
}) {
  const stats = [
    {
      v: xpTotal != null ? String(xpTotal) : '--',
      l: 'Total XP',
      color: 'var(--wardle-color-teal)',
    },
    {
      v: `🔥 ${currentStreak ?? 0}`,
      l: 'Day streak',
      color: 'var(--wardle-color-amber)',
    },
  ]

  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Learning & Stats" />
      <SettingsSubHero
        icon="📊"
        title="Your learning stats"
        desc="Track your diagnostic growth over time"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          margin: '0 16px 4px',
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.l}
            style={{
              background: 'rgba(26,60,94,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>
              {stat.v}
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--wardle-color-gray)',
                marginTop: 3,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              {stat.l}
            </div>
          </div>
        ))}
      </div>
      <SettingsSectionLabel>Detail</SettingsSectionLabel>
      <SettingsSection>
        <SettingsActionRow
          icon="📈"
          iconBg="rgba(0,180,166,0.15)"
          label="Performance report"
          sublabel="Accuracy by specialty & over time"
          onClick={() => {}}
        />
        <SettingsActionRow
          icon="🏅"
          iconBg="rgba(244,162,97,0.15)"
          label="Specialty badges"
          sublabel="4 earned · 11 remaining"
          onClick={() => {}}
        />
        <SettingsActionRow
          icon="📋"
          iconBg="rgba(26,60,94,0.55)"
          label="Case history"
          sublabel="All 147 cases you've played"
          onClick={() => {}}
          style={{ borderBottom: 'none' }}
        />
      </SettingsSection>
    </SettingsShell>
  )
}

