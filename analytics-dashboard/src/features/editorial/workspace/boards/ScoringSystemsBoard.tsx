import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { ScoringSystemCard } from '../components/ScoringSystemCard.tsx';
import type { ScoringSystemsBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';

export function ScoringSystemsBoard({
  board,
}: {
  board: ScoringSystemsBoardViewModel;
}) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail="Scoring systems are projected from learner content."
        tone={board.tone}
      />

      <CompactPanel title="Scoring system coverage">
        {board.scoringSystems.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {board.scoringSystems.map((scoringSystem) => (
              <ScoringSystemCard
                key={scoringSystem.id}
                scoringSystem={scoringSystem}
              />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No scoring systems in learner content"
            detail="Scoring systems will appear when present in learner content."
          />
        )}
      </CompactPanel>
    </div>
  );
}
