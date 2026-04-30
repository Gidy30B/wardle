import { useAuth, useUser } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import WardleLogo from '../../../components/brand/WardleLogo'
import { useApi } from '../../../lib/api'
import type { UserOrganizationMembership } from '../../organizations/organization.types'
import {
  getBackendProfileApi,
  getUserSettingsApi,
  updateUserSettingsApi,
} from '../../profile/profile.api'
import type { DifficultyPreference, UserSettings } from '../../profile/profile.types'

type SettingsPageProps = {
  currentStreak: number | null
  xpTotal: number | null
  organizationName: string | null
  memberships: UserOrganizationMembership[]
}

// ─── SHARED COMPONENTS ─────────────────────────────────────────
const DEFAULT_USER_SETTINGS: UserSettings = {
  showTimer: true,
  hintsEnabled: true,
  autocompleteEnabled: true,
  difficultyPreference: 'STANDARD',
  spacedRepetitionEnabled: false,
}

const DIFFICULTY_OPTIONS: Array<{ value: DifficultyPreference; label: string }> = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'HARD', label: 'Hard' },
  { value: 'EXPERT', label: 'Expert' },
]

const DIFFICULTY_LABELS: Record<DifficultyPreference, string> = {
  BEGINNER: 'Beginner',
  STANDARD: 'Standard',
  HARD: 'Hard',
  EXPERT: 'Expert',
}

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

function SettingsScrollFrame({
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

const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        padding: 0,
        border: 'none',
        background: on ? 'var(--wardle-color-teal)' : 'rgba(255,255,255,0.1)',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.25s',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          transform: on ? 'translateX(18px)' : 'translateX(0)',
        }}
      />
    </button>
  )
}

const SettingRow = ({
  icon,
  iconBg,
  label,
  sublabel,
  right,
  onClick,
  redLabel,
}: {
  icon: string
  iconBg: string
  label: string
  sublabel?: string
  right?: ReactNode
  onClick?: () => void
  redLabel?: boolean
}) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '13px 14px',
      gap: 12,
      cursor: onClick ? 'pointer' : 'default',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      transition: 'background 0.15s',
    }}
    onMouseEnter={(e) => {
      if (onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent'
    }}
  >
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        flexShrink: 0,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
      }}
    >
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: redLabel ? '#E05C5C' : 'var(--wardle-color-mint)',
        }}
      >
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: 11, color: 'var(--wardle-color-gray)', marginTop: 1 }}>
          {sublabel}
        </div>
      )}
    </div>
    {right}
  </div>
)

const SettingsGroup = ({ children }: { children: ReactNode }) => (
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

const SectionLabel = ({ children }: { children: ReactNode }) => (
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

const BackHeader = ({ onBack, title }: { onBack: () => void; title: string }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 20px 0',
    }}
  >
    <button
      onClick={onBack}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--wardle-color-teal)',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: 0,
      }}
    >
      ‹ Settings
    </button>
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--wardle-color-gray)',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
      }}
    >
      {title}
    </span>
  </div>
)

const SubHero = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
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
    <div style={{ fontSize: 12, color: 'var(--wardle-color-gray)', lineHeight: 1.5 }}>
      {desc}
    </div>
  </div>
)

const ChevronVal = ({ label, color }: { label?: string; color?: string }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 12,
      color: color || 'var(--wardle-color-gray)',
      whiteSpace: 'nowrap',
    }}
  >
    {label && <span>{label}</span>}
    <span style={{ fontSize: 14, color: 'rgba(138,155,176,0.45)' }}>›</span>
  </div>
)

const SegControl = ({
  options,
  active,
  onChange,
}: {
  options: { value: string; label: string }[]
  active: string
  onChange: (value: string) => void
}) => (
  <div
    style={{
      display: 'flex',
      background: 'rgba(26,60,94,0.45)',
      borderRadius: 10,
      padding: 3,
      gap: 2,
    }}
  >
    {options.map((o) => (
      <button
        key={o.value}
        onClick={() => onChange(o.value)}
        style={{
          flex: 1,
          padding: '5px 6px',
          borderRadius: 8,
          border: 'none',
          background: active === o.value ? 'var(--wardle-color-teal)' : 'transparent',
          color: active === o.value ? 'white' : 'var(--wardle-color-gray)',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
        }}
      >
        {o.label}
      </button>
    ))}
  </div>
)

