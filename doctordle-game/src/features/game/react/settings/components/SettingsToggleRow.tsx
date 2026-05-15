import { SettingsRow } from './SettingsRow'
import type { SettingsRowProps } from '../settings.types'

export function SettingsToggle({
  on,
  onToggle,
  disabled = false,
}: {
  on: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        padding: 0,
        border: 'none',
        background: on ? 'var(--wardle-color-teal)' : 'rgba(255,255,255,0.1)',
        cursor: disabled ? 'default' : 'pointer',
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

export function SettingsToggleRow({
  on,
  onToggle,
  disabled,
  ...rowProps
}: Omit<SettingsRowProps, 'right'> & {
  on: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <SettingsRow
      {...rowProps}
      right={
        <SettingsToggle on={on} onToggle={onToggle} disabled={disabled} />
      }
    />
  )
}
