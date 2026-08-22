import {
  applyClinicalCaseDraft,
  reviewClinicalCaseDraft,
} from '../../../../api/admin.ts';
import type {
  CaseDraftActionPayload,
  WorkspaceActionExecutor,
  WorkspaceActionId,
} from './workspaceActionTypes.ts';

const reviewDecisionByAction: Partial<
  Record<WorkspaceActionId, CaseDraftActionPayload['decision']>
> = {
  'caseDraft.accept': 'ACCEPT',
  'caseDraft.reject': 'REJECT',
  'caseDraft.requestChanges': 'REQUEST_CHANGES',
};

export const runCaseDraftAction: WorkspaceActionExecutor = async (
  actionId,
  payload,
  context,
) => {
  const draftPayload = payload as CaseDraftActionPayload;
  const draftId = requireDraftId(draftPayload);

  if (actionId === 'caseDraft.apply') {
    return applyClinicalCaseDraft(
      context.client,
      draftId,
      draftPayload.idempotencyKey ?? createApplyIdempotencyKey(draftId),
    );
  }

  const decision = reviewDecisionByAction[actionId];
  if (!decision) {
    throw new Error(`Unsupported Clinical Case Draft action: ${actionId}`);
  }

  return reviewClinicalCaseDraft(context.client, draftId, {
    decision,
    rationale: draftPayload.note,
  });
};

function requireDraftId(payload: CaseDraftActionPayload) {
  if (!payload.draftId) {
    throw new Error('caseDraft action requires draftId.');
  }
  return payload.draftId;
}

function createApplyIdempotencyKey(draftId: string) {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `apply-clinical-case-draft:${draftId}:${randomPart}`;
}
