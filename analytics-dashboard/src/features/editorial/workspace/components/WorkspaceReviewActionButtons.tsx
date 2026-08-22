import {
  canRunWorkspaceAction,
  getWorkspaceActionDescriptor,
  requiresConfirmation,
} from '../actions/workspaceActionRegistry.ts';
import {
  getWorkspaceActionPendingKey,
  isActionSafeForWorkflowShell,
} from '../actions/workspaceReviewActionPolicy.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionId,
  WorkspaceActionPayload,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';

type WorkspaceReviewActionButtonsProps = {
  actionIds: WorkspaceActionId[];
  access: WorkspaceActionAccess;
  payload: WorkspaceActionPayload;
  pendingAction: string | null;
  subjectId: string;
  subjectLabel: string;
  includeConfirmationActions?: boolean;
  confirmationMessage?: string;
  onRunAction: WorkspaceActionRequestHandler;
};

export function WorkspaceReviewActionButtons({
  actionIds,
  access,
  payload,
  pendingAction,
  subjectId,
  subjectLabel,
  includeConfirmationActions = false,
  confirmationMessage,
  onRunAction,
}: WorkspaceReviewActionButtonsProps) {
  const safeActionIds = actionIds.filter(
    (actionId) =>
      isActionSafeForWorkflowShell(actionId) &&
      (includeConfirmationActions || !requiresConfirmation(actionId)),
  );
  if (!safeActionIds.length) return null;

  const subjectPending = safeActionIds.some(
    (actionId) =>
      pendingAction === getWorkspaceActionPendingKey(actionId, subjectId),
  );

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
      {safeActionIds.map((actionId) => {
        const descriptor = getWorkspaceActionDescriptor(actionId);
        const permitted = canRunWorkspaceAction(actionId, access);
        const isPending =
          pendingAction === getWorkspaceActionPendingKey(actionId, subjectId);
        const disabledReason = permitted
          ? undefined
          : descriptor.requiredAccess === 'seniorEditorial'
            ? 'Requires senior editor access'
            : 'Requires editorial access';

        return (
          <button
            key={actionId}
            type="button"
            disabled={!permitted || subjectPending}
            title={disabledReason}
            aria-label={`${descriptor.label}: ${subjectLabel}${
              disabledReason ? ` (${disabledReason})` : ''
            }`}
            onClick={() => {
              if (requiresConfirmation(actionId)) {
                const confirmed = window.confirm(
                  confirmationMessage ?? descriptor.description,
                );
                if (!confirmed) return;
                void onRunAction(actionId, { ...payload, confirmed: true }, subjectId);
                return;
              }
              void onRunAction(actionId, payload, subjectId);
            }}
            className="rounded-md border border-[var(--color-navy-border)] bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-[var(--color-teal)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isPending ? 'Working…' : actionLabel(actionId)}
          </button>
        );
      })}
    </div>
  );
}

function actionLabel(actionId: WorkspaceActionId): string {
  const intent = getWorkspaceActionDescriptor(actionId).intent;
  if (intent === 'requestChanges') return 'Request changes';
  if (intent === 'reject') return 'Reject';
  if (intent === 'supersede') return 'Supersede';
  if (intent === 'repair') return 'Repair claim';
  if (intent === 'apply') return 'Apply';
  return 'Approve';
}
