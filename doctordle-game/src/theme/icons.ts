export const APP_ICONS = {
  play: '\u{1FA7A}',
  learn: '\u{1F4DA}',
  rank: '\u{1F3C6}',
  streak: '\u{1F525}',
  accuracy: '\u{1F3AF}',
  time: '\u23F1',
  clues: '\u{1F50D}',
  settings: '\u2699\uFE0F',
} as const

export type AppIconKey = keyof typeof APP_ICONS
export type AppIconSet = typeof APP_ICONS
