import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { ClueProgressionTimeline } from '../components/ClueProgressionTimeline.tsx';
import type { ClueProgressionBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';

export function ClueProgressionBoard({
  board,
}: {
  board: ClueProgressionBoardViewModel;
}) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail="Review for premature diagnostic disclosure, weak clue transitions, late discriminator introduction, and unresolved mimics."
        tone={board.tone}
      />

      <CompactPanel title="Clue progression analysis">
        {board.cases.length ? (
          <div className="space-y-3">
            {board.cases.map((progression) => (
              <ClueProgressionTimeline
                key={progression.id}
                progression={progression}
              />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No clue progression data"
            detail="Clue progression analysis will appear once cases have projected timelines."
          />
        )}
      </CompactPanel>
    </div>
  );
}
