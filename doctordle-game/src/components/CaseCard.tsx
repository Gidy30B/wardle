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

export default function CaseCard({
  caseData,
  isLoading,
  error,
  onOpenExplanation,
  canOpenExplanation,
}: CaseCardProps) {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Case</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Case in progress</h2>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
            Live
          </span>
        </div>
        <p className="rounded-2xl bg-white/5 p-3 text-sm leading-6 text-white/70">Loading case...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Case</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Case unavailable</h2>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
            Live
          </span>
        </div>
        <p className="rounded-2xl bg-white/5 p-3 text-sm leading-6 text-white/70">{error}</p>
      </section>
    )
  }

  if (!caseData) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Case</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Case in progress</h2>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
            Live
          </span>
        </div>
        <p className="rounded-2xl bg-white/5 p-3 text-sm leading-6 text-white/70">No case available</p>
      </section>
    )
  }

  const activeCase = {
    title: caseData.difficulty ? `${caseData.difficulty} case` : 'Case in progress',
    history: caseData.history,
    symptoms: caseData.symptoms,
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Case</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{activeCase.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenExplanation}
            disabled={!canOpenExplanation}
            aria-label="Open case explanation"
            className="h-7 w-7 rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-white/70 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            i
          </button>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
            Live
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-2 text-sm font-semibold text-white">History</p>
          <p className="rounded-2xl bg-white/5 p-3 text-sm leading-6 text-white/70">
            {activeCase.history}
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-white">Symptoms</p>
          <div className="max-h-40 overflow-y-auto rounded-2xl bg-white/5 p-3">
            <div className="flex flex-wrap gap-2">
              {activeCase.symptoms.map((symptom, index) => (
                <span
                  key={`${symptom}-${index}`}
                  className={`rounded-full border px-3 py-1 text-sm text-white/70 transition-colors ${
                    index === activeCase.symptoms.length - 1
                      ? 'border-emerald-400/30 bg-emerald-500/15'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  {symptom}
                </span>
              ))}
              {activeCase.symptoms.length === 0 && (
                <p className="text-sm text-white/60">No symptoms revealed yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
