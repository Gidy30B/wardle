import type { SettingsRowProps } from '../settings.types'

export function SettingsRow({
  icon,
  iconBg,
  label,
  sublabel,
  right,
  onClick,
  redLabel,
  style,
}: SettingsRowProps) {
  return (
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
        ...style,
      }}
      onMouseEnter={(event) => {
        if (onClick) {
          event.currentTarget.style.background = 'rgba(255,255,255,0.03)'
        }
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent'
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
        {sublabel ? (
          <div
            style={{
              fontSize: 11,
              color: 'var(--wardle-color-gray)',
              marginTop: 1,
            }}
          >
            {sublabel}
          </div>
        ) : null}
      </div>
      {right}
    </div>
  )
}

