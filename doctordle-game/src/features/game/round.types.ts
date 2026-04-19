import type { ClinicalClue, GameResult } from './game.types'
import type { GameAttempt, GameEngineMode, GameRewardState } from './useGameEngine'

export type RoundLoopState =
  | 'loading_case'
  | 'playing'
  | 'submitting'
  | 'round_complete'
  | 'waiting_next_case'
  | 'blocked'

export type RoundVisibleClue = Pick<ClinicalClue, 'id' | 'type' | 'value'> & {
  isNewest: boolean
}

export type RoundOutcomeTone =
  | 'early_save'
  | 'steady_save'
  | 'last_chance_save'
  | 'patient_lost'

export type RoundHudViewModel = {
  statusLabel: string | null
  xpTotal: number | null
  level: number | null
  viabilityRemaining: number
  viabilityTotal: number
}

export type RoundViewModel = {
  mode: GameEngineMode['type']
  loopState: RoundLoopState
  sessionId: string | null
  caseId: string | null
  isLoading: boolean
  totalClues: number
  revealedClueCount: number
  cluesRemaining: number
  visibleClues: RoundVisibleClue[]
  guess: string
  canEditGuess: boolean
  canSubmit: boolean
  submitDisabled: boolean
  latestAttempt: GameAttempt | null
  attemptsCount: number
  latestResult: GameResult | null
  feedbackLabel: GameAttempt['label'] | null
  finalDiagnosis: string | null
  outcomeTone: RoundOutcomeTone | null
  reward: GameRewardState
  waitingCountdownText: string | null
  unavailableReason: string | null
  canRetry: boolean
  canOpenExplanation: boolean
  explanationAvailable: boolean
  hud: RoundHudViewModel
}
