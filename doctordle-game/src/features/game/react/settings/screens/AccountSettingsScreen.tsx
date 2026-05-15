import { useState } from 'react'
import { DEFAULT_MOCK_PRIVACY_SETTINGS } from '../settings.constants'
import { SettingsActionRow, SettingsChevronValue } from '../components/SettingsActionRow'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import { SettingsRow } from '../components/SettingsRow'
import {
  SettingsSection,
  SettingsSectionLabel,
  SettingsSubHero,
} from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'
import { SettingsStatusBadge } from '../components/SettingsStatusBadge'
import { SettingsToggleRow } from '../components/SettingsToggleRow'

export function AccountSettingsScreen({
  onBack,
  onSignOut,
  organizationName,
}: {
  onBack: () => void
  onSignOut: () => void
  organizationName: string | null
}) {
  const [privacy, setPrivacy] = useState(DEFAULT_MOCK_PRIVACY_SETTINGS)

  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Account & Privacy" />
      <SettingsSubHero
        icon="👤"
        title="Account & privacy"
        desc="Wardle will never sell your data"
      />
      <SettingsSectionLabel>Account</SettingsSectionLabel>
      <SettingsSection>
        <SettingsRow
          icon="🎓"
          iconBg="rgba(52,199,89,0.12)"
          label="School verification"
          sublabel={
            organizationName
              ? `Verified · ${organizationName}`
              : 'No organization connected'
          }
          onClick={() => {}}
          right={
            <SettingsStatusBadge>
              {organizationName ? '✓ Verified' : 'Add school'}
            </SettingsStatusBadge>
          }
        />
        <SettingsActionRow
          icon="🔑"
          iconBg="rgba(26,60,94,0.55)"
          label="Change password"
          sublabel="Sent to your registered email"
          onClick={() => {}}
          style={{ borderBottom: 'none' }}
        />
      </SettingsSection>
      <SettingsSectionLabel>Privacy</SettingsSectionLabel>
      <SettingsSection>
        <SettingsToggleRow
          icon="👁"
          iconBg="rgba(0,180,166,0.15)"
          label="Public leaderboard profile"
          sublabel="Others can see your rank & streak"
          on={privacy.publicProfile}
          onToggle={() =>
            setPrivacy((current) => ({
              ...current,
              publicProfile: !current.publicProfile,
            }))
          }
        />
        <SettingsToggleRow
          icon="📈"
          iconBg="rgba(26,60,94,0.55)"
          label="Share anonymised data"
          sublabel="Help improve case difficulty"
          on={privacy.anonData}
          onToggle={() =>
            setPrivacy((current) => ({ ...current, anonData: !current.anonData }))
          }
        />
        <SettingsActionRow
          icon="📄"
          iconBg="rgba(26,60,94,0.55)"
          label="Privacy policy"
          sublabel="How we handle your data"
          onClick={() => {}}
          style={{ borderBottom: 'none' }}
        />
      </SettingsSection>
      <SettingsSectionLabel>Danger zone</SettingsSectionLabel>
      <SettingsSection>
        <SettingsRow
          icon="🚪"
          iconBg="rgba(26,60,94,0.55)"
          label="Sign out"
          sublabel="Your streak is safe — don't worry"
          onClick={onSignOut}
          right={<SettingsChevronValue />}
        />
        <SettingsRow
          icon="⛔"
          iconBg="rgba(224,92,92,0.12)"
          label="Delete account"
          sublabel="Permanent — streak will be lost"
          redLabel
          onClick={() => {}}
          right={<SettingsChevronValue color="#E05C5C" />}
          style={{ borderBottom: 'none' }}
        />
      </SettingsSection>
    </SettingsShell>
  )
}

