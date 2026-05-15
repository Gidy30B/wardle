import type { UserSettings } from '../../../../profile/profile.types'
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
} from '../settings.constants'
import type { SettingsUpdateHandler } from '../settings.types'
import { getNextDifficultyPreference } from '../settings.utils'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import { SettingsRow } from '../components/SettingsRow'
import { SettingsSection, SettingsSubHero } from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'
import { SettingsToggleRow } from '../components/SettingsToggleRow'

export function GameplaySettingsScreen({
  onBack,
  settings,
  saving,
  onUpdate,
}: {
  onBack: () => void
  settings: UserSettings
  saving: boolean
  onUpdate: SettingsUpdateHandler
}) {
  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Gameplay" />
      <SettingsSubHero
        icon="🎮"
        title="Gameplay settings"
        desc="Tune your daily case experience"
      />
      <SettingsSection>
        <SettingsRow
          icon="🎯"
          iconBg="rgba(0,180,166,0.15)"
          label="Difficulty"
          sublabel="Adjust case complexity"
          onClick={() =>
            onUpdate({
              difficultyPreference: getNextDifficultyPreference(
                settings.difficultyPreference,
              ),
            })
          }
          right={
            <div
              style={{
                fontSize: 12,
                color: DIFFICULTY_COLORS[settings.difficultyPreference],
                fontWeight: 700,
                opacity: saving ? 0.68 : 1,
              }}
            >
              {DIFFICULTY_LABELS[settings.difficultyPreference]} ›
            </div>
          }
        />
        <SettingsToggleRow
          icon="⏰"
          iconBg="rgba(244,162,97,0.15)"
          label="Daily reminder"
          sublabel="Notification preference is coming later"
          on={true}
          onToggle={() => {}}
        />
        <SettingsToggleRow
          icon="⏱"
          iconBg="rgba(26,60,94,0.55)"
          label="Show timer"
          sublabel="Elapsed time during play"
          on={settings.showTimer}
          onToggle={() => onUpdate({ showTimer: !settings.showTimer })}
        />
        <SettingsToggleRow
          icon="💡"
          iconBg="rgba(244,162,97,0.15)"
          label="Hint system"
          sublabel="Allow hints during a case"
          on={settings.hintsEnabled}
          onToggle={() => onUpdate({ hintsEnabled: !settings.hintsEnabled })}
        />
        <SettingsToggleRow
          icon="🔍"
          iconBg="rgba(0,180,166,0.15)"
          label="Diagnosis autocomplete"
          sublabel="Suggestions as you type"
          on={settings.autocompleteEnabled}
          onToggle={() =>
            onUpdate({ autocompleteEnabled: !settings.autocompleteEnabled })
          }
        />
        <SettingsToggleRow
          icon="🧠"
          iconBg="rgba(140,100,210,0.15)"
          label="Spaced repetition"
          sublabel="Resurface cases you've missed"
          on={settings.spacedRepetitionEnabled}
          onToggle={() =>
            onUpdate({
              spacedRepetitionEnabled: !settings.spacedRepetitionEnabled,
            })
          }
          style={{ borderBottom: 'none' }}
        />
      </SettingsSection>
    </SettingsShell>
  )
}

