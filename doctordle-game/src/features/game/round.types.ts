import type {
  DiagnosisDictionaryAvailability,
  DiagnosisInputState,
  DiagnosisSubmitMode,
} from './diagnosisInput.state'
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

export type RoundSelectedDiagnosis = {
  diagnosisRegistryId: string
  displayLabel: string
}

export type RoundDiagnosisSuggestion = {
  diagnosisRegistryId: string
  displayLabel: string
  matchKind: 'label_prefix' | 'alias_prefix' | 'label_contains' | 'alias_contains'
}

export type RoundSuggestionsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export type RoundDiagnosisStatusTone =
  | 'neutral'
  | 'selected'
  | 'warning'
  | 'blocked'

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
  selectedSuggestion: RoundSelectedDiagnosis | null
  selectedDiagnosisLabel: string | null
  suggestions: RoundDiagnosisSuggestion[]
  suggestionsStatus: RoundSuggestionsStatus
  suggestionsStatusLabel: string | null
  highlightedSuggestionIndex: number
  canEditGuess: boolean
  canSubmit: boolean
  submitDisabled: boolean
  latestAttempt: GameAttempt | null
  attemptHistory: GameAttempt[]
  attemptsCount: number
  resultAttemptsUsed: number | null
  resultCluesUsed: number | null
  resultWasCorrect: boolean | null
  latestResult: GameResult | null
  feedbackLabel: GameAttempt['label'] | null
  finalDiagnosis: string | null
  finalExplanation: string | null
  outcomeTone: RoundOutcomeTone | null
  reward: GameRewardState
  elapsedSeconds: number | null
  elapsedTimeText: string | null
  waitingCountdownText: string | null
  unavailableReason: string | null
  canRetry: boolean
  canOpenExplanation: boolean
  explanationAvailable: boolean
  diagnosisInputMode: DiagnosisInputState['mode']
  diagnosisSubmitMode: DiagnosisSubmitMode
  dictionaryAvailability: DiagnosisDictionaryAvailability
  diagnosisStatusLabel: string | null
  diagnosisStatusTone: RoundDiagnosisStatusTone
  submitPromptLabel: string | null
  hud: RoundHudViewModel
}
