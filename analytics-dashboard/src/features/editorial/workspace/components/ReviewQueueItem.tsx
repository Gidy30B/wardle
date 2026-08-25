import StatusBadge from '../../../../components/ui/StatusBadge';
import type { ReviewQueueItemViewModel } from '../viewModels/editorialWorkflowViewModel.ts';
import type {
  WorkspaceBoardId,
  WorkspacePacketTarget,
  WorkspaceWorkflowId,
} from '../viewModels/workflowNavigationViewModel.ts';
import {
  getDeferredReviewItemActions,
  getReviewActionPayload,
  getReviewActionSubject,
  getReviewItemActions,
} from '../actions/workspaceReviewActionPolicy.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';
import { WorkspaceReviewActionButtons } from './WorkspaceReviewActionButtons.tsx';

export function ReviewQueueItem({
  item,
  compact = false,
  onNavigate,
  actionAccess,
  pendingAction,
  onRunAction,
}: {
  item: ReviewQueueItemViewModel;
  compact?: boolean;
  onNavigate?: (target: {
    workflowId: WorkspaceWorkflowId;
    boardId?: WorkspaceBoardId | null;
    packetType?: WorkspacePacketTarget['type'] | null;
    packetId?: string | null;
  }) => void;
  actionAccess?: WorkspaceActionAccess;
  pendingAction?: string | null;
  onRunAction?: WorkspaceActionRequestHandler;
}) {
  const canNavigate = Boolean(onNavigate);
  const sourceLabel = item.metadata.find((entry) =>
    entry.startsWith('Source:'),
  );
  const workflowLabel = item.metadata.find((entry) =>
    entry.startsWith('Workflow:'),
  );
  const actionSubject = getReviewActionSubject(item);
  const actionIds = actionSubject ? getReviewItemActions(actionSubject) : [];
  const deferredActionIds = actionSubject
    ? getDeferredReviewItemActions(actionSubject)
    : [];
  const includeConfirmationActions =
    actionSubject?.kind === 'caseRevision' ||
    actionSubject?.kind === 'publicationAuthorization' ||
    actionSubject?.kind === 'educationCandidate' ||
    actionSubject?.kind === 'educationRevision' ||
    actionSubject?.kind === 'educationPublication';
  const visibleActionIds = includeConfirmationActions
    ? [...actionIds, ...deferredActionIds]
    : actionIds;
  const sourceId = item.sourceId;

  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">{item.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {item.editorialReason}
          </p>
        </div>
        <StatusBadge
          status={item.severity}
          tone={
            item.severity === 'blocker'
              ? 'danger'
              : item.severity === 'warning'
                ? 'warning'
                : 'info'
          }
        />
      </div>

      {sourceLabel || workflowLabel ? (
        <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {[workflowLabel, sourceLabel].filter(Boolean).join(' · ')}
        </p>
      ) : null}

      {compact ? null : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.metadata.map((entry) => (
            <span
              key={entry}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400"
            >
              {entry}
            </span>
          ))}
        </div>
      )}

      {canNavigate ? (
        <button
          type="button"
          onClick={() =>
            onNavigate?.({
              workflowId: item.targetWorkflow,
              boardId: item.targetBoard ?? null,
              ...packetTargetForItem(item),
            })
          }
          className="mt-3 text-xs font-semibold text-[var(--color-teal)] transition hover:text-teal-200"
        >
          Review findings
        </button>
      ) : null}

      {visibleActionIds.length && sourceId && actionAccess && onRunAction ? (
        <WorkspaceReviewActionButtons
          actionIds={visibleActionIds}
          access={actionAccess}
          payload={getReviewActionPayload(visibleActionIds[0], sourceId, item)}
          pendingAction={pendingAction ?? null}
          subjectId={sourceId}
          subjectLabel={item.title}
          includeConfirmationActions={includeConfirmationActions}
          onRunAction={(actionId, _payload, subjectId) =>
            onRunAction(
              actionId,
              getReviewActionPayload(actionId, subjectId, item),
              subjectId,
            )
          }
        />
      ) : deferredActionIds.length ? (
        <p className="mt-3 text-xs font-medium text-slate-500">
          Deferred — editorial action pending
        </p>
      ) : null}
    </article>
  );
}

function packetTargetForItem(
  item: ReviewQueueItemViewModel,
): { packetType?: WorkspacePacketTarget['type']; packetId?: string } {
  if (!item.sourceId) return {};
  if (item.kind === 'education_candidate') {
    return { packetType: 'educationCandidate', packetId: item.sourceId };
  }
  if (item.kind === 'education_revision') {
    return { packetType: 'educationRevision', packetId: item.sourceId };
  }
  if (item.kind === 'education_publication') {
    return { packetType: 'educationPublication', packetId: item.sourceId };
  }
  if (item.kind === 'clinical_case_draft') {
    return { packetType: 'caseDraft', packetId: item.sourceId };
  }
  if (item.kind === 'case_revision') {
    return { packetType: 'caseRevision', packetId: item.sourceId };
  }
  if (item.kind === 'publication_authorization') {
    return { packetType: 'casePublication', packetId: item.sourceId };
  }
  return {};
}
