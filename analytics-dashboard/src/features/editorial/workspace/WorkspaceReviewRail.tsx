import StatusBadge from '../../../components/ui/StatusBadge';
import { ReviewQueueItem } from './components/ReviewQueueItem.tsx';
import { CompactPanel } from './EditorialPrimitives.tsx';
import type {
  EditorialWorkflowViewModel,
  WorkflowTone,
} from './viewModels/editorialWorkflowViewModel.ts';
import type {
  WorkspaceBoardId,
  WorkspaceWorkflowId,
} from './viewModels/workflowNavigationViewModel.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from './actions/workspaceActionTypes.ts';

export function WorkspaceReviewRail({
  viewModel,
  activeWorkflowId,
  actionAccess,
  pendingAction,
  onRunAction,
  onNavigate,
}: {
  viewModel: EditorialWorkflowViewModel;
  activeWorkflowId: WorkspaceWorkflowId;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
  onNavigate?: (target: {
    workflowId: WorkspaceWorkflowId;
    boardId?: WorkspaceBoardId | null;
  }) => void;
}) {
  const activeWorkflow = viewModel.workflows[activeWorkflowId];
  const globalItems = viewModel.reviewQueue.items.slice(0, 5);
  const activeItems = viewModel.reviewQueue.items
    .filter((item) => item.targetWorkflow === activeWorkflowId)
    .slice(0, 3);
  const blockerCount = viewModel.reviewQueue.items.filter(
    (item) => item.severity === 'blocker',
  ).length;

  return (
    <aside
      data-testid="workspace-review-rail"
      className="hidden space-y-2 text-[0.8125rem] xl:sticky xl:top-20 xl:block xl:self-start"
    >
      <CompactPanel
        title={activeWorkflow.label}
        subtitle={activeWorkflow.question}
        action={
          <StatusBadge
            status={activeWorkflow.tone}
            tone={toneToBadge(activeWorkflow.tone)}
          />
        }
      >
        <p className="mb-3 text-sm leading-6 text-slate-400">
          {activeWorkflow.verdict}
        </p>
        <ReviewItemList
          title="Workflow findings"
          emptyText="No findings for this workflow."
          items={activeItems}
          actionAccess={actionAccess}
          pendingAction={pendingAction}
          onRunAction={onRunAction}
          onNavigate={onNavigate}
        />
      </CompactPanel>

      <CompactPanel
        title="Editorial review queue"
        subtitle={`${blockerCount} blocker${blockerCount !== 1 ? 's' : ''} total`}
      >
        <ReviewItemList
          title="Blockers and warnings"
          emptyText="No review items pending."
          items={globalItems}
          actionAccess={actionAccess}
          pendingAction={pendingAction}
          onRunAction={onRunAction}
          onNavigate={onNavigate}
        />
      </CompactPanel>
    </aside>
  );
}

function ReviewItemList({
  title,
  emptyText,
  items,
  actionAccess,
  pendingAction,
  onRunAction,
  onNavigate,
}: {
  title: string;
  emptyText: string;
  items: EditorialWorkflowViewModel['reviewQueue']['items'];
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
  onNavigate?: (target: {
    workflowId: WorkspaceWorkflowId;
    boardId?: WorkspaceBoardId | null;
  }) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      {items.length ? (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <ReviewQueueItem
              key={item.id}
              item={item}
              compact
              actionAccess={actionAccess}
              pendingAction={pendingAction}
              onRunAction={onRunAction}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

function toneToBadge(tone: WorkflowTone) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warning') return 'warning';
  if (tone === 'success') return 'success';
  return 'info';
}
