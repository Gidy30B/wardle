import {
  coerceStructuredExplanation,
  getExplanationDisplayText,
} from '../features/game/gameExplanation'
import type { GameExplanation } from '../features/game/game.types'
import WardleLogo from '../components/brand/WardleLogo'
import Button from '../components/ui/Button'
import SurfaceCard from '../components/ui/SurfaceCard'

type ExplanationPageProps = {
  explanation: GameExplanation
  onBack: () => void
  resultSummary?: {
    label: 'correct' | 'close' | 'wrong'
    attempts: number | null
    score: number | null
    streak: number | null
    xp: number | null
    diagnosis: string | null
  }
}

export default function ExplanationPage({
  explanation,
  onBack,
  resultSummary,
}: ExplanationPageProps) {
  const structuredExplanation = coerceStructuredExplanation(explanation)
  const displayText = getExplanationDisplayText(explanation)

  return (
    <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col gap-4 px-1 pb-24 pt-1 sm:px-2">
      {resultSummary ? (
        <SurfaceCard className="overflow-hidden">
          <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(0,180,166,0.16),rgba(26,60,94,0.32))] px-5 py-6 text-center">
            <div className="text-5xl">{resultSummary.label === 'correct' ? '🎯' : '🧠'}</div>
            <h1 className="mt-3 text-2xl font-black text-[var(--wardle-color-mint)]">
              {resultSummary.label === 'correct' ? 'Nailed it, Doctor' : 'Clinical review'}
            </h1>
            <p className="mt-2 text-sm text-white/65">
              {resultSummary.label === 'correct'
                ? `Diagnosed in ${resultSummary.attempts ?? '--'} clue${resultSummary.attempts === 1 ? '' : 's'}`
                : 'Review the diagnostic reasoning behind the final answer.'}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <ResultPill label="Attempts" value={resultSummary.attempts != null ? `${resultSummary.attempts}/6` : '--'} />
              <ResultPill label="Score" value={resultSummary.score != null ? String(resultSummary.score) : '--'} />
              <ResultPill label="XP" value={resultSummary.xp != null ? `+${resultSummary.xp}` : '--'} />
              <ResultPill label="Streak" value={resultSummary.streak != null ? `🔥${resultSummary.streak}` : '--'} />
            </div>
            {resultSummary.diagnosis ? (
              <p className="mt-5 font-brand-mono text-xs uppercase tracking-[0.24em] text-[var(--wardle-color-teal)]">
                Final diagnosis: {resultSummary.diagnosis}
              </p>
            ) : null}
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard eyebrow="Case Explanation" title="Why this diagnosis">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <WardleLogo size="sm" subtitle="Diagnostic reasoning" />
          </div>
          <Button type="button" variant="ghost" block={false} onClick={onBack} className="px-3 py-2 text-xs">
            Back
          </Button>
        </div>

        <div className="space-y-4">
          {structuredExplanation ? (
            <>
              <p className="rounded-[20px] bg-white/5 p-4 text-sm leading-7 text-white/72 md:text-[15px]">
                {structuredExplanation.summary ?? 'Explanation unavailable.'}
              </p>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 font-brand-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/80">
                    Key findings
                  </p>
                  <ul className="space-y-2 rounded-[20px] bg-white/5 p-4 text-sm leading-6 text-white/72">
                    {structuredExplanation.keyFindings.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-1 h-2 w-2 rounded-full bg-[var(--wardle-color-teal)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 font-brand-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/80">
                    Reasoning
                  </p>
                  <p className="rounded-[20px] bg-white/5 p-4 text-sm leading-7 whitespace-pre-line text-white/72">
                    {structuredExplanation.reasoning ?? 'Reasoning unavailable.'}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 font-brand-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-amber)]/90">
                  Differentials
                </p>
                <ul className="space-y-2 rounded-[20px] bg-white/5 p-4 text-sm leading-6 text-white/72">
                  {structuredExplanation.differentials.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[var(--wardle-color-amber)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="rounded-[20px] bg-white/5 p-4 text-sm leading-7 whitespace-pre-line text-white/72 md:text-[15px]">
              {displayText ?? 'Explanation unavailable.'}
            </p>
          )}
        </div>
      </SurfaceCard>
    </main>
  )
}

function ResultPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-center">
      <p className="text-lg font-black text-[var(--wardle-color-mint)]">{value}</p>
      <p className="mt-1 font-brand-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
        {label}
      </p>
    </div>
  )
}