// ─── SETTINGS SUB-SCREENS ─────────────────────────────────────────
const GameplaySettings = ({
  onBack,
  settings,
  saving,
  onUpdate,
}: {
  onBack: () => void
  settings: UserSettings
  saving: boolean
  onUpdate: (payload: Partial<UserSettings>) => void
}) => {
  const diffColors: Record<DifficultyPreference, string> = {
    BEGINNER: 'var(--wardle-color-gray)',
    STANDARD: 'var(--wardle-color-teal)',
    HARD: 'var(--wardle-color-amber)',
    EXPERT: '#E05C5C',
  }
  const cycleDiff = () => {
    const currentIndex = DIFFICULTY_OPTIONS.findIndex(
      (option) => option.value === settings.difficultyPreference,
    )
    const next = DIFFICULTY_OPTIONS[(currentIndex + 1) % DIFFICULTY_OPTIONS.length]
    onUpdate({ difficultyPreference: next.value })
  }
  return (
    <SettingsScrollFrame>
      <BackHeader onBack={onBack} title="Gameplay" />
      <SubHero icon="🎮" title="Gameplay settings" desc="Tune your daily case experience" />
      <SettingsGroup>
        <SettingRow
          icon="🎯"
          iconBg="rgba(0,180,166,0.15)"
          label="Difficulty"
          sublabel="Adjust case complexity"
          onClick={cycleDiff}
          right={
            <div style={{ fontSize: 12, color: diffColors[settings.difficultyPreference], fontWeight: 700, opacity: saving ? 0.68 : 1 }}>
              {DIFFICULTY_LABELS[settings.difficultyPreference]} ›
            </div>
          }
        />
        <SettingRow
          icon="⏰"
          iconBg="rgba(244,162,97,0.15)"
          label="Daily reminder"
          sublabel="Notification preference is coming later"
          right={<Toggle on={true} onToggle={() => {}} />}
        />
        <SettingRow
          icon="⏱"
          iconBg="rgba(26,60,94,0.55)"
          label="Show timer"
          sublabel="Elapsed time during play"
          right={<Toggle on={settings.showTimer} onToggle={() => onUpdate({ showTimer: !settings.showTimer })} />}
        />
        <SettingRow
          icon="💡"
          iconBg="rgba(244,162,97,0.15)"
          label="Hint system"
          sublabel="Allow hints during a case"
          right={<Toggle on={settings.hintsEnabled} onToggle={() => onUpdate({ hintsEnabled: !settings.hintsEnabled })} />}
        />
        <SettingRow
          icon="🔍"
          iconBg="rgba(0,180,166,0.15)"
          label="Diagnosis autocomplete"
          sublabel="Suggestions as you type"
          right={<Toggle on={settings.autocompleteEnabled} onToggle={() => onUpdate({ autocompleteEnabled: !settings.autocompleteEnabled })} />}
        />
        <div style={{ borderBottom: 'none' }}>
          <SettingRow
            icon="🧠"
            iconBg="rgba(140,100,210,0.15)"
            label="Spaced repetition"
            sublabel="Resurface cases you've missed"
            right={<Toggle on={settings.spacedRepetitionEnabled} onToggle={() => onUpdate({ spacedRepetitionEnabled: !settings.spacedRepetitionEnabled })} />}
          />
        </div>
      </SettingsGroup>
    </SettingsScrollFrame>
  )
}

