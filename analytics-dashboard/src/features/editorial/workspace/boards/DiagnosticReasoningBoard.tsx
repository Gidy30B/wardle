import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { DiagnosticReasoningMatrix } from '../components/DiagnosticReasoningMatrix.tsx';
import { ReviewQueueItem } from '../components/ReviewQueueItem.tsx';
import type { DiagnosticReasoningBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';

export function DiagnosticReasoningBoard({
  board,
}: {
  board: DiagnosticReasoningBoardViewModel;
}) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.coreClaim.claim}
        detail={board.coreClaim.supportSummary}
        tone={board.tone}
      />

      <CompactPanel title="Differential diagnosis comparisons" subtitle="Core differential reasoning asset.">
        <DiagnosticReasoningMatrix comparisons={board.comparisons} />
      </CompactPanel>

      <CompactPanel title="Discriminating features and reasoning narratives" subtitle="Structured clinical reasoning support.">
        {board.discriminators.length || board.narratives.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {board.discriminators.map((discriminator) => (
              <article
                key={discriminator.id}
                className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3"
              >
                <p className="text-sm font-semibold text-slate-100">
                  {discriminator.mimicName}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {discriminator.label}
                </p>
              </article>
            ))}
            {board.narratives.map((narrative) => (
              <article
                key={narrative.id}
                className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3"
              >
                <p className="text-sm font-semibold text-slate-100">
                  {narrative.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {narrative.summary}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No differential support projected"
            detail="Differential discriminators and reasoning narratives will appear once projected."
          />
        )}
      </CompactPanel>

      {board.pendingActions.length ? (
        <CompactPanel title="Pending reasoning decisions">
          <div className="space-y-2">
            {board.pendingActions.map((item) => (
              <ReviewQueueItem key={item.id} item={item} compact />
            ))}
          </div>
        </CompactPanel>
      ) : null}
    </div>
  );
}
