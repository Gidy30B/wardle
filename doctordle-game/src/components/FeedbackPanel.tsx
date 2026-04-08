import type { GameResult } from '../features/game/game.types'

type FeedbackPanelProps = {
  result: GameResult | null
  hasActiveSession?: boolean
  currentStreak?: number
  xpEarned?: number
  attemptLabels?: { guess: string; label: 'correct' | 'close' | 'wrong' }[]
  showAttemptLabels?: boolean
  showProgressSummary?: boolean
}

export default function FeedbackPanel({
  result,
  hasActiveSession = true,
  currentStreak = 0,
  xpEarned = 0,
  showProgressSummary = true,
}: FeedbackPanelProps) {
  if (!result) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        {hasActiveSession ? 'Submit a guess to see feedback' : 'Daily limit reached'}
      </div>
    )
  }

  const label =
    result.label === 'correct'
      ? 'Correct'
      : result.label === 'close'
      ? 'Close'
      : 'Wrong'

  const colorClass =
    result.label === 'correct'
      ? 'text-emerald-400'
      : result.label === 'close'
      ? 'text-yellow-400'
      : 'text-white/70'

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <span className={`text-sm font-medium ${colorClass}`}>{label}</span>

      <div className="flex items-center gap-3 text-sm text-white/80">
        {showProgressSummary && xpEarned > 0 && <span>+{xpEarned} XP</span>}
        {showProgressSummary && currentStreak > 0 && <span>Streak {currentStreak}</span>}
      </div>
    </div>
  )
}
