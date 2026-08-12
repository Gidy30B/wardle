import {
  generateEvidenceGraphCandidates,
  reviewEvidenceGraphRelationship,
} from '../../../../api/admin.ts';
import type {
  EvidenceRelationshipActionPayload,
  WorkspaceActionExecutor,
} from './workspaceActionTypes.ts';

export const runEvidenceAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  const actionPayload = payload as EvidenceRelationshipActionPayload;

  switch (actionId) {
    case 'evidence.approveRelationship':
      return reviewEvidenceGraphRelationship(
        context.client,
        requireRelationshipId(actionPayload),
        'activate',
      );
    case 'evidence.rejectRelationship':
      return reviewEvidenceGraphRelationship(
        context.client,
        requireRelationshipId(actionPayload),
        'reject',
      );
    case 'evidence.generateCandidates':
      return generateEvidenceGraphCandidates(
        context.client,
        context.diagnosisRegistryId,
      );
    default:
      throw new Error(`Unsupported evidence action: ${actionId}`);
  }
};

function requireRelationshipId(payload: EvidenceRelationshipActionPayload): string {
  if (!payload.relationshipId) {
    throw new Error('Evidence action requires relationshipId.');
  }
  return payload.relationshipId;
}
