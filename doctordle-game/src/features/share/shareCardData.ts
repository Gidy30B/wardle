import type { GameResult } from '../game/game.types'
import type { RoundViewModel } from '../game/round.types'
import type { ShareAttemptLabel, ShareCardData } from './shareCard.types'

type ShareCardDataOverrides = {
  streak?: number | null
  school?: string | null
}

export function buildShareCardDataFromRound(
  roundViewModel: RoundViewModel,
  overrides: ShareCardDataOverrides = {},
): ShareCardData | null {
  const result = roundViewModel.latestResult
  if (!result?.gameOver && roundViewModel.mode !== 'FINAL_FEEDBACK') {
    return null
  }

  const totalClues = Math.max(1, roundViewModel.totalClues || result?.case?.clues.length || 6)
  const attemptsUsed =
    roundViewModel.resultAttemptsUsed ?? result?.attemptsCount ?? roundViewModel.attemptsCount
  const cluesUsed = roundViewModel.resultCluesUsed ?? Math.min(attemptsUsed, totalClues)
  const isCorrect =
    roundViewModel.resultWasCorrect === true ||
    result?.gameOverReason === 'correct' ||
    result?.label === 'correct'
  const hasStreakOverride = Object.prototype.hasOwnProperty.call(overrides, 'streak')
  const streak = hasStreakOverride
    ? overrides.streak ?? null
    : typeof roundViewModel.reward?.streak === 'number'
      ? roundViewModel.reward.streak
      : typeof result?.streakAfter === 'number'
        ? result.streakAfter
        : null

  return {
    caseId: roundViewModel.caseId,
    caseLabel: roundViewModel.caseDisplayLabel,
    result: isCorrect ? 'correct' : 'failed',
    attemptsUsed,
    cluesUsed,
    totalClues,
    score: result?.score ?? 0,
    streak,
    xpTotal:
      typeof roundViewModel.hud.xpTotal === 'number' ? roundViewModel.hud.xpTotal : null,
    school: overrides.school ?? null,
    attemptLabels: roundViewModel.attemptHistory.map((attempt) => attempt.label),
  }
}

export function buildShareCardDataFromResult(
  result: GameResult,
  fallback: RoundViewModel,
): ShareCardData {
  const totalClues = Math.max(1, result.case?.clues.length ?? fallback.totalClues ?? 6)
  const attemptsUsed = result.attemptsCount ?? fallback.resultAttemptsUsed ?? fallback.attemptsCount
  const isCorrect = result.gameOverReason === 'correct' || result.label === 'correct'
  const fallbackLabels = getFallbackAttemptLabels({
    attemptsUsed,
    result: isCorrect ? 'correct' : 'failed',
  })

  return {
    caseId: result.case?.id ?? fallback.caseId,
    caseLabel: result.case?.displayLabel ?? fallback.caseDisplayLabel,
    result: isCorrect ? 'correct' : 'failed',
    attemptsUsed,
    cluesUsed: Math.min(attemptsUsed, totalClues),
    totalClues,
    score: result.score,
    streak:
      typeof fallback.reward?.streak === 'number'
        ? fallback.reward.streak
        : typeof result.streakAfter === 'number'
          ? result.streakAfter
          : null,
    xpTotal: typeof fallback.hud.xpTotal === 'number' ? fallback.hud.xpTotal : null,
    school: null,
    attemptLabels:
      fallback.attemptHistory.length > 0
        ? fallback.attemptHistory.map((attempt) => attempt.label)
        : fallbackLabels,
  }
}

function getFallbackAttemptLabels({
  attemptsUsed,
  result,
}: {
  attemptsUsed: number
  result: ShareCardData['result']
}): ShareAttemptLabel[] {
  // TODO(api-gap): completed case payloads do not currently expose historical attempt labels.
  // We only derive the final terminal marker from the result and leave earlier slots generic.
  if (attemptsUsed <= 0) {
    return []
  }

  const labels: ShareAttemptLabel[] = Array.from({ length: attemptsUsed }, () => 'wrong')
  labels[attemptsUsed - 1] = result === 'correct' ? 'correct' : 'wrong'
  return labels
}
