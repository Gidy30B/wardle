import type { GameResult } from '../features/game/game.types'

type FeedbackPanelProps = {
  result: GameResult | null
  currentStreak?: number
  xpEarned?: number
}

const labelStyles: Record<GameResult['label'], string> = {
  correct: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  close: 'bg-amber-50 text-amber-700 border-amber-200',
  wrong: 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function FeedbackPanel({ result, currentStreak = 0, xpEarned = 0 }: FeedbackPanelProps) {
  if (!result) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Submit a guess to see feedback.
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Feedback</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {result.label === 'correct' ? 'Correct' : result.label === 'close' ? 'Close' : 'Wrong'}
          </h2>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${labelStyles[result.label]}`}>
          {result.label}
        </span>
      </div>

      <div className="rounded-2xl bg-slate-50 p-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Score</p>
        <p className="mt-1 text-2xl font-semibold text-slate-950">{result.score}</p>
        <p className="mt-1 text-sm text-slate-600">Attempts: {result.attemptsCount ?? 0}</p>
        {result.gameOver && (
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p>
              {result.gameOverReason === 'clues_exhausted'
                ? 'Trial ended: all clues were used.'
                : 'Trial completed successfully.'}
            </p>
            <p>+{xpEarned} XP</p>
            <p>🔥 {currentStreak} day streak</p>
          </div>
        )}
      </div>
    </section>
  )
}
