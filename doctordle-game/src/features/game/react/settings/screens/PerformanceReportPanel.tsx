import type { UserStatsReport } from '../../../../user-stats/userStats.types'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import { SettingsShell } from '../components/SettingsShell'

function fmtPct(value: number | null): string {
  return value === null ? '--' : `${value}%`
}

function fmtDecimal(value: number | null | undefined): string {
  if (typeof value !== 'number') return '--'
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

function fmtDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number') return '--'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (minutes <= 0) return `${remainingSeconds}s`
  return `${minutes}m ${remainingSeconds}s`
}

function fmtNumber(value: number | null | undefined): string {
  return typeof value === 'number' ? String(value) : '--'
}

type StatItem = { label: string; value: string; color: string }

export function PerformanceReportPanel({
  onBack,
  statsReport,
}: {
  onBack: () => void
  statsReport: UserStatsReport | null
}) {
  const totals = statsReport?.totals
  const hasData = (totals?.casesCompleted ?? 0) > 0

  const statItems: StatItem[] = [
    {
      label: 'Cases completed',
      value: fmtNumber(totals?.casesCompleted),
      color: 'var(--wardle-color-mint)',
    },
    {
      label: 'Accuracy',
      value: fmtPct(totals?.accuracyPct ?? null),
      color: 'var(--wardle-color-teal)',
    },
    {
      label: 'Avg attempts',
      value: fmtDecimal(totals?.averageAttempts),
      color: 'var(--wardle-color-amber)',
    },
    {
      label: 'Avg time',
      value: fmtDuration(totals?.averageTimeSecs),
      color: 'var(--wardle-color-amber)',
    },
  ]

  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Learning & Stats" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 20px 0' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: 'rgba(0,180,166,0.15)',
            border: '1px solid rgba(0,180,166,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          📊
        </div>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: 'var(--wardle-color-mint)',
              lineHeight: 1.3,
            }}
          >
            Performance report
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--wardle-color-gray)',
              marginTop: 3,
              lineHeight: 1.4,
            }}
          >
            {hasData
              ? 'Your diagnostic performance breakdown'
              : 'Complete cases to build your report'}
          </div>
        </div>
      </div>

      <div className="wardle-learn-slide-up" style={{ padding: '20px 16px' }}>
        {hasData ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}
          >
            {statItems.map((item) => (
              <div
                key={item.label}
                style={{
                  background: 'rgba(26,60,94,0.3)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: '14px 12px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: item.color,
                    lineHeight: 1.2,
                  }}
                >
                  {item.value}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--wardle-color-gray)',
                    marginTop: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(26,60,94,0.18)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 16,
              padding: '32px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12, lineHeight: 1 }}>📋</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--wardle-color-gray)',
                lineHeight: 1.5,
              }}
            >
              No data yet
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(138,155,176,0.5)',
                marginTop: 4,
                lineHeight: 1.6,
              }}
            >
              Complete a few cases to unlock your performance report.
            </div>
          </div>
        )}
      </div>
    </SettingsShell>
  )
}
