import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../../../../lib/api'
import { updateUserSettingsApi } from '../../../../profile/profile.api'
import { useUserSettings } from '../../../../profile/useUserSettings'
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
import { PasswordSettingsPanel } from './PasswordSettingsPanel'

export function AccountSettingsScreen({
  onBack,
  onSignOut,
  organizationName,
}: {
  onBack: () => void
  onSignOut: () => void
  organizationName: string | null
}) {
  const { user } = useUser()
  const [showPasswordPanel, setShowPasswordPanel] = useState(false)
  const [anonData, setAnonData] = useState(DEFAULT_MOCK_PRIVACY_SETTINGS.anonData)
  const { request } = useApi()
  const queryClient = useQueryClient()
  const settingsQuery = useUserSettings()
  const leaderboardProfilePublic =
    settingsQuery.data?.leaderboardProfilePublic ?? true
  const settingsMutation = useMutation({
    mutationFn: async (leaderboardProfilePublic: boolean) =>
      updateUserSettingsApi(request, { leaderboardProfilePublic }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })

  if (showPasswordPanel) {
    return <PasswordSettingsPanel onBack={() => setShowPasswordPanel(false)} />
  }

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
          label={user?.passwordEnabled ? 'Change password' : 'Add password'}
          sublabel={
            user?.passwordEnabled
              ? 'Update your sign-in password'
              : 'Set a password for email + password sign-in'
          }
          onClick={() => setShowPasswordPanel(true)}
          style={{ borderBottom: 'none' }}
        />
      </SettingsSection>
      <SettingsSectionLabel>Privacy</SettingsSectionLabel>
      <SettingsSection>
        <SettingsToggleRow
          icon="👁"
          iconBg="rgba(0,180,166,0.15)"
          label="Show me on public leaderboards"
          sublabel="When off, your score still counts, but your name appears as Anonymous player."
          on={leaderboardProfilePublic}
          disabled={settingsQuery.isLoading || settingsMutation.isPending}
          onToggle={() =>
            settingsMutation.mutate(!leaderboardProfilePublic)
          }
        />
        <SettingsToggleRow
          icon="📈"
          iconBg="rgba(26,60,94,0.55)"
          label="Share anonymised data"
          sublabel="Help improve case difficulty"
          on={anonData}
          onToggle={() =>
            setAnonData((current) => !current)
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
