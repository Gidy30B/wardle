import {
  authorizeDiagnosisEducationPublication,
  decideDiagnosisEducationRevision,
  withdrawDiagnosisEducationPublication,
} from '../../../../api/admin.ts';
import type {
  EducationPublicationActionPayload,
  EducationRevisionActionPayload,
  WorkspaceActionExecutor,
} from './workspaceActionTypes.ts';

export const runEducationRevisionAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  const actionPayload = payload as EducationRevisionActionPayload;
  const outcome =
    actionId === 'educationRevision.approve'
      ? 'APPROVED'
      : actionId === 'educationRevision.reject'
        ? 'REJECTED'
        : 'CHANGES_REQUIRED';
  return decideDiagnosisEducationRevision(
    context.client,
    requireValue(actionPayload.educationId, 'educationId'),
    requireValue(actionPayload.revisionId, 'revisionId'),
    {
      outcome,
      expectedVersion: requireNumber(actionPayload.expectedVersion),
      idempotencyKey:
        actionPayload.idempotencyKey ??
        `education-revision-${outcome.toLowerCase()}-${requireValue(actionPayload.revisionId, 'revisionId')}`,
      rationale: requireNote(actionPayload),
    },
  );
};

export const runEducationPublicationAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  const actionPayload = payload as EducationPublicationActionPayload;
  if (actionId === 'educationPublication.withdraw') {
    return withdrawDiagnosisEducationPublication(
      context.client,
      requireValue(actionPayload.publicationDecisionId, 'publicationDecisionId'),
      { rationale: requireNote(actionPayload) },
    );
  }
  return authorizeDiagnosisEducationPublication(
    context.client,
    requireValue(actionPayload.educationId, 'educationId'),
    requireValue(actionPayload.revisionId, 'revisionId'),
    {
      expectedVersion: requireNumber(actionPayload.expectedVersion),
      expectedApprovalDecisionId: requireValue(
        actionPayload.expectedApprovalDecisionId,
        'expectedApprovalDecisionId',
      ),
      expectedActivePublicationDecisionId:
        actionPayload.expectedActivePublicationDecisionId ?? null,
      idempotencyKey:
        actionPayload.idempotencyKey ??
        `education-publication-authorize-${requireValue(actionPayload.revisionId, 'revisionId')}`,
      rationale: requireNote(actionPayload),
    },
  );
};

function requireValue(value: string | null | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Education governance action requires ${label}.`);
  }
  return trimmed;
}

function requireNumber(value: number | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1) {
    throw new Error('Education governance action requires expectedVersion.');
  }
  return value;
}

function requireNote(
  payload: EducationRevisionActionPayload | EducationPublicationActionPayload,
): string {
  const note = payload.note?.trim();
  if (!note) {
    throw new Error('Education governance action requires a rationale.');
  }
  return note;
}
