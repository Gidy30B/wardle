import type { GameCase, GameResult } from './game.types'
import type { RoundLoopState, RoundViewModel } from './round.types'
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
    return latestAttempt?.label === 'correct' ? 'Solved' : 'Round over'
  }

  if (latestAttempt?.label === 'close') {
    return 'Close'
  }

  if (latestAttempt?.label === 'wrong') {
    return 'Keep going'
  }

  return null
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
  const attemptsCount = latestResult?.attemptsCount ?? attempts.length
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
    reward,
    waitingCountdownText: mode.type === 'WAITING' ? waitingCountdownText ?? '00:00:00' : null,
    unavailableReason: resolvedUnavailableReason,
    canRetry: mode.type === 'BLOCKED' && canRetry,
    canOpenExplanation,
    explanationAvailable,
    hud: {
      clueProgressLabel: `Clue ${revealedClueCount} / ${totalClues}`,
      statusLabel: getHudStatus(mode, latestAttempt),
    },
  }
}
