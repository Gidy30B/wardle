import { useEffect, useRef } from 'react'

type AttemptListProps = {
  attemptLabels?: Array<{ guess: string; label: 'correct' | 'close' | 'wrong' }>
}

export default function AttemptList({ attemptLabels }: AttemptListProps) {
  const lastRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    lastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [attemptLabels])

  if (!attemptLabels?.length) {
    return null
  }

  return (
    <div className="space-y-2">
      {attemptLabels.map((attempt, i) => {
        const isLatest = i === attemptLabels.length - 1
        const feedbackText =
          attempt.label === 'correct'
            ? '✔ Correct'
            : attempt.label === 'close'
              ? '↗ Getting closer'
              : '✖ Try again'

        return (
          <div
            key={i}
            ref={isLatest ? lastRef : null}
            className={`relative rounded-lg px-3 py-2 text-sm transition-all duration-300 ease-out ${
              attempt.label === 'correct'
                ? 'border border-emerald-400/20 bg-green-500/20 text-green-300'
                : attempt.label === 'close'
                  ? 'border border-white/10 bg-yellow-500/20 text-yellow-300'
                  : 'border border-white/10 bg-white/5 text-white/70'
            } ${isLatest ? 'ring-2 ring-white/30 scale-[1.03] shadow-sm animate-[popIn_0.25s_ease]' : 'opacity-60'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{attempt.guess}</span>
              <span className="ml-2 shrink-0 text-xs text-white/60">{feedbackText}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}