import { useEffect, useRef } from 'react'

type AttemptListProps = {
  guesses?: Array<{ guess: string; label: 'correct' | 'close' | 'wrong' }>
}

export default function AttemptList({ guesses }: AttemptListProps) {
  const lastRef = useRef<HTMLDivElement | null>(null)
  const safeGuesses = Array.isArray(guesses) ? guesses : []

  useEffect(() => {
    lastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [safeGuesses])

  if (!safeGuesses.length) {
    return null
  }

  return (
    <div className="space-y-2">
      {safeGuesses.map((entry, index) => {
        const isLatest = index === safeGuesses.length - 1
        const label =
          entry.label === 'correct'
            ? 'Correct'
            : entry.label === 'close'
              ? 'Close'
              : 'Wrong'

        return (
          <div
            key={`${entry.guess}-${index}`}
            ref={isLatest ? lastRef : null}
            className={`relative rounded-lg px-3 py-2 text-sm transition-all duration-300 ease-out ${
              entry.label === 'correct'
                ? 'border border-emerald-400/20 bg-green-500/20 text-green-300'
                : entry.label === 'close'
                  ? 'border border-white/10 bg-yellow-500/20 text-yellow-300'
                  : 'border border-white/10 bg-white/5 text-white/70'
            } ${isLatest ? 'ring-2 ring-white/30 scale-[1.03] shadow-sm animate-[popIn_0.25s_ease]' : 'opacity-60'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{entry.guess}</span>
              <span className="ml-2 shrink-0 text-xs text-white/60">→ {label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
