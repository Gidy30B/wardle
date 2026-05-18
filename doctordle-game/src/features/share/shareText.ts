import type { ShareAttemptLabel, ShareCardData } from './shareCard.types'
import { shareNatively } from './nativeShare'
import { buildShareUrl } from './shareUrl'
import { getVisibleStreak } from '../user-progress/streakVisibility'

const emojiByAttempt: Record<ShareAttemptLabel, string> = {
  correct: '🟩',
  close: '🟨',
  wrong: '🟦',
}

export function buildShareGrid(attemptLabels: ShareAttemptLabel[]): string {
  if (attemptLabels.length === 0) {
    return ''
  }

  return attemptLabels.map((label) => emojiByAttempt[label]).join('')
}

export function buildDesignerShareBlocks(data: ShareCardData): string[] {
  const totalSlots = Math.max(data.totalClues, data.attemptLabels.length, 1)

  return Array.from({ length: totalSlots }, (_, index) => {
    const label = data.attemptLabels[index]

    if (!label) {
      return '⬜'
    }

    if (label === 'correct') {
      return '🟩'
    }

    if (label === 'close') {
      return '🟨'
    }

    const isTerminalMiss =
      data.result === 'failed' && index === Math.min(data.attemptLabels.length, totalSlots) - 1

    return isTerminalMiss ? '🟥' : '🟦'
  })
}

export function getShareUrl() {
  return buildShareUrl()
}

function buildShareTextLines(
  data: ShareCardData,
  { includeUrl }: { includeUrl: boolean },
) {
  const caseLabel = data.caseLabel ?? 'Daily Diagnosis'
  const resultLine =
    data.result === 'correct'
      ? `Solved in ${data.cluesUsed}/${data.totalClues} clues`
      : 'Not solved today'
  const visibleStreak = getVisibleStreak(data.streak)
  const streakLine = visibleStreak != null ? `🔥 ${visibleStreak}-day streak` : null
  const xpLine = data.xpTotal != null ? `${data.xpTotal} XP` : null
  const blocks = buildDesignerShareBlocks(data).join('')

  return [
    'WARDLE',
    caseLabel,
    resultLine,
    '',
    blocks,
    '',
    `Score: ${data.score}`,
    streakLine,
    xpLine,
    includeUrl ? '' : null,
    includeUrl ? getShareUrl() : null,
  ]
    .filter((line): line is string => line != null)
    .join('\n')
}

export function buildShareText(data: ShareCardData) {
  return buildShareTextLines(data, { includeUrl: true })
}

export function buildShareTextForShareSheet(data: ShareCardData) {
  return buildShareTextLines(data, { includeUrl: false })
}

export function buildSharePayload(data: ShareCardData) {
  const url = getShareUrl()

  return {
    title: 'Wardle score',
    text: buildShareTextForShareSheet(data),
    url,
    clipboardText: buildShareText(data),
    dialogTitle: 'Share Wardle score',
  }
}

export async function shareScoreText(data: ShareCardData): Promise<'shared' | 'copied' | 'idle'> {
  const payload = buildSharePayload(data)

  if (await shareNatively({
    title: payload.title,
    text: payload.text,
    url: payload.url,
    dialogTitle: payload.dialogTitle,
  })) {
    return 'shared'
  }

  try {
    if (navigator.share) {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      })
      return 'shared'
    }
  } catch {
    // Native share cancellation should fall back to copy behavior.
  }

  try {
    await navigator.clipboard.writeText(payload.clipboardText)
    return 'copied'
  } catch {
    return 'idle'
  }
}
