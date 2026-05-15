import { SettingsRow } from './SettingsRow'
import type { SettingsRowProps } from '../settings.types'

export function SettingsChevronValue({
  label,
  color,
}: {
  label?: string
  color?: string
}) {
  return (
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
      {label ? <span>{label}</span> : null}
      <span style={{ fontSize: 14, color: 'rgba(138,155,176,0.45)' }}>›</span>
    </div>
  )
}

export function SettingsActionRow({
  chevronLabel,
  chevronColor,
  ...rowProps
}: Omit<SettingsRowProps, 'right'> & {
  chevronLabel?: string
  chevronColor?: string
}) {
  return (
    <SettingsRow
      {...rowProps}
      right={<SettingsChevronValue label={chevronLabel} color={chevronColor} />}
    />
  )
}

