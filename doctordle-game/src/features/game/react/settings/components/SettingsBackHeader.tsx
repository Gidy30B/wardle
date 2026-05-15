export function SettingsBackHeader({
  onBack,
  title,
}: {
  onBack: () => void
  title: string
}) {
  return (
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
}

