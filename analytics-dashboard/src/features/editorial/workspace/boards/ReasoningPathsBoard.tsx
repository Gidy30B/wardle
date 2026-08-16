import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { ReasoningPathCard } from '../components/ReasoningPathCard.tsx';
import type {
  ReasoningPathsBoardViewModel,
} from '../viewModels/editorialWorkflowViewModel.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';

export function ReasoningPathsBoard({
  board,
  actionAccess,
  pendingAction,
  onRunAction,
}: {
  board: ReasoningPathsBoardViewModel;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  const paths = [
    ...board.activePaths,
    ...board.candidatePaths.filter(
      (candidatePath) =>
        !board.activePaths.some((path) => path.id === candidatePath.id),
    ),
    ...board.weakPaths.filter(
      (weakPath) =>
        !board.activePaths.some((path) => path.id === weakPath.id) &&
        !board.candidatePaths.some((path) => path.id === weakPath.id),
    ),
    ...board.generationReadyPaths.filter(
      (readyPath) => !board.activePaths.some((path) => path.id === readyPath.id),
    ),
  ];

  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail={`${board.generationReadyPaths.length} generation-ready path(s); ${board.narratives.length} reasoning narrative(s).`}
        tone={board.tone}
      />

      <CompactPanel title="Diagnostic reasoning paths" subtitle="Read-only reasoning path review.">
        {paths.length ? (
          <div className="space-y-3">
            {paths.map((path) => (
              <ReasoningPathCard
                key={path.id}
                path={path}
                actionAccess={actionAccess}
                pendingAction={pendingAction}
                onRunAction={onRunAction}
              />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No reasoning paths projected"
            detail="Reasoning paths will appear once they exist in the workspace."
          />
        )}
      </CompactPanel>
    </div>
  );
}
