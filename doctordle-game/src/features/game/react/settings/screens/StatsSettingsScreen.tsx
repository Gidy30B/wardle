import { useState } from 'react'
import type { ReactNode } from 'react'
import { SettingsActionRow } from '../components/SettingsActionRow'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import {
  SettingsSection,
  SettingsSectionLabel,
  SettingsSubHero,
} from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'
import {
  LEARNING_STATS_SETTINGS_ICON,
  LEARNING_STATS_SETTINGS_ICON_BG,
} from '../settings.icons'
import { getVisibleStreak } from '../../../../user-progress/streakVisibility'
import type { UserStatsReport } from '../../../../user-stats/userStats.types'
import { PerformanceReportPanel } from './PerformanceReportPanel'
import { SpecialtySummaryPanel } from './SpecialtySummaryPanel'
import { WeakAreasPanel } from './WeakAreasPanel'

type StatsIconName =
  | 'xp'
  | 'cases'
  | 'streak'
  | 'bestStreak'
  | 'report'
  | 'specialty'
  | 'weakAreas'

type StatCard = {
  v: string
  l: string
  color: string
  icon: StatsIconName
  iconStroke: string
  iconBg: string
}

function StatsSvgIcon({
  name,
  stroke,
  size = 18,
}: {
  name: StatsIconName
  stroke: string
  size?: number
}) {
  const common = {
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
      {...common}
    >
      {name === 'xp' ? (
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      ) : null}

      {name === 'cases' ? <path d="M22 12h-4l-3 9L9 3l-3 9H2" /> : null}

      {name === 'streak' ? (
        <>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
          <path d="M12 6v6l4 2" />
        </>
      ) : null}

      {name === 'bestStreak' ? (
        <>
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </>
      ) : null}

      {name === 'report' ? (
        <>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </>
      ) : null}

      {name === 'specialty' ? (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
        </>
      ) : null}

      {name === 'weakAreas' ? (
        <>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </>
      ) : null}
    </svg>
  )
}

function IconBox({
  children,
  bg,
}: {
  children: ReactNode
  bg: string
}) {
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: 9,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}

function formatPercent(value: number | null): string {
  return value === null ? '--' : `${value}%`
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' ? String(value) : '--'
}

function formatDecimal(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return '--'
  }

  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number') {
    return '--'
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (minutes <= 0) {
    return `${remainingSeconds}s`
  }

  return `${minutes}m ${remainingSeconds}s`
}

