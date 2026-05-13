import { Capacitor } from '@capacitor/core'
import type { ShareAttemptLabel, ShareCardData } from './shareCard.types'
import { shareNatively } from './nativeShare'

const FALLBACK_SHARE_URL = 'https://wardle.app'
const PLACEHOLDER_HOSTS = new Set(['your-app.vercel.app', 'example.com'])
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
const PREVIEW_HOST_SUFFIXES = [
  '.vercel.app',
  '.netlify.app',
  '.pages.dev',
  '.railway.app',
  '.render.com',
]

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
  const env = (import.meta as {
    env?: Record<string, string | boolean | undefined>
  }).env
  const isProduction = env?.PROD === true || env?.MODE === 'production'
  const envUrl = typeof env?.VITE_SHARE_URL === 'string' ? env.VITE_SHARE_URL.trim() : ''

  if (envUrl && isValidShareUrl(envUrl, { allowLocal: !isProduction })) {
    return envUrl
  }

  if (isProduction) {
    return FALLBACK_SHARE_URL
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    if (Capacitor.isNativePlatform() && isLocalHost(window.location.hostname)) {
      return FALLBACK_SHARE_URL
    }

    if (isValidShareUrl(window.location.origin, { allowLocal: true })) {
      return window.location.origin
    }
  }

  return FALLBACK_SHARE_URL
}

function isValidShareUrl(
  url: string,
  { allowLocal }: { allowLocal: boolean },
): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    if (parsed.protocol !== 'https:' && !(allowLocal && parsed.protocol === 'http:')) {
      return false
    }

    if (PLACEHOLDER_HOSTS.has(hostname)) {
      return false
    }

    if (hostname.includes('your-app') || hostname.includes('example')) {
      return false
    }

    if (!allowLocal && isLocalHost(hostname)) {
      return false
    }

    if (!allowLocal && isPreviewHost(hostname)) {
      return false
    }

    return true
  } catch {
    return false
  }
}

function isLocalHost(hostname: string) {
  return LOCAL_HOSTS.has(hostname.toLowerCase())
}

function isPreviewHost(hostname: string) {
  return PREVIEW_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
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

export async function shareScoreText(data: ShareCardData): Promise<'shared' | 'copied' | 'idle'> {
  const clipboardText = buildShareText(data)
  const shareText = buildShareTextForShareSheet(data)
  const shareUrl = getShareUrl()

  if (await shareNatively({
    title: 'Wardle score',
    text: shareText,
    url: shareUrl,
    dialogTitle: 'Share Wardle score',
  })) {
    return 'shared'
  }

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'Wardle score',
        text: shareText,
        url: shareUrl,
      })
      return 'shared'
    }
  } catch {
    // Native share cancellation should fall back to copy behavior.
  }

  try {
    await navigator.clipboard.writeText(clipboardText)
    return 'copied'
  } catch {
    return 'idle'
  }
}
