import type { ClinicalClue } from '../game.types'
import type { GameAttempt, GameEngineMode, GameRewardState } from '../useGameEngine'

export type PhaserVisibleClue = Pick<ClinicalClue, 'id' | 'type' | 'value'> & {
  isNewest: boolean
}

export type PhaserGameSessionSnapshot = {
  mode: GameEngineMode['type']
  isLoading: boolean
  totalClues: number
  revealedClueCount: number
  visibleClues: PhaserVisibleClue[]
  latestAttempt: GameAttempt | null
  guess: string
  canEditGuess: boolean
  submitDisabled: boolean
  canOpenExplanation: boolean
  waitingCountdownText: string | null
  unavailableReason: string | null
  canRetry: boolean
  feedbackLabel: GameAttempt['label'] | null
  finalDiagnosis: string | null
  headerStatus: string | null
  reward: GameRewardState
}

export type PhaserGameSessionIntents = {
  onKeyPress: (value: string) => void
  onSubmit: () => void
  onContinue: () => void
  onOpenExplanation: () => void
  onOpenMenu: () => void
  onClearGuess: () => void
  onBackspace: () => void
  onReload: () => void
}
