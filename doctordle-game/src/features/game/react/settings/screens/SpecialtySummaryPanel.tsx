import type { UserStatsReport } from '../../../../user-stats/userStats.types'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import { SettingsSection, SettingsSectionLabel } from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'

function fmtPct(value: number | null): string {
  return value === null ? '--' : `${value}%`
}

export function SpecialtySummaryPanel({
  onBack,
  statsReport,
}: {
  onBack: () => void
  statsReport: UserStatsReport | null
}) {
  const specialties = statsReport?.bySpecialty ?? []
  const hasData = specialties.length > 0

  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Learning & Stats" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 20px 0' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: 'rgba(244,162,97,0.15)',
            border: '1px solid rgba(244,162,97,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          🔬
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
            Specialty summary
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
              ? `${specialties.length} specialt${specialties.length === 1 ? 'y' : 'ies'} tracked`
              : 'No specialty data yet'}
          </div>
        </div>
      </div>

      <div className="wardle-learn-slide-up">
        {hasData ? (
          <>
            <SettingsSectionLabel>By specialty</SettingsSectionLabel>
            <SettingsSection>
              {specialties.map((s, i) => (
                <div
                  key={s.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '13px 16px',
                    borderBottom:
                      i < specialties.length - 1
                        ? '1px solid rgba(255,255,255,0.05)'
                        : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--wardle-color-light)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--wardle-color-gray)',
                        marginTop: 2,
                      }}
                    >
                      {s.casesCompleted} case{s.casesCompleted !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: 'var(--wardle-color-teal)',
                      }}
                    >
                      {fmtPct(s.accuracyPct)}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--wardle-color-gray)',
                        marginTop: 1,
                      }}
                    >
                      accuracy
                    </div>
                  </div>
                </div>
              ))}
            </SettingsSection>
          </>
        ) : (
          <div style={{ padding: '20px 16px' }}>
            <div
              style={{
                background: 'rgba(26,60,94,0.18)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 16,
                padding: '32px 24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12, lineHeight: 1 }}>🔬</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--wardle-color-gray)',
                  lineHeight: 1.5,
                }}
              >
                No specialties yet
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(138,155,176,0.5)',
                  marginTop: 4,
                  lineHeight: 1.6,
                }}
              >
                Complete cases to build specialty trends.
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsShell>
  )
}
