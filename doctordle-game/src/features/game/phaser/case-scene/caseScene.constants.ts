export const SCENE_KEY = 'case-scene'
export const LOGICAL_WIDTH = 390
export const LOGICAL_HEIGHT = 760
export const MAX_RENDER_DPR = 3
export const DEBUG_RENDER_AUDIT = import.meta.env.DEV
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
  bg: 0x1e1e2c,
  bgAccent: 0x1a3c5e,
  bgAccentSoft: 0x14283f,
  panel: 0x182235,
  panelSoft: 0x203049,
  panelMuted: 0x234e7a,
  border: 0x3a5067,
  borderSoft: 0x2a3a4f,
  text: '#eaf4f4',
  textMuted: '#8a9bb0',
  textQuiet: '#6f8097',
  shadow: 0x090d14,
  emerald: 0x00b4a6,
  emeraldSoft: 0x103a3b,
  emeraldGlow: 0x00c9ba,
  amber: 0xf4a261,
  amberSoft: 0x4b3221,
  rose: 0xe05c5c,
  roseSoft: 0x472128,
  sky: 0x234e7a,
  skySoft: 0x172b42,
  cyan: 0x00b4a6,
  cyanSoft: 0x13383b,
  orange: 0xf7ba85,
  orangeSoft: 0x4f3624,
  violet: 0xa9b9d0,
  violetSoft: 0x2a3445,
  ink: 0x141a27,
  inkLift: 0x20283a,
} as const

export const HEADER_HEART_FULL = '♥'
export const HEADER_HEART_EMPTY = '♥'
