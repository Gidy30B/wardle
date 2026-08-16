import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { MimicComparisonCard } from '../components/MimicComparisonCard.tsx';
import type { DifferentialsBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';

export function DifferentialsBoard({
  board,
}: {
  board: DifferentialsBoardViewModel;
}) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail={`${board.linkedMimics.length} linked mimic(s), ${board.discriminatorGaps.length} discriminator gap(s).`}
        tone={board.tone}
      />

      <CompactPanel title="Weak mimic distinction coverage">
        {board.weakComparisons.length ? (
          <div className="space-y-3">
            {board.weakComparisons.map((comparison) => (
              <MimicComparisonCard
                key={comparison.id}
                comparison={comparison}
              />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No weak comparisons projected"
            detail="No weak mimic distinctions are currently projected."
          />
        )}
      </CompactPanel>

      <CompactPanel title="Linked mimics and coverage gaps">
        {board.linkedMimics.length || board.discriminatorGaps.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {board.linkedMimics.map((mimic) => (
              <article
                key={mimic.id}
                className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3"
              >
                <p className="text-sm font-semibold text-slate-100">
                  {mimic.displayLabel}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {mimic.role} · confidence {mimic.confidence ?? 'unknown'}
                </p>
              </article>
            ))}
            {board.discriminatorGaps.map((gap) => (
              <article
                key={gap.id}
                className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3"
              >
                <p className="text-sm font-semibold text-slate-100">
                  {gap.mimicName}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {gap.reason}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No linked mimics projected"
            detail="Mimic links and coverage gaps will appear once projected."
          />
        )}
      </CompactPanel>
    </div>
  );
}
