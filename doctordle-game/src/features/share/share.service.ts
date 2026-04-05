type ShareResult = 'correct' | 'failed'
type AttemptLabel = 'correct' | 'close' | 'wrong'

const FALLBACK_SHARE_URL = 'https://wardle.app'
const PLACEHOLDER_HOSTS = new Set(['your-app.vercel.app', 'example.com'])

const emojiByAttempt: Record<AttemptLabel, string> = {
  correct: '🟩',
  close: '🟨',
  wrong: '⬜',
}

export function buildShareGrid(attemptLabels: AttemptLabel[]): string {
  if (attemptLabels.length === 0) {
    return ''
  }

  return attemptLabels.map((label) => emojiByAttempt[label]).join('')
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

export function buildShareText(data: {
  attempts: number
  score: number
  streak: number
  result: ShareResult
  attemptLabels: AttemptLabel[]
}) {
  const shareUrl = getShareUrl()
  const lead = data.result === 'correct' ? 'Solved it!' : 'Tough case today 😅'
  const streakMilestone = [3, 7, 30].includes(data.streak)
    ? `🏅 Streak milestone: ${data.streak} days`
    : null
  const grid = buildShareGrid(data.attemptLabels)

  return `🧠 Wardle — Daily Diagnosis

${lead}
Attempts: ${data.attempts}
Score: ${data.score}
Streak: ${data.streak} 🔥
${streakMilestone ? `${streakMilestone}\n` : ''}
${grid ? `${grid}\n` : ''}
Can you beat me?

👉 ${shareUrl}`
}
