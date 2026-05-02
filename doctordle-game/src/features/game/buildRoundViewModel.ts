import type {
  DiagnosisDictionaryAvailability,
  DiagnosisInputState,
  DiagnosisSubmitMode,
} from './diagnosisInput.state'
import type {
  DiagnosisSelection,
  DiagnosisSuggestion,
  GameCase,
  GameResult,
  UserProgress,
} from './game.types'
import { truncateExplanationDisplayText } from './gameExplanation'
import type {
  RoundLoopState,
  RoundOutcomeTone,
  RoundDiagnosisStatusTone,
  RoundSelectedDiagnosis,
  RoundSuggestionsStatus,
  RoundViewModel,
} from './round.types'
import type { GameAttempt, GameEngineMode, GameRewardState } from './useGameEngine'

type BuildRoundViewModelInput = {
  mode: GameEngineMode
  sessionId: string | null
  caseData: GameCase | null
  clueIndex: number
  guess: string
  diagnosisInputState: DiagnosisInputState
  diagnosisSubmitMode: DiagnosisSubmitMode
  dictionaryAvailability: DiagnosisDictionaryAvailability
  selectedDiagnosis: DiagnosisSelection | null
  suggestions: DiagnosisSuggestion[]
  isAutocompleteLoading: boolean
  autocompleteError: string | null
  highlightedSuggestionIndex: number
  attempts: GameAttempt[]
  latestResult: GameResult | null
  reward: GameRewardState
  elapsedSeconds: number | null
  elapsedTimeText: string | null
  isLoadingCase: boolean
  error: string | null
  waitingCountdownText: string | null
  unavailableReason: string | null
  progress: UserProgress | null
  canRetry: boolean
  canOpenExplanation: boolean
  canSubmit: boolean
  submitDisabled: boolean
}

function getLoopState(mode: GameEngineMode): RoundLoopState {
  switch (mode.type) {
    case 'LOADING':
      return 'loading_case'
    case 'SUBMITTING':
      return 'submitting'
    case 'FINAL_FEEDBACK':
      return 'round_complete'
    case 'WAITING':
      return 'waiting_next_case'
    case 'BLOCKED':
      return 'blocked'
    default:
      return 'playing'
  }
}