const NotificationSettings = ({ onBack }: { onBack: () => void }) => {
  const [notifs, setNotifs] = useState({
    push: true,
    streak: true,
    digest: true,
    challenge: false,
    announcements: true,
  })
  const tog = (key: string) =>
    setNotifs((p) => ({ ...p, [key]: !p[key as keyof typeof notifs] }))
  return (
    <SettingsScrollFrame>
      <BackHeader onBack={onBack} title="Notifications" />
      <SubHero icon="🔔" title="Notification settings" desc="Control when and how Wardle reaches you" />
      <SettingsGroup>
        <SettingRow
          icon="📲"
          iconBg="rgba(0,180,166,0.15)"
          label="Push notifications"
          sublabel="Streak alerts & leaderboard moves"
          right={<Toggle on={notifs.push} onToggle={() => tog('push')} />}
        />
        <SettingRow
          icon="🔥"
          iconBg="rgba(244,162,97,0.15)"
          label="Streak reminders"
          sublabel="Alert before midnight if not played"
          right={<Toggle on={notifs.streak} onToggle={() => tog('streak')} />}
        />
        <SettingRow
          icon="🏆"
          iconBg="rgba(244,162,97,0.15)"
          label="Weekly leaderboard digest"
          sublabel="Your rank summary every Monday at 9 AM"
          right={<Toggle on={notifs.digest} onToggle={() => tog('digest')} />}
        />
        <SettingRow
          icon="⚔️"
          iconBg="rgba(140,100,210,0.15)"
          label="Challenge alerts"
          sublabel="When a friend challenges you"
          right={<Toggle on={notifs.challenge} onToggle={() => tog('challenge')} />}
        />
        <div style={{ borderBottom: 'none' }}>
          <SettingRow
            icon="📣"
            iconBg="rgba(26,60,94,0.55)"
            label="Product announcements"
            sublabel="New features & case packs"
            right={<Toggle on={notifs.announcements} onToggle={() => tog('announcements')} />}
          />
        </div>
      </SettingsGroup>
    </SettingsScrollFrame>
  )
}

const AppearanceSettings = ({ onBack }: { onBack: () => void }) => {
  const [appear, setAppear] = useState({
    theme: 'dark',
    textSize: 'M',
    animations: true,
    colorBlind: false,
    haptics: true,
  })
  return (
    <SettingsScrollFrame>
      <BackHeader onBack={onBack} title="Appearance" />
      <SubHero icon="🌙" title="Appearance settings" desc="Make Wardle look exactly how you like it" />
      <SettingsGroup>
        <SettingRow
          icon="🌙"
          iconBg="rgba(26,60,94,0.55)"
          label="Theme"
          sublabel="Dark is default for night owls"
          right={
            <SegControl
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
              active={appear.theme}
              onChange={(v) => setAppear((p) => ({ ...p, theme: v }))}
            />
          }
        />
        <SettingRow
          icon="Aa"
          iconBg="rgba(0,180,166,0.15)"
          label="Text size"
          sublabel="For clue readability"
          right={
            <SegControl
              options={[
                { value: 'S', label: 'S' },
                { value: 'M', label: 'M' },
                { value: 'L', label: 'L' },
              ]}
              active={appear.textSize}
              onChange={(v) => setAppear((p) => ({ ...p, textSize: v }))}
            />
          }
        />
        <SettingRow
          icon="✨"
          iconBg="rgba(140,100,210,0.15)"
          label="Tile animations"
          sublabel="Flip and reveal effects"
          right={<Toggle on={appear.animations} onToggle={() => setAppear((p) => ({ ...p, animations: !p.animations }))} />}
        />
        <SettingRow
          icon="👁"
          iconBg="rgba(52,199,89,0.12)"
          label="Colour-blind mode"
          sublabel="Alternative feedback colours"
          right={<Toggle on={appear.colorBlind} onToggle={() => setAppear((p) => ({ ...p, colorBlind: !p.colorBlind }))} />}
        />
        <div style={{ borderBottom: 'none' }}>
          <SettingRow
            icon="📳"
            iconBg="rgba(26,60,94,0.55)"
            label="Haptic feedback"
            sublabel="Vibration on guess submit"
            right={<Toggle on={appear.haptics} onToggle={() => setAppear((p) => ({ ...p, haptics: !p.haptics }))} />}
          />
        </div>
      </SettingsGroup>
    </SettingsScrollFrame>
  )
}

