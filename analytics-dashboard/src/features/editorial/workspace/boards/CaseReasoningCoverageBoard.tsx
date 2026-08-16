import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { ReasoningCoverageRow } from '../components/ReasoningCoverageRow.tsx';
import type { CaseReasoningCoverageBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';

export function CaseReasoningCoverageBoard({
  board,
}: {
  board: CaseReasoningCoverageBoardViewModel;
}) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail={`${board.gapCount} comparison(s) lack clinical case coverage.`}
        tone={board.tone}
      />

      <CompactPanel title="Case reasoning coverage">
        {board.rows.length ? (
          <div className="space-y-3">
            {board.rows.map((row) => (
              <ReasoningCoverageRow key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No case reasoning coverage"
            detail="Case reasoning coverage will appear once comparisons are projected against clinical cases."
          />
        )}
      </CompactPanel>
    </div>
  );
}
