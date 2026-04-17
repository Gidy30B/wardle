import Phaser from 'phaser'
import type { PhaserGameSessionIntents, PhaserGameSessionSnapshot, PhaserVisibleClue } from './gameSessionBridge'

const SCENE_KEY = 'case-scene'
const LOGICAL_WIDTH = 390
const LOGICAL_HEIGHT = 760
const MAX_RENDER_DPR = 3
export const DEBUG_RENDER_AUDIT = true
const DEBUG_RENDER_OVERLAY = false
const FRACTIONAL_EPSILON = 0.001
const LAB_MOTE_TEXTURE = 'diagnosis-lab-mote'
const LAB_DNA_TEXTURE = 'diagnosis-lab-dna'

const DEPTH = {
  BACKDROP: 0,
  BOARD: 10,
  FEEDBACK: 20,
  OVERLAY: 30,
  STATE: 40,
  DEBUG: 1000,
} as const

type LayoutRect = {
  x: number
  y: number
  width: number
  height: number
}

type LayoutMetrics = {
  board: LayoutRect
  insets: {
    top: number
    right: number
    bottom: number
    left: number
  }
  header: LayoutRect
  clues: LayoutRect & {
    captionX: number
    captionY: number
    cardInset: number
    maskInset: number
    stackBottomInset: number
    minTopInset: number
    ageShiftX: number
    stepMin: number
    stepMax: number
  }
  feedback: {
    x: number
    y: number
    width: number
    height: number
    baselineOffset: number
  }
  guessBar: LayoutRect & {
    haloInset: number
    labelY: number
    valueY: number
    helperBottomInset: number
    textInset: number
  }
  actions: LayoutRect & {
    gap: number
    clearWidth: number
    submitWidth: number
    backspaceWidth: number
  }
  keyboard: LayoutRect & {
    rowTop: number
    rowGap: number
    keyGap: number
    sideInset: number
    keyHeight: number
    spaceWidth: number
    spaceTopGap: number
  }
  overlay: LayoutRect & {
    padding: number
    accentHeight: number
    buttonWidth: number
    buttonHeight: number
    buttonBottomInset: number
    entryOffset: number
    shadowOffset: number
  }
  statePanel: LayoutRect & {
    padding: number
    bodyY: number
    actionWidth: number
    actionHeight: number
    actionBottomInset: number
  }
  typography: {
    headerProgress: number
    headerStatus: number
    clueCaption: number
    clueEmpty: number
    clueType: number
    clueValue: number
    guessLabel: number
    guessValue: number
    guessHelper: number
    keyLabel: number
    actionLabel: number
    feedback: number
    overlayEyebrow: number
    overlayTitle: number
    overlayDiagnosis: number
    overlayHelper: number
    stateEyebrow: number
    stateTitle: number
    stateBody: number
  }
}

function getLayoutMetrics(width: number, height: number): LayoutMetrics {
  const toPx = (value: number) => Math.max(1, Math.round(value))
  const canvasWidth = Math.max(1, width)
  const canvasHeight = Math.max(1, height)
  const fit = Math.min(canvasWidth / LOGICAL_WIDTH, canvasHeight / LOGICAL_HEIGHT)
  const boardWidth = toPx(LOGICAL_WIDTH * fit)
  const boardHeight = toPx(LOGICAL_HEIGHT * fit)
  const boardX = Math.round((canvasWidth - boardWidth) / 2)
  const boardY = Math.round((canvasHeight - boardHeight) / 2)
  const scaleX = boardWidth / LOGICAL_WIDTH
  const scaleY = boardHeight / LOGICAL_HEIGHT
  const textScale = Phaser.Math.Clamp(fit, 0.84, 1.24)
  const horizontalGutter = toPx(Phaser.Math.Clamp(boardWidth * 0.022, 8, 10))
  const topInset = toPx(Phaser.Math.Clamp(boardHeight * 0.016, 10, 14))
  const bottomInset = toPx(Phaser.Math.Clamp(boardHeight * 0.016, 10, 14))
  const headerHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.052, 34, 40))
  const headerGap = toPx(Phaser.Math.Clamp(boardHeight * 0.012, 8, 9))
  const sectionGap = toPx(Phaser.Math.Clamp(boardHeight * 0.009, 6, 7))
  const boardInnerWidth = Math.max(1, boardWidth - horizontalGutter * 2)
  const keyboardHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.336, 232, 254))
  const guessHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.112, 78, 88))
  const keyboardY = boardY + boardHeight - bottomInset - keyboardHeight
  const guessY = keyboardY - sectionGap - guessHeight
  const headerY = boardY + topInset
  const cluesY = headerY + headerHeight + headerGap
  const cluesHeight = Math.max(toPx(boardHeight * 0.30), guessY - sectionGap - cluesY)
  const keyboardSideInset = toPx(Phaser.Math.Clamp(boardWidth * 0.012, 4, 5))
  const keyGap = toPx(Phaser.Math.Clamp(boardWidth * 0.007, 2, 2))
  const keyHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.057, 39, 43))
  const actionGap = toPx(Phaser.Math.Clamp(boardWidth * 0.016, 5, 7))
  const actionHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.055, 39, 43))
  const actionTopInset = toPx(Phaser.Math.Clamp(boardHeight * 0.0035, 2, 3))
  const actionKeyboardGap = toPx(Phaser.Math.Clamp(boardHeight * 0.009, 6, 8))
  const actionWidth = Math.max(1, boardInnerWidth - keyboardSideInset * 2)
  const clearWidth = toPx(actionWidth * (88 / 334))
  const submitWidth = toPx(actionWidth * (150 / 334))
  const backspaceWidth = Math.max(toPx(46 * scaleX), actionWidth - clearWidth - submitWidth - actionGap * 2)
  const rowTop = actionTopInset + actionHeight + actionKeyboardGap
  const rowGap = toPx(Phaser.Math.Clamp(boardHeight * 0.003, 2, 2))
  const spaceTopGap = toPx(Phaser.Math.Clamp(boardHeight * 0.004, 2, 3))
  const spaceWidth = toPx(
    Math.min(
      boardInnerWidth - keyboardSideInset * 2,
      Phaser.Math.Clamp(boardWidth * 0.59, 210, 232),
    ),
  )
  const overlayWidth = boardInnerWidth
  const overlayHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.268, 196, 212))
  const overlayPadding = toPx(Phaser.Math.Clamp(boardWidth * 0.041, 14, 16))
  const overlayButtonGap = toPx(Phaser.Math.Clamp(boardWidth * 0.021, 8, 10))
  const overlayButtonWidth = Math.max(92, Math.floor((overlayWidth - overlayPadding * 2 - overlayButtonGap) / 2))
  const statePanelWidth = Math.max(1, boardInnerWidth - toPx(Phaser.Math.Clamp(boardWidth * 0.02, 6, 8)))
  const statePanelHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.31, 220, 238))
  const statePanelY = boardY + Math.round((boardHeight - statePanelHeight) / 2) - toPx(Phaser.Math.Clamp(boardHeight * 0.02, 8, 14))

  const header = {
    x: boardX + horizontalGutter,
    y: headerY,
    width: boardInnerWidth,
    height: headerHeight,
  }

  const clues = {
    x: boardX + horizontalGutter,
    y: cluesY,
    width: boardInnerWidth,
    height: cluesHeight,
  }

  const guessBar = {
    x: boardX + horizontalGutter,
    y: guessY,
    width: boardInnerWidth,
    height: guessHeight,
  }

  const keyboard = {
    x: boardX + horizontalGutter,
    y: keyboardY,
    width: boardInnerWidth,
    height: keyboardHeight,
  }

  return {
    board: {
      x: boardX,
      y: boardY,
      width: boardWidth,
      height: boardHeight,
    },
    insets: {
      top: topInset,
      right: horizontalGutter,
      bottom: bottomInset,
      left: horizontalGutter,
    },
    header,
    clues: {
      ...clues,
      captionX: toPx(Phaser.Math.Clamp(boardWidth * 0.024, 8, 10)),
      captionY: toPx(Phaser.Math.Clamp(boardHeight * 0.011, 7, 9)),
      cardInset: toPx(Phaser.Math.Clamp(boardWidth * 0.02, 7, 9)),
      maskInset: toPx(Phaser.Math.Clamp(boardWidth * 0.008, 2, 3)),
      stackBottomInset: toPx(Phaser.Math.Clamp(boardHeight * 0.018, 12, 14)),
      minTopInset: toPx(Phaser.Math.Clamp(boardHeight * 0.032, 22, 24)),
      ageShiftX: toPx(Phaser.Math.Clamp(boardWidth * 0.017, 6, 7)),
      stepMin: toPx(Phaser.Math.Clamp(boardHeight * 0.021, 14, 16)),
      stepMax: toPx(Phaser.Math.Clamp(boardHeight * 0.034, 22, 26)),
    },
    feedback: {
      x: boardX + Math.round(boardWidth / 2),
      y: guessY - toPx(Phaser.Math.Clamp(boardHeight * 0.014, 8, 10)),
      width: toPx(Phaser.Math.Clamp(boardWidth * 0.31, 112, 122)),
      height: toPx(Phaser.Math.Clamp(boardHeight * 0.038, 26, 30)),
      baselineOffset: toPx(Phaser.Math.Clamp(boardHeight * 0.008, 5, 6)),
    },
    guessBar: {
      ...guessBar,
      haloInset: toPx(Phaser.Math.Clamp(Math.min(scaleX, scaleY) * 4, 3, 4)),
      labelY: toPx(Phaser.Math.Clamp(boardHeight * 0.012, 7, 9)),
      valueY: toPx(Phaser.Math.Clamp(boardHeight * 0.028, 18, 22)),
      helperBottomInset: toPx(Phaser.Math.Clamp(boardHeight * 0.007, 4, 5)),
      textInset: toPx(Phaser.Math.Clamp(boardWidth * 0.043, 15, 17)),
    },
    actions: {
      x: keyboard.x + keyboardSideInset,
      y: keyboard.y + actionTopInset,
      width: actionWidth,
      height: actionHeight,
      gap: actionGap,
      clearWidth,
      submitWidth,
      backspaceWidth,
    },
    keyboard: {
      ...keyboard,
      rowTop,
      rowGap,
      keyGap,
      sideInset: keyboardSideInset,
      keyHeight,
      spaceWidth,
      spaceTopGap,
    },
    overlay: {
      x: boardX + horizontalGutter,
      y: boardY + boardHeight - bottomInset - overlayHeight - toPx(Phaser.Math.Clamp(boardHeight * 0.072, 24, 32)),
      width: overlayWidth,
      height: overlayHeight,
      padding: overlayPadding,
      accentHeight: toPx(Phaser.Math.Clamp(boardHeight * 0.0055, 3, 4)),
      buttonWidth: overlayButtonWidth,
      buttonHeight: toPx(Phaser.Math.Clamp(boardHeight * 0.047, 34, 36)),
      buttonBottomInset: toPx(Phaser.Math.Clamp(boardHeight * 0.021, 14, 16)),
      entryOffset: toPx(Phaser.Math.Clamp(boardHeight * 0.034, 22, 28)),
      shadowOffset: toPx(Phaser.Math.Clamp(boardHeight * 0.013, 8, 10)),
    },
    statePanel: {
      x: boardX + Math.round((boardWidth - statePanelWidth) / 2),
      y: statePanelY,
      width: statePanelWidth,
      height: statePanelHeight,
      padding: toPx(Phaser.Math.Clamp(boardWidth * 0.046, 16, 18)),
      bodyY: toPx(Phaser.Math.Clamp(statePanelHeight * 0.52, 114, 124)),
      actionWidth: toPx(Phaser.Math.Clamp(statePanelWidth * 0.45, 150, 160)),
      actionHeight: toPx(Phaser.Math.Clamp(boardHeight * 0.055, 40, 42)),
      actionBottomInset: toPx(Phaser.Math.Clamp(boardHeight * 0.023, 16, 18)),
    },
    typography: {
      headerProgress: toPx(13 * textScale),
      headerStatus: toPx(12 * textScale),
      clueCaption: toPx(10 * textScale),
      clueEmpty: toPx(16 * textScale),
      clueType: toPx(10 * textScale),
      clueValue: toPx(15 * textScale),
      guessLabel: toPx(9 * textScale),
      guessValue: toPx(32 * textScale),
      guessHelper: toPx(10 * textScale),
      keyLabel: toPx(14 * textScale),
      actionLabel: toPx(14 * textScale),
      feedback: toPx(13 * textScale),
      overlayEyebrow: toPx(11 * textScale),
      overlayTitle: toPx(22 * textScale),
      overlayDiagnosis: toPx(18 * textScale),
      overlayHelper: toPx(12 * textScale),
      stateEyebrow: toPx(12 * textScale),
      stateTitle: toPx(28 * textScale),
      stateBody: toPx(17 * textScale),
    },
  }
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
] as const

