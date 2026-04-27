export const wardleColors = {
  navy: '#1A3C5E',
  navyLight: '#234e7a',
  teal: '#00B4A6',
  tealDark: '#009A8E',
  tealLight: '#00C9BA',
  amber: '#F4A261',
  amberLight: '#F7BA85',
  mint: '#EAF4F4',
  mintDark: '#D4ECEC',
  charcoal: '#1E1E2C',
  white: '#FFFFFF',
  red: '#E05C5C',
  gray: '#8A9BB0',
  grayLight: '#C8D6E5',
} as const

export const wardleTypography = {
  sans: "'DM Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  display: "'DM Sans', system-ui, sans-serif",
} as const

export const wardleSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const

export const wardleRadii = {
  sm: 12,
  md: 14,
  lg: 20,
  xl: 24,
  '2xl': 28,
} as const

export const wardleShadows = {
  frame: '0 40px 80px rgba(0,0,0,0.35)',
  card: '0 24px 60px rgba(0,0,0,0.24)',
  glow: '0 0 40px rgba(0,180,166,0.12)',
} as const

export const wardleGradients = {
  primary: `linear-gradient(135deg, ${wardleColors.teal}, ${wardleColors.tealDark})`,
  amber: `linear-gradient(135deg, ${wardleColors.amber}, #e8834a)`,
  panel: `linear-gradient(180deg, rgba(26,60,94,0.28), rgba(30,30,44,0.9))`,
  shell: `radial-gradient(circle at top, rgba(0,180,166,0.16), transparent 34%), linear-gradient(180deg, #08111b 0%, #0d1824 52%, #070d16 100%)`,
} as const

export type WardleButtonVariant = 'primary' | 'secondary' | 'amber' | 'ghost'