export function StatsSettingsScreen({
  onBack,
  currentStreak,
  bestStreak,
  xpTotal,
  statsReport,
  loading,
  error,
  onRetry,
}: {
  onBack: () => void
  currentStreak: number | null
  bestStreak: number | null
  xpTotal: number | null
  statsReport: UserStatsReport | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const [panel, setPanel] = useState<'performance' | 'specialty' | 'weakAreas' | null>(null)

  const progress = statsReport?.progress
  const totals = statsReport?.totals
  const visibleStreak = getVisibleStreak(
    currentStreak ?? progress?.currentStreak ?? 0,
  )
  const visibleBestStreak = getVisibleStreak(
    bestStreak ?? progress?.bestStreak ?? 0,
  )
  const hasCompletedCases = (totals?.casesCompleted ?? 0) > 0
  const topSpecialty = statsReport?.bySpecialty[0] ?? null
  const topWeakArea = statsReport?.weakAreas[0] ?? null

  const rawStats: Array<StatCard | null> = [
    {
      v: formatNumber(progress?.xpTotal ?? xpTotal),
      l: 'Total XP',
      color: 'var(--wardle-color-teal)',
      icon: 'xp' as const,
      iconStroke: 'var(--wardle-color-teal)',
      iconBg: 'rgba(0,180,166,0.14)',
    },
    {
      v: formatNumber(totals?.casesCompleted),
      l: 'Cases',
      color: 'var(--wardle-color-mint)',
      icon: 'cases' as const,
      iconStroke: 'rgba(238,240,255,0.7)',
      iconBg: 'rgba(238,240,255,0.08)',
    },
    visibleStreak != null
      ? {
          v: `Streak ${visibleStreak}`,
          l: 'Day streak',
          color: 'var(--wardle-color-amber)',
          icon: 'streak' as const,
          iconStroke: 'var(--wardle-color-amber)',
          iconBg: 'rgba(244,162,97,0.14)',
        }
      : null,
    visibleBestStreak != null
      ? {
          v: String(visibleBestStreak),
          l: 'Best streak',
          color: 'var(--wardle-color-amber)',
          icon: 'bestStreak' as const,
          iconStroke: 'var(--wardle-color-amber)',
          iconBg: 'rgba(244,162,97,0.14)',
        }
      : null,
  ]
  const stats = rawStats.filter((stat): stat is StatCard => stat != null)

  if (panel === 'performance') {
    return <PerformanceReportPanel onBack={() => setPanel(null)} statsReport={statsReport} />
  }
  if (panel === 'specialty') {
    return <SpecialtySummaryPanel onBack={() => setPanel(null)} statsReport={statsReport} />
  }
  if (panel === 'weakAreas') {
    return <WeakAreasPanel onBack={() => setPanel(null)} statsReport={statsReport} />
  }

  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Learning & Stats" />
      <SettingsSubHero
        icon={
          <span
            style={{
              display: 'inline-flex',
              width: 54,
              height: 54,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 16,
              background: LEARNING_STATS_SETTINGS_ICON_BG,
              fontSize: 30,
            }}
          >
            {LEARNING_STATS_SETTINGS_ICON}
          </span>
        }
        title="Your learning stats"
        desc={
          loading
            ? 'Loading your performance report...'
            : hasCompletedCases
              ? 'Track your diagnostic growth over time'
              : 'Complete a few cases to unlock your stats.'
        }
      />

      {error ? (
        <div
          style={{
            margin: '0 16px 12px',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(231,76,60,0.12)',
            border: '1px solid rgba(231,76,60,0.25)',
            color: 'var(--wardle-color-light)',
            fontSize: 12,
          }}
        >
          Stats are temporarily unavailable.
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginLeft: 8,
              color: 'var(--wardle-color-teal)',
              fontWeight: 700,
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

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
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              <IconBox bg={stat.iconBg}>
                <StatsSvgIcon
                  name={stat.icon}
                  stroke={stat.iconStroke}
                  size={16}
                />
              </IconBox>
            </div>
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
          icon={
            <StatsSvgIcon
              name="report"
              stroke="var(--wardle-color-teal)"
              size={18}
            />
          }
          iconBg="rgba(0,180,166,0.15)"
          label="Performance report"
          sublabel={
            hasCompletedCases
              ? `${formatPercent(totals?.accuracyPct ?? null)} accuracy - ${formatDecimal(
                  totals?.averageAttempts,
                )} avg attempts - ${formatDuration(totals?.averageTimeSecs)} avg time`
              : 'No performance report yet'
          }
          onClick={() => setPanel('performance')}
        />
        <SettingsActionRow
          icon={
            <StatsSvgIcon
              name="specialty"
              stroke="var(--wardle-color-amber)"
              size={18}
            />
          }
          iconBg="rgba(244,162,97,0.15)"
          label="Specialty summary"
          sublabel={
            topSpecialty
              ? `${topSpecialty.label}: ${topSpecialty.casesCompleted} cases - ${formatPercent(
                  topSpecialty.accuracyPct,
                )} accuracy`
              : 'Complete cases to build specialty trends'
          }
          onClick={() => setPanel('specialty')}
        />
        <SettingsActionRow
          icon={
            <StatsSvgIcon
              name="weakAreas"
              stroke="rgba(238,240,255,0.5)"
              size={18}
            />
          }
          iconBg="rgba(26,60,94,0.55)"
          label="Weak areas"
          sublabel={
            topWeakArea
              ? `${topWeakArea.label}: ${topWeakArea.reason}`
              : hasCompletedCases
                ? 'No weak areas detected yet'
                : 'Complete at least three cases in an area to detect trends'
          }
          onClick={() => setPanel('weakAreas')}
          style={{ borderBottom: 'none' }}
        />
      </SettingsSection>
    </SettingsShell>
  )
}
