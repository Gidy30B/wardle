import type { RoundVisibleClue } from '../round.types'

type ReactClueCardState = 'active' | 'revealed' | 'review' | 'locked'

type ReactClueCardProps = {
  clue?: RoundVisibleClue
  index: number
  state: ReactClueCardState
}

const clueTypeLabels: Record<RoundVisibleClue['type'], string> = {
  exam: 'Exam',
  history: 'History',
  imaging: 'Imaging',
  lab: 'Lab',
  symptom: 'Symptom',
  vital: 'Vitals',
}

export default function ReactClueCard({
  clue,
  index,
  state,
}: ReactClueCardProps) {
  if (state === 'locked' || !clue) {
    return (
      <article className="rounded-[18px] border border-dashed border-white/8 bg-[rgba(26,60,94,0.12)] px-4 py-4 opacity-80">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white/5 text-xs font-bold text-white/22">
            {index + 1}
          </div>
          <div className="flex-1">
            <div className="h-2.5 w-24 rounded-full bg-white/6" />
            <div className="mt-3 h-2.5 w-full rounded-full bg-white/5" />
            <div className="mt-2 h-2.5 w-3/4 rounded-full bg-white/5" />
          </div>
          <span className="text-sm text-white/20">LOCK</span>
        </div>
      </article>
    )
  }

  const toneClass =
    state === 'active'
      ? 'border-[rgba(0,180,166,0.32)] bg-[rgba(0,180,166,0.08)] shadow-[0_18px_42px_rgba(0,180,166,0.08)]'
      : state === 'revealed'
        ? 'border-white/8 bg-[rgba(26,60,94,0.32)]'
        : 'border-white/6 bg-[rgba(26,60,94,0.22)]'
  const badgeClass =
    state === 'active'
      ? 'bg-[var(--wardle-color-teal)] text-white'
      : 'bg-[rgba(0,180,166,0.18)] text-[var(--wardle-color-mint)]'
  const textClass =
    state === 'active' ? 'text-[var(--wardle-color-mint)]' : 'text-white/68'

  return (
    <article
      className={`rounded-[18px] border px-4 py-4 transition-all duration-300 ${toneClass}`}
      style={clue.isNewest && state === 'active' ? { animation: 'wardle-clue-slide-up 240ms ease-out' } : undefined}
    >
      <div className="flex gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold ${badgeClass}`}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/80">
              {clueTypeLabels[clue.type]}
            </p>
            {state === 'review' ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Review
              </span>
            ) : null}
          </div>
          <p className={`text-sm leading-6 ${textClass}`}>{clue.value}</p>
        </div>
      </div>
    </article>
  )
}
