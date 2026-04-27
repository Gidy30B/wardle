import type { ShareAttemptLabel, ShareCardData } from './shareCard.types'

const FALLBACK_SHARE_URL = 'https://wardle.app'
const PLACEHOLDER_HOSTS = new Set(['your-app.vercel.app', 'example.com'])

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
  const envUrl = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SHARE_URL?.trim()
  if (envUrl && isValidShareUrl(envUrl)) {
    return envUrl
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return FALLBACK_SHARE_URL
}

function isValidShareUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (PLACEHOLDER_HOSTS.has(parsed.hostname)) {
      return false
    }

    if (parsed.hostname.includes('your-app') || parsed.hostname.includes('example')) {
      return false
    }

    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function buildShareText(data: ShareCardData) {
  const shareUrl = getShareUrl()
  const caseLabel = data.caseId ? `Case ${data.caseId}` : 'Daily Diagnosis'
  const resultLine =
    data.result === 'correct'
      ? `Solved in ${data.cluesUsed}/${data.totalClues} clues`
      : 'Not solved today'
  const streakLine = data.streak != null ? `🔥 ${data.streak}-day streak` : null
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
    '',
    shareUrl,
  ]
    .filter((line): line is string => line != null)
    .join('\n')
}

export async function shareScoreText(data: ShareCardData): Promise<'shared' | 'copied' | 'idle'> {
  const shareText = buildShareText(data)

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'Wardle score',
        text: shareText,
        url: getShareUrl(),
      })
      return 'shared'
    }
  } catch {
    // Native share cancellation should fall back to copy behavior.
  }

  try {
    await navigator.clipboard.writeText(shareText)
    return 'copied'
  } catch {
    return 'idle'
  }
}
