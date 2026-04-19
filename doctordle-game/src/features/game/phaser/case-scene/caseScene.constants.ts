export const SCENE_KEY = 'case-scene'
export const LOGICAL_WIDTH = 390
export const LOGICAL_HEIGHT = 760
export const MAX_RENDER_DPR = 3
export const DEBUG_RENDER_AUDIT = true
export const DEBUG_RENDER_OVERLAY = false
export const FRACTIONAL_EPSILON = 0.001
export const LAB_MOTE_TEXTURE = 'diagnosis-lab-mote'
export const LAB_DNA_TEXTURE = 'diagnosis-lab-dna'
export const ONBOARDING_SEEN_STORAGE_KEY = 'wardle:onboarding-demo-seen'
export const ONBOARDING_FORCE_STORAGE_KEY = 'wardle:force-onboarding-demo'
export const ONBOARDING_DEMO_CLUE = 'Shortness of breath and wheezing'
export const ONBOARDING_GHOST_GUESS = 'ASTHMA'

export const DEPTH = {
  BACKDROP: 0,
  BOARD: 10,
  FEEDBACK: 20,
  OVERLAY: 30,
  STATE: 40,
  DEBUG: 1000,
} as const

export const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
] as const

export const COLORS = {
  bg: 0x04070d,
  bgAccent: 0x0d1727,
  bgAccentSoft: 0x08111d,
  panel: 0x0b1220,
  panelSoft: 0x111b2b,
  panelMuted: 0x172236,
  border: 0x223048,
  borderSoft: 0x1b2639,
  text: '#f8fafc',
  textMuted: '#8fa2bc',
  textQuiet: '#64748b',
  shadow: 0x020617,
  emerald: 0x10b981,
  emeraldSoft: 0x0f2f2a,
  emeraldGlow: 0x1fc98a,
  amber: 0xf59e0b,
  amberSoft: 0x3d2b0d,
  rose: 0xfb7185,
  roseSoft: 0x3a111d,
  sky: 0x38bdf8,
  skySoft: 0x102338,
  cyan: 0x22d3ee,
  cyanSoft: 0x0c2430,
  orange: 0xf97316,
  orangeSoft: 0x39200f,
  violet: 0xa78bfa,
  violetSoft: 0x20183c,
  ink: 0x0a101b,
  inkLift: 0x121d30,
} as const

export const HEADER_HEART_FULL = '♥'
export const HEADER_HEART_EMPTY = '♥'
