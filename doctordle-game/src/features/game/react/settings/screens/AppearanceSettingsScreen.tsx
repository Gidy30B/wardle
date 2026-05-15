import { useState } from 'react'
import { DEFAULT_MOCK_APPEARANCE_SETTINGS } from '../settings.constants'
import { SettingsBackHeader } from '../components/SettingsBackHeader'
import { SettingsRow } from '../components/SettingsRow'
import { SettingsSection, SettingsSubHero } from '../components/SettingsSection'
import { SettingsShell } from '../components/SettingsShell'
import { SettingsToggleRow } from '../components/SettingsToggleRow'

function SegControl({
  options,
  active,
  onChange,
}: {
  options: { value: string; label: string }[]
  active: string
  onChange: (value: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'rgba(26,60,94,0.45)',
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            flex: 1,
            padding: '5px 6px',
            borderRadius: 8,
            border: 'none',
            background:
              active === option.value ? 'var(--wardle-color-teal)' : 'transparent',
            color: active === option.value ? 'white' : 'var(--wardle-color-gray)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function AppearanceSettingsScreen({ onBack }: { onBack: () => void }) {
  const [appearance, setAppearance] = useState(DEFAULT_MOCK_APPEARANCE_SETTINGS)

  return (
    <SettingsShell>
      <SettingsBackHeader onBack={onBack} title="Appearance" />
      <SettingsSubHero
        icon="🌙"
        title="Appearance settings"
        desc="Make Wardle look exactly how you like it"
      />
      <SettingsSection>
        <SettingsRow
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
              active={appearance.theme}
              onChange={(theme) =>
                setAppearance((current) => ({
                  ...current,
                  theme: theme === 'light' ? 'light' : 'dark',
                }))
              }
            />
          }
        />
        <SettingsRow
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
              active={appearance.textSize}
              onChange={(textSize) =>
                setAppearance((current) => ({
                  ...current,
                  textSize:
                    textSize === 'S' || textSize === 'L' ? textSize : 'M',
                }))
              }
            />
          }
        />
        <SettingsToggleRow
          icon="✨"
          iconBg="rgba(140,100,210,0.15)"
          label="Tile animations"
          sublabel="Flip and reveal effects"
          on={appearance.animations}
          onToggle={() =>
            setAppearance((current) => ({
              ...current,
              animations: !current.animations,
            }))
          }
        />
        <SettingsToggleRow
          icon="👁"
          iconBg="rgba(52,199,89,0.12)"
          label="Colour-blind mode"
          sublabel="Alternative feedback colours"
          on={appearance.colorBlind}
          onToggle={() =>
            setAppearance((current) => ({
              ...current,
              colorBlind: !current.colorBlind,
            }))
          }
        />
        <SettingsToggleRow
          icon="📳"
          iconBg="rgba(26,60,94,0.55)"
          label="Haptic feedback"
          sublabel="Vibration on guess submit"
          on={appearance.haptics}
          onToggle={() =>
            setAppearance((current) => ({
              ...current,
              haptics: !current.haptics,
            }))
          }
          style={{ borderBottom: 'none' }}
        />
      </SettingsSection>
    </SettingsShell>
  )
}

