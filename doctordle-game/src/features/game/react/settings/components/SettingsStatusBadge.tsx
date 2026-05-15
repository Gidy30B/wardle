export function SettingsStatusBadge({
  children,
  color = 'var(--wardle-color-teal)',
}: {
  children: string
  color?: string
}) {
  return (
    <div style={{ fontSize: 12, color, fontWeight: 700 }}>
      {children}
    </div>
  )
}

