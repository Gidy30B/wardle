import type { ClinicalClue } from '../game.types'

type ClueTimelineProps = {
  clues: ClinicalClue[]
  clueIndex: number
  isLoading?: boolean
  error?: string | null
  onOpenExplanation?: () => void
  canOpenExplanation?: boolean
}

function getTypeTone(type: ClinicalClue['type']): string {
  switch (type) {
    case 'history':
      return 'border-sky-400/20 bg-sky-500/10'
    case 'symptom':
      return 'border-rose-400/20 bg-rose-500/10'
    case 'exam':
      return 'border-amber-400/20 bg-amber-500/10'
    case 'lab':
      return 'border-cyan-400/20 bg-cyan-500/10'
    case 'vital':
      return 'border-orange-400/20 bg-orange-500/10'
    case 'imaging':
      return 'border-violet-400/20 bg-violet-500/10'
    default:
      return 'border-white/10 bg-black/20'
  }
}

export default function ClueTimeline({
  clues,
  clueIndex,
  isLoading,
  error,
  onOpenExplanation,
  canOpenExplanation,
}: ClueTimelineProps) {
  if (isLoading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Case</p>
            <h2 className="text-lg font-semibold text-white">Diagnosis?</h2>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            Live
          </span>
        </div>
        <p className="text-[15px] leading-snug text-white/70">Loading clues...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Case</p>
            <h2 className="text-lg font-semibold text-white">Diagnosis?</h2>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            Live
          </span>
        </div>
        <p className="text-[15px] leading-snug text-white/70">{error}</p>
      </section>
    )
  }

  const visibleClues = clues.filter((clue) => clue.order <= clueIndex)

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Case</p>
          <h2 className="text-lg font-semibold text-white">Diagnosis?</h2>
        </div>
        <button
          type="button"
          onClick={onOpenExplanation}
          disabled={!canOpenExplanation}
          aria-label="Open case explanation"
          className="text-xs text-white/50 underline transition disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
        >
          Details
        </button>
      </div>

      {visibleClues.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-white/50">
          No clues revealed yet.
        </div>
      ) : (
        <div className="space-y-2">
          {visibleClues.map((clue) => {
            const isNewest = clue.order === visibleClues[visibleClues.length - 1]?.order

            return (
              <div
                key={clue.id}
                className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm leading-6 ${
                  isNewest
                    ? 'animate-[fadeIn_0.25s_ease] border-emerald-400/30 bg-emerald-500/10 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.08)]'
                    : `${getTypeTone(clue.type)} text-white/80`
                }`}
              >
                <p className="min-w-0 flex-1">{clue.value}</p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
