import WardleLogo from '../../../../../components/brand/WardleLogo'
import { SETTINGS_VERSION_LABEL } from '../settings.constants'
import {
  LEARNING_STATS_SETTINGS_ICON,
  LEARNING_STATS_SETTINGS_ICON_BG,
} from '../settings.icons'
import type { SettingsScreenId } from '../settings.types'
import { SettingsChevronValue } from '../components/SettingsActionRow'
import { SettingsRow } from '../components/SettingsRow'
import { SettingsSection, SettingsSectionLabel } from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'
import { getVisibleStreak } from '../../../../user-progress/streakVisibility'

const MENU_ITEMS: Array<{
  id: SettingsScreenId
  icon: string
  bg: string
  label: string
  sub: string
}> = ([
  {
    id: 'gameplay',
    icon: '🎮',
    bg: 'rgba(0,180,166,0.15)',
    label: 'Gameplay',
    sub: 'Difficulty, hints, timer',
  },
  {
    id: 'notifications',
    icon: '🔔',
    bg: 'rgba(244,162,97,0.15)',
    label: 'Notifications',
    sub: 'Reminders, alerts, digest',
  },
  {
    id: 'appearance',
    icon: '🌙',
    bg: 'rgba(26,60,94,0.55)',
    label: 'Appearance',
    sub: 'Theme, text size, animations',
  },
  {
    id: 'stats',
    icon: LEARNING_STATS_SETTINGS_ICON,
    bg: LEARNING_STATS_SETTINGS_ICON_BG,
    label: 'Learning & Stats',
    sub: 'Performance, badges, history',
  },
  {
    id: 'account',
    icon: '👤',
    bg: 'rgba(26,60,94,0.55)',
    label: 'Account & Privacy',
    sub: 'Password, data, sign out',
  },
].filter(
  (item) =>
    // TODO: Re-enable after production-ready appearance/gameplay/premium systems ship.
    item.id !== 'gameplay' && item.id !== 'appearance',
) as Array<{
  id: SettingsScreenId
  icon: string
  bg: string
  label: string
  sub: string
}>)

export function SettingsHomeScreen({
  username,
  organizationLabel,
  trainingLevel,
  currentStreak,
  onSelectScreen,
}: {
  username: string
  organizationLabel: string
  trainingLevel: string | null
  currentStreak: number | null
  onSelectScreen: (screen: SettingsScreenId) => void
}) {
  const visibleStreak = getVisibleStreak(currentStreak)

  return (
    <SettingsShell>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--wardle-color-charcoal)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <WardleLogo size="sm" />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--wardle-color-gray)',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
          }}
        >
          Settings
        </span>
      </div>

      <div
        style={{
          margin: '16px 16px 0',
          background: 'rgba(26,60,94,0.45)',
          border: '1px solid rgba(0,180,166,0.22)',
          borderRadius: 18,
          padding: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            flexShrink: 0,
            background:
              'linear-gradient(135deg, var(--wardle-color-teal), var(--wardle-color-navy))',
          display: visibleStreak != null ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 800,
            color: 'white',
            position: 'relative',
          }}
        >
          {username.charAt(0).toUpperCase()}
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'var(--wardle-color-amber)',
              border: '2px solid var(--wardle-color-charcoal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 8,
            }}
          >
            🏅
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--wardle-color-mint)',
            }}
          >
            {username}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--wardle-color-gray)',
              marginTop: 1,
            }}
          >
            {organizationLabel} · {trainingLevel ?? 'Training level unset'}
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              color: 'var(--wardle-color-teal)',
              marginTop: 3,
              letterSpacing: 1,
            }}
          >
            FOUNDING MEMBER
          </div>
        </div>
        <div style={{ color: 'var(--wardle-color-gray)', fontSize: 16 }}>›</div>
      </div>

      <div
        style={{
          margin: '10px 16px 0',
          background: 'rgba(244,162,97,0.08)',
          border: '1px solid rgba(244,162,97,0.22)',
          borderRadius: 13,
          padding: '10px 13px',
          display: visibleStreak != null ? 'flex' : 'none',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 22 }}>🔥</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: 'var(--wardle-color-amber)',
            }}
          >
            {visibleStreak}-day streak
          </div>
          <div style={{ fontSize: 11, color: 'var(--wardle-color-gray)' }}>
            Keep it going!
          </div>
        </div>
        <button
          style={{
            background: 'rgba(244,162,97,0.15)',
            border: '1px solid rgba(244,162,97,0.3)',
            borderRadius: 8,
            padding: '4px 9px',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--wardle-color-amber)',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          🛡 Shield
        </button>
      </div>

      {false ? (
        // TODO: Re-enable after production-ready appearance/gameplay/premium systems ship.
        <div
        style={{
          margin: '10px 16px 0',
          background: 'rgba(26,60,94,0.55)',
          border: '1px solid rgba(244,162,97,0.3)',
          borderRadius: 16,
          padding: '14px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(244,162,97,0.15)',
            border: '1px solid rgba(244,162,97,0.3)',
            borderRadius: 20,
            padding: '3px 9px',
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--wardle-color-amber)',
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 7,
          }}
        >
          ★ Wardle Plus
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--wardle-color-mint)',
            marginBottom: 3,
          }}
        >
          Upgrade your diagnosis game
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--wardle-color-gray)',
            lineHeight: 1.45,
            marginBottom: 10,
          }}
        >
          Unlimited archive, specialty tracks, exam prep & analytics.
        </div>
        <button
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 10,
            border: 'none',
            background:
              'linear-gradient(135deg, var(--wardle-color-amber), #e8834a)',
            color: 'white',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Upgrade — KES 299/month →
        </button>
        </div>
      ) : null}
      <SettingsSectionLabel>Preferences</SettingsSectionLabel>
      <SettingsSection>
        {MENU_ITEMS.map((item, index) => (
          <SettingsRow
            key={item.id}
            icon={item.icon}
            iconBg={item.bg}
            label={item.label}
            sublabel={item.sub}
            onClick={() => onSelectScreen(item.id)}
            right={<SettingsChevronValue />}
            style={{
              borderBottom:
                index < MENU_ITEMS.length - 1
                  ? '1px solid rgba(255,255,255,0.04)'
                  : 'none',
            }}
          />
        ))}
      </SettingsSection>

      <div
        style={{
          textAlign: 'center',
          padding: '14px 20px 4px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 9,
          color: 'rgba(138,155,176,0.35)',
          letterSpacing: 1,
        }}
      >
        {SETTINGS_VERSION_LABEL}
      </div>
    </SettingsShell>
  )
}
