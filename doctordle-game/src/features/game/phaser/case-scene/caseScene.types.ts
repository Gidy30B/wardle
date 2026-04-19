import Phaser from 'phaser'
import type { PhaserGameSessionSnapshot, PhaserVisibleClue } from '../gameSessionBridge'

export type GuessBarState = 'empty' | 'typing' | 'disabled' | 'submitting' | 'wrong' | 'close' | 'correct'
export type FeedbackLabel = NonNullable<PhaserGameSessionSnapshot['feedbackLabel']>
export type HeaderTensionState = 'safe' | 'warning' | 'danger'

export type CluePalette = {
  fill: number
  stroke: number
  tag: string
}

export type ButtonPalette = {
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

export type PressableButtonView = {
  container: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Rectangle
  shadow: Phaser.GameObjects.Rectangle
  background: Phaser.GameObjects.Rectangle
  shine: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  enabled: boolean
  palette?: ButtonPalette
}

export type ClueCardView = {
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

export type GuessBarView = {
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

export type FeedbackView = {
  container: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Rectangle
  background: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
}

export type EndOverlayView = {
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

export type StatePanelView = {
  container: Phaser.GameObjects.Container
  background: Phaser.GameObjects.Rectangle
  eyebrow: Phaser.GameObjects.Text
  title: Phaser.GameObjects.Text
  body: Phaser.GameObjects.Text
  menuButton: PressableButtonView
  actionButton: PressableButtonView
}

export type RewardToastView = {
  container: Phaser.GameObjects.Container
  label: Phaser.GameObjects.Text
  sublabel: Phaser.GameObjects.Text
}

export type GeometryAuditEntry = {
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

export type ScaleAuditEntry = {
  label: string
  runtimeScaleX: number
  runtimeScaleY: number
  restScale: string
  hoverScale: string
  pressScale: string
  animationScale: string
  childContentScaled: boolean
}

export type OnboardingState = 'inactive' | 'pending' | 'playing' | 'awaiting_tap' | 'skipped' | 'complete'

export type RoundVisualState =
  | 'boot'
  | 'loading_case'
  | 'round_intro'
  | 'playing'
  | 'submitting'
  | 'guess_result'
  | 'reveal_next_clue'
  | 'round_complete'
  | 'waiting_next_case'
  | 'blocked'

export type CaseSceneSnapshot = PhaserGameSessionSnapshot
export type CaseSceneVisibleClue = PhaserVisibleClue
