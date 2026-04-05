import type { CaseExplanation } from '../features/game/game.types'

type ExplanationPageProps = {
  explanation: CaseExplanation
  onBack: () => void
}

export default function ExplanationPage({ explanation, onBack }: ExplanationPageProps) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col gap-4 px-4 pb-24 pt-4 sm:px-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Case Explanation</p>
            <h1 className="mt-1 text-lg font-semibold text-white">{explanation.diagnosis}</h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70"
          >
            Back
          </button>
        </div>

        <div className="space-y-3">
          <p className="rounded-2xl bg-white/5 p-3 text-sm leading-6 text-white/70">{explanation.summary}</p>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Clinical reasoning
            </p>
            <ul className="space-y-2 rounded-2xl bg-white/5 p-3 text-sm text-white/70">
              {explanation.reasoning.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {explanation.deepDive && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Advanced deep dive
              </p>
              <p className="rounded-2xl bg-white/5 p-3 text-sm leading-6 text-white/70">
                {explanation.deepDive}
              </p>
            </div>
          )}

          {explanation.pitfalls?.length ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Common pitfalls
              </p>
              <ul className="space-y-2 rounded-2xl bg-white/5 p-3 text-sm text-white/70">
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