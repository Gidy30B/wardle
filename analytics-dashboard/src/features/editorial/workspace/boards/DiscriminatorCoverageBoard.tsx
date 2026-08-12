import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { DiscriminatorCoverageCard } from '../components/DiscriminatorCoverageCard.tsx';
import type { DiscriminatorCoverageBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';

export function DiscriminatorCoverageBoard({
  board,
}: {
  board: DiscriminatorCoverageBoardViewModel;
}) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail={`${board.gapCount} discriminator(s) lack clinical case coverage.`}
        tone={board.tone}
      />

      <CompactPanel title="Discriminator teaching coverage">
        {board.rows.length ? (
          <div className="space-y-3">
            {board.rows.map((row) => (
              <DiscriminatorCoverageCard key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No discriminator coverage projected"
            detail="Discriminator coverage will appear once diagnostic discriminators are projected."
          />
        )}
      </CompactPanel>
    </div>
  );
}
