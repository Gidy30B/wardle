import StatusBadge from '../../../../components/ui/StatusBadge';
import { CaseReasoningCoverageBoard } from '../boards/CaseReasoningCoverageBoard.tsx';
import { ClueProgressionBoard } from '../boards/ClueProgressionBoard.tsx';
import { DiagnosticCasesBoard } from '../boards/DiagnosticCasesBoard.tsx';
import { DiscriminatorCoverageBoard } from '../boards/DiscriminatorCoverageBoard.tsx';
import type { WorkspaceWorkflowComponentProps } from '../WorkspaceWorkflowRegistry.ts';
import { BoardVerdict, toneToBadge } from '../components/BoardVerdict.tsx';
import type { WorkspaceBoardId } from '../viewModels/workflowNavigationViewModel.ts';

export function CasesWorkflow({
  viewModel,
  actionAccess,
  pendingAction,
  activeBoardId,
  onRunAction,
  onNavigate,
}: WorkspaceWorkflowComponentProps) {
  const workflow = viewModel.cases;
  const activeBoard = resolveCasesBoard(activeBoardId);

  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={workflow.label}
        question={workflow.question}
        verdict={workflow.verdict}
        detail={workflow.detail}
        topConcerns={workflow.reviewItems.map((item) => item.title)}
        tone={workflow.tone}
      />

      <LocalBoardNav
        activeBoard={activeBoard}
        boards={workflow.boards}
        onSelect={(boardId) =>
          onNavigate?.({ workflowId: 'cases', boardId })
        }
      />

      {activeBoard === 'clueProgression' ? (
        <ClueProgressionBoard board={workflow.clueProgression} />
      ) : activeBoard === 'reasoningCoverage' ? (
        <CaseReasoningCoverageBoard board={workflow.reasoningCoverage} />
      ) : activeBoard === 'discriminatorCoverage' ? (
        <DiscriminatorCoverageBoard board={workflow.discriminatorCoverage} />
      ) : (
        <DiagnosticCasesBoard
          board={workflow.diagnosticCases}
          actionAccess={actionAccess}
          pendingAction={pendingAction}
          onRunAction={onRunAction}
        />
      )}
    </div>
  );
}

function resolveCasesBoard(
  boardId: WorkspaceBoardId | null | undefined,
): WorkspaceBoardId {
  if (
    boardId === 'clueProgression' ||
    boardId === 'reasoningCoverage' ||
    boardId === 'discriminatorCoverage'
  ) {
    return boardId;
  }

  return 'diagnosticCases';
}

function LocalBoardNav({
  activeBoard,
  boards,
  onSelect,
}: {
  activeBoard: WorkspaceBoardId;
  boards: WorkspaceWorkflowComponentProps['viewModel']['cases']['boards'];
  onSelect: (boardId: WorkspaceBoardId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {boards.map((board) => {
        const active = board.id === activeBoard;

        return (
          <button
            key={board.id}
            type="button"
            onClick={() => onSelect(board.id)}
            className={[
              'rounded-lg border px-3 py-2 text-left transition',
              active
                ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)]'
                : 'border-[var(--color-navy-border)] bg-white/[0.03] hover:bg-white/[0.06]',
            ].join(' ')}
            aria-pressed={active}
          >
            <span className="block text-xs font-semibold text-slate-100">
              {board.label}
            </span>
            <span className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
              {board.itemCount} item(s)
              <StatusBadge
                status={board.tone}
                tone={toneToBadge(board.tone)}
                className="px-1.5 py-0.5 text-[9px]"
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
