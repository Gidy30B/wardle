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
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Case</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Case in progress</h2>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
            Live
          </span>
        </div>
        <p className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">Loading case...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Case</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Case unavailable</h2>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
            Live
          </span>
        </div>
        <p className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{error}</p>
      </section>
    )
  }

  if (!caseData) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Case</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Case in progress</h2>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
            Live
          </span>
        </div>
        <p className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">No case available</p>
      </section>
    )
  }

  const activeCase = {
    title: caseData.difficulty ? `${caseData.difficulty} case` : 'Case in progress',
    history: caseData.history,
    symptoms: caseData.symptoms,
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Case</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{activeCase.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenExplanation}
            disabled={!canOpenExplanation}
            aria-label="Open case explanation"
            className="h-7 w-7 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            i
          </button>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
            Live
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-900">History</p>
          <p className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            {activeCase.history}
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-900">Symptoms</p>
          <div className="max-h-40 overflow-y-auto rounded-2xl bg-slate-50 p-3">
            <div className="flex flex-wrap gap-2">
              {activeCase.symptoms.map((symptom, index) => (
                <span
                  key={`${symptom}-${index}`}
                  className={`rounded-full border px-3 py-1 text-sm text-slate-700 transition-colors ${
                    index === activeCase.symptoms.length - 1
                      ? 'border-sky-200 bg-sky-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {symptom}
                </span>
              ))}
              {activeCase.symptoms.length === 0 && (
                <p className="text-sm text-slate-500">No symptoms revealed yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
