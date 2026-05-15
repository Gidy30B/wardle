import { SettingsBackHeader } from '../components/SettingsBackHeader'
import { SettingsActionRow } from '../components/SettingsActionRow'
import {
  SettingsSection,
  SettingsSectionLabel,
  SettingsSubHero,
} from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'

export function LegalSettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Legal" />
      <SettingsSubHero
        icon="📄"
        title="Legal"
        desc="Policies and terms are placeholders until the production links are wired"
      />
      <SettingsSectionLabel>Documents</SettingsSectionLabel>
      <SettingsSection>
        <SettingsActionRow
          icon="📄"
          iconBg="rgba(26,60,94,0.55)"
          label="Privacy policy"
          sublabel="How we handle your data"
          onClick={() => {}}
        />
        <SettingsActionRow
          icon="⚖️"
          iconBg="rgba(26,60,94,0.55)"
          label="Terms of service"
          sublabel="Usage terms"
          onClick={() => {}}
          style={{ borderBottom: 'none' }}
        />
      </SettingsSection>
    </SettingsShell>
  )
}

