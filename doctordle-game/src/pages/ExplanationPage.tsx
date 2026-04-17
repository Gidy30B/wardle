import type { CaseExplanation } from '../features/game/game.types'

type ExplanationPageProps = {
  explanation: CaseExplanation
  onBack: () => void
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

export default function ExplanationPage({ explanation, onBack }: ExplanationPageProps) {
  const explanationData = asRecord(explanation)
  const summary =
    typeof explanationData.summary === 'string' && explanationData.summary.trim().length > 0
      ? explanationData.summary
      : 'Explanation unavailable.'
  const keyPoints = Array.isArray(explanationData.keyPoints)
    ? explanationData.keyPoints.filter((item): item is string => typeof item === 'string')
    : []
  const reasoning = Array.isArray(explanationData.reasoning)
    ? explanationData.reasoning.filter(
        (item): item is { clueId: string; explanation: string } =>
          Boolean(item) &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          typeof (item as { clueId?: unknown }).clueId === 'string' &&
          typeof (item as { explanation?: unknown }).explanation === 'string',
      )
    : []
  const differentials = Array.isArray(explanationData.differentials)
    ? explanationData.differentials.filter(
        (item): item is { diagnosis: string; whyNot: string } =>
          Boolean(item) &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          typeof (item as { diagnosis?: unknown }).diagnosis === 'string' &&
          typeof (item as { whyNot?: unknown }).whyNot === 'string',
      )
    : []

  return (
    <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col gap-4 px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm md:p-5 lg:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Case Explanation</p>
            <h1 className="mt-1 text-lg font-semibold text-white md:text-xl">Why this diagnosis</h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/10"
          >
            Back
          </button>
        </div>

        <div className="space-y-4">
          <p className="rounded-2xl bg-white/5 p-3 text-sm leading-6 text-white/70 md:p-4 md:text-[15px]">
            {summary}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Key points
              </p>
              <ul className="space-y-2 rounded-2xl bg-white/5 p-3 text-sm text-white/70 md:p-4">
                {keyPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Clue reasoning
              </p>
              <ul className="space-y-2 rounded-2xl bg-white/5 p-3 text-sm text-white/70 md:p-4">
                {reasoning.map((item) => (
                  <li key={`${item.clueId}-${item.explanation}`}>
                    <span className="font-semibold text-white/90">{item.clueId}</span>
                    <span className="text-white/50"> - </span>
                    <span>{item.explanation}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Differentials
            </p>
            <ul className="space-y-2 rounded-2xl bg-white/5 p-3 text-sm text-white/70 md:p-4">
              {differentials.map((item) => (
                <li key={`${item.diagnosis}-${item.whyNot}`}>
                  <span className="font-semibold text-white/90">{item.diagnosis}</span>
                  <span className="text-white/50"> - </span>
                  <span>{item.whyNot}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
