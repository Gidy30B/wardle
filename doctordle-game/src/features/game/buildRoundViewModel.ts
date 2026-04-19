import type { GameCase, GameResult, UserProgress } from './game.types'
import type { RoundLoopState, RoundOutcomeTone, RoundViewModel } from './round.types'
import type { GameAttempt, GameEngineMode, GameRewardState } from './useGameEngine'

type BuildRoundViewModelInput = {
  mode: GameEngineMode
  sessionId: string | null
  caseData: GameCase | null
  clueIndex: number
  guess: string
  attempts: GameAttempt[]
  latestResult: GameResult | null
  reward: GameRewardState
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

export function buildRoundViewModel({
  mode,
  sessionId,
  caseData,
  clueIndex,
  guess,
  attempts,
  latestResult,
  reward,
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
  const latestAttempt = attempts.at(-1) ?? null
  const visibleClues =
    caseData?.clues
      .filter((clue) => clue.order <= clueIndex)
      .map((clue, _index, array) => ({
        id: clue.id,
        type: clue.type,
        value: clue.value,
        isNewest: clue.id === array[array.length - 1]?.id,
      })) ?? []

  const totalClues = caseData?.clues.length ?? 0
  const revealedClueCount = visibleClues.length
  const cluesRemaining = Math.max(0, totalClues - revealedClueCount)
  const attemptsCount = latestResult?.attemptsCount ?? attempts.length
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
  const explanationAvailable = Boolean(latestResult?.explanation)
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
    canEditGuess: mode.type === 'PLAYING',
    canSubmit,
    submitDisabled,
    latestAttempt,
    attemptsCount,
    latestResult,
    feedbackLabel: latestAttempt?.label ?? null,
    finalDiagnosis: mode.type === 'FINAL_FEEDBACK' ? latestAttempt?.guess ?? null : null,
    outcomeTone,
    reward,
    waitingCountdownText: mode.type === 'WAITING' ? waitingCountdownText ?? '00:00:00' : null,
    unavailableReason: resolvedUnavailableReason,
    canRetry: mode.type === 'BLOCKED' && canRetry,
    canOpenExplanation,
    explanationAvailable,
    hud: {
      statusLabel: getHudStatus(mode, latestAttempt),
      xpTotal: progress?.xpTotal ?? null,
      level: progress?.level ?? null,
      viabilityRemaining,
      viabilityTotal: totalClues,
    },
  }
}
