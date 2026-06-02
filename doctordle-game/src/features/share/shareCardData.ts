import type { GameResult } from '../game/game.types'
import type { RoundViewModel } from '../game/round.types'
import { getVisibleStreak } from '../user-progress/streakVisibility'
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
  const rawStreak =
    typeof roundViewModel.reward?.streak === 'number'
      ? roundViewModel.reward.streak
      : typeof result?.streakAfter === 'number'
        ? result.streakAfter
        : typeof overrides.streak === 'number'
          ? overrides.streak
          : null
  const streak = getVisibleStreak(rawStreak)

  return {
    caseId: roundViewModel.caseId,
    caseLabel: buildShareCaseLabel({
      publicNumber: roundViewModel.casePublicNumber ?? result?.case?.casePublicNumber ?? null,
      fallbackLabel: roundViewModel.caseDisplayLabel,
    }),
    result: isCorrect ? 'correct' : 'failed',
    attemptsUsed,
    cluesUsed,
    totalClues,
    timeUsedText: buildTimeUsedText(result, roundViewModel),
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
    caseLabel: buildShareCaseLabel({
      publicNumber: result.case?.casePublicNumber ?? fallback.casePublicNumber,
      fallbackLabel: result.case?.displayLabel ?? fallback.caseDisplayLabel,
    }),
    result: isCorrect ? 'correct' : 'failed',
    attemptsUsed,
    cluesUsed: Math.min(attemptsUsed, totalClues),
    totalClues,
    timeUsedText: buildTimeUsedText(result, fallback),
    score: result.score,
    streak: getVisibleStreak(
      typeof fallback.reward?.streak === 'number'
        ? fallback.reward.streak
        : typeof result.streakAfter === 'number'
          ? result.streakAfter
          : null,
    ),
    xpTotal: typeof fallback.hud.xpTotal === 'number' ? fallback.hud.xpTotal : null,
    school: null,
    attemptLabels:
      fallback.attemptHistory.length > 0
        ? fallback.attemptHistory.map((attempt) => attempt.label)
        : fallbackLabels,
  }
}

function buildShareCaseLabel({
  publicNumber,
  fallbackLabel,
}: {
  publicNumber?: number | null
  fallbackLabel?: string | null
}) {
  if (typeof publicNumber === 'number' && Number.isFinite(publicNumber) && publicNumber > 0) {
    return `Case ${String(Math.floor(publicNumber)).padStart(3, '0')}`
  }

  const trimmed = fallbackLabel?.trim()
  const sequenceMatch = trimmed?.match(/^Daily Case\s+\d{4}-\d{2}-\d{2}\s+#(\d+)$/i)
  if (sequenceMatch?.[1]) {
    return `Daily Case #${sequenceMatch[1]}`
  }

  if (trimmed && !/\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed
  }

  return 'Daily Case'
}

function buildTimeUsedText(result: GameResult | null | undefined, fallback: RoundViewModel) {
  return formatTimeUsed(
    getElapsedSecondsFromResult(result) ??
      fallback.elapsedSeconds ??
      null,
  )
}

function getElapsedSecondsFromResult(result: GameResult | null | undefined) {
  if (!result?.startedAt || !result.completedAt) {
    return null
  }

  const startedAtMs = Date.parse(result.startedAt)
  const completedAtMs = Date.parse(result.completedAt)
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(completedAtMs)) {
    return null
  }

  return Math.max(0, Math.floor((completedAtMs - startedAtMs) / 1000))
}

function formatTimeUsed(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return null
  }

  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
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
