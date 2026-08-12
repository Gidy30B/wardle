import StatusBadge from '../../../../components/ui/StatusBadge';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { ReviewQueueItem } from '../components/ReviewQueueItem.tsx';
import { CompactPanel } from '../EditorialPrimitives.tsx';
import type { WorkspaceWorkflowComponentProps } from '../WorkspaceWorkflowRegistry.ts';

export function ReviewQueueWorkflow({
  viewModel,
  actionAccess,
  pendingAction,
  onRunAction,
  onNavigate,
}: WorkspaceWorkflowComponentProps) {
  const workflow = viewModel.reviewQueue;

  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={workflow.label}
        question={workflow.question}
        verdict={workflow.verdict}
        detail={workflow.detail}
        topConcerns={workflow.items.map((item) => item.title)}
        tone={workflow.tone}
      />

      {workflow.groups.length ? (
        <div className="space-y-4">
          {workflow.groups.map((group) => (
            <CompactPanel
              key={group.id}
              title={group.label}
              subtitle={group.description}
              action={
                <StatusBadge
                  status={`${group.items.length} item${group.items.length === 1 ? '' : 's'}`}
                  tone={group.items.some((item) => item.severity === 'blocker') ? 'danger' : 'warning'}
                />
              }
            >
              <div className="space-y-2">
                {group.items.map((item) => (
                  <ReviewQueueItem
                    key={item.id}
                    item={item}
                    actionAccess={actionAccess}
                    pendingAction={pendingAction}
                    onRunAction={onRunAction}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </CompactPanel>
          ))}
        </div>
      ) : (
        <BoardEmptyState
          title="No editorial review items"
          detail="No blockers, warnings, drafts, candidates, or governance issues are currently projected."
        />
      )}
    </div>
  );
}