const StatsSettings = ({
  onBack,
  currentStreak,
  xpTotal,
}: {
  onBack: () => void
  currentStreak: number | null
  xpTotal: number | null
}) => {
  const stats = [
    { v: xpTotal != null ? String(xpTotal) : '--', l: 'Total XP', color: 'var(--wardle-color-teal)' },
    { v: `🔥 ${currentStreak ?? 0}`, l: 'Day streak', color: 'var(--wardle-color-amber)' },
  ]
  return (
    <SettingsScrollFrame>
      <BackHeader onBack={onBack} title="Learning & Stats" />
      <SubHero icon="📊" title="Your learning stats" desc="Track your diagnostic growth over time" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '0 16px 4px' }}>
        {stats.map((s) => (
          <div
            key={s.l}
            style={{
              background: 'rgba(26,60,94,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.v}</div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--wardle-color-gray)',
                marginTop: 3,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              {s.l}
            </div>
          </div>
        ))}
      </div>
      <SectionLabel>Detail</SectionLabel>
      <SettingsGroup>
        <SettingRow
          icon="📈"
          iconBg="rgba(0,180,166,0.15)"
          label="Performance report"
          sublabel="Accuracy by specialty & over time"
          onClick={() => {}}
          right={<ChevronVal />}
        />
        <SettingRow
          icon="🏅"
          iconBg="rgba(244,162,97,0.15)"
          label="Specialty badges"
          sublabel="4 earned · 11 remaining"
          onClick={() => {}}
          right={<ChevronVal />}
        />
        <div style={{ borderBottom: 'none' }}>
          <SettingRow
            icon="📋"
            iconBg="rgba(26,60,94,0.55)"
            label="Case history"
            sublabel="All 147 cases you've played"
            onClick={() => {}}
            right={<ChevronVal />}
          />
        </div>
      </SettingsGroup>
    </SettingsScrollFrame>
  )
}

const AccountSettings = ({
  onBack,
  onSignOut,
  organizationName,
}: {
  onBack: () => void
  onSignOut: () => void
  organizationName: string | null
}) => {
  const [privacy, setPrivacy] = useState({ publicProfile: true, anonData: true })
  return (
    <SettingsScrollFrame>
      <BackHeader onBack={onBack} title="Account & Privacy" />
      <SubHero icon="👤" title="Account & privacy" desc="Wardle will never sell your data" />
      <SectionLabel>Account</SectionLabel>
      <SettingsGroup>
        <SettingRow
          icon="🎓"
          iconBg="rgba(52,199,89,0.12)"
          label="School verification"
          sublabel={organizationName ? `Verified · ${organizationName}` : 'No organization connected'}
          onClick={() => {}}
          right={<div style={{ fontSize: 12, color: 'var(--wardle-color-teal)', fontWeight: 700 }}>{organizationName ? '✓ Verified' : 'Add school'}</div>}
        />
        <div style={{ borderBottom: 'none' }}>
          <SettingRow
            icon="🔑"
            iconBg="rgba(26,60,94,0.55)"
            label="Change password"
            sublabel="Sent to your registered email"
            onClick={() => {}}
            right={<ChevronVal />}
          />
        </div>
      </SettingsGroup>
      <SectionLabel>Privacy</SectionLabel>
      <SettingsGroup>
        <SettingRow
          icon="👁"
          iconBg="rgba(0,180,166,0.15)"
          label="Public leaderboard profile"
          sublabel="Others can see your rank & streak"
          right={<Toggle on={privacy.publicProfile} onToggle={() => setPrivacy((p) => ({ ...p, publicProfile: !p.publicProfile }))} />}
        />
        <SettingRow
          icon="📈"
          iconBg="rgba(26,60,94,0.55)"
          label="Share anonymised data"
          sublabel="Help improve case difficulty"
          right={<Toggle on={privacy.anonData} onToggle={() => setPrivacy((p) => ({ ...p, anonData: !p.anonData }))} />}
        />
        <div style={{ borderBottom: 'none' }}>
          <SettingRow
            icon="📄"
            iconBg="rgba(26,60,94,0.55)"
            label="Privacy policy"
            sublabel="How we handle your data"
            onClick={() => {}}
            right={<ChevronVal />}
          />
        </div>
      </SettingsGroup>
      <SectionLabel>Danger zone</SectionLabel>
      <SettingsGroup>
        <SettingRow
          icon="🚪"
          iconBg="rgba(26,60,94,0.55)"
          label="Sign out"
          sublabel="Your streak is safe — don't worry"
          onClick={onSignOut}
          right={<ChevronVal />}
        />
        <div style={{ borderBottom: 'none' }}>
          <SettingRow
            icon="⛔"
            iconBg="rgba(224,92,92,0.12)"
            label="Delete account"
            sublabel="Permanent — streak will be lost"
            redLabel
            onClick={() => {}}
            right={<ChevronVal color="#E05C5C" />}
          />
        </div>
      </SettingsGroup>
    </SettingsScrollFrame>
  )
}

