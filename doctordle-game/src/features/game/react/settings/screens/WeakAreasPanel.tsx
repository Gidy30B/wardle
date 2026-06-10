import type { UserStatsReport, UserWeakAreaSummary } from '../../../../user-stats/userStats.types'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import { SettingsSection, SettingsSectionLabel } from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'

const PRIORITY_COLOR: Record<UserWeakAreaSummary['priority'], string> = {
  low: 'rgba(138,155,176,0.7)',
  medium: 'var(--wardle-color-amber)',
  high: '#E05C5C',
}

const PRIORITY_BG: Record<UserWeakAreaSummary['priority'], string> = {
  low: 'rgba(26,60,94,0.55)',
  medium: 'rgba(244,162,97,0.12)',
  high: 'rgba(224,92,92,0.12)',
}

export function WeakAreasPanel({
  onBack,
  statsReport,
}: {
  onBack: () => void
  statsReport: UserStatsReport | null
}) {
  const weakAreas = statsReport?.weakAreas ?? []
  const hasData = weakAreas.length > 0

  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Learning & Stats" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 20px 0' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: 'rgba(26,60,94,0.55)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          ⚠️
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
            Weak areas
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
              ? `${weakAreas.length} area${weakAreas.length === 1 ? '' : 's'} flagged for improvement`
              : 'No weak areas detected'}
          </div>
        </div>
      </div>

      <div className="wardle-learn-slide-up">
        {hasData ? (
          <>
            <SettingsSectionLabel>Areas to improve</SettingsSectionLabel>
            <SettingsSection>
              {weakAreas.map((area, i) => (
                <div
                  key={area.key}
                  style={{
                    padding: '13px 16px',
                    borderBottom:
                      i < weakAreas.length - 1
                        ? '1px solid rgba(255,255,255,0.05)'
                        : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--wardle-color-light)',
                        lineHeight: 1.3,
                      }}
                    >
                      {area.label}
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 9,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        padding: '2px 6px',
                        borderRadius: 5,
                        color: PRIORITY_COLOR[area.priority],
                        background: PRIORITY_BG[area.priority],
                      }}
                    >
                      {area.priority}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--wardle-color-gray)',
                      lineHeight: 1.5,
                    }}
                  >
                    {area.reason}
                  </div>
                </div>
              ))}
            </SettingsSection>
          </>
        ) : (
          <div style={{ padding: '20px 16px' }}>
            <div
              style={{
                background: 'rgba(0,180,166,0.06)',
                border: '1px solid rgba(0,180,166,0.15)',
                borderRadius: 16,
                padding: '32px 24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12, lineHeight: 1 }}>✅</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--wardle-color-teal)',
                  lineHeight: 1.5,
                }}
              >
                No weak areas detected
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(138,155,176,0.5)',
                  marginTop: 4,
                  lineHeight: 1.6,
                }}
              >
                Complete at least three cases in an area to detect trends.
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsShell>
  )
}
