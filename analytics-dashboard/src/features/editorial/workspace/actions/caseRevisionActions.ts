import {
  startCaseReview,
  submitCaseReview,
} from '../../../../api/admin.ts';
import type {
  CaseRevisionActionPayload,
  WorkspaceActionExecutor,
} from './workspaceActionTypes.ts';

export const runCaseRevisionAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  const actionPayload = payload as CaseRevisionActionPayload;
  const caseId = requireCaseId(actionPayload);

  switch (actionId) {
    case 'caseRevision.startReview':
      return startCaseReview(context.client, caseId);
    case 'caseRevision.approve': {
      const revisionId = requireRevisionId(actionPayload);
      return submitCaseReview(context.client, caseId, {
        decision: 'APPROVED',
        expectedRevisionId: revisionId,
        expectedReviewId: actionPayload.reviewId ?? undefined,
        commandIdempotencyKey:
          actionPayload.commandIdempotencyKey ??
          createCaseRevisionApprovalIdempotencyKey(caseId, revisionId),
        authorityAssignmentReferences:
          actionPayload.authorityAssignmentReferences,
        notes: actionPayload.notes,
      });
    }
    default:
      throw new Error(`Unsupported CaseRevision action: ${actionId}`);
  }
};

function requireCaseId(payload: CaseRevisionActionPayload): string {
  if (!payload.caseId) {
    throw new Error('CaseRevision action requires caseId.');
  }
  return payload.caseId;
}

function requireRevisionId(payload: CaseRevisionActionPayload): string {
  if (!payload.revisionId) {
    throw new Error('CaseRevision approval requires revisionId.');
  }
  return payload.revisionId;
}

function createCaseRevisionApprovalIdempotencyKey(
  caseId: string,
  revisionId: string,
): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `approve-case-revision:${caseId}:${revisionId}:${randomId}`;
}
