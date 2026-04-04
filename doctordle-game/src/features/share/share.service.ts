type ShareResult = 'correct' | 'failed'
type AttemptLabel = 'correct' | 'close' | 'wrong'

const FALLBACK_SHARE_URL = 'https://wardle.app'

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
  if (envUrl) {
    return envUrl
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return FALLBACK_SHARE_URL
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