// ─── SETTINGS MAIN SCREEN ─────────────────────────────────────────
export default function SettingsPage({
  currentStreak,
  xpTotal,
  organizationName,
  memberships,
}: SettingsPageProps) {
  const { isLoaded, isSignedIn, signOut } = useAuth()
  const { user } = useUser()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const [subScreen, setSubScreen] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => getBackendProfileApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  const settingsQuery = useQuery({
    queryKey: ['settings', 'me'],
    queryFn: async () => getUserSettingsApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  const settingsMutation = useMutation({
    mutationFn: async (payload: Partial<UserSettings>) =>
      updateUserSettingsApi(request, payload),
    onSuccess: (settings) => {
      queryClient.setQueryData(['settings', 'me'], settings)
    },
  })

  const backendProfile = profileQuery.data
  const settings = settingsQuery.data ?? DEFAULT_USER_SETTINGS

  const fallbackDisplayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ??
    'Wardle clinician'

  const displayName = backendProfile?.displayName?.trim() || fallbackDisplayName
  const trainingLevel = backendProfile?.trainingLevel?.trim() || null
  const membershipLabel =
    memberships.length > 0
      ? `${memberships.length} organization${memberships.length === 1 ? '' : 's'}`
      : 'Individual'

  // Sub-screen renderers
  if (subScreen === 'gameplay')
    return (
      <GameplaySettings
        onBack={() => setSubScreen(null)}
        settings={settings}
        saving={settingsMutation.isPending}
        onUpdate={(payload) => settingsMutation.mutate(payload)}
      />
    )
  if (subScreen === 'notifications') return <NotificationSettings onBack={() => setSubScreen(null)} />
  if (subScreen === 'appearance') return <AppearanceSettings onBack={() => setSubScreen(null)} />
  if (subScreen === 'stats')
    return (
      <StatsSettings
        onBack={() => setSubScreen(null)}
        currentStreak={currentStreak}
        xpTotal={xpTotal}
      />
    )
  if (subScreen === 'account')
    return (
      <AccountSettings
        onBack={() => setSubScreen(null)}
        onSignOut={() => void signOut()}
        organizationName={organizationName}
      />
    )

  const menuItems = [
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
      icon: '📊',
      bg: 'rgba(140,100,210,0.15)',
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
  ]

  return (
    <SettingsScrollFrame contentStyle={{
      paddingLeft: 'var(--px-1)',
      paddingRight: 'var(--px-1)',
      paddingTop: 'var(--pt-1)',
    }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px 0',
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

      {/* Profile card */}
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
            background: 'linear-gradient(135deg, var(--wardle-color-teal), var(--wardle-color-navy))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 800,
            color: 'white',
            position: 'relative',
          }}
        >
          {displayName.charAt(0).toUpperCase()}
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
            {displayName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--wardle-color-gray)',
              marginTop: 1,
            }}
          >
            {organizationName ?? membershipLabel} · {trainingLevel ?? 'Training level unset'}
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

      {/* Streak bar */}
      <div
        style={{
          margin: '10px 16px 0',
          background: 'rgba(244,162,97,0.08)',
          border: '1px solid rgba(244,162,97,0.22)',
          borderRadius: 13,
          padding: '10px 13px',
          display: 'flex',
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
            {currentStreak ?? 0}-day streak
          </div>
          <div style={{ fontSize: 11, color: 'var(--wardle-color-gray)' }}>Keep it going!</div>
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

      {/* Wardle Plus card */}
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
            background: 'linear-gradient(135deg, var(--wardle-color-amber), #e8834a)',
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

      {/* Menu items */}
      <SectionLabel>Preferences</SectionLabel>
      <SettingsGroup>
        {menuItems.map((item, i) => (
          <div
            key={item.id}
            style={{
              borderBottom: i < menuItems.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <SettingRow
              icon={item.icon}
              iconBg={item.bg}
              label={item.label}
              sublabel={item.sub}
              onClick={() => setSubScreen(item.id)}
              right={<ChevronVal />}
            />
          </div>
        ))}
      </SettingsGroup>

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
        WARDLE v1.0.3 · BUILD 2026.04
      </div>
    </SettingsScrollFrame>
  )
}
