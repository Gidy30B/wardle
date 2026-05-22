import type { ShareAttemptLabel, ShareCardData } from './shareCard.types'
import { shareNatively } from './nativeShare'
import { buildShareUrl } from './shareUrl'

const emojiByAttempt: Record<ShareAttemptLabel, string> = {
  correct: '\uD83D\uDFE9',
  close: '\uD83D\uDFE8',
  wrong: '\uD83D\uDFE6',
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
      return '\u2B1C'
    }

    if (label === 'correct') {
      return '\uD83D\uDFE9'
    }

    if (label === 'close') {
      return '\uD83D\uDFE8'
    }

    const isTerminalMiss =
      data.result === 'failed' && index === Math.min(data.attemptLabels.length, totalSlots) - 1

    return isTerminalMiss ? '\uD83D\uDFE5' : '\uD83D\uDFE6'
  })
}

export function getShareUrl() {
  return buildShareUrl()
}

function buildShareTextLines(
  data: ShareCardData,
  { includeUrl }: { includeUrl: boolean },
) {
  const clueText = data.cluesUsed === 1 ? '1 clue' : `${data.cluesUsed} clues`
  const hook =
    data.result === 'correct'
      ? data.cluesUsed === 1
        ? 'Only 1 clue needed.'
        : `I solved today's Wardle case in ${clueText}.`
      : 'This Wardle case got me.'
  const challenge =
    data.result === 'correct' && data.cluesUsed > 1
      ? 'Could you?'
      : 'Can you diagnose it?'

  return [
    hook,
    '',
    challenge,
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
    title: 'Wardle result',
    text: buildShareTextForShareSheet(data),
    url,
    clipboardText: buildShareText(data),
    dialogTitle: 'Share Wardle result',
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
