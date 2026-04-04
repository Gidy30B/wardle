import type { CaseExplanation } from '../features/game/game.types'

type ExplanationPageProps = {
  explanation: CaseExplanation
  onBack: () => void
}

export default function ExplanationPage({ explanation, onBack }: ExplanationPageProps) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col gap-4 px-4 pb-24 pt-4 sm:px-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Case Explanation</p>
            <h1 className="mt-1 text-lg font-semibold text-slate-950">{explanation.diagnosis}</h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
          >
            Back
          </button>
        </div>

        <div className="space-y-3">
          <p className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{explanation.summary}</p>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Clinical reasoning
            </p>
            <ul className="space-y-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
              {explanation.reasoning.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {explanation.deepDive && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Advanced deep dive
              </p>
              <p className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                {explanation.deepDive}
              </p>
            </div>
          )}

          {explanation.pitfalls?.length ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Common pitfalls
              </p>
              <ul className="space-y-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                {explanation.pitfalls.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}