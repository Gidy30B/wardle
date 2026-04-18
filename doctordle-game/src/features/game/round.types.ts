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

export type RoundHudViewModel = {
  clueProgressLabel: string
  statusLabel: string | null
}

export type RoundViewModel = {
  mode: GameEngineMode['type']
  loopState: RoundLoopState
  sessionId: string | null
  caseId: string | null
  isLoading: boolean
  totalClues: number
  revealedClueCount: number
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
  reward: GameRewardState
  waitingCountdownText: string | null
  unavailableReason: string | null
  canRetry: boolean
  canOpenExplanation: boolean
  explanationAvailable: boolean
  hud: RoundHudViewModel
}