function getHudStatus(mode: GameEngineMode, latestAttempt: GameAttempt | null) {
  if (mode.type === 'SUBMITTING') {
    return 'Checking'
  }

  if (mode.type === 'FINAL_FEEDBACK') {
    return latestAttempt?.label === 'correct' ? 'Patient stabilized' : 'Patient lost'
  }

  if (latestAttempt?.label === 'close') {
    return 'Close'
  }

  if (latestAttempt?.label === 'wrong') {
    return 'Keep going'
  }

  return null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getActiveViabilityRemaining(totalClues: number, clueIndex: number) {
  if (totalClues <= 0) {
    return 0
  }

  return clamp(totalClues - Math.max(0, clueIndex), 0, totalClues)
}

function getSuccessfulResolutionViability(totalClues: number, attemptsCount: number) {
  if (totalClues <= 0) {
    return 0
  }

  const wrongAttemptsBeforeSuccess = Math.max(0, attemptsCount - 1)
  return clamp(totalClues - wrongAttemptsBeforeSuccess, 1, totalClues)
}

function getViabilityRemaining(input: {
  totalClues: number
  clueIndex: number
  latestResult: GameResult | null
  attemptsCount: number
}) {
  if (input.totalClues <= 0) {
    return 0
  }

  if (input.latestResult?.gameOverReason === 'clues_exhausted') {
    return 0
  }

  if (input.latestResult?.gameOverReason === 'correct' || input.latestResult?.label === 'correct') {
    return getSuccessfulResolutionViability(input.totalClues, input.attemptsCount)
  }

  return getActiveViabilityRemaining(input.totalClues, input.clueIndex)
}

function getOutcomeTone(input: {
  latestResult: GameResult | null
  viabilityRemaining: number
  viabilityTotal: number
}): RoundOutcomeTone | null {
  if (!input.latestResult?.gameOver) {
    return null
  }

  if (input.latestResult.gameOverReason === 'clues_exhausted') {
    return 'patient_lost'
  }

  if (input.viabilityRemaining <= 1) {
    return 'last_chance_save'
  }

  const steadyThreshold = Math.max(2, Math.floor(input.viabilityTotal * 0.5))
  return input.viabilityRemaining <= steadyThreshold ? 'steady_save' : 'early_save'
}

function toRoundSelectedDiagnosis(
  diagnosis: DiagnosisSelection | null,
): RoundSelectedDiagnosis | null {
  if (!diagnosis) {
    return null
  }

  return {
    diagnosisRegistryId: diagnosis.diagnosisRegistryId,
    displayLabel: diagnosis.displayLabel,
  }
}

function getSuggestionsStatus(input: {
  mode: GameEngineMode
  diagnosisInputState: DiagnosisInputState
  dictionaryAvailability: DiagnosisDictionaryAvailability
  suggestions: DiagnosisSuggestion[]
  isAutocompleteLoading: boolean
  autocompleteError: string | null
}): RoundSuggestionsStatus {
  if (input.mode.type !== 'PLAYING') {
    return 'idle'
  }

  if (input.dictionaryAvailability === 'unavailable') {
    return 'error'
  }

  if (input.diagnosisInputState.mode === 'selected') {
    return 'idle'
  }

  if (input.diagnosisInputState.mode === 'empty') {
    return 'idle'
  }

  if (input.isAutocompleteLoading) {
    return 'loading'
  }

  if (input.autocompleteError) {
    return 'error'
  }

  if (input.suggestions.length > 0) {
    return 'ready'
  }

  return 'empty'
}

function getSuggestionsStatusLabel(input: {
  status: RoundSuggestionsStatus
  dictionaryAvailability: DiagnosisDictionaryAvailability
}): string | null {
  switch (input.status) {
    case 'loading':
      return 'Loading diagnoses...'
    case 'ready':
      return 'Select a diagnosis from suggestions'
    case 'empty':
      return input.dictionaryAvailability === 'ready'
        ? 'Type to find a diagnosis to select'
        : null
    case 'error':
      return 'Diagnosis list unavailable - reload to continue'
    default:
      return null
  }
}

export function buildRoundViewModel({
  mode,
  sessionId,
  caseData,
  clueIndex,
  guess,
  diagnosisInputState,
  diagnosisSubmitMode,
  dictionaryAvailability,
  selectedDiagnosis,
  suggestions,
  isAutocompleteLoading,
  autocompleteError,
  highlightedSuggestionIndex,
  attempts,
  latestResult,
  reward,
  elapsedSeconds,
  elapsedTimeText,
  isLoadingCase,
  error,
  waitingCountdownText,
  unavailableReason,
  progress,
  canRetry,
  canOpenExplanation,
  canSubmit,
  submitDisabled,
}: BuildRoundViewModelInput): RoundViewModel {
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null
  const gameplayClues = caseData?.clues ?? latestResult?.case?.clues ?? []
  const gameplayVisibleClues = gameplayClues.filter((clue) => clue.order <= clueIndex)
  const totalClues = latestResult?.case?.clues.length ?? caseData?.clues.length ?? 0
  const attemptsCount = latestResult?.attemptsCount ?? attempts.length
  const reviewClues =
    mode.type === 'FINAL_FEEDBACK'
      ? latestResult?.case?.clues ?? gameplayClues
      : gameplayVisibleClues
  const visibleClues = reviewClues.map((clue, _index, array) => ({
    id: clue.id,
    type: clue.type,
    value: clue.value,
    isNewest: clue.id === array[array.length - 1]?.id,
  }))

  const resultWasCorrect =
    mode.type === 'FINAL_FEEDBACK'
      ? latestResult?.gameOverReason === 'correct' || latestResult?.label === 'correct'
      : null
  const resultAttemptsUsed = mode.type === 'FINAL_FEEDBACK' ? attemptsCount : null
  const resultCluesUsed =
    mode.type === 'FINAL_FEEDBACK'
      ? resultWasCorrect
        ? Math.max(1, gameplayVisibleClues.length || attemptsCount || 1)
        : Math.max(1, totalClues || gameplayVisibleClues.length || attemptsCount || 1)
      : null
  const revealedClueCount = resultCluesUsed ?? gameplayVisibleClues.length
  const cluesRemaining = Math.max(0, totalClues - revealedClueCount)
  const viabilityRemaining = getViabilityRemaining({
    totalClues,
    clueIndex,
    latestResult,
    attemptsCount,
  })
  const outcomeTone = getOutcomeTone({
    latestResult,
    viabilityRemaining,
    viabilityTotal: totalClues,
  })
  const selectedRoundSuggestion = toRoundSelectedDiagnosis(selectedDiagnosis)
  const roundSuggestions = suggestions.map((suggestion) => ({
    diagnosisRegistryId: suggestion.diagnosisRegistryId,
    displayLabel: suggestion.displayLabel,
    matchKind: suggestion.matchKind,
  }))
  const suggestionsStatus = getSuggestionsStatus({
    mode,
    diagnosisInputState,
    dictionaryAvailability,
    suggestions,
    isAutocompleteLoading,
    autocompleteError,
  })
  const diagnosisStatus = getDiagnosisStatus({
    diagnosisInputState,
    diagnosisSubmitMode,
    dictionaryAvailability,
    suggestionsStatus,
  })
  const finalExplanation = truncateExplanationDisplayText(latestResult?.explanation ?? null)
  const explanationAvailable = finalExplanation !== null
  const resolvedUnavailableReason =
    mode.type === 'BLOCKED' ? error ?? unavailableReason ?? 'No case available right now.' : null

  return {
    mode: mode.type,
    loopState: getLoopState(mode),
    sessionId,
    caseId: caseData?.id ?? latestResult?.case?.id ?? null,
    isLoading: isLoadingCase,
    totalClues,
    revealedClueCount,
    cluesRemaining,
    visibleClues,
    guess,
    selectedSuggestion: selectedRoundSuggestion,
    selectedDiagnosisLabel: selectedRoundSuggestion?.displayLabel ?? null,
    suggestions: roundSuggestions,
    suggestionsStatus,
    suggestionsStatusLabel: getSuggestionsStatusLabel({
      status: suggestionsStatus,
      dictionaryAvailability,
    }),
    highlightedSuggestionIndex,
    canEditGuess: mode.type === 'PLAYING',
    canSubmit,
    submitDisabled,
    latestAttempt,
    attemptHistory: attempts,
    attemptsCount,
    resultAttemptsUsed,
    resultCluesUsed,
    resultWasCorrect,
    latestResult,
    feedbackLabel: latestAttempt?.label ?? null,
    finalDiagnosis: mode.type === 'FINAL_FEEDBACK' ? latestAttempt?.guess ?? null : null,
    finalExplanation,
    outcomeTone,
    reward,
    elapsedSeconds,
    elapsedTimeText,
    waitingCountdownText: mode.type === 'WAITING' ? waitingCountdownText ?? '00:00:00' : null,
    unavailableReason: resolvedUnavailableReason,
    canRetry: mode.type === 'BLOCKED' && canRetry,
    canOpenExplanation,
    explanationAvailable,
    diagnosisInputMode: diagnosisInputState.mode,
    diagnosisSubmitMode,
    dictionaryAvailability,
    diagnosisStatusLabel: diagnosisStatus.label,
    diagnosisStatusTone: diagnosisStatus.tone,
    submitPromptLabel: getSubmitPromptLabel({
      diagnosisSubmitMode,
      diagnosisInputState,
      dictionaryAvailability,
    }),
    hud: {
      statusLabel: getHudStatus(mode, latestAttempt),
      xpTotal: progress?.xpTotal ?? null,
      level: progress?.level ?? null,
      viabilityRemaining,
      viabilityTotal: totalClues,
    },
  }
}

function getDiagnosisStatus(input: {
  diagnosisInputState: DiagnosisInputState
  diagnosisSubmitMode: DiagnosisSubmitMode
  dictionaryAvailability: DiagnosisDictionaryAvailability
  suggestionsStatus: RoundSuggestionsStatus
}): { label: string | null; tone: RoundDiagnosisStatusTone } {
  if (input.dictionaryAvailability === 'unavailable') {
    return {
      label: 'Diagnosis list unavailable - reload to submit',
      tone: 'blocked',
    }
  }

  if (input.diagnosisSubmitMode === 'blocked') {
    if (input.diagnosisInputState.mode === 'stale-selection') {
      return {
        label: 'Selection changed - choose a diagnosis again',
        tone: 'warning',
      }
    }

    return {
      label:
        input.diagnosisInputState.mode === 'empty'
          ? 'Select a diagnosis from suggestions to submit'
          : 'Selection required before submitting',
      tone: 'warning',
    }
  }

  switch (input.diagnosisInputState.mode) {
    case 'selected':
      return {
        label: 'Selected diagnosis locked in',
        tone: 'selected',
      }
    case 'typing':
      return {
        label:
          input.suggestionsStatus === 'loading'
            ? 'Loading diagnoses...'
            : input.suggestionsStatus === 'ready'
              ? 'Select a diagnosis from suggestions to submit'
              : input.suggestionsStatus === 'error'
                ? 'Diagnosis list unavailable - reload to submit'
                : 'Selection required before submitting',
        tone: 'warning',
      }
    default:
      if (input.suggestionsStatus === 'loading') {
        return {
          label: 'Loading diagnoses...',
          tone: 'neutral',
        }
      }

      return {
        label: null,
        tone: 'neutral',
      }
  }
}

function getSubmitPromptLabel(
  input: {
    diagnosisSubmitMode: DiagnosisSubmitMode
    diagnosisInputState: DiagnosisInputState
    dictionaryAvailability: DiagnosisDictionaryAvailability
  },
): string | null {
  switch (input.diagnosisSubmitMode) {
    case 'selected-id':
      return 'Registry-backed submit'
    default:
      if (input.dictionaryAvailability === 'unavailable') {
        return 'Diagnosis list unavailable'
      }

      if (input.diagnosisInputState.mode === 'empty') {
        return null
      }

      return input.diagnosisInputState.mode === 'stale-selection'
        ? 'Reselect to submit'
        : 'Selection required'
  }
}

