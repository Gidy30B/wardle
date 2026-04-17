type FeedbackPanelProps = {
  latestAttempt?: { guess: string; label: 'correct' | 'close' | 'wrong' }
}

export default function FeedbackPanel({ latestAttempt }: FeedbackPanelProps) {
  if (!latestAttempt) return null

  const label =
    latestAttempt.label === 'correct'
      ? 'Correct'
      : latestAttempt.label === 'close'
      ? 'Close'
      : 'Wrong'

  const bgClass =
    latestAttempt.label === 'correct'
      ? 'bg-emerald-500/10 border-emerald-500/20'
      : latestAttempt.label === 'close'
      ? 'bg-yellow-500/10 border-yellow-500/20'
      : 'bg-white/5 border-white/10'

  const textClass =
    latestAttempt.label === 'correct'
      ? 'text-emerald-400'
      : latestAttempt.label === 'close'
      ? 'text-yellow-400'
      : 'text-white/70'

  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${bgClass}`}>
      <span className="text-sm font-medium text-white">{latestAttempt.guess}</span>

      <span className={`text-sm font-semibold ${textClass}`}>{label}</span>
    </div>
  )
}
