type CaseCardProps = {
  caseData?: {
    id: string
    history: string
    symptoms: string[]
    difficulty?: string
  } | null
  isLoading?: boolean
  error?: string | null
  onOpenExplanation?: () => void
  canOpenExplanation?: boolean
}

const MAX_SYMPTOMS = 6

export default function CaseCard({
  caseData,
  isLoading,
  error,
  onOpenExplanation,
  canOpenExplanation,
}: CaseCardProps) {
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
        <p className="mt-1 text-[15px] leading-snug text-white/70">Loading case...</p>
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
        <p className="mt-1 text-[15px] leading-snug text-white/70 line-clamp-2">{error}</p>
      </section>
    )
  }

  if (!caseData) {
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
        <p className="mt-1 text-[15px] leading-snug text-white/70">No case available</p>
      </section>
    )
  }

  const activeCase = {
    history: caseData.history,
    symptoms: caseData.symptoms,
  }

  const symptomSlots = Array.from({ length: MAX_SYMPTOMS }, (_, index) => activeCase.symptoms[index] ?? null)

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Diagnosis?</h2>
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

      <p className="mt-1 text-[15px] leading-snug text-white/70 line-clamp-2">{activeCase.history}</p>

      <div className="mt-2 grid grid-rows-6 gap-1">
        {symptomSlots.map((symptom, index) => {
          const isRevealed = Boolean(symptom)
          const isLatest = isRevealed && index === activeCase.symptoms.length - 1

          return (
            <div
              key={index}
              className={`flex h-10 w-full items-center rounded-lg px-2.5 text-[15px] transition-all duration-300 ease-out ${
                isRevealed
                  ? 'bg-white/10 text-white'
                  : 'bg-white/5 text-white/30'
              } ${isLatest ? 'ring-2 ring-white/20 animate-[popIn_0.25s_ease]' : ''}`}
            >
              {isRevealed ? (
                <span className="truncate">{symptom}</span>
              ) : (
                <span className="italic">— hidden —</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
