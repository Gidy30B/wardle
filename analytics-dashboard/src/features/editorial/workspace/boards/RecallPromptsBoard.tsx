import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { RecallPromptCard } from '../components/RecallPromptCard.tsx';
import type { RecallPromptsBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';

export function RecallPromptsBoard({
  board,
}: {
  board: RecallPromptsBoardViewModel;
}) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail="Recall prompts should assess diagnostic reasoning, discriminating features, and differential separation."
        tone={board.tone}
      />

      <CompactPanel title="Recall prompt coverage">
        {board.recallPrompts.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {board.recallPrompts.map((prompt) => (
              <RecallPromptCard key={prompt.id} prompt={prompt} />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No recall prompts in learner content"
            detail="Recall prompts will appear when present in learner content."
          />
        )}
      </CompactPanel>
    </div>
  );
}