const COLORS = {
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

type GuessBarState = 'empty' | 'typing' | 'disabled' | 'submitting' | 'wrong' | 'close' | 'correct'
type FeedbackLabel = NonNullable<PhaserGameSessionSnapshot['feedbackLabel']>

type CluePalette = {
  fill: number
  stroke: number
  tag: string
}

type ClueCardView = {
  id: string
  container: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Rectangle
  shadow: Phaser.GameObjects.Rectangle
  background: Phaser.GameObjects.Rectangle
  accent: Phaser.GameObjects.Rectangle
  frame: Phaser.GameObjects.Rectangle
  sheen: Phaser.GameObjects.Rectangle
  typeText: Phaser.GameObjects.Text
  valueText: Phaser.GameObjects.Text
  width: number
  height: number
}

type ButtonPalette = {
  fill: number
  stroke: number
  text: string
  shadowAlpha: number
  alpha?: number
  glowAlpha?: number
  hoverGlowAlpha?: number
  pressedGlowAlpha?: number
  strokeWidth?: number
  pressedStrokeWidth?: number
  shineAlpha?: number
}

type PressableButtonView = {
  container: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Rectangle
  shadow: Phaser.GameObjects.Rectangle
  background: Phaser.GameObjects.Rectangle
  shine: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  enabled: boolean
  palette?: ButtonPalette
}

type GuessBarView = {
  container: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Rectangle
  halo: Phaser.GameObjects.Rectangle
  background: Phaser.GameObjects.Rectangle
  border: Phaser.GameObjects.Rectangle
  scan: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  value: Phaser.GameObjects.Text
  helper: Phaser.GameObjects.Text
}

type FeedbackView = {
  container: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Rectangle
  background: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
}

type EndOverlayView = {
  container: Phaser.GameObjects.Container
  scrim: Phaser.GameObjects.Rectangle
  panel: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Rectangle
  shadow: Phaser.GameObjects.Rectangle
  background: Phaser.GameObjects.Rectangle
  accent: Phaser.GameObjects.Rectangle
  beam: Phaser.GameObjects.Rectangle
  eyebrow: Phaser.GameObjects.Text
  title: Phaser.GameObjects.Text
  diagnosis: Phaser.GameObjects.Text
  helper: Phaser.GameObjects.Text
  continueButton: PressableButtonView
  explanationButton: PressableButtonView
}

type StatePanelView = {
  container: Phaser.GameObjects.Container
  background: Phaser.GameObjects.Rectangle
  eyebrow: Phaser.GameObjects.Text
  title: Phaser.GameObjects.Text
  body: Phaser.GameObjects.Text
  menuButton: PressableButtonView
  actionButton: PressableButtonView
}

type RewardToastView = {
  container: Phaser.GameObjects.Container
  label: Phaser.GameObjects.Text
  sublabel: Phaser.GameObjects.Text
}

type GeometryAuditEntry = {
  label: string
  type: string
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  scaleX: number | null
  scaleY: number | null
  fractional: boolean
  ancestorScaled: boolean
  ancestorScale: string
}

type ScaleAuditEntry = {
  label: string
  runtimeScaleX: number
  runtimeScaleY: number
  restScale: string
  hoverScale: string
  pressScale: string
  animationScale: string
  childContentScaled: boolean
}

type LabVisualBudget = {
  ambientMotes: number
  feedbackBursts: number
  overlayDna: number
}

function cloneSnapshot(snapshot: PhaserGameSessionSnapshot): PhaserGameSessionSnapshot {
  return {
    ...snapshot,
    visibleClues: snapshot.visibleClues.map((clue) => ({ ...clue })),
    latestAttempt: snapshot.latestAttempt ? { ...snapshot.latestAttempt } : null,
    reward: snapshot.reward ? { ...snapshot.reward } : null,
  }
}

function getAttemptKey(attempt: PhaserGameSessionSnapshot['latestAttempt']) {
  return attempt ? `${attempt.guess}::${attempt.label}` : null
}

function getFeedbackText(label: FeedbackLabel) {
  switch (label) {
    case 'correct':
      return 'CORRECT'
    case 'close':
      return 'CLOSE'
    default:
      return 'WRONG'
  }
}

function getClueTone(type: PhaserVisibleClue['type']): CluePalette {
  switch (type) {
    case 'history':
      return { fill: COLORS.skySoft, stroke: COLORS.sky, tag: '#7dd3fc' }
    case 'symptom':
      return { fill: COLORS.roseSoft, stroke: COLORS.rose, tag: '#fda4af' }
    case 'exam':
      return { fill: COLORS.amberSoft, stroke: COLORS.amber, tag: '#fcd34d' }
    case 'lab':
      return { fill: COLORS.cyanSoft, stroke: COLORS.cyan, tag: '#67e8f9' }
    case 'vital':
      return { fill: COLORS.orangeSoft, stroke: COLORS.orange, tag: '#fdba74' }
    case 'imaging':
      return { fill: COLORS.violetSoft, stroke: COLORS.violet, tag: '#c4b5fd' }
    default:
      return { fill: COLORS.panelSoft, stroke: 0x64748b, tag: COLORS.textMuted }
  }
}

function getGuessBarBaseState(snapshot: PhaserGameSessionSnapshot): GuessBarState {
  if (snapshot.mode === 'SUBMITTING') {
    return 'submitting'
  }

  if (!snapshot.canEditGuess && snapshot.mode !== 'FINAL_FEEDBACK') {
    return 'disabled'
  }

  return snapshot.guess.trim().length > 0 ? 'typing' : 'empty'
}

function isReadyToCommit(snapshot: PhaserGameSessionSnapshot | undefined) {
  return Boolean(snapshot?.canEditGuess && snapshot.guess.trim().length > 0 && !snapshot.submitDisabled)
}

function formatAuditNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a'
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

function isFractionalValue(value: number | null | undefined) {
  return typeof value === 'number' && Math.abs(value - Math.round(value)) > FRACTIONAL_EPSILON
}

function getLabVisualBudget(board: LayoutRect): LabVisualBudget {
  if (board.width <= 300) {
    return { ambientMotes: 8, feedbackBursts: 8, overlayDna: 6 }
  }

  if (board.width <= 360) {
    return { ambientMotes: 11, feedbackBursts: 10, overlayDna: 8 }
  }

  return { ambientMotes: 14, feedbackBursts: 12, overlayDna: 10 }
}

export function getCaseSceneRenderResolution() {
  return typeof window === 'undefined' ? 1 : Math.max(1, Math.min(window.devicePixelRatio || 1, MAX_RENDER_DPR))
}

function getCaseSceneTextResolution(scaleFactor = 1) {
  const renderResolution = getCaseSceneRenderResolution()
  const effectiveScale = Math.max(0.5, scaleFactor)

  return Math.max(1, Math.min(3, Math.ceil(renderResolution / effectiveScale)))
}

export function getCaseSceneCanvasSize() {
  return {
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
  }
}

export class DiagnosisLabScene extends Phaser.Scene {
  private readonly getSnapshot: () => PhaserGameSessionSnapshot
  private readonly getIntents: () => PhaserGameSessionIntents
  private layoutMetrics: LayoutMetrics = getLayoutMetrics(LOGICAL_WIDTH, LOGICAL_HEIGHT)

  private backdropLayer?: Phaser.GameObjects.Container
  private backdropBase?: Phaser.GameObjects.Rectangle
  private backdropFrame?: Phaser.GameObjects.Rectangle
  private backdropGrid?: Phaser.GameObjects.Graphics
  private backdropWell?: Phaser.GameObjects.Ellipse
  private backdropUpperGlow?: Phaser.GameObjects.Arc
  private backdropLowerGlow?: Phaser.GameObjects.Arc
  private backdropWash?: Phaser.GameObjects.Rectangle
  private ambientMotes: Phaser.GameObjects.Image[] = []

  private gameplayLayer?: Phaser.GameObjects.Container
  private feedbackRoot?: Phaser.GameObjects.Container
  private overlayRoot?: Phaser.GameObjects.Container
  private stateLayer?: Phaser.GameObjects.Container

  private headerRegion?: Phaser.GameObjects.Container
  private headerMenuButton?: PressableButtonView
  private headerBackground?: Phaser.GameObjects.Rectangle
  private headerDivider?: Phaser.GameObjects.Rectangle
  private headerTitleText?: Phaser.GameObjects.Text
  private keyboardRegion?: Phaser.GameObjects.Container
  private keyboardTray?: Phaser.GameObjects.Rectangle
  private actionRowRegion?: Phaser.GameObjects.Container

  private clueStackRegion?: Phaser.GameObjects.Container
  private clueStackShadow?: Phaser.GameObjects.Rectangle
  private clueStackTray?: Phaser.GameObjects.Rectangle
  private clueStackCaption?: Phaser.GameObjects.Text
  private clueProgressContainer?: Phaser.GameObjects.Container
  private clueProgressDots: Phaser.GameObjects.Arc[] = []
  private lastClueProgressRevealed = -1
  private lastClueProgressTotal = -1

  private clueCardLayer?: Phaser.GameObjects.Container
  private clueMaskGraphics?: Phaser.GameObjects.Graphics
  private clueEmptyText?: Phaser.GameObjects.Text
  private readonly clueCards = new Map<string, ClueCardView>()

  private guessBar?: GuessBarView
  private feedbackLayer?: FeedbackView
  private rewardToast?: RewardToastView
  private endOverlay?: EndOverlayView
  private statePanel?: StatePanelView

  private actionButtons?: {
    clear: PressableButtonView
    submit: PressableButtonView
    backspace: PressableButtonView
  }

  private keyboardButtons: Array<{ key: string; view: PressableButtonView }> = []
  private spaceButton?: PressableButtonView
  private guessBarState: GuessBarState = 'empty'
  private guessBarGlowTween?: Phaser.Tweens.Tween
  private guessBarScanTween?: Phaser.Tweens.Tween
  private guessCaretBlinkEvent?: Phaser.Time.TimerEvent
  private guessCaretVisible = true
  private guessBarResetEvent?: Phaser.Time.TimerEvent
  private feedbackHideEvent?: Phaser.Time.TimerEvent
  private overlayBeamTween?: Phaser.Tweens.Tween
  private overlayDnaLoopEvent?: Phaser.Time.TimerEvent
  private previousSnapshot?: PhaserGameSessionSnapshot
  private debugAuditText?: Phaser.GameObjects.Text
  private feedbackBurstPool: Phaser.GameObjects.Image[] = []
  private overlayDnaPool: Phaser.GameObjects.Image[] = []

  constructor(
    getSnapshot: () => PhaserGameSessionSnapshot,
    getIntents: () => PhaserGameSessionIntents,
  ) {
    super({ key: SCENE_KEY })
    this.getSnapshot = getSnapshot
    this.getIntents = getIntents
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg)
    this.cameras.main.roundPixels = true
    this.configureViewport()
    this.layoutMetrics = this.getCurrentLayoutMetrics()
    this.ensureLabTextures()

    this.backdropLayer = this.add.container(0, 0).setDepth(DEPTH.BACKDROP)
    this.gameplayLayer = this.add.container(0, 0).setDepth(DEPTH.BOARD)
    this.feedbackRoot = this.add.container(0, 0).setDepth(DEPTH.FEEDBACK)
    this.overlayRoot = this.add.container(0, 0).setDepth(DEPTH.OVERLAY)
    this.stateLayer = this.add.container(0, 0).setDepth(DEPTH.STATE)

    this.createBackdrop()

    this.createHeader()
    this.createClueStack()
    this.createFeedbackLayer()
    this.createRewardToast()
    this.createGuessBar()
    this.startGuessCaretBlink()
    this.createKeyboard()
    this.createActionRow()
    this.createEndOverlay()
    this.createStatePanel()
    this.registerHardwareKeyboard()
    this.applyLayoutMetrics()
    if (DEBUG_RENDER_AUDIT && DEBUG_RENDER_OVERLAY) {
      this.createDebugAuditOverlay()
    }

    this.scale.on('resize', this.handleResize, this)
    this.applySnapshot()
    if (DEBUG_RENDER_AUDIT) {
      this.runRenderAudit('create')
    }
  }

  shutdown() {
    this.scale.off('resize', this.handleResize, this)
    this.input.keyboard?.off('keydown', this.handleHardwareKeyDown, this)
    this.guessBarGlowTween?.stop()
    this.guessBarScanTween?.stop()
    this.guessCaretBlinkEvent?.remove(false)
    this.overlayBeamTween?.stop()
    this.guessBarResetEvent?.remove(false)
    this.feedbackHideEvent?.remove(false)
    this.overlayDnaLoopEvent?.remove(false)
    this.clueMaskGraphics?.destroy()
    this.ambientMotes.forEach((mote) => mote.destroy())
    this.feedbackBurstPool.forEach((particle) => particle.destroy())
    this.overlayDnaPool.forEach((particle) => particle.destroy())
    this.ambientMotes = []
    this.feedbackBurstPool = []
    this.overlayDnaPool = []
  }

  applyBridge() {
    if (this.sys.isActive()) {
      this.applySnapshot()
    }
  }

  private handleResize = () => {
    this.syncRenderSurface('resize')
  }

  private getDisplayLayoutSize() {
    const parentWidth = Math.round(this.scale.parentSize.width || 0)
    const parentHeight = Math.round(this.scale.parentSize.height || 0)

    return {
      width: Math.max(1, parentWidth || Math.round(this.scale.gameSize.width || LOGICAL_WIDTH)),
      height: Math.max(1, parentHeight || Math.round(this.scale.gameSize.height || LOGICAL_HEIGHT)),
    }
  }

  private getRenderCanvasSize() {
    const canvas = this.sys.game.canvas

    return {
      width: Math.max(1, Math.round(canvas?.width || this.scale.gameSize.width || LOGICAL_WIDTH)),
      height: Math.max(1, Math.round(canvas?.height || this.scale.gameSize.height || LOGICAL_HEIGHT)),
    }
  }

  private getRenderResolutionFactor() {
    const renderWidth = this.getRenderCanvasSize().width
    const { width } = this.getDisplayLayoutSize()

    return Phaser.Math.Clamp(renderWidth / Math.max(1, width), 1, MAX_RENDER_DPR)
  }

  private getCurrentLayoutMetrics() {
    const { width, height } = this.getDisplayLayoutSize()

    return getLayoutMetrics(width, height)
  }

  private registerHardwareKeyboard() {
    this.input.keyboard?.on('keydown', this.handleHardwareKeyDown, this)
  }

  private handleHardwareKeyDown(event: KeyboardEvent) {
    const activeElement = document.activeElement
    const activeTag = activeElement instanceof HTMLElement ? activeElement.tagName : ''

    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return
    }

    if (
      activeTag === 'INPUT' ||
      activeTag === 'TEXTAREA' ||
      activeTag === 'BUTTON' ||
      activeTag === 'SELECT' ||
      activeTag === 'A' ||
      activeElement instanceof HTMLTextAreaElement
    ) {
      return
    }

    const key = event.key
    const upper = key.toUpperCase()

    if (/^[A-Z]$/.test(upper)) {
      if (!event.repeat) {
        this.handleKeyPressIntent(upper)
        event.preventDefault()
      }
      return
    }

    if (key === 'Backspace' || key === 'Delete') {
      this.handleBackspaceIntent()
      event.preventDefault()
      return
    }

    if (key === 'Enter' && !event.repeat) {
      this.handleSubmitIntent()
      event.preventDefault()
      return
    }

    if (key === 'Escape' && !event.repeat) {
      this.handleClearIntent()
      event.preventDefault()
    }
  }

  private configureViewport() {
    const { width: renderWidth, height: renderHeight } = this.getRenderCanvasSize()
    const { width, height } = this.getDisplayLayoutSize()
    const renderResolution = this.getRenderResolutionFactor()

    this.cameras.main.setViewport(0, 0, renderWidth, renderHeight)
    this.cameras.main.setSize(renderWidth, renderHeight)
    this.cameras.main.setScroll(0, 0)
    this.cameras.main.setZoom(renderResolution)
    this.cameras.main.setBounds(0, 0, width, height)
  }

  public syncRenderSurface(reason = 'render-surface') {
    this.configureViewport()
    this.layoutMetrics = this.getCurrentLayoutMetrics()
    this.applyLayoutMetrics()
    this.applySnapshot()
    if (DEBUG_RENDER_AUDIT) {
      this.runRenderAudit(reason)
    }
  }

  private applyLayoutMetrics() {
    this.layoutBackdrop()
    this.layoutHeader()
    this.layoutClueStack()
    this.layoutGuessBar()
    this.layoutKeyboard()
    this.layoutActionRow()
    this.layoutFeedbackLayer()
    this.layoutRewardToast()
    this.layoutEndOverlay()
    this.layoutStatePanel()
  }

  private toFontPx(value: number) {
    return `${Math.max(1, Math.round(value))}px`
  }

  private setRectangleDimensions(target: Phaser.GameObjects.Rectangle, width: number, height: number) {
    target.setSize(width, height)
    target.setDisplaySize(width, height)
  }

  private setButtonFrame(view: PressableButtonView, width: number, height: number, fontSize: number) {
    this.setRectangleDimensions(view.glow, width + 10, height + 10)
    this.setRectangleDimensions(view.shadow, width, height)
    this.setRectangleDimensions(view.background, width, height)
    this.setRectangleDimensions(view.shine, Math.max(22, Math.round(width * 0.36)), Math.max(10, Math.round(height * 0.22)))
    view.shine.setPosition(Math.round(width * 0.12), Math.round(height * 0.18))
    view.label.setPosition(Math.round(width / 2), Math.round(height / 2))
    view.label.setFontSize(this.toFontPx(fontSize))
    if (view.enabled) {
      view.background.setInteractive({ useHandCursor: true })
    }
  }

  private refreshGuessBarScan(state: GuessBarState, color: number) {
    if (!this.guessBar) {
      return
    }

    const shouldScan = state === 'typing' || state === 'submitting' || state === 'correct'
    this.guessBar.scan.setFillStyle(color, shouldScan ? 0.16 : 0)

    if (!shouldScan) {
      this.guessBarScanTween?.stop()
      this.guessBarScanTween = undefined
      this.guessBar.scan.setAlpha(0)
      return
    }

    this.guessBar.scan.setVisible(true)
    this.guessBar.scan.setAlpha(state === 'submitting' ? 0.18 : 0.12)
    this.guessBar.scan.setX(-Math.round(this.layoutMetrics.guessBar.width * 0.22))

    if (this.guessBarScanTween?.isPlaying()) {
      return
    }

    this.guessBarScanTween = this.tweens.add({
      targets: this.guessBar.scan,
      x: this.layoutMetrics.guessBar.width + Math.round(this.layoutMetrics.guessBar.width * 0.18),
      duration: state === 'submitting' ? 540 : 900,
      ease: 'Sine.InOut',
      repeat: -1,
      repeatDelay: state === 'submitting' ? 70 : 190,
      onRepeat: () => {
        this.guessBar?.scan.setX(-Math.round(this.layoutMetrics.guessBar.width * 0.22))
      },
    })
  }

  private refreshOverlayEffects(active: boolean, color: number) {
    if (!this.endOverlay) {
      return
    }

    this.overlayBeamTween?.stop()
    this.overlayBeamTween = undefined
    this.overlayDnaLoopEvent?.remove(false)
    this.overlayDnaLoopEvent = undefined

    if (!active) {
      this.endOverlay.beam.setAlpha(0)
      return
    }

    this.endOverlay.beam.setFillStyle(color, 0.16)
    this.endOverlay.beam.setAlpha(0.16)
    this.endOverlay.beam.setX(-Math.round(this.layoutMetrics.overlay.width * 0.22))
    this.overlayBeamTween = this.tweens.add({
      targets: this.endOverlay.beam,
      x: this.layoutMetrics.overlay.width + Math.round(this.layoutMetrics.overlay.width * 0.16),
      duration: 1100,
      ease: 'Sine.InOut',
      repeat: -1,
      repeatDelay: 260,
      onRepeat: () => {
        this.endOverlay?.beam.setX(-Math.round(this.layoutMetrics.overlay.width * 0.22))
      },
    })
    this.emitOverlayDnaWave(color)
    this.overlayDnaLoopEvent = this.time.addEvent({
      delay: 1400,
      loop: true,
      callback: () => {
        this.emitOverlayDnaWave(color)
      },
    })
  }

  private getKeyboardRowLayout(rowLength: number) {
    const { keyboard } = this.layoutMetrics
    const totalGapWidth = keyboard.keyGap * Math.max(0, rowLength - 1)
    const availableWidth = Math.max(1, keyboard.width - keyboard.sideInset * 2 - totalGapWidth)
    const baseWidth = Math.floor(availableWidth / rowLength)
    const remainder = availableWidth - baseWidth * rowLength
    const widths = Array.from({ length: rowLength }, (_, index) => baseWidth + (index < remainder ? 1 : 0))
    const positions: number[] = []
    let x = keyboard.sideInset

    widths.forEach((width) => {
      positions.push(x)
      x += width + keyboard.keyGap
    })

    return { widths, positions }
  }

  private ensureLabTextures() {
    if (!this.textures.exists(LAB_MOTE_TEXTURE)) {
      const mote = this.make.graphics({ x: 0, y: 0 }, false)
      mote.fillStyle(0xffffff, 1)
      mote.fillCircle(6, 6, 5)
      mote.lineStyle(1, 0xb6f5ff, 0.55)
      mote.strokeCircle(6, 6, 5)
      mote.generateTexture(LAB_MOTE_TEXTURE, 12, 12)
      mote.destroy()
    }

    if (!this.textures.exists(LAB_DNA_TEXTURE)) {
      const dna = this.make.graphics({ x: 0, y: 0 }, false)
      dna.lineStyle(2, 0x7dd3fc, 0.82)
      dna.strokeLineShape(new Phaser.Geom.Line(4, 2, 16, 22))
      dna.strokeLineShape(new Phaser.Geom.Line(16, 2, 4, 22))
      dna.fillStyle(0x67e8f9, 0.92)
      dna.fillCircle(4, 2, 2)
      dna.fillCircle(16, 2, 2)
      dna.fillCircle(10, 12, 2)
      dna.fillCircle(4, 22, 2)
      dna.fillCircle(16, 22, 2)
      dna.generateTexture(LAB_DNA_TEXTURE, 20, 24)
      dna.destroy()
    }
  }

  private createImagePool(texture: string, count: number, layer?: Phaser.GameObjects.Container, depth?: number) {
    return Array.from({ length: count }, () => {
      const image = this.add.image(0, 0, texture).setVisible(false).setAlpha(0)
      if (layer) {
        layer.add(image)
      }
      if (typeof depth === 'number') {
        image.setDepth(depth)
      }
      return image
    })
  }

  private getPoolItem(pool: Phaser.GameObjects.Image[], texture: string, layer?: Phaser.GameObjects.Container, depth?: number) {
    const hidden = pool.find((item) => !item.visible)
    if (hidden) {
      return hidden
    }

    const image = this.add.image(0, 0, texture).setVisible(false).setAlpha(0)
    if (layer) {
      layer.add(image)
    }
    if (typeof depth === 'number') {
      image.setDepth(depth)
    }
    pool.push(image)
    return image
  }

  private primeAmbientMotes() {
    if (!this.backdropLayer) {
      return
    }

    const { ambientMotes } = getLabVisualBudget(this.layoutMetrics.board)
    if (this.ambientMotes.length < ambientMotes) {
      const nextMotes = this.createImagePool(LAB_MOTE_TEXTURE, ambientMotes - this.ambientMotes.length, this.backdropLayer)
      this.ambientMotes.push(...nextMotes)
    }

    this.ambientMotes.forEach((mote, index) => {
      mote.setBlendMode(Phaser.BlendModes.ADD)
      this.layoutAmbientMote(mote, index)
      if (this.tweens.isTweening(mote)) {
        return
      }

      this.tweens.add({
        targets: mote,
        alpha: { from: 0.08 + (index % 3) * 0.02, to: 0.24 + (index % 3) * 0.03 },
        scaleX: { from: 0.55 + (index % 4) * 0.04, to: 0.85 + (index % 4) * 0.05 },
        scaleY: { from: 0.55 + (index % 4) * 0.04, to: 0.85 + (index % 4) * 0.05 },
        duration: 1800 + index * 110,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      })
      this.tweens.add({
        targets: mote,
        y: mote.y - (18 + (index % 5) * 6),
        x: mote.x + ((index % 2 === 0 ? 1 : -1) * (10 + (index % 4) * 4)),
        duration: 4200 + index * 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      })
    })
  }

  private layoutAmbientMote(mote: Phaser.GameObjects.Image, index: number) {
    const { board } = this.layoutMetrics
    const column = (index % 5) + 1
    const row = Math.floor(index / 5) + 1
    const x = board.x + Math.round((board.width / 6) * column) + ((index % 2 === 0) ? 6 : -6)
    const y = board.y + Math.round((board.height / 5.5) * row)

    mote.setPosition(x, y)
    mote.setVisible(true)
    mote.setScale(0.55 + (index % 4) * 0.04)
    mote.setTint(index % 2 === 0 ? 0x67e8f9 : 0x99f6e4)
  }

  private emitBurst(
    pool: Phaser.GameObjects.Image[],
    texture: string,
    originX: number,
    originY: number,
    color: number,
    count: number,
    layer?: Phaser.GameObjects.Container,
    depth?: number,
  ) {
    for (let index = 0; index < count; index += 1) {
      const particle = this.getPoolItem(pool, texture, layer, depth)
      const angle = Phaser.Math.DegToRad(-110 + (220 / Math.max(1, count - 1)) * index)
      const radius = 18 + (index % 4) * 8
      const driftX = Math.cos(angle) * radius
      const driftY = Math.sin(angle) * radius

      particle.setVisible(true)
      particle.setAlpha(0.95)
      particle.setTint(color)
      particle.setScale(0.45 + (index % 3) * 0.12)
      particle.setPosition(originX, originY)
      particle.setRotation(angle)
      this.tweens.killTweensOf(particle)
      this.tweens.add({
        targets: particle,
        x: originX + driftX,
        y: originY + driftY,
        alpha: 0,
        scaleX: 0.08,
        scaleY: 0.08,
        angle: particle.angle + ((index % 2 === 0) ? 90 : -90),
        duration: 360 + index * 18,
        ease: 'Cubic.Out',
        onComplete: () => {
          particle.setVisible(false)
        },
      })
    }
  }

  private emitOverlayDnaWave(color: number) {
    if (!this.endOverlay || !this.endOverlay.container.visible) {
      return
    }

    const { overlay } = this.layoutMetrics
    const { overlayDna } = getLabVisualBudget(this.layoutMetrics.board)
    const baseX = overlay.x + overlay.width - overlay.padding - 28
    const baseY = overlay.y + overlay.height - overlay.buttonBottomInset - overlay.buttonHeight - 10

    for (let index = 0; index < overlayDna; index += 1) {
      const helix = this.getPoolItem(this.overlayDnaPool, LAB_DNA_TEXTURE, this.overlayRoot, DEPTH.OVERLAY)
      const offsetX = ((index % 2 === 0) ? -1 : 1) * (8 + (index % 3) * 10)
      const startX = baseX + offsetX
      const startY = baseY + index * 3
      const targetY = startY - (42 + index * 10)

      helix.setVisible(true)
      helix.setAlpha(0.82)
      helix.setTint(color)
      helix.setBlendMode(Phaser.BlendModes.ADD)
      helix.setScale(0.42 + (index % 3) * 0.08)
      helix.setPosition(startX, startY)
      helix.setAngle(index % 2 === 0 ? -8 : 8)
      this.tweens.killTweensOf(helix)
      this.tweens.add({
        targets: helix,
        y: targetY,
        x: startX + ((index % 2 === 0) ? -12 : 12),
        alpha: 0,
        angle: helix.angle + ((index % 2 === 0) ? -28 : 28),
        duration: 760 + index * 55,
        ease: 'Sine.Out',
        onComplete: () => {
          helix.setVisible(false)
        },
      })
    }
  }

  private createDebugAuditOverlay() {
    const text = this.createText(10, 10, '', {
      fontFamily: 'Courier New',
      fontSize: '11px',
      color: '#9fb3c8',
      backgroundColor: 'rgba(4, 7, 13, 0.82)',
      padding: { x: 6, y: 4 },
      lineSpacing: 2,
    })
      .setDepth(DEPTH.DEBUG)
      .setScrollFactor(0)

    this.debugAuditText = text
    this.updateDebugAuditOverlay('boot')
  }

  private getObjectDisplaySize(target: unknown) {
    if (!target || typeof target !== 'object') {
      return { width: null, height: null }
    }

    const gameObject = target as {
      displayWidth?: number
      displayHeight?: number
      width?: number
      height?: number
    }
    const width = typeof gameObject.displayWidth === 'number' ? gameObject.displayWidth : typeof gameObject.width === 'number' ? gameObject.width : null
    const height =
      typeof gameObject.displayHeight === 'number' ? gameObject.displayHeight : typeof gameObject.height === 'number' ? gameObject.height : null

    return { width, height }
  }

  private getAncestorScaleAudit(target: Phaser.GameObjects.GameObject | undefined) {
    let current = target?.parentContainer
    const chain: string[] = []

    while (current) {
      if (isFractionalValue(current.scaleX) || isFractionalValue(current.scaleY) || Math.abs(current.scaleX - 1) > FRACTIONAL_EPSILON || Math.abs(current.scaleY - 1) > FRACTIONAL_EPSILON) {
        chain.push(`${current.type ?? 'Container'}(${formatAuditNumber(current.scaleX)},${formatAuditNumber(current.scaleY)})`)
      }
      current = current.parentContainer
    }

    return {
      ancestorScaled: chain.length > 0,
      ancestorScale: chain.length > 0 ? chain.join(' <- ') : 'none',
    }
  }

  private pushGeometryAuditEntry(entries: GeometryAuditEntry[], label: string, target: Phaser.GameObjects.GameObject | undefined) {
    if (!target) {
      return
    }

    const positionedTarget = target as Phaser.GameObjects.GameObject & {
      x?: number
      y?: number
      scaleX?: number
      scaleY?: number
      type?: string
    }
    const { width, height } = this.getObjectDisplaySize(target)
    const scaleX = typeof positionedTarget.scaleX === 'number' ? positionedTarget.scaleX : null
    const scaleY = typeof positionedTarget.scaleY === 'number' ? positionedTarget.scaleY : null
    const { ancestorScaled, ancestorScale } = this.getAncestorScaleAudit(target)

    entries.push({
      label,
      type: positionedTarget.type ?? target.constructor.name,
      x: typeof positionedTarget.x === 'number' ? positionedTarget.x : null,
      y: typeof positionedTarget.y === 'number' ? positionedTarget.y : null,
      width,
      height,
      scaleX,
      scaleY,
      fractional: [
        positionedTarget.x,
        positionedTarget.y,
        width,
        height,
        scaleX,
        scaleY,
      ].some((value) => isFractionalValue(typeof value === 'number' ? value : null)),
      ancestorScaled,
      ancestorScale,
    })
  }

  private collectGeometryAudit() {
    const entries: GeometryAuditEntry[] = []

    this.pushGeometryAuditEntry(entries, 'backdrop.base', this.backdropBase)
    this.pushGeometryAuditEntry(entries, 'backdrop.wash', this.backdropWash)
    this.pushGeometryAuditEntry(entries, 'clues.tray', this.clueStackTray)
    this.pushGeometryAuditEntry(entries, 'clues.shadow', this.clueStackShadow)
    this.pushGeometryAuditEntry(entries, 'clues.emptyText', this.clueEmptyText)

    Array.from(this.clueCards.values()).forEach((view, index) => {
      this.pushGeometryAuditEntry(entries, `clue.${index}.container`, view.container)
      this.pushGeometryAuditEntry(entries, `clue.${index}.background`, view.background)
      this.pushGeometryAuditEntry(entries, `clue.${index}.accent`, view.accent)
      this.pushGeometryAuditEntry(entries, `clue.${index}.typeText`, view.typeText)
      this.pushGeometryAuditEntry(entries, `clue.${index}.valueText`, view.valueText)
    })

    if (this.guessBar) {
      this.pushGeometryAuditEntry(entries, 'guess.container', this.guessBar.container)
      this.pushGeometryAuditEntry(entries, 'guess.background', this.guessBar.background)
      this.pushGeometryAuditEntry(entries, 'guess.border', this.guessBar.border)
      this.pushGeometryAuditEntry(entries, 'guess.value', this.guessBar.value)
    }

    this.pushGeometryAuditEntry(entries, 'keyboard.region', this.keyboardRegion)
    this.pushGeometryAuditEntry(entries, 'keyboard.tray', this.keyboardTray)
    this.pushGeometryAuditEntry(entries, 'keyboard.key.0.container', this.keyboardButtons[0]?.view.container)
    this.pushGeometryAuditEntry(entries, 'keyboard.key.0.background', this.keyboardButtons[0]?.view.background)
    this.pushGeometryAuditEntry(entries, 'keyboard.key.0.label', this.keyboardButtons[0]?.view.label)
    this.pushGeometryAuditEntry(entries, 'keyboard.space.container', this.spaceButton?.container)
    this.pushGeometryAuditEntry(entries, 'keyboard.space.background', this.spaceButton?.background)
    this.pushGeometryAuditEntry(entries, 'keyboard.space.label', this.spaceButton?.label)
    this.pushGeometryAuditEntry(entries, 'action.submit.container', this.actionButtons?.submit.container)
    this.pushGeometryAuditEntry(entries, 'action.submit.background', this.actionButtons?.submit.background)
    this.pushGeometryAuditEntry(entries, 'action.submit.label', this.actionButtons?.submit.label)

    if (this.feedbackLayer) {
      this.pushGeometryAuditEntry(entries, 'feedback.container', this.feedbackLayer.container)
      this.pushGeometryAuditEntry(entries, 'feedback.background', this.feedbackLayer.background)
      this.pushGeometryAuditEntry(entries, 'feedback.label', this.feedbackLayer.label)
    }

    if (this.endOverlay) {
      this.pushGeometryAuditEntry(entries, 'overlay.scrim', this.endOverlay.scrim)
      this.pushGeometryAuditEntry(entries, 'overlay.panel', this.endOverlay.panel)
      this.pushGeometryAuditEntry(entries, 'overlay.background', this.endOverlay.background)
      this.pushGeometryAuditEntry(entries, 'overlay.title', this.endOverlay.title)
      this.pushGeometryAuditEntry(entries, 'overlay.explanation.label', this.endOverlay.explanationButton.label)
    }

    if (this.statePanel) {
      this.pushGeometryAuditEntry(entries, 'state.container', this.statePanel.container)
      this.pushGeometryAuditEntry(entries, 'state.background', this.statePanel.background)
      this.pushGeometryAuditEntry(entries, 'state.title', this.statePanel.title)
      this.pushGeometryAuditEntry(entries, 'state.action.label', this.statePanel.actionButton.label)
    }

    return entries
  }

  private collectScaleAudit() {
    const entries: ScaleAuditEntry[] = []

    Array.from(this.clueCards.entries()).forEach(([id, view]) => {
      entries.push({
        label: `clue.${id}`,
        runtimeScaleX: view.container.scaleX,
        runtimeScaleY: view.container.scaleY,
        restScale: 'layout-driven 1.00 to 0.64 by age',
        hoverScale: 'none',
        pressScale: 'none',
        animationScale: 'new clue enters at targetScale * 0.96 then tweens to target',
        childContentScaled: true,
      })
    })

    const pushButtonScale = (label: string, view: PressableButtonView | undefined) => {
      if (!view) {
        return
      }

      entries.push({
        label,
        runtimeScaleX: view.container.scaleX,
        runtimeScaleY: view.container.scaleY,
        restScale: '1.00',
        hoverScale: '1.015',
        pressScale: '0.98',
        animationScale: 'none',
        childContentScaled: true,
      })
    }

    pushButtonScale('keyboard.key.0', this.keyboardButtons[0]?.view)
    pushButtonScale('keyboard.space', this.spaceButton)
    pushButtonScale('action.clear', this.actionButtons?.clear)
    pushButtonScale('action.submit', this.actionButtons?.submit)
    pushButtonScale('action.backspace', this.actionButtons?.backspace)
    pushButtonScale('overlay.explanation', this.endOverlay?.explanationButton)
    pushButtonScale('overlay.continue', this.endOverlay?.continueButton)
    pushButtonScale('state.retry', this.statePanel?.actionButton)

    if (this.guessBar) {
      entries.push({
        label: 'guess.bar',
        runtimeScaleX: this.guessBar.container.scaleX,
        runtimeScaleY: this.guessBar.container.scaleY,
        restScale: '1.00',
        hoverScale: 'none',
        pressScale: 'none',
        animationScale: 'submit 0.992, close 1.015, correct 1.02',
        childContentScaled: true,
      })
    }

    if (this.feedbackLayer) {
      entries.push({
        label: 'feedback.panel',
        runtimeScaleX: this.feedbackLayer.container.scaleX,
        runtimeScaleY: this.feedbackLayer.container.scaleY,
        restScale: '1.00',
        hoverScale: 'none',
        pressScale: 'none',
        animationScale: 'entry 0.94 -> 1.00',
        childContentScaled: true,
      })
    }

    if (this.endOverlay) {
      entries.push({
        label: 'overlay.panel',
        runtimeScaleX: this.endOverlay.panel.scaleX,
        runtimeScaleY: this.endOverlay.panel.scaleY,
        restScale: '1.00',
        hoverScale: 'none',
        pressScale: 'none',
        animationScale: 'position tween only',
        childContentScaled: false,
      })
    }

    return entries
  }

  private updateDebugAuditOverlay(reason: string) {
    if (!this.debugAuditText) {
      return
    }

    const { width: layoutWidth, height: layoutHeight } = this.getDisplayLayoutSize()
    const renderCanvas = this.getRenderCanvasSize()
    const renderResolution = this.getRenderResolutionFactor()
    const board = this.layoutMetrics.board
    const firstKey = this.keyboardButtons[0]?.view.background
    const newestClue = Array.from(this.clueCards.values()).at(-1)?.background
    const guessBackground = this.guessBar?.background
    const geometryEntries = this.collectGeometryAudit()
    const fractionalCount = geometryEntries.filter((entry) => entry.fractional).length

    const lines = [
      `AUDIT ${reason.toUpperCase()}`,
      `dpr ${formatAuditNumber(typeof window === 'undefined' ? 1 : window.devicePixelRatio)}`,
      `parent ${formatAuditNumber(this.scale.parentSize.width)} x ${formatAuditNumber(this.scale.parentSize.height)}`,
      `game ${formatAuditNumber(this.scale.gameSize.width)} x ${formatAuditNumber(this.scale.gameSize.height)}`,
      `canvas ${formatAuditNumber(renderCanvas.width)} x ${formatAuditNumber(renderCanvas.height)}`,
      `layout ${formatAuditNumber(layoutWidth)} x ${formatAuditNumber(layoutHeight)}`,
      `zoom ${formatAuditNumber(this.cameras.main.zoom)} factor ${formatAuditNumber(renderResolution)}`,
      `board ${formatAuditNumber(board.x)},${formatAuditNumber(board.y)} ${formatAuditNumber(board.width)}x${formatAuditNumber(board.height)}`,
      `boardInt ${!['x', 'y', 'width', 'height'].some((key) => isFractionalValue(board[key as keyof LayoutRect]))}`,
      `frac ${fractionalCount}/${geometryEntries.length}`,
      `key0 ${firstKey ? `${formatAuditNumber(firstKey.x)},${formatAuditNumber(firstKey.y)} ${formatAuditNumber(firstKey.displayWidth)}x${formatAuditNumber(firstKey.displayHeight)}` : 'n/a'}`,
      `clue ${newestClue ? `${formatAuditNumber(newestClue.x)},${formatAuditNumber(newestClue.y)} ${formatAuditNumber(newestClue.displayWidth)}x${formatAuditNumber(newestClue.displayHeight)}` : 'n/a'}`,
      `guess ${guessBackground ? `${formatAuditNumber(guessBackground.x)},${formatAuditNumber(guessBackground.y)} ${formatAuditNumber(guessBackground.displayWidth)}x${formatAuditNumber(guessBackground.displayHeight)}` : 'n/a'}`,
    ]

    this.debugAuditText.setText(lines.join('\n'))
    this.debugAuditText.setPosition(board.x + 8, board.y + 8)
  }

  public runRenderAudit(reason = 'manual') {
    if (!DEBUG_RENDER_AUDIT) {
      return
    }

    const { width: layoutWidth, height: layoutHeight } = this.getDisplayLayoutSize()
    const renderCanvas = this.getRenderCanvasSize()
    const renderResolution = this.getRenderResolutionFactor()
    const camera = this.cameras.main
    const geometryEntries = this.collectGeometryAudit()
    const scaleEntries = this.collectScaleAudit()
    const payload = {
      reason,
      dpr: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
      parentSize: {
        width: this.scale.parentSize.width,
        height: this.scale.parentSize.height,
      },
      gameSize: {
        width: this.scale.gameSize.width,
        height: this.scale.gameSize.height,
      },
      renderCanvas,
      camera: {
        x: camera.x,
        y: camera.y,
        width: camera.width,
        height: camera.height,
        zoom: camera.zoom,
        visibleWorldWidth: camera.zoom === 0 ? null : camera.width / camera.zoom,
        visibleWorldHeight: camera.zoom === 0 ? null : camera.height / camera.zoom,
        worldViewWidth: camera.worldView.width,
        worldViewHeight: camera.worldView.height,
      },
      board: this.layoutMetrics.board,
      layoutSize: {
        width: layoutWidth,
        height: layoutHeight,
      },
      renderResolutionFactor: renderResolution,
      fractionalGeometryCount: geometryEntries.filter((entry) => entry.fractional).length,
      geometryCount: geometryEntries.length,
    }

    console.groupCollapsed(`[CaseScene render audit] ${reason}`)
    console.log(payload)
    console.table(geometryEntries)
    console.table(scaleEntries)
    console.groupEnd()

    ;(window as typeof window & { __DXLAB_CASE_SCENE_AUDIT__?: unknown }).__DXLAB_CASE_SCENE_AUDIT__ = {
      ...payload,
      geometryEntries,
      scaleEntries,
    }
    this.updateDebugAuditOverlay(reason)
  }

  private createBackdrop() {
    if (!this.backdropLayer) {
      return
    }

    const base = this.add
      .rectangle(0, 0, this.layoutMetrics.board.width, this.layoutMetrics.board.height, COLORS.bg)
      .setOrigin(0)
    const frame = this.add
      .rectangle(0, 0, this.layoutMetrics.board.width, this.layoutMetrics.board.height, 0xffffff, 0)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border, 0.64)
    const grid = this.add.graphics()
    const well = this.add
      .ellipse(0, 0, Math.round(this.layoutMetrics.board.width * 0.56), Math.round(this.layoutMetrics.board.height * 0.2), COLORS.cyanSoft, 0.12)
      .setBlendMode(Phaser.BlendModes.SCREEN)
    const upperGlow = this.add
      .circle(0, 0, 128, COLORS.bgAccent, 0.54)
      .setBlendMode(Phaser.BlendModes.SCREEN)
    const lowerGlow = this.add
      .circle(0, 0, 136, COLORS.bgAccentSoft, 0.62)
      .setBlendMode(Phaser.BlendModes.SCREEN)
    const boardWash = this.add
      .rectangle(0, 0, this.layoutMetrics.board.width, this.layoutMetrics.board.height, 0x08111d, 0.26)
      .setOrigin(0)

    this.backdropLayer.add([base, frame, grid, well, upperGlow, lowerGlow, boardWash])
    this.backdropBase = base
    this.backdropFrame = frame
    this.backdropGrid = grid
    this.backdropWell = well
    this.backdropUpperGlow = upperGlow
    this.backdropLowerGlow = lowerGlow
    this.backdropWash = boardWash
    this.primeAmbientMotes()
    this.layoutBackdrop()
  }

  private layoutBackdrop() {
    const { board, insets } = this.layoutMetrics
    if (this.backdropBase) {
      this.backdropBase.setPosition(board.x, board.y)
      this.setRectangleDimensions(this.backdropBase, board.width, board.height)
    }

    if (this.backdropFrame) {
      this.backdropFrame.setPosition(board.x + 1, board.y + 1)
      this.setRectangleDimensions(this.backdropFrame, Math.max(1, board.width - 2), Math.max(1, board.height - 2))
    }

    if (this.backdropGrid) {
      const gridSpacing = Math.max(18, Math.round(board.width * (28 / LOGICAL_WIDTH)))
      this.backdropGrid.clear()
      this.backdropGrid.lineStyle(1, COLORS.border, 0.12)

      for (let x = board.x + gridSpacing; x < board.x + board.width; x += gridSpacing) {
        this.backdropGrid.lineBetween(x, board.y + Math.round(board.height * 0.06), x, board.y + board.height - Math.round(board.height * 0.05))
      }

      for (let y = board.y + Math.round(gridSpacing * 0.8); y < board.y + board.height; y += gridSpacing) {
        this.backdropGrid.lineBetween(board.x + Math.round(board.width * 0.06), y, board.x + board.width - Math.round(board.width * 0.06), y)
      }
    }

    if (this.backdropWell) {
      this.backdropWell.setPosition(board.x + Math.round(board.width * 0.52), board.y + Math.round(board.height * 0.18))
      this.backdropWell.setSize(Math.round(board.width * 0.54), Math.round(board.height * 0.18))
    }

    if (this.backdropUpperGlow) {
      this.backdropUpperGlow.setPosition(board.x + board.width - board.width * (28 / LOGICAL_WIDTH), board.y + board.height * (60 / LOGICAL_HEIGHT))
      this.backdropUpperGlow.setRadius(Math.round(board.width * (128 / LOGICAL_WIDTH)))
    }

    if (this.backdropLowerGlow) {
      this.backdropLowerGlow.setPosition(board.x + board.width * (78 / LOGICAL_WIDTH), board.y + board.height - board.height * (92 / LOGICAL_HEIGHT))
      this.backdropLowerGlow.setRadius(Math.round(board.width * (136 / LOGICAL_WIDTH)))
    }

    if (this.backdropWash) {
      this.backdropWash.setPosition(board.x + insets.left - 6, board.y + insets.top + 30)
      this.setRectangleDimensions(
        this.backdropWash,
        Math.max(1, board.width - insets.left - insets.right + 12),
        Math.max(1, board.height - insets.top - insets.bottom - 20),
      )
    }

    this.primeAmbientMotes()
    this.ambientMotes.forEach((mote, index) => {
      this.layoutAmbientMote(mote, index)
    })
  }

  private createHeader() {
    if (!this.gameplayLayer) {
      return
    }

    const region = this.add.container(this.layoutMetrics.header.x, this.layoutMetrics.header.y)
    const background = this.add
      .rectangle(0, 0, this.layoutMetrics.header.width, this.layoutMetrics.header.height, COLORS.skySoft, 0.32)
      .setOrigin(0)
    const divider = this.add
      .rectangle(0, this.layoutMetrics.header.height - 1, this.layoutMetrics.header.width, 1, COLORS.cyan, 0.16)
      .setOrigin(0)
    const menuButton = this.createPressableButton(0, 0, 40, 24, '\u2630', () => {
      this.handleOpenMenuIntent()
    })
    const title = this.createText(Math.round(this.layoutMetrics.header.width / 2), Math.round(this.layoutMetrics.header.height / 2), 'Wardle', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(this.layoutMetrics.typography.headerProgress),
      color: '#a8c9e8',
      fontStyle: 'bold',
    })
    title.setOrigin(0.5)
    title.setAlpha(0.92)

    region.add([background, divider, menuButton.container, title])
    this.headerRegion = region
    this.headerBackground = background
    this.headerDivider = divider
    this.headerMenuButton = menuButton
    this.headerTitleText = title
    this.gameplayLayer.add(region)
    this.layoutHeader()
  }

  private layoutHeader() {
    if (!this.headerRegion) {
      return
    }

    const { header, typography } = this.layoutMetrics
    const horizontalPadding = Phaser.Math.Clamp(Math.round(header.width * (11 / 334)), 10, 12)
    const verticalPadding = Phaser.Math.Clamp(Math.round(header.height * 0.19), 6, 8)
    const menuHeight = Math.max(20, header.height - verticalPadding * 2)

    this.headerRegion.setPosition(header.x, header.y)
    if (this.headerBackground) {
      this.setRectangleDimensions(this.headerBackground, header.width, header.height)
    }
    if (this.headerDivider) {
      this.headerDivider.setPosition(0, Math.max(0, header.height - 1))
      this.setRectangleDimensions(this.headerDivider, header.width, 1)
    }
    if (this.headerMenuButton) {
      this.headerMenuButton.container.setPosition(horizontalPadding, Math.round((header.height - menuHeight) / 2))
      this.setButtonFrame(this.headerMenuButton, 40, menuHeight, Math.max(10, typography.headerStatus))
      this.applyButtonPalette(this.headerMenuButton, {
        fill: COLORS.skySoft,
        stroke: COLORS.border,
        text: '#9ec4de',
        shadowAlpha: 0.1,
        alpha: 0.9,
      })
    }
    this.headerTitleText?.setPosition(Math.round(header.width / 2), Math.round(header.height / 2))
    this.headerTitleText?.setFontSize(this.toFontPx(typography.headerProgress))
  }

  private createClueStack() {
    if (!this.gameplayLayer) {
      return
    }

    const region = this.add.container(this.layoutMetrics.clues.x, this.layoutMetrics.clues.y)
    const shadow = this.add
      .rectangle(0, 10, this.layoutMetrics.clues.width, this.layoutMetrics.clues.height, COLORS.shadow, 0.22)
      .setOrigin(0)
    const tray = this.add
      .rectangle(0, 0, this.layoutMetrics.clues.width, this.layoutMetrics.clues.height, 0x091522, 0.34)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.cyan, 0.3)
    const caption = this.createText(this.layoutMetrics.clues.captionX, this.layoutMetrics.clues.captionY, 'REVEALED CLUES', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(this.layoutMetrics.typography.clueCaption),
      color: COLORS.textQuiet,
      fontStyle: 'bold',
    })
    const progress = this.add.container(0, 0)
    const cardLayer = this.add.container(0, 0)
    const empty = this.createText(this.layoutMetrics.clues.width / 2, this.layoutMetrics.clues.height / 2, 'Reveal a clue to begin the board.', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(this.layoutMetrics.typography.clueEmpty),
      color: COLORS.textQuiet,
      align: 'center',
    })
    empty.setOrigin(0.5)

    const maskGraphics = this.make.graphics({ x: 0, y: 0 }, false)
    maskGraphics.fillStyle(0xffffff, 1)
    maskGraphics.fillRect(0, 0, this.layoutMetrics.clues.width, this.layoutMetrics.clues.height)
    cardLayer.setMask(maskGraphics.createGeometryMask())

    region.add([shadow, tray, cardLayer, caption, progress, empty])

    this.clueStackRegion = region
    this.clueStackShadow = shadow
    this.clueStackTray = tray
    this.clueStackCaption = caption
    this.clueProgressContainer = progress
    this.clueCardLayer = cardLayer
    this.clueMaskGraphics = maskGraphics
    this.clueEmptyText = empty
    this.gameplayLayer.add(region)
    this.layoutClueStack()
  }

  private layoutClueStack() {
    const { clues, typography } = this.layoutMetrics
    if (!this.clueStackRegion || !this.clueStackShadow || !this.clueStackTray || !this.clueStackCaption) {
      return
    }

    this.clueStackRegion.setPosition(clues.x, clues.y)
    this.clueStackShadow.setY(Math.max(2, Math.round(clues.height * (10 / 340))))
    this.setRectangleDimensions(this.clueStackShadow, clues.width, clues.height)
    this.setRectangleDimensions(this.clueStackTray, clues.width, clues.height)
    this.clueStackCaption.setPosition(clues.captionX, clues.captionY)
    this.clueStackCaption.setFontSize(this.toFontPx(typography.clueCaption))
    this.clueProgressContainer?.setPosition(clues.width - clues.cardInset, clues.captionY + 1)
    this.layoutClueProgressDots()

    if (this.clueEmptyText) {
      this.clueEmptyText.setPosition(Math.round(clues.width / 2), Math.round(clues.height / 2))
      this.clueEmptyText.setFontSize(this.toFontPx(typography.clueEmpty))
      this.clueEmptyText.setWordWrapWidth(clues.width - clues.cardInset * 2)
    }

    if (this.clueMaskGraphics) {
      this.clueMaskGraphics.clear()
      this.clueMaskGraphics.fillStyle(0xffffff, 1)
      this.clueMaskGraphics.fillRect(
        clues.x + clues.maskInset,
        clues.y + clues.maskInset,
        Math.max(1, clues.width - clues.maskInset * 2),
        Math.max(1, clues.height - clues.maskInset * 2),
      )
    }
  }

  private layoutClueProgressDots() {
    if (!this.clueProgressContainer || this.clueProgressDots.length === 0) {
      return
    }

    const radius = Math.max(2, Math.round(this.layoutMetrics.clues.height * (2 / 340)))
    const gap = Math.max(4, Math.round(this.layoutMetrics.clues.width * (6 / 334)))
    const step = radius * 2 + gap
    const totalWidth = this.clueProgressDots.length * radius * 2 + Math.max(0, this.clueProgressDots.length - 1) * gap
    const startX = Math.round(-totalWidth)

    this.clueProgressDots.forEach((dot, index) => {
      dot.setRadius(radius)
      dot.setPosition(startX + Math.round(radius + index * step), 0)
    })
  }

  private syncClueProgressIndicator(snapshot: PhaserGameSessionSnapshot, previousSnapshot: PhaserGameSessionSnapshot | undefined) {
    const total = Math.max(0, snapshot.totalClues)
    const revealed = Phaser.Math.Clamp(snapshot.revealedClueCount, 0, total)
    const totalChanged = this.lastClueProgressTotal !== total
    const revealedChanged = this.lastClueProgressRevealed !== revealed

    if (!totalChanged && !revealedChanged) {
      return
    }

    if (totalChanged) {
      this.clueProgressDots.forEach((dot) => dot.destroy())
      this.clueProgressDots = []

      for (let index = 0; index < total; index += 1) {
        const dot = this.add.circle(0, 0, 3, COLORS.border, 0.5)
        this.clueProgressContainer?.add(dot)
        this.clueProgressDots.push(dot)
      }

      this.layoutClueProgressDots()
    }

    this.clueProgressDots.forEach((dot, index) => {
      const isFilled = index < revealed
      dot.setFillStyle(isFilled ? COLORS.cyan : COLORS.border, isFilled ? 0.72 : 0.42)
      dot.setScale(1)
    })

    const previousRevealed = Phaser.Math.Clamp(previousSnapshot?.revealedClueCount ?? 0, 0, total)
    if (revealed > previousRevealed && revealed > 0) {
      const newestDot = this.clueProgressDots[revealed - 1]
      if (newestDot) {
        this.tweens.killTweensOf(newestDot)
        newestDot.setScale(1.18)
        newestDot.setAlpha(1)
        this.tweens.add({
          targets: newestDot,
          scale: 1,
          alpha: 0.9,
          duration: 120,
          ease: 'Sine.Out',
        })
      }
    }

    this.lastClueProgressRevealed = revealed
    this.lastClueProgressTotal = total
  }

  private createGuessBar() {
    if (!this.gameplayLayer) {
      return
    }

    const { guessBar, typography } = this.layoutMetrics
    const region = this.add.container(guessBar.x, guessBar.y)
    const glow = this.add
      .rectangle(-guessBar.haloInset - 4, -guessBar.haloInset - 4, guessBar.width + guessBar.haloInset * 2 + 8, guessBar.height + guessBar.haloInset * 2 + 8, COLORS.cyan, 0.1)
      .setOrigin(0)
    const halo = this.add
      .rectangle(-guessBar.haloInset, -guessBar.haloInset, guessBar.width + guessBar.haloInset * 2, guessBar.height + guessBar.haloInset * 2, COLORS.sky, 0.1)
      .setOrigin(0)
    const background = this.add
      .rectangle(0, 0, guessBar.width, guessBar.height, 0x0e1b2b, 0.96)
      .setOrigin(0)
    const border = this.add
      .rectangle(0, 0, guessBar.width, guessBar.height, 0xffffff, 0)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.border, 1)
    const scan = this.add
      .rectangle(-Math.round(guessBar.width * 0.22), 6, Math.max(26, Math.round(guessBar.width * 0.18)), Math.max(guessBar.height - 12, 16), COLORS.cyan, 0.12)
      .setOrigin(0)
    scan.setVisible(true)
    scan.setAlpha(0)
    const label = this.createText(guessBar.width / 2, guessBar.labelY, 'DIAGNOSIS', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.guessLabel),
      color: COLORS.textMuted,
    })
    label.setOrigin(0.5, 0)
    const value = this.createText(guessBar.width / 2, guessBar.valueY, 'YOUR DIAGNOSIS', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.guessValue),
      color: COLORS.textQuiet,
      fontStyle: 'bold',
      align: 'center',
    })
    value.setOrigin(0.5, 0)
    const helper = this.createText(guessBar.width / 2, guessBar.height - guessBar.helperBottomInset, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.guessHelper),
      color: COLORS.textQuiet,
    })
    helper.setOrigin(0.5, 1)

    region.add([glow, halo, background, border, scan, label, value, helper])

    this.guessBar = { container: region, glow, halo, background, border, scan, label, value, helper }
    this.gameplayLayer.add(region)
    this.layoutGuessBar()
  }

  private layoutGuessBar() {
    if (!this.guessBar) {
      return
    }

    const { guessBar, typography } = this.layoutMetrics
    this.guessBar.container.setPosition(guessBar.x, guessBar.y)
    this.guessBar.glow.setPosition(-guessBar.haloInset - 4, -guessBar.haloInset - 4)
    this.setRectangleDimensions(this.guessBar.glow, guessBar.width + guessBar.haloInset * 2 + 8, guessBar.height + guessBar.haloInset * 2 + 8)
    this.guessBar.halo.setPosition(-guessBar.haloInset, -guessBar.haloInset)
    this.setRectangleDimensions(this.guessBar.halo, guessBar.width + guessBar.haloInset * 2, guessBar.height + guessBar.haloInset * 2)
    this.setRectangleDimensions(this.guessBar.background, guessBar.width, guessBar.height)
    this.setRectangleDimensions(this.guessBar.border, guessBar.width, guessBar.height)
    this.guessBar.scan.setPosition(-Math.round(guessBar.width * 0.22), 6)
    this.setRectangleDimensions(this.guessBar.scan, Math.max(26, Math.round(guessBar.width * 0.18)), Math.max(guessBar.height - 12, 16))

    this.guessBar.label.setPosition(Math.round(guessBar.width / 2), guessBar.labelY)
    this.guessBar.label.setFontSize(this.toFontPx(typography.guessLabel))
    this.guessBar.value.setPosition(Math.round(guessBar.width / 2), guessBar.valueY)
    this.guessBar.helper.setPosition(Math.round(guessBar.width / 2), guessBar.height - guessBar.helperBottomInset)
    this.guessBar.helper.setFontSize(this.toFontPx(typography.guessHelper))
  }

  private startGuessCaretBlink() {
    this.guessCaretBlinkEvent?.remove(false)
    this.guessCaretVisible = true
    this.guessCaretBlinkEvent = this.time.addEvent({
      delay: 460,
      loop: true,
      callback: () => {
        this.guessCaretVisible = !this.guessCaretVisible
        if (this.sys.isActive()) {
          this.syncGuessBar(this.getSnapshot())
        }
      },
    })
  }

  private createActionRow() {
    if (!this.keyboardRegion) {
      return
    }

    const { actions } = this.layoutMetrics
    const region = this.add.container(actions.x - this.layoutMetrics.keyboard.x, actions.y - this.layoutMetrics.keyboard.y)
    const clear = this.createPressableButton(0, 0, actions.clearWidth, actions.height, 'Clear', () => {
      this.handleClearIntent()
    })
    const submit = this.createPressableButton(actions.clearWidth + actions.gap, 0, actions.submitWidth, actions.height, 'Submit', () => {
      this.handleSubmitIntent()
    })
    const backspace = this.createPressableButton(
      actions.clearWidth + actions.submitWidth + actions.gap * 2,
      0,
      actions.backspaceWidth,
      actions.height,
      'Del',
      () => {
        this.handleBackspaceIntent()
      },
    )

    region.add([clear.container, submit.container, backspace.container])
    this.actionRowRegion = region
    this.actionButtons = { clear, submit, backspace }
    this.keyboardRegion.add(region)
    this.layoutActionRow()
  }

  private layoutActionRow() {
    if (!this.keyboardRegion || !this.actionRowRegion || !this.actionButtons) {
      return
    }

    const { actions, keyboard, typography } = this.layoutMetrics
    this.actionRowRegion.setPosition(actions.x - keyboard.x, actions.y - keyboard.y)

    this.actionButtons.clear.container.setPosition(0, 0)
    this.setButtonFrame(this.actionButtons.clear, actions.clearWidth, actions.height, typography.actionLabel)

    this.actionButtons.submit.container.setPosition(actions.clearWidth + actions.gap, 0)
    this.setButtonFrame(this.actionButtons.submit, actions.submitWidth, actions.height, typography.actionLabel)

    this.actionButtons.backspace.container.setPosition(actions.clearWidth + actions.submitWidth + actions.gap * 2, 0)
    this.setButtonFrame(this.actionButtons.backspace, actions.backspaceWidth, actions.height, typography.actionLabel)
  }

  private createKeyboard() {
    if (!this.gameplayLayer) {
      return
    }

    const { keyboard } = this.layoutMetrics

    const region = this.add.container(keyboard.x, keyboard.y)
    const tray = this.add
      .rectangle(0, 0, keyboard.width, keyboard.height, 0x091522, 0.28)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.cyan, 0.38)
    region.add(tray)
    this.keyboardRegion = region
    this.keyboardTray = tray

    let y = keyboard.rowTop
    KEYBOARD_ROWS.forEach((row, rowIndex) => {
      const rowLayout = this.getKeyboardRowLayout(row.length)

      row.forEach((key, keyIndex) => {
        const keyWidth = rowLayout.widths[keyIndex]
        const x = rowLayout.positions[keyIndex]
        const button = this.createPressableButton(x, y, keyWidth, keyboard.keyHeight, key, () => {
          this.handleKeyPressIntent(key)
        })
        button.label.setFontSize(this.toFontPx(this.layoutMetrics.typography.keyLabel))
        region.add(button.container)
        this.keyboardButtons.push({ key, view: button })
      })

      y += keyboard.keyHeight + keyboard.rowGap
      if (rowIndex === 1) {
        y += Math.max(1, Math.round(keyboard.rowGap * 0.34))
      }
    })

    const spaceWidth = Math.min(keyboard.spaceWidth, keyboard.width - keyboard.sideInset * 2)
    const spaceX = Math.round((keyboard.width - spaceWidth) / 2)
    const space = this.createPressableButton(spaceX, y + keyboard.spaceTopGap, spaceWidth, keyboard.keyHeight, 'SPACE', () => {
      this.handleKeyPressIntent(' ')
    })
    space.label.setFontSize(this.toFontPx(Math.max(10, this.layoutMetrics.typography.keyLabel - 1)))
    region.add(space.container)

    this.spaceButton = space
    this.gameplayLayer.add(region)
    this.layoutKeyboard()
  }

  private layoutKeyboard() {
    if (!this.keyboardRegion || !this.keyboardTray) {
      return
    }

    const { keyboard, typography } = this.layoutMetrics
    this.keyboardRegion.setPosition(keyboard.x, keyboard.y)
    this.setRectangleDimensions(this.keyboardTray, keyboard.width, keyboard.height)

    let index = 0
    let y = keyboard.rowTop
    KEYBOARD_ROWS.forEach((row, rowIndex) => {
      const rowLayout = this.getKeyboardRowLayout(row.length)

      row.forEach((_, keyIndex) => {
        const entry = this.keyboardButtons[index]
        if (entry) {
          entry.view.container.setPosition(rowLayout.positions[keyIndex], y)
          this.setButtonFrame(entry.view, rowLayout.widths[keyIndex], keyboard.keyHeight, typography.keyLabel)
        }
        index += 1
      })

      y += keyboard.keyHeight + keyboard.rowGap
      if (rowIndex === 1) {
        y += Math.max(1, Math.round(keyboard.rowGap * 0.34))
      }
    })

    if (this.spaceButton) {
      const spaceWidth = Math.min(keyboard.spaceWidth, keyboard.width - keyboard.sideInset * 2)
      const spaceX = Math.round((keyboard.width - spaceWidth) / 2)
      this.spaceButton.container.setPosition(spaceX, y + keyboard.spaceTopGap)
      this.setButtonFrame(this.spaceButton, spaceWidth, keyboard.keyHeight, Math.max(10, typography.keyLabel - 1))
    }
  }

  private createFeedbackLayer() {
    if (!this.feedbackRoot) {
      return
    }

    const { feedback, typography } = this.layoutMetrics
    const region = this.add.container(feedback.x, feedback.y)
    const glow = this.add
      .rectangle(0, 0, feedback.width + 16, feedback.height + 16, COLORS.cyan, 0.08)
      .setOrigin(0.5)
    const background = this.add
      .rectangle(0, 0, feedback.width, feedback.height, COLORS.panelMuted, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(1, COLORS.border, 0.8)
    const label = this.createText(0, 1, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.feedback),
      color: COLORS.text,
      fontStyle: 'bold',
      align: 'center',
    }, getCaseSceneTextResolution(0.94))
    label.setOrigin(0.5)

    region.add([glow, background, label])
    region.setAlpha(0)
    region.setVisible(false)

    this.feedbackLayer = { container: region, glow, background, label }
    this.feedbackRoot.add(region)
    this.layoutFeedbackLayer()
  }

  private layoutFeedbackLayer() {
    if (!this.feedbackLayer) {
      return
    }

    const { feedback, typography } = this.layoutMetrics
    this.feedbackLayer.container.setPosition(feedback.x, feedback.y)
    this.setRectangleDimensions(this.feedbackLayer.glow, feedback.width + 16, feedback.height + 16)
    this.setRectangleDimensions(this.feedbackLayer.background, feedback.width, feedback.height)
    this.feedbackLayer.label.setFontSize(this.toFontPx(typography.feedback))
  }

  private createRewardToast() {
    if (!this.feedbackRoot) {
      return
    }

    const { board } = this.layoutMetrics
    const region = this.add.container(board.x + Math.round(board.width / 2), board.y + Math.round(board.height * 0.22))
    const label = this.createText(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(Math.max(18, this.layoutMetrics.typography.overlayDiagnosis)),
      color: COLORS.text,
      fontStyle: 'bold',
      align: 'center',
    })
    label.setOrigin(0.5)
    const sublabel = this.createText(0, 24, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(Math.max(11, this.layoutMetrics.typography.feedback - 1)),
      color: COLORS.textMuted,
      align: 'center',
    })
    sublabel.setOrigin(0.5)

    region.add([label, sublabel])
    region.setVisible(false)
    region.setAlpha(0)

    this.rewardToast = { container: region, label, sublabel }
    this.feedbackRoot.add(region)
    this.layoutRewardToast()
  }

  private layoutRewardToast() {
    if (!this.rewardToast) {
      return
    }

    const { board, typography } = this.layoutMetrics
    this.rewardToast.container.setPosition(board.x + Math.round(board.width / 2), board.y + Math.round(board.height * 0.2))
    this.rewardToast.label.setFontSize(this.toFontPx(Math.max(18, typography.overlayDiagnosis)))
    this.rewardToast.sublabel.setPosition(0, Math.max(20, Math.round(typography.overlayDiagnosis * 1.24)))
    this.rewardToast.sublabel.setFontSize(this.toFontPx(Math.max(11, typography.feedback - 1)))
  }

  private createEndOverlay() {
    if (!this.overlayRoot) {
      return
    }

    const { board, overlay, typography } = this.layoutMetrics
    const region = this.add.container(0, 0)
    const scrim = this.add.rectangle(board.x, board.y, board.width, board.height, COLORS.shadow, 0.52).setOrigin(0)
    const panel = this.add.container(overlay.x, overlay.y)
    const glow = this.add
      .rectangle(-6, -6, overlay.width + 12, overlay.height + 12, COLORS.cyan, 0.05)
      .setOrigin(0)
    const shadow = this.add
      .rectangle(0, overlay.shadowOffset, overlay.width, overlay.height, COLORS.shadow, 0.18)
      .setOrigin(0)
    const background = this.add
      .rectangle(0, 0, overlay.width, overlay.height, COLORS.panelSoft, 0.95)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border, 1)
    const accent = this.add.rectangle(0, 0, overlay.width, overlay.accentHeight, COLORS.emerald, 0.95).setOrigin(0)
    const beam = this.add
      .rectangle(-Math.round(overlay.width * 0.22), overlay.accentHeight + 8, Math.max(32, Math.round(overlay.width * 0.16)), Math.max(overlay.height - overlay.accentHeight - 22, 20), COLORS.cyan, 0.14)
      .setOrigin(0)
    beam.setAlpha(0)
    const eyebrow = this.createText(overlay.padding, overlay.padding, 'ROUND COMPLETE', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.overlayEyebrow),
      color: COLORS.textMuted,
      fontStyle: 'bold',
    })
    const title = this.createText(overlay.padding, overlay.padding + Math.round(22 * (overlay.height / 204)), 'Diagnosis locked in', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.overlayTitle),
      color: COLORS.text,
      fontStyle: 'bold',
      wordWrap: { width: overlay.width - overlay.padding * 2, useAdvancedWrap: true },
    })
    const diagnosis = this.createText(overlay.padding, overlay.padding + Math.round(64 * (overlay.height / 204)), '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.overlayDiagnosis),
      color: COLORS.text,
      fontStyle: 'bold',
      wordWrap: { width: overlay.width - overlay.padding * 2, useAdvancedWrap: true },
    })
    const helper = this.createText(overlay.padding, overlay.padding + Math.round(102 * (overlay.height / 204)), 'Open the explanation or continue to the next case.', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.overlayHelper),
      color: COLORS.textMuted,
      wordWrap: { width: overlay.width - overlay.padding * 2, useAdvancedWrap: true },
    })
    const explanationButton = this.createPressableButton(
      overlay.padding,
      overlay.height - overlay.buttonBottomInset - overlay.buttonHeight,
      overlay.buttonWidth,
      overlay.buttonHeight,
      'Why?',
      () => {
      if (!this.getSnapshot().canOpenExplanation) {
        return
      }

      this.getIntents().onOpenExplanation()
      },
    )
    const continueButton = this.createPressableButton(
      overlay.width - overlay.buttonWidth - overlay.padding,
      overlay.height - overlay.buttonBottomInset - overlay.buttonHeight,
      overlay.buttonWidth,
      overlay.buttonHeight,
      'Continue',
      () => {
        this.getIntents().onContinue()
      },
    )

    panel.add([
      glow,
      shadow,
      background,
      accent,
      beam,
      eyebrow,
      title,
      diagnosis,
      helper,
      explanationButton.container,
      continueButton.container,
    ])
    region.add([scrim, panel])
    region.setVisible(false)
    region.setAlpha(0)

    this.endOverlay = {
      container: region,
      scrim,
      panel,
      glow,
      shadow,
      background,
      accent,
      beam,
      eyebrow,
      title,
      diagnosis,
      helper,
      continueButton,
      explanationButton,
    }
    this.overlayRoot.add(region)
    this.layoutEndOverlay()
  }

  private layoutEndOverlay() {
    if (!this.endOverlay) {
      return
    }

    const { board, overlay, typography } = this.layoutMetrics
    this.endOverlay.scrim.setPosition(board.x, board.y)
    this.setRectangleDimensions(this.endOverlay.scrim, board.width, board.height)

    this.endOverlay.panel.setX(overlay.x)
    this.endOverlay.glow.setPosition(-6, -6)
    this.setRectangleDimensions(this.endOverlay.glow, overlay.width + 12, overlay.height + 12)
    this.endOverlay.shadow.setY(overlay.shadowOffset)
    this.setRectangleDimensions(this.endOverlay.shadow, overlay.width, overlay.height)
    this.setRectangleDimensions(this.endOverlay.background, overlay.width, overlay.height)
    this.setRectangleDimensions(this.endOverlay.accent, overlay.width, overlay.accentHeight)
    this.endOverlay.beam.setPosition(-Math.round(overlay.width * 0.22), overlay.accentHeight + 8)
    this.setRectangleDimensions(this.endOverlay.beam, Math.max(32, Math.round(overlay.width * 0.16)), Math.max(overlay.height - overlay.accentHeight - 22, 20))

    this.endOverlay.eyebrow.setPosition(overlay.padding, overlay.padding)
    this.endOverlay.eyebrow.setFontSize(this.toFontPx(typography.overlayEyebrow))
    this.endOverlay.title.setPosition(overlay.padding, overlay.padding + Math.round(22 * (overlay.height / 204)))
    this.endOverlay.title.setFontSize(this.toFontPx(typography.overlayTitle))
    this.endOverlay.title.setWordWrapWidth(overlay.width - overlay.padding * 2)
    this.endOverlay.diagnosis.setPosition(overlay.padding, overlay.padding + Math.round(64 * (overlay.height / 204)))
    this.endOverlay.diagnosis.setFontSize(this.toFontPx(typography.overlayDiagnosis))
    this.endOverlay.diagnosis.setWordWrapWidth(overlay.width - overlay.padding * 2)
    this.endOverlay.helper.setPosition(overlay.padding, overlay.padding + Math.round(102 * (overlay.height / 204)))
    this.endOverlay.helper.setFontSize(this.toFontPx(typography.overlayHelper))
    this.endOverlay.helper.setWordWrapWidth(overlay.width - overlay.padding * 2)

    this.endOverlay.explanationButton.container.setPosition(
      overlay.padding,
      overlay.height - overlay.buttonBottomInset - overlay.buttonHeight,
    )
    this.endOverlay.continueButton.container.setPosition(
      overlay.width - overlay.buttonWidth - overlay.padding,
      overlay.height - overlay.buttonBottomInset - overlay.buttonHeight,
    )
    this.setButtonFrame(this.endOverlay.explanationButton, overlay.buttonWidth, overlay.buttonHeight, this.layoutMetrics.typography.actionLabel)
    this.setButtonFrame(this.endOverlay.continueButton, overlay.buttonWidth, overlay.buttonHeight, this.layoutMetrics.typography.actionLabel)

    if (this.endOverlay.container.visible && this.endOverlay.container.alpha > 0) {
      this.endOverlay.panel.setY(overlay.y)
    }
  }

  private createStatePanel() {
    if (!this.stateLayer) {
      return
    }

    const { statePanel, typography } = this.layoutMetrics
    const region = this.add.container(statePanel.x, statePanel.y)
    const background = this.add
      .rectangle(0, 0, statePanel.width, statePanel.height, COLORS.panelSoft, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border, 1)
    const eyebrow = this.createText(statePanel.padding, statePanel.padding, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.stateEyebrow),
      color: COLORS.textMuted,
      fontStyle: 'bold',
    })
    const title = this.createText(statePanel.padding, statePanel.padding + Math.round(34 * (statePanel.height / 236)), '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.stateTitle),
      color: COLORS.text,
      fontStyle: 'bold',
      wordWrap: { width: statePanel.width - statePanel.padding * 2, useAdvancedWrap: true },
    })
    const body = this.createText(statePanel.width / 2, statePanel.bodyY, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.stateBody),
      color: COLORS.textMuted,
      align: 'center',
      wordWrap: { width: statePanel.width - statePanel.padding * 2, useAdvancedWrap: true },
    })
    body.setOrigin(0.5, 0)
    const menuButton = this.createPressableButton(
      statePanel.width - statePanel.padding - 64,
      statePanel.padding - 4,
      64,
      24,
      'Menu',
      () => {
        this.handleOpenMenuIntent()
      },
    )

    const actionButton = this.createPressableButton(
      (statePanel.width - statePanel.actionWidth) / 2,
      statePanel.height - statePanel.actionBottomInset - statePanel.actionHeight,
      statePanel.actionWidth,
      statePanel.actionHeight,
      'Try again',
      () => {
        this.getIntents().onReload()
      },
    )

    region.add([background, eyebrow, title, body, menuButton.container, actionButton.container])

    this.statePanel = { container: region, background, eyebrow, title, body, menuButton, actionButton }
    this.stateLayer.add(region)
    this.layoutStatePanel()
  }

  private layoutStatePanel() {
    if (!this.statePanel) {
      return
    }

    const { statePanel, typography } = this.layoutMetrics
    this.statePanel.container.setPosition(statePanel.x, statePanel.y)
    this.setRectangleDimensions(this.statePanel.background, statePanel.width, statePanel.height)

    this.statePanel.eyebrow.setPosition(statePanel.padding, statePanel.padding)
    this.statePanel.eyebrow.setFontSize(this.toFontPx(typography.stateEyebrow))
    this.statePanel.menuButton.container.setPosition(statePanel.width - statePanel.padding - 64, statePanel.padding - 4)
    this.setButtonFrame(this.statePanel.menuButton, 64, 24, Math.max(10, typography.headerStatus))
    this.applyButtonPalette(this.statePanel.menuButton, {
      fill: COLORS.ink,
      stroke: COLORS.border,
      text: COLORS.textMuted,
      shadowAlpha: 0.12,
      alpha: 0.96,
    })

    this.statePanel.title.setPosition(statePanel.padding, statePanel.padding + Math.round(34 * (statePanel.height / 236)))
    this.statePanel.title.setFontSize(this.toFontPx(typography.stateTitle))
    this.statePanel.title.setWordWrapWidth(statePanel.width - statePanel.padding * 2)

    this.statePanel.body.setPosition(Math.round(statePanel.width / 2), statePanel.bodyY)
    this.statePanel.body.setFontSize(this.toFontPx(typography.stateBody))
    this.statePanel.body.setWordWrapWidth(statePanel.width - statePanel.padding * 2)

    this.statePanel.actionButton.container.setPosition(
      (statePanel.width - statePanel.actionWidth) / 2,
      statePanel.height - statePanel.actionBottomInset - statePanel.actionHeight,
    )
    this.setButtonFrame(this.statePanel.actionButton, statePanel.actionWidth, statePanel.actionHeight, this.layoutMetrics.typography.actionLabel)
  }

  private applySnapshot = () => {
    const snapshot = this.getSnapshot()
    const previousSnapshot = this.previousSnapshot
    const showStatePanel =
      snapshot.mode === 'LOADING' || snapshot.mode === 'WAITING' || snapshot.mode === 'BLOCKED'

    this.gameplayLayer?.setVisible(!showStatePanel)
    this.feedbackRoot?.setVisible(!showStatePanel)
    this.overlayRoot?.setVisible(!showStatePanel)
    this.stateLayer?.setVisible(showStatePanel)

    if (showStatePanel) {
      this.refreshOverlayEffects(false, COLORS.cyan)
      this.guessBarScanTween?.stop()
      this.guessBarScanTween = undefined
      if (this.guessBar) {
        this.guessBar.scan.setAlpha(0)
      }
      this.syncStatePanel(snapshot)
      if (this.endOverlay) {
        this.endOverlay.container.setVisible(false)
        this.endOverlay.container.setAlpha(0)
      }
      this.guessBarResetEvent?.remove(false)
      this.guessBarResetEvent = undefined
      this.feedbackHideEvent?.remove(false)
      this.feedbackHideEvent = undefined
      if (this.feedbackLayer) {
        this.feedbackLayer.container.setVisible(false)
        this.feedbackLayer.container.setAlpha(0)
      }
      this.previousSnapshot = cloneSnapshot(snapshot)
      if (DEBUG_RENDER_AUDIT) {
        this.updateDebugAuditOverlay('snapshot')
      }
      return
    }

    const rewardChanged = snapshot.reward?.receivedAt && snapshot.reward.receivedAt !== previousSnapshot?.reward?.receivedAt
    const attemptChanged = getAttemptKey(previousSnapshot?.latestAttempt ?? null) !== getAttemptKey(snapshot.latestAttempt)
    const enteredSubmitting = snapshot.mode === 'SUBMITTING' && previousSnapshot?.mode !== 'SUBMITTING'
    const becameReadyToCommit = isReadyToCommit(snapshot) && !isReadyToCommit(previousSnapshot)

    if (rewardChanged && snapshot.reward) {
      this.showRewardToast(snapshot.reward)
    }

    if (enteredSubmitting) {
      this.animateGuessSubmit()
    }

    if (attemptChanged && snapshot.latestAttempt) {
      switch (snapshot.latestAttempt.label) {
        case 'correct':
          this.animateCorrectGuess(snapshot.mode === 'FINAL_FEEDBACK')
          break
        case 'close':
          this.animateCloseGuess(snapshot.mode === 'FINAL_FEEDBACK')
          break
        default:
          this.animateWrongGuess(snapshot.mode === 'FINAL_FEEDBACK')
          break
      }
    } else if (!this.guessBarResetEvent && snapshot.mode !== 'FINAL_FEEDBACK') {
      this.guessBarState = getGuessBarBaseState(snapshot)
    }

    if (snapshot.mode === 'FINAL_FEEDBACK' && snapshot.feedbackLabel) {
      this.guessBarResetEvent?.remove(false)
      this.guessBarResetEvent = undefined
      this.guessBarState = snapshot.feedbackLabel
    }

    this.syncHeader(snapshot)
    this.syncClues(snapshot, previousSnapshot)
    this.syncActionRow(snapshot)
    this.syncKeyboard(snapshot)
    this.syncFeedback(snapshot, previousSnapshot)
    this.syncGuessBar(snapshot)
    this.syncEndOverlay(snapshot, previousSnapshot)

    if (becameReadyToCommit && snapshot.mode === 'PLAYING') {
      this.animateReadyToCommit()
    }

    this.previousSnapshot = cloneSnapshot(snapshot)
    if (DEBUG_RENDER_AUDIT) {
      this.updateDebugAuditOverlay('snapshot')
    }
  }

  private syncStatePanel(snapshot: PhaserGameSessionSnapshot) {
    if (!this.statePanel) {
      return
    }

    let eyebrow = 'Case'
    let title = 'Loading case'
    let body = 'Preparing your next diagnostic challenge...'
    let showAction = false

    if (snapshot.mode === 'WAITING') {
      eyebrow = 'Case completed'
      title = 'Next case available in'
      body = snapshot.waitingCountdownText ?? '00:00:00'
    } else if (snapshot.mode === 'BLOCKED') {
      eyebrow = 'Unavailable'
      title = 'Play is paused'
      body = snapshot.unavailableReason ?? 'No case available right now.'
      showAction = snapshot.canRetry
    }

    this.statePanel.eyebrow.setText(eyebrow)
    this.statePanel.title.setText(title)
    this.statePanel.body.setText(body)
    this.statePanel.actionButton.container.setVisible(showAction)
    this.setPressableEnabled(this.statePanel.actionButton, showAction)

    if (showAction) {
      this.applyButtonPalette(this.statePanel.actionButton, {
        fill: COLORS.emerald,
        stroke: COLORS.emerald,
        text: COLORS.text,
        shadowAlpha: 0.22,
      })
    }
  }

  private syncHeader(_snapshot: PhaserGameSessionSnapshot) {
    this.headerTitleText?.setText('Wardle')
  }

  private syncClues(
    snapshot: PhaserGameSessionSnapshot,
    previousSnapshot: PhaserGameSessionSnapshot | undefined,
  ) {
    if (!this.clueCardLayer) {
      return
    }

    this.syncClueProgressIndicator(snapshot, previousSnapshot)

    const { clues } = this.layoutMetrics
    const clueCardWidth = Math.max(120, clues.width - clues.cardInset * 2)

    const currentIds = new Set(snapshot.visibleClues.map((clue) => clue.id))
    this.clueCards.forEach((view, id) => {
      if (!currentIds.has(id)) {
        view.container.destroy(true)
        this.clueCards.delete(id)
      }
    })

    const hasClues = snapshot.visibleClues.length > 0
    if (this.clueEmptyText) {
      this.clueEmptyText.setVisible(!hasClues)
    }

    snapshot.visibleClues.forEach((clue) => {
      if (!this.clueCards.has(clue.id)) {
        const view = this.createClueCard(clue, clueCardWidth)
        this.clueCards.set(clue.id, view)
        this.clueCardLayer?.add(view.container)
      }
    })

    const total = snapshot.visibleClues.length
    const newestIndex = total - 1
    const itemGap = Math.max(6, Math.round(clues.height * (8 / 340)))

    const targets = snapshot.visibleClues.map((clue, index) => {
      const view = this.clueCards.get(clue.id)
      const age = newestIndex - index
      const scale = 1
      const alpha = age === 0 ? 1 : Phaser.Math.Clamp(0.9 - age * 0.08, 0.72, 0.9)
      const x = Math.round(clues.cardInset)

      this.refreshClueCard(view!, clue, age)
      const y = 0

      return { clue, view: view!, age, x, y, scale, alpha }
    })

    const totalHeight = targets.reduce((sum, target) => sum + target.view.height, 0) + Math.max(0, total - 1) * itemGap
    const contentBottom = clues.height - clues.stackBottomInset
    const minStartY = clues.minTopInset
    const startY = Math.min(minStartY, Math.round(contentBottom - totalHeight))
    let cursorY = startY
    targets.forEach((target) => {
      target.y = cursorY
      cursorY += target.view.height + itemGap
    })

    const previousCount = previousSnapshot?.visibleClues.length ?? 0

    targets.forEach((target, order) => {
      const { clue, view, scale, alpha } = target
      const x = target.x
      const y = target.y

      view.container.setDepth(order + 1)
      this.clueCardLayer?.bringToTop(view.container)

      const isNewReveal = !previousSnapshot || !previousSnapshot.visibleClues.some((item) => item.id === clue.id)
      if (isNewReveal && total >= previousCount) {
        this.animateNewClueCard(view, x, y, scale, alpha)
        return
      }

      this.tweens.killTweensOf(view.container)
      view.container.setPosition(x, y)
      view.container.setScale(scale)
      view.container.setAlpha(alpha)
    })
  }

  private syncGuessBar(snapshot: PhaserGameSessionSnapshot) {
    if (!this.guessBar) {
      return
    }

    if (snapshot.mode !== 'FINAL_FEEDBACK' && snapshot.mode !== 'SUBMITTING' && !this.guessBarResetEvent) {
      this.guessBarState = getGuessBarBaseState(snapshot)
    }

    const state = this.guessBarState
    const style = this.getGuessBarVisual(state)
    const readyToCommit = state === 'typing' && isReadyToCommit(snapshot)
    const baseValue =
      state === 'empty'
        ? 'YOUR DIAGNOSIS'
        : snapshot.guess || snapshot.finalDiagnosis || snapshot.latestAttempt?.guess || 'YOUR DIAGNOSIS'

    const slotStroke = readyToCommit ? COLORS.emeraldGlow : style.stroke
    const slotHaloColor = readyToCommit ? COLORS.emeraldGlow : style.haloColor
    const slotHaloAlpha = readyToCommit ? 0.2 : style.haloAlpha
    const slotFill = readyToCommit ? 0x103028 : style.fill
    const slotLabelColor = readyToCommit ? '#bbf7d0' : style.labelColor
    const borderWidth = readyToCommit ? 2 : state === 'empty' || state === 'disabled' ? 1 : 2

    const hasTypedGuess = snapshot.guess.trim().length > 0
    const showCaret = snapshot.canEditGuess && (state === 'typing' || (state === 'empty' && !hasTypedGuess)) && !snapshot.submitDisabled && this.guessCaretVisible

    this.guessBar.container.setAlpha(snapshot.mode === 'FINAL_FEEDBACK' ? 0.68 : 1)
    this.guessBar.halo.setFillStyle(slotHaloColor, slotHaloAlpha)
    this.guessBar.glow.setFillStyle(slotStroke, Phaser.Math.Clamp(slotHaloAlpha * 0.66, 0.06, 0.22))
    this.guessBar.background.setFillStyle(slotFill, state === 'empty' ? 0.9 : readyToCommit ? 0.97 : 0.95)
    this.guessBar.border.setStrokeStyle(borderWidth, slotStroke, 1)
    this.guessBar.label.setColor(slotLabelColor)
    this.guessBar.label.setAlpha(readyToCommit ? 0.86 : state === 'empty' ? 0.62 : 0.78)
    this.guessBar.value.setColor(style.valueColor)
    this.guessBar.value.setAlpha(snapshot.mode === 'FINAL_FEEDBACK' ? 0.9 : state === 'empty' ? 0.78 : 1)
    const baseFontSize = this.layoutMetrics.typography.guessValue
    const adjustedFontSize =
      baseValue.length > 24
        ? Math.max(16, Math.round(baseFontSize * 0.67))
        : baseValue.length > 16
        ? Math.max(18, Math.round(baseFontSize * 0.8))
        : baseFontSize
    const maxChars = Math.max(
      10,
      Math.floor((this.layoutMetrics.guessBar.width - this.layoutMetrics.guessBar.textInset * 2) / Math.max(7, adjustedFontSize * 0.56)),
    )
    const clippedValue =
      baseValue.length > maxChars ? `${baseValue.slice(0, Math.max(6, maxChars - 1)).trimEnd()}...` : baseValue
    const renderedValue = showCaret ? `${clippedValue}|` : clippedValue

    this.guessBar.value.setText(renderedValue)
    this.guessBar.value.setFontSize(this.toFontPx(adjustedFontSize))
    this.guessBar.helper.setText(style.helper)
    this.guessBar.helper.setColor(style.helperColor)
    this.guessBar.helper.setAlpha(style.helper ? 1 : 0)

    this.refreshGuessBarGlow(state, style)
    this.refreshGuessBarScan(state, slotStroke)
  }

  private syncActionRow(snapshot: PhaserGameSessionSnapshot) {
    if (!this.actionButtons) {
      return
    }

    const hasGuess = snapshot.guess.trim().length > 0
    const canEdit = snapshot.canEditGuess
    const canClear = canEdit && hasGuess
    const canSubmit = !snapshot.submitDisabled
    const readyToCommit = isReadyToCommit(snapshot)
    const isSubmitting = snapshot.mode === 'SUBMITTING'

    this.actionButtons.submit.label.setText(snapshot.mode === 'SUBMITTING' ? 'Checking' : 'Submit')
    this.setPressableEnabled(this.actionButtons.clear, canClear)
    this.setPressableEnabled(this.actionButtons.backspace, canClear)
    this.setPressableEnabled(this.actionButtons.submit, canSubmit)
    this.actionButtons.clear.container.setAlpha(snapshot.mode === 'FINAL_FEEDBACK' ? 0.3 : 1)
    this.actionButtons.backspace.container.setAlpha(snapshot.mode === 'FINAL_FEEDBACK' ? 0.3 : 1)
    this.actionButtons.submit.container.setAlpha(snapshot.mode === 'FINAL_FEEDBACK' ? 0.4 : 1)

    this.applyButtonPalette(this.actionButtons.clear, {
      fill: canClear ? 0x122638 : COLORS.ink,
      stroke: canClear ? COLORS.cyan : COLORS.borderSoft,
      text: canClear ? '#d7f7ff' : COLORS.textQuiet,
      shadowAlpha: canClear ? 0.16 : 0.08,
      alpha: canEdit ? 1 : 0.76,
      glowAlpha: canClear ? 0.04 : 0.02,
      hoverGlowAlpha: canClear ? 0.08 : 0.03,
      pressedGlowAlpha: canClear ? 0.14 : 0.04,
    })

    this.applyButtonPalette(this.actionButtons.backspace, {
      fill: canClear ? 0x161f31 : COLORS.ink,
      stroke: canClear ? COLORS.amber : COLORS.borderSoft,
      text: canClear ? '#fde68a' : COLORS.textQuiet,
      shadowAlpha: canClear ? 0.16 : 0.08,
      alpha: canEdit ? 1 : 0.76,
      glowAlpha: canClear ? 0.04 : 0.02,
      hoverGlowAlpha: canClear ? 0.08 : 0.03,
      pressedGlowAlpha: canClear ? 0.14 : 0.04,
    })

    this.applyButtonPalette(this.actionButtons.submit, {
      fill: isSubmitting ? 0x0f3040 : readyToCommit ? 0x0f5d4f : canSubmit ? 0x0f5348 : 0x12342f,
      stroke: isSubmitting ? COLORS.cyan : canSubmit ? COLORS.emeraldGlow : 0x245148,
      text: COLORS.text,
      shadowAlpha: readyToCommit ? 0.32 : canSubmit ? 0.28 : 0.12,
      alpha: canSubmit ? 1 : 0.84,
      glowAlpha: readyToCommit ? 0.14 : canSubmit ? 0.1 : 0.03,
      hoverGlowAlpha: readyToCommit ? 0.22 : canSubmit ? 0.18 : 0.05,
      pressedGlowAlpha: readyToCommit ? 0.32 : canSubmit ? 0.28 : 0.08,
      strokeWidth: canSubmit ? 2 : 1,
      pressedStrokeWidth: readyToCommit ? 3 : canSubmit ? 2 : 1,
      shineAlpha: readyToCommit ? 0.14 : canSubmit ? 0.11 : 0.04,
    })
  }

  private syncKeyboard(snapshot: PhaserGameSessionSnapshot) {
    const canEdit = snapshot.canEditGuess
    if (this.keyboardRegion) {
      this.keyboardRegion.setAlpha(snapshot.mode === 'FINAL_FEEDBACK' ? 0.34 : 1)
    }
    const keyPalette: ButtonPalette = canEdit
      ? {
          fill: 0x102131,
          stroke: COLORS.cyan,
          text: '#e0f7ff',
          shadowAlpha: 0.16,
          glowAlpha: 0.05,
          hoverGlowAlpha: 0.12,
          pressedGlowAlpha: 0.22,
          shineAlpha: 0.09,
        }
      : {
          fill: COLORS.ink,
          stroke: COLORS.borderSoft,
          text: COLORS.textQuiet,
          shadowAlpha: 0.08,
          alpha: 0.8,
          glowAlpha: 0.02,
          hoverGlowAlpha: 0.03,
          pressedGlowAlpha: 0.05,
          shineAlpha: 0.03,
        }

    this.keyboardButtons.forEach(({ view }) => {
      this.setPressableEnabled(view, canEdit)
      this.applyButtonPalette(view, keyPalette)
    })

    if (this.spaceButton) {
      this.setPressableEnabled(this.spaceButton, canEdit)
      this.applyButtonPalette(this.spaceButton, keyPalette)
    }
  }

  private syncFeedback(
    snapshot: PhaserGameSessionSnapshot,
    previousSnapshot: PhaserGameSessionSnapshot | undefined,
  ) {
    if (!this.feedbackLayer) {
      return
    }

    const previousKey = getAttemptKey(previousSnapshot?.latestAttempt ?? null)
    const currentKey = getAttemptKey(snapshot.latestAttempt)

    if (currentKey && currentKey !== previousKey && snapshot.latestAttempt) {
      this.showFeedback(snapshot.latestAttempt.label, snapshot.mode === 'FINAL_FEEDBACK')
      return
    }

    if (snapshot.mode !== 'FINAL_FEEDBACK' && !this.feedbackHideEvent && this.feedbackLayer.container.alpha === 0) {
      this.feedbackLayer.container.setVisible(false)
    }
  }

  private syncEndOverlay(
    snapshot: PhaserGameSessionSnapshot,
    previousSnapshot: PhaserGameSessionSnapshot | undefined,
  ) {
    if (!this.endOverlay) {
      return
    }

    const { overlay } = this.layoutMetrics

    if (snapshot.mode !== 'FINAL_FEEDBACK') {
      this.clueStackRegion?.setAlpha(1)
      this.refreshOverlayEffects(false, COLORS.cyan)
      if (previousSnapshot?.mode === 'FINAL_FEEDBACK') {
        this.tweens.add({
          targets: this.endOverlay.container,
          alpha: 0,
          duration: 180,
          ease: 'Quad.Out',
          onComplete: () => {
            this.endOverlay?.container.setVisible(false)
          },
        })
      } else {
        this.endOverlay.container.setVisible(false)
        this.endOverlay.container.setAlpha(0)
      }
      return
    }

    const label = snapshot.latestAttempt?.label ?? 'wrong'
    const diagnosisText = snapshot.finalDiagnosis ?? snapshot.latestAttempt?.guess ?? 'Diagnosis submitted'
    const title =
      label === 'correct' ? 'Diagnosis confirmed' : label === 'close' ? 'Close call' : 'Round complete'
    const helper =
      label === 'correct'
        ? 'Open the explanation to see why this diagnosis fits.'
        : 'Review the explanation or continue when you are ready.'
    const accentColor = label === 'correct' ? COLORS.emerald : label === 'close' ? COLORS.amber : COLORS.rose

    this.endOverlay.eyebrow.setText(label === 'correct' ? 'CORRECT' : label === 'close' ? 'CLOSE' : 'ROUND COMPLETE')
    this.endOverlay.title.setText(title)
    this.endOverlay.diagnosis.setText(diagnosisText)
    this.endOverlay.helper.setText(helper)
    this.endOverlay.accent.setFillStyle(accentColor, 0.95)
    this.endOverlay.eyebrow.setColor(label === 'correct' ? '#6ee7b7' : label === 'close' ? '#fcd34d' : '#fda4af')
    this.endOverlay.glow.setFillStyle(accentColor, 0.1)

    this.applyButtonPalette(this.endOverlay.continueButton, {
      fill: COLORS.emerald,
      stroke: COLORS.emerald,
      text: COLORS.text,
      shadowAlpha: 0.24,
    })
    this.setPressableEnabled(this.endOverlay.continueButton, true)
    this.setPressableEnabled(this.endOverlay.explanationButton, snapshot.canOpenExplanation)
    this.applyButtonPalette(this.endOverlay.explanationButton, {
      fill: snapshot.canOpenExplanation ? COLORS.panelMuted : COLORS.ink,
      stroke: snapshot.canOpenExplanation ? COLORS.border : COLORS.borderSoft,
      text: snapshot.canOpenExplanation ? COLORS.text : COLORS.textQuiet,
      shadowAlpha: snapshot.canOpenExplanation ? 0.18 : 0.08,
      alpha: snapshot.canOpenExplanation ? 1 : 0.82,
    })

    if (previousSnapshot?.mode !== 'FINAL_FEEDBACK') {
      this.animateFinalRevealSettle()
      this.endOverlay.container.setVisible(true)
      this.endOverlay.container.setAlpha(0)
      this.endOverlay.panel.y = overlay.y + overlay.entryOffset
      this.endOverlay.glow.setAlpha(0.08)
      this.endOverlay.beam.setAlpha(0.14)
      this.tweens.add({
        targets: this.endOverlay.container,
        alpha: 1,
        duration: 170,
        ease: 'Quad.Out',
      })
      this.tweens.add({
        targets: this.endOverlay.panel,
        y: overlay.y,
        duration: 220,
        ease: 'Cubic.Out',
        onComplete: () => {
          this.refreshOverlayEffects(true, accentColor)
        },
      })
    } else {
      this.endOverlay.container.setVisible(true)
      this.endOverlay.container.setAlpha(1)
      this.endOverlay.panel.y = overlay.y
      this.refreshOverlayEffects(true, accentColor)
    }
  }

  private animateNewClueCard(
    view: ClueCardView,
    targetX: number,
    targetY: number,
    scale: number,
    alpha: number,
  ) {
    const dropInOffset = Math.max(5, Math.round(this.layoutMetrics.clues.height * (8 / 340)))
    view.container.setPosition(targetX, targetY + dropInOffset)
    view.container.setScale(scale)
    view.container.setAlpha(Math.min(0.4, alpha))
    this.tweens.killTweensOf(view.container)
    this.tweens.add({
      targets: view.container,
      x: targetX,
      y: targetY,
      alpha,
      scaleX: scale,
      scaleY: scale,
      duration: 180,
      ease: 'Cubic.Out',
    })
  }

  private animateGuessSubmit() {
    if (!this.guessBar) {
      return
    }

    this.guessBarState = 'submitting'
    this.syncGuessBar(this.getSnapshot())
    this.guessBarResetEvent?.remove(false)
    this.guessBarResetEvent = undefined
    this.tweens.killTweensOf(this.guessBar.container)
    if (this.actionButtons?.submit) {
      this.tweens.killTweensOf(this.actionButtons.submit.container)
      this.tweens.killTweensOf(this.actionButtons.submit.glow)
      this.tweens.add({
        targets: this.actionButtons.submit.container,
        scaleX: 0.978,
        scaleY: 0.978,
        duration: 70,
        yoyo: true,
        ease: 'Quad.Out',
        onComplete: () => {
          this.actionButtons?.submit.container.setScale(1)
        },
      })
      this.tweens.add({
        targets: this.actionButtons.submit.glow,
        alpha: { from: this.actionButtons.submit.glow.alpha, to: 0.34 },
        duration: 90,
        yoyo: true,
        ease: 'Quad.Out',
      })
    }
    this.tweens.add({
      targets: this.guessBar.container,
      scaleX: 0.988,
      scaleY: 0.988,
      y: this.layoutMetrics.guessBar.y + 1,
      duration: 72,
      yoyo: true,
      ease: 'Quad.Out',
      onComplete: () => {
        this.guessBar?.container.setScale(1)
        this.guessBar?.container.setY(this.layoutMetrics.guessBar.y)
        this.syncGuessBar(this.getSnapshot())
      },
    })
  }

  private animateReadyToCommit() {
    if (!this.guessBar) {
      return
    }

    this.tweens.killTweensOf(this.guessBar.halo)
    this.tweens.add({
      targets: this.guessBar.halo,
      alpha: { from: Math.max(this.guessBar.halo.alpha, 0.18), to: 0.18 },
      scaleX: { from: 1.008, to: 1.04 },
      scaleY: { from: 1.008, to: 1.04 },
      duration: 170,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.guessBar?.halo.setScale(1)
        this.syncGuessBar(this.getSnapshot())
      },
    })

    if (this.actionButtons?.submit) {
      this.tweens.killTweensOf(this.actionButtons.submit.container)
      this.tweens.killTweensOf(this.actionButtons.submit.glow)
      this.tweens.add({
        targets: this.actionButtons.submit.container,
        scaleX: 1.012,
        scaleY: 1.012,
        duration: 120,
        yoyo: true,
        ease: 'Quad.Out',
        onComplete: () => {
          this.actionButtons?.submit.container.setScale(1)
        },
      })
      this.tweens.add({
        targets: this.actionButtons.submit.glow,
        alpha: { from: this.actionButtons.submit.glow.alpha, to: Math.max(0.24, this.actionButtons.submit.glow.alpha) },
        duration: 140,
        yoyo: true,
        ease: 'Quad.Out',
      })
    }
  }

  private animateFinalRevealSettle() {
    if (this.clueStackRegion) {
      this.tweens.killTweensOf(this.clueStackRegion)
      this.tweens.add({
        targets: this.clueStackRegion,
        alpha: 0.84,
        duration: 180,
        ease: 'Quad.Out',
      })
    }

    if (this.guessBar) {
      this.tweens.killTweensOf(this.guessBar.container)
      this.tweens.add({
        targets: this.guessBar.container,
        alpha: 0.68,
        scaleX: 0.994,
        scaleY: 0.994,
        duration: 180,
        ease: 'Quad.Out',
        onComplete: () => {
          this.guessBar?.container.setScale(1)
        },
      })
    }
  }

  private animateWrongGuess(persist: boolean) {
    this.setGuessBarState('wrong', persist ? undefined : 900)
    this.shakeHorizontal(this.guessBar?.container, this.layoutMetrics.guessBar.x)
    this.pulseHalo(COLORS.rose, 0.28)
    this.emitBurst(
      this.feedbackBurstPool,
      LAB_MOTE_TEXTURE,
      this.layoutMetrics.guessBar.x + Math.round(this.layoutMetrics.guessBar.width * 0.5),
      this.layoutMetrics.guessBar.y + Math.round(this.layoutMetrics.guessBar.height * 0.42),
      COLORS.rose,
      getLabVisualBudget(this.layoutMetrics.board).feedbackBursts,
      this.feedbackRoot,
      DEPTH.FEEDBACK,
    )
  }

  private animateCloseGuess(persist: boolean) {
    this.setGuessBarState('close', persist ? undefined : 1050)
    this.pulseHalo(COLORS.amber, 0.28)
    this.emitBurst(
      this.feedbackBurstPool,
      LAB_MOTE_TEXTURE,
      this.layoutMetrics.guessBar.x + Math.round(this.layoutMetrics.guessBar.width * 0.5),
      this.layoutMetrics.guessBar.y + Math.round(this.layoutMetrics.guessBar.height * 0.42),
      COLORS.amber,
      Math.max(6, getLabVisualBudget(this.layoutMetrics.board).feedbackBursts - 1),
      this.feedbackRoot,
      DEPTH.FEEDBACK,
    )
    this.tweens.add({
      targets: this.guessBar?.container,
      scaleX: 1.015,
      scaleY: 1.015,
      duration: 110,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.guessBar?.container.setScale(1)
      },
    })
  }

  private animateCorrectGuess(persist: boolean) {
    this.setGuessBarState('correct', persist ? undefined : 1300)
    this.pulseHalo(COLORS.emeraldGlow, 0.34)
    this.emitBurst(
      this.feedbackBurstPool,
      LAB_MOTE_TEXTURE,
      this.layoutMetrics.guessBar.x + Math.round(this.layoutMetrics.guessBar.width * 0.5),
      this.layoutMetrics.guessBar.y + Math.round(this.layoutMetrics.guessBar.height * 0.42),
      COLORS.emeraldGlow,
      getLabVisualBudget(this.layoutMetrics.board).feedbackBursts,
      this.feedbackRoot,
      DEPTH.FEEDBACK,
    )
    this.tweens.add({
      targets: this.guessBar?.container,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 130,
      yoyo: true,
      ease: 'Back.Out',
      onComplete: () => {
        this.guessBar?.container.setScale(1)
      },
    })
  }

  private animateInvalidSubmit() {
    this.shakeHorizontal(this.guessBar?.container, this.layoutMetrics.guessBar.x, 4, 3)
    this.pulseHalo(COLORS.rose, 0.18)
  }

  private showRewardToast(reward: NonNullable<PhaserGameSessionSnapshot['reward']>) {
    if (!this.rewardToast || reward.xp <= 0) {
      return
    }

    const bonus = reward.streak ? `Streak ${reward.streak}` : 'Correct'
    this.rewardToast.label.setText(`+${reward.xp} XP`)
    this.rewardToast.sublabel.setText(bonus)
    this.rewardToast.container.setVisible(true)
    this.rewardToast.container.setAlpha(0)
    this.rewardToast.container.setScale(0.96)
    this.rewardToast.container.setY(this.layoutMetrics.board.y + Math.round(this.layoutMetrics.board.height * 0.24))
    this.tweens.killTweensOf(this.rewardToast.container)
    this.tweens.add({
      targets: this.rewardToast.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: this.layoutMetrics.board.y + Math.round(this.layoutMetrics.board.height * 0.2),
      duration: 180,
      ease: 'Cubic.Out',
      yoyo: true,
      hold: 560,
      onComplete: () => {
        this.rewardToast?.container.setVisible(false)
      },
    })
  }

  private showFeedback(label: FeedbackLabel, persist: boolean) {
    if (!this.feedbackLayer) {
      return
    }

    const { feedback } = this.layoutMetrics

    const palette =
      label === 'correct'
        ? { fill: COLORS.emeraldSoft, stroke: COLORS.emerald, text: '#6ee7b7' }
        : label === 'close'
        ? { fill: COLORS.amberSoft, stroke: COLORS.amber, text: '#fcd34d' }
        : { fill: COLORS.roseSoft, stroke: COLORS.rose, text: '#fda4af' }

    this.feedbackHideEvent?.remove(false)
    this.feedbackHideEvent = undefined

    this.feedbackLayer.background.setFillStyle(palette.fill, 0.96)
    this.feedbackLayer.background.setStrokeStyle(1, palette.stroke, 1)
    this.feedbackLayer.glow.setFillStyle(palette.stroke, 0.12)
    this.feedbackLayer.label.setText(getFeedbackText(label))
    this.feedbackLayer.label.setColor(palette.text)
    this.feedbackLayer.container.setVisible(true)
    this.feedbackLayer.container.setAlpha(0)
    this.feedbackLayer.container.setScale(0.94)
    this.feedbackLayer.container.y = feedback.y + feedback.baselineOffset

    this.tweens.killTweensOf(this.feedbackLayer.container)
    this.tweens.add({
      targets: this.feedbackLayer.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: feedback.y,
      duration: 200,
      ease: 'Cubic.Out',
    })

    if (!persist) {
      this.feedbackHideEvent = this.time.delayedCall(1100, () => {
        this.tweens.add({
          targets: this.feedbackLayer?.container,
          alpha: 0,
          y: feedback.y - Math.max(4, Math.round(feedback.baselineOffset * 1.34)),
          duration: 180,
          ease: 'Quad.In',
          onComplete: () => {
            this.feedbackLayer?.container.setVisible(false)
            if (this.feedbackLayer) {
              this.feedbackLayer.container.y = feedback.y
            }
          },
        })
        this.feedbackHideEvent = undefined
      })
    }
  }

  private setGuessBarState(state: GuessBarState, duration?: number) {
    this.guessBarState = state
    this.guessBarResetEvent?.remove(false)
    this.guessBarResetEvent = undefined
    this.syncGuessBar(this.getSnapshot())

    if (!duration) {
      return
    }

    this.guessBarResetEvent = this.time.delayedCall(duration, () => {
      this.guessBarState = getGuessBarBaseState(this.getSnapshot())
      this.guessBarResetEvent = undefined
      this.syncGuessBar(this.getSnapshot())
    })
  }

  private refreshGuessBarGlow(
    state: GuessBarState,
    style: { haloAlpha: number; haloColor: number },
  ) {
    if (!this.guessBar) {
      return
    }

    if (state === 'typing') {
      if (!this.guessBarGlowTween || !this.guessBarGlowTween.isPlaying()) {
        this.guessBarGlowTween?.stop()
        this.guessBarGlowTween = this.tweens.add({
          targets: this.guessBar.halo,
          alpha: { from: 0.14, to: 0.28 },
          duration: 760,
          ease: 'Sine.InOut',
          yoyo: true,
          repeat: -1,
        })
      }
      return
    }

    this.guessBarGlowTween?.stop()
    this.guessBarGlowTween = undefined
    this.guessBar.halo.setAlpha(style.haloAlpha)
  }

  private pulseHalo(color: number, alpha: number) {
    if (!this.guessBar) {
      return
    }

    this.guessBar.halo.setFillStyle(color, alpha)
    this.tweens.killTweensOf(this.guessBar.halo)
    this.tweens.add({
      targets: this.guessBar.halo,
      alpha: { from: alpha, to: 0.05 },
      scaleX: { from: 1.02, to: 1.08 },
      scaleY: { from: 1.02, to: 1.08 },
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.guessBar?.halo.setScale(1)
        this.syncGuessBar(this.getSnapshot())
      },
    })
  }

  private shakeHorizontal(
    target: Phaser.GameObjects.Container | undefined,
    baseX: number,
    distance = 6,
    repeat = 4,
  ) {
    if (!target) {
      return
    }

    this.tweens.killTweensOf(target)
    this.tweens.add({
      targets: target,
      x: baseX + distance,
      duration: 42,
      yoyo: true,
      repeat,
      ease: 'Sine.InOut',
      onComplete: () => {
        target.x = baseX
      },
    })
  }

  private getGuessBarVisual(state: GuessBarState) {
    switch (state) {
      case 'typing':
        return {
          fill: 0x0f2133,
          stroke: COLORS.cyan,
          haloColor: COLORS.sky,
          haloAlpha: 0.18,
          labelColor: '#a5f3fc',
          valueColor: COLORS.text,
          helper: '',
          helperColor: COLORS.textMuted,
        }
      case 'submitting':
        return {
          fill: 0x0c1f2b,
          stroke: COLORS.cyan,
          haloColor: COLORS.cyan,
          haloAlpha: 0.18,
          labelColor: '#a5f3fc',
          valueColor: COLORS.text,
          helper: '',
          helperColor: '#a5f3fc',
        }
      case 'wrong':
        return {
          fill: COLORS.roseSoft,
          stroke: COLORS.rose,
          haloColor: COLORS.rose,
          haloAlpha: 0.18,
          labelColor: '#fecdd3',
          valueColor: COLORS.text,
          helper: '',
          helperColor: '#fda4af',
        }
      case 'close':
        return {
          fill: COLORS.amberSoft,
          stroke: COLORS.amber,
          haloColor: COLORS.amber,
          haloAlpha: 0.2,
          labelColor: '#fde68a',
          valueColor: COLORS.text,
          helper: '',
          helperColor: '#fcd34d',
        }
      case 'correct':
        return {
          fill: COLORS.emeraldSoft,
          stroke: COLORS.emerald,
          haloColor: COLORS.emeraldGlow,
          haloAlpha: 0.22,
          labelColor: '#bbf7d0',
          valueColor: COLORS.text,
          helper: '',
          helperColor: '#86efac',
        }
      case 'disabled':
        return {
          fill: 0x0a1521,
          stroke: COLORS.borderSoft,
          haloColor: COLORS.borderSoft,
          haloAlpha: 0.06,
          labelColor: COLORS.textQuiet,
          valueColor: COLORS.textQuiet,
          helper: 'LOCKED',
          helperColor: COLORS.textQuiet,
        }
      default:
        return {
          fill: 0x0d1a2a,
          stroke: COLORS.cyan,
          haloColor: COLORS.cyan,
          haloAlpha: 0.1,
          labelColor: '#93c5fd',
          valueColor: '#cbd5e1',
          helper: '',
          helperColor: COLORS.textQuiet,
        }
    }
  }

  private createClueCard(clue: PhaserVisibleClue, width: number): ClueCardView {
    const { clues, typography } = this.layoutMetrics
    const textInsetX = Math.max(12, Math.round(width * 0.045))
    const typeTop = Math.max(10, Math.round(clues.height * (12 / 340)))
    const valueTop = typeTop + Math.max(14, Math.round(typography.clueType * 1.8))
    const minHeight = Math.max(56, Math.round(clues.height * (72 / 340)))
    const shadowOffset = Math.max(4, Math.round(clues.height * (8 / 340)))
    const accentWidth = Math.max(4, Math.round(width * 0.017))

    const palette = getClueTone(clue.type)
    const container = this.add.container(0, 0)
    const typeText = this.createText(textInsetX, typeTop, clue.type.toUpperCase(), {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.clueType),
      color: palette.tag,
      fontStyle: 'bold',
    })
    const valueText = this.createText(textInsetX, valueTop, clue.value, {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.clueValue),
      color: COLORS.text,
      wordWrap: { width: width - textInsetX * 2, useAdvancedWrap: true },
      lineSpacing: Math.max(2, Math.round(typography.clueValue * 0.22)),
    })
    const height = Math.max(minHeight, Math.round(valueTop + valueText.height + Math.max(14, clues.height * (14 / 340))))
    const glow = this.add.rectangle(-4, -4, width + 8, height + 8, palette.stroke, 0.08).setOrigin(0)
    const shadow = this.add.rectangle(0, shadowOffset, width, height, COLORS.shadow, 0.22).setOrigin(0)
    const background = this.add
      .rectangle(0, 0, width, height, palette.fill, 0.94)
      .setOrigin(0)
      .setStrokeStyle(1, palette.stroke, 0.74)
    const accent = this.add.rectangle(0, 0, accentWidth, height, palette.stroke, 0.9).setOrigin(0)
    const frame = this.add
      .rectangle(3, 3, Math.max(1, width - 6), Math.max(1, height - 6), 0xffffff, 0)
      .setOrigin(0)
      .setStrokeStyle(1, palette.stroke, 0.2)
    const sheen = this.add
      .rectangle(-Math.max(28, Math.round(width * 0.18)), 4, Math.max(24, Math.round(width * 0.14)), Math.max(24, height - 8), 0xffffff, 0.18)
      .setOrigin(0)
    sheen.setVisible(false)
    sheen.setAlpha(0)

    container.add([glow, shadow, background, accent, frame, sheen, typeText, valueText])

    return {
      id: clue.id,
      container,
      glow,
      shadow,
      background,
      accent,
      frame,
      sheen,
      typeText,
      valueText,
      width,
      height,
    }
  }

  private refreshClueCard(view: ClueCardView, clue: PhaserVisibleClue, age: number) {
    const { clues, typography } = this.layoutMetrics
    const width = Math.max(120, clues.width - clues.cardInset * 2)
    const textInsetX = Math.max(12, Math.round(width * 0.045))
    const typeTop = Math.max(10, Math.round(clues.height * (12 / 340)))
    const valueTop = typeTop + Math.max(14, Math.round(typography.clueType * 1.8))
    const minHeight = Math.max(56, Math.round(clues.height * (72 / 340)))
    const shadowOffset = Math.max(4, Math.round(clues.height * (8 / 340)))
    const accentWidth = Math.max(4, Math.round(width * 0.017))
    const textResolution = getCaseSceneTextResolution(Math.max(0.5, 1 - age * 0.08))

    const palette = getClueTone(clue.type)
    const isLatest = age === 0
    const backgroundAlpha = isLatest ? 0.96 : Phaser.Math.Clamp(0.86 - age * 0.05, 0.74, 0.86)

    view.width = width
    view.typeText.setResolution(textResolution)
    view.typeText.setText(clue.type.toUpperCase())
    view.typeText.setPosition(textInsetX, typeTop)
    view.typeText.setFontSize(this.toFontPx(typography.clueType))
    view.typeText.setAlpha(isLatest ? 0.95 : 0.78)
    view.valueText.setResolution(textResolution)
    view.valueText.setText(clue.value)
    view.valueText.setPosition(textInsetX, valueTop)
    view.valueText.setFontSize(this.toFontPx(typography.clueValue))
    view.valueText.setLineSpacing(Math.max(2, Math.round(typography.clueValue * 0.22)))
    view.valueText.setWordWrapWidth(width - textInsetX * 2)
    view.valueText.setAlpha(isLatest ? 1 : 0.84)

    const nextHeight = Math.max(minHeight, Math.round(valueTop + view.valueText.height + Math.max(14, clues.height * (14 / 340))))
    view.height = nextHeight

    this.setRectangleDimensions(view.glow, width + 8, nextHeight + 8)
    view.glow.setPosition(-4, -4)
    this.setRectangleDimensions(view.shadow, width, nextHeight)
    view.shadow.setY(shadowOffset)
    this.setRectangleDimensions(view.background, width, nextHeight)
    this.setRectangleDimensions(view.accent, accentWidth, nextHeight)
    this.setRectangleDimensions(view.frame, Math.max(1, width - 6), Math.max(1, nextHeight - 6))
    view.frame.setPosition(3, 3)
    this.setRectangleDimensions(view.sheen, Math.max(24, Math.round(width * 0.14)), Math.max(24, nextHeight - 8))
    view.sheen.setY(4)

    view.typeText.setColor(isLatest ? '#bbf7d0' : palette.tag)
    view.typeText.setScale(1)
    view.valueText.setScale(1)
    view.background.setFillStyle(palette.fill, backgroundAlpha)
    view.background.setStrokeStyle(isLatest ? 2 : 1, palette.stroke, isLatest ? 0.94 : 0.34)
    view.accent.setFillStyle(palette.stroke, isLatest ? 0.94 : 0.5)
    view.glow.setFillStyle(palette.stroke, isLatest ? 0.06 : 0)
    view.frame.setStrokeStyle(1, palette.stroke, isLatest ? 0.22 : 0.08)
    view.shadow.setAlpha(isLatest ? 0.16 : 0.08)
  }

  private createPressableButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onPress: () => void,
  ): PressableButtonView {
    const container = this.add.container(x, y)
    const glow = this.add.rectangle(-5, -5, width + 10, height + 10, COLORS.cyan, 0.06).setOrigin(0)
    const shadow = this.add.rectangle(0, 4, width, height, COLORS.shadow, 0.18).setOrigin(0)
    const background = this.add
      .rectangle(0, 0, width, height, COLORS.panelSoft, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border, 1)
    const shine = this.add
      .rectangle(Math.round(width * 0.12), Math.round(height * 0.18), Math.max(22, Math.round(width * 0.36)), Math.max(10, Math.round(height * 0.22)), 0xffffff, 0.08)
      .setOrigin(0)
    const text = this.createText(width / 2, height / 2, label, {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(this.layoutMetrics.typography.actionLabel),
      color: COLORS.text,
      fontStyle: 'bold',
      align: 'center',
    })
    text.setOrigin(0.5)

    let isPressed = false
    const view: PressableButtonView = {
      container,
      glow,
      shadow,
      background,
      shine,
      label: text,
      enabled: true,
      palette: undefined,
    }

    background.setInteractive({ useHandCursor: true })
    background.on('pointerdown', () => {
      if (!view.enabled) {
        return
      }

      isPressed = true
      this.setPressableVisualState(view, 'pressed')
    })
    background.on('pointerover', () => {
      if (!view.enabled) {
        return
      }

      this.setPressableVisualState(view, 'hover')
    })
    background.on('pointerup', () => {
      if (!view.enabled) {
        isPressed = false
        return
      }

      if (isPressed) {
        onPress()
      }
      isPressed = false
      this.setPressableVisualState(view, 'rest')
    })
    background.on('pointerout', () => {
      isPressed = false
      this.setPressableVisualState(view, 'rest')
    })

    container.add([glow, shadow, background, shine, text])
    return view
  }

  private setPressableVisualState(view: PressableButtonView, state: 'rest' | 'hover' | 'pressed') {
    const palette = view.palette
    const baseGlow = palette?.glowAlpha ?? (view.enabled ? 0.06 : 0.02)
    const hoverGlow = palette?.hoverGlowAlpha ?? Math.max(baseGlow + 0.05, 0.1)
    const pressedGlow = palette?.pressedGlowAlpha ?? Math.max(baseGlow + 0.12, 0.18)
    const shineAlpha = palette?.shineAlpha ?? (view.enabled ? 0.08 : 0.03)
    const strokeWidth = palette?.strokeWidth ?? 1
    const pressedStrokeWidth = palette?.pressedStrokeWidth ?? Math.max(strokeWidth, 2)
    const height = Math.round(view.background.height)
    const width = Math.round(view.background.width)

    if (!view.enabled) {
      view.container.setScale(1)
      view.background.setY(0)
      view.label.setY(Math.round(height / 2))
      view.shine.setPosition(Math.round(width * 0.12), Math.round(height * 0.18))
      view.shine.setAlpha(Math.min(shineAlpha, 0.03))
      view.shadow.y = 4
      view.glow.setAlpha(baseGlow)
      view.background.setStrokeStyle(strokeWidth, palette?.stroke ?? COLORS.borderSoft, 1)
      return
    }

    if (state === 'pressed') {
      view.container.setScale(0.972)
      view.background.setY(1)
      view.label.setY(Math.round(height / 2) + 1)
      view.shine.setPosition(Math.round(width * 0.12), Math.round(height * 0.18) + 1)
      view.shine.setAlpha(Math.min(shineAlpha * 0.45, 0.05))
      view.shadow.y = 1
      view.glow.setAlpha(pressedGlow)
      view.background.setStrokeStyle(pressedStrokeWidth, palette?.stroke ?? COLORS.cyan, 1)
      return
    }

    view.container.setScale(state === 'hover' ? 1.01 : 1)
    view.background.setY(0)
    view.label.setY(Math.round(height / 2))
    view.shine.setPosition(Math.round(width * 0.12), Math.round(height * 0.18))
    view.shine.setAlpha(state === 'hover' ? Math.min(shineAlpha + 0.02, 0.14) : shineAlpha)
    view.shadow.y = state === 'hover' ? 3 : 4
    view.glow.setAlpha(state === 'hover' ? hoverGlow : baseGlow)
    view.background.setStrokeStyle(strokeWidth, palette?.stroke ?? COLORS.border, 1)
  }

  private applyButtonPalette(view: PressableButtonView, palette: ButtonPalette) {
    view.palette = palette
    view.glow.setFillStyle(palette.stroke, palette.glowAlpha ?? (view.enabled ? 0.06 : 0.02))
    view.background.setFillStyle(palette.fill, palette.alpha ?? 1)
    view.background.setStrokeStyle(palette.strokeWidth ?? 1, palette.stroke, 1)
    view.shine.setFillStyle(0xffffff, palette.shineAlpha ?? (view.enabled ? 0.08 : 0.03))
    view.shadow.setAlpha(palette.shadowAlpha)
    view.label.setColor(palette.text)
    view.container.setAlpha(palette.alpha ?? 1)
    this.setPressableVisualState(view, 'rest')
  }

  private setPressableEnabled(view: PressableButtonView, enabled: boolean) {
    if (view.enabled === enabled) {
      return
    }

    view.enabled = enabled

    if (enabled) {
      view.background.setInteractive({ useHandCursor: true })
      this.setPressableVisualState(view, 'rest')
      return
    }

    view.background.disableInteractive()
    this.setPressableVisualState(view, 'rest')
  }

  private handleKeyPressIntent(value: string) {
    const snapshot = this.getSnapshot()
    if (!snapshot.canEditGuess) {
      return
    }

    this.getIntents().onKeyPress(value)
  }

  private handleOpenMenuIntent() {
    this.getIntents().onOpenMenu()
  }

  private handleClearIntent() {
    const snapshot = this.getSnapshot()
    if (!snapshot.canEditGuess || snapshot.guess.length === 0) {
      return
    }

    this.getIntents().onClearGuess()
  }

  private handleBackspaceIntent() {
    const snapshot = this.getSnapshot()
    if (!snapshot.canEditGuess || snapshot.guess.length === 0) {
      return
    }

    this.getIntents().onBackspace()
  }

  private handleSubmitIntent() {
    const snapshot = this.getSnapshot()
    if (snapshot.submitDisabled) {
      this.animateInvalidSubmit()
      return
    }

    this.animateGuessSubmit()
    this.getIntents().onSubmit()
  }

  private createText(
    x: number,
    y: number,
    value: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    resolution = getCaseSceneTextResolution(),
  ) {
    return this.add
      .text(Math.round(x), Math.round(y), value, style)
      .setResolution(resolution)
  }
}

export function createCaseScene(
  getSnapshot: () => PhaserGameSessionSnapshot,
  getIntents: () => PhaserGameSessionIntents,
) {
  return new DiagnosisLabScene(getSnapshot, getIntents)
}

export { DiagnosisLabScene as CaseScene }

export const caseSceneConfig = {
  key: SCENE_KEY,
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
}
