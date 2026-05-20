import { SettingsActionRow } from '../components/SettingsActionRow'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import {
  SettingsSection,
  SettingsSectionLabel,
  SettingsSubHero,
} from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'
import { getVisibleStreak } from '../../../../user-progress/streakVisibility'
import type { UserStatsReport } from '../../../../user-stats/userStats.types'

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
  const stats = [
    {
      v: formatNumber(progress?.xpTotal ?? xpTotal),
      l: 'Total XP',
      color: 'var(--wardle-color-teal)',
    },
    {
      v: formatNumber(totals?.casesCompleted),
      l: 'Cases',
      color: 'var(--wardle-color-mint)',
    },
    visibleStreak != null
      ? {
          v: `Streak ${visibleStreak}`,
          l: 'Day streak',
          color: 'var(--wardle-color-amber)',
        }
      : null,
    visibleBestStreak != null
      ? {
          v: String(visibleBestStreak),
          l: 'Best streak',
          color: 'var(--wardle-color-amber)',
        }
      : null,
  ].filter((stat): stat is { v: string; l: string; color: string } => stat != null)

  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Learning & Stats" />
      <SettingsSubHero
        icon="Stats"
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
          icon="Report"
          iconBg="rgba(0,180,166,0.15)"
          label="Performance report"
          sublabel={
            hasCompletedCases
              ? `${formatPercent(totals?.accuracyPct ?? null)} accuracy - ${formatDecimal(
                  totals?.averageAttempts,
                )} avg attempts - ${formatDuration(totals?.averageTimeSecs)} avg time`
              : 'No performance report yet'
          }
          onClick={() => {}}
        />
        <SettingsActionRow
          icon="Focus"
          iconBg="rgba(244,162,97,0.15)"
          label="Specialty summary"
          sublabel={
            topSpecialty
              ? `${topSpecialty.label}: ${topSpecialty.casesCompleted} cases - ${formatPercent(
                  topSpecialty.accuracyPct,
                )} accuracy`
              : 'Complete cases to build specialty trends'
          }
          onClick={() => {}}
        />
        <SettingsActionRow
          icon="Review"
          iconBg="rgba(26,60,94,0.55)"
          label="Weak areas"
          sublabel={
            topWeakArea
              ? `${topWeakArea.label}: ${topWeakArea.reason}`
              : hasCompletedCases
                ? 'No weak areas detected yet'
                : 'Complete at least three cases in an area to detect trends'
          }
          onClick={() => {}}
          style={{ borderBottom: 'none' }}
        />
      </SettingsSection>
    </SettingsShell>
  )
}
