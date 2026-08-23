import {
  applyDiagnosisEducationCandidate,
  reviewDiagnosisEducationCandidate,
} from '../../../../api/admin.ts';
import type {
  DiagnosisEducationCandidateReviewDecision,
} from '../../../../api/admin.types.ts';
import type {
  EducationCandidateActionPayload,
  WorkspaceActionExecutor,
} from './workspaceActionTypes.ts';

export const runEducationCandidateAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  const actionPayload = payload as EducationCandidateActionPayload;
  switch (actionId) {
    case 'educationCandidate.accept':
      return reviewDiagnosisEducationCandidate(
        context.client,
        requireCandidateId(actionPayload),
        {
          decision: 'ACCEPT',
          rationale: requireNote(actionPayload),
        },
      );
    case 'educationCandidate.reject':
      return reviewDiagnosisEducationCandidate(
        context.client,
        requireCandidateId(actionPayload),
        {
          decision: 'REJECT',
          rationale: requireNote(actionPayload),
        },
      );
    case 'educationCandidate.requestChanges':
      return reviewDiagnosisEducationCandidate(
        context.client,
        requireCandidateId(actionPayload),
        {
          decision:
            actionPayload.decision ?? ('REQUEST_CHANGES' as DiagnosisEducationCandidateReviewDecision),
          rationale: requireNote(actionPayload),
        },
      );
    case 'educationCandidate.apply':
      return applyDiagnosisEducationCandidate(
        context.client,
        requireCandidateId(actionPayload),
        {
          idempotencyKey:
            actionPayload.idempotencyKey ??
            `education-candidate-apply-${requireCandidateId(actionPayload)}`,
          rationale: requireNote(actionPayload),
        },
      );
    default:
      throw new Error(`Unsupported education candidate action: ${actionId}`);
  }
};

function requireCandidateId(payload: EducationCandidateActionPayload): string {
  if (!payload.candidateId) {
    throw new Error('Education candidate action requires candidateId.');
  }
  return payload.candidateId;
}

function requireNote(payload: EducationCandidateActionPayload): string {
  const note = payload.note?.trim();
  if (!note) {
    throw new Error('Education candidate action requires a rationale.');
  }
  return note;
}
