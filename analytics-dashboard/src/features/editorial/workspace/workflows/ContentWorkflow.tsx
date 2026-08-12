import StatusBadge from '../../../../components/ui/StatusBadge';
import { EducationBoard } from '../boards/EducationBoard.tsx';
import { MnemonicsBoard } from '../boards/MnemonicsBoard.tsx';
import { RecallPromptsBoard } from '../boards/RecallPromptsBoard.tsx';
import { ScoringSystemsBoard } from '../boards/ScoringSystemsBoard.tsx';
import type { WorkspaceWorkflowComponentProps } from '../WorkspaceWorkflowRegistry.ts';
import { BoardVerdict, toneToBadge } from '../components/BoardVerdict.tsx';
import type { WorkspaceBoardId } from '../viewModels/workflowNavigationViewModel.ts';

export function ContentWorkflow({
  viewModel,
  actionAccess,
  pendingAction,
  activeBoardId,
  onRunAction,
  onNavigate,
}: WorkspaceWorkflowComponentProps) {
  const workflow = viewModel.content;
  const activeBoard = resolveContentBoard(activeBoardId);

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
          onNavigate?.({ workflowId: 'content', boardId })
        }
      />

      {activeBoard === 'scoringSystems' ? (
        <ScoringSystemsBoard board={workflow.scoringSystems} />
      ) : activeBoard === 'mnemonics' ? (
        <MnemonicsBoard board={workflow.mnemonics} />
      ) : activeBoard === 'recallPrompts' ? (
        <RecallPromptsBoard board={workflow.recallPrompts} />
      ) : (
        <EducationBoard
          board={workflow.education}
          actionAccess={actionAccess}
          pendingAction={pendingAction}
          onRunAction={onRunAction}
        />
      )}
    </div>
  );
}

function resolveContentBoard(
  boardId: WorkspaceBoardId | null | undefined,
): WorkspaceBoardId {
  if (
    boardId === 'scoringSystems' ||
    boardId === 'mnemonics' ||
    boardId === 'recallPrompts'
  ) {
    return boardId;
  }

  return 'education';
}

function LocalBoardNav({
  activeBoard,
  boards,
  onSelect,
}: {
  activeBoard: WorkspaceBoardId;
  boards: WorkspaceWorkflowComponentProps['viewModel']['content']['boards'];
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
