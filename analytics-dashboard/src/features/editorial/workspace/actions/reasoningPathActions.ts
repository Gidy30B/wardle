import {
  generateReasoningPathCandidates,
  reviewReasoningPath,
  runReasoningDraftValidation,
} from '../../../../api/admin.ts';
import type {
  ReasoningPathActionPayload,
  WorkspaceActionExecutor,
} from './workspaceActionTypes.ts';

export const runReasoningPathAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  const actionPayload = payload as ReasoningPathActionPayload;

  switch (actionId) {
    case 'reasoningPath.approve':
      return reviewReasoningPath(
        context.client,
        requireReasoningPathId(actionPayload),
        'activate',
      );
    case 'reasoningPath.reject':
      return reviewReasoningPath(
        context.client,
        requireReasoningPathId(actionPayload),
        'reject',
      );
    case 'reasoningPath.requestChanges':
      return reviewReasoningPath(
        context.client,
        requireReasoningPathId(actionPayload),
        'needs_review',
      );
    case 'reasoningPath.generateCandidates':
      return generateReasoningPathCandidates(
        context.client,
        context.diagnosisRegistryId,
      );
    case 'reasoningPath.validateDraft':
      return runReasoningDraftValidation(context.client, {
        artifactId: requireArtifactId(actionPayload),
        artifactType: requireArtifactType(actionPayload),
      });
    default:
      throw new Error(`Unsupported reasoning path action: ${actionId}`);
  }
};

function requireReasoningPathId(payload: ReasoningPathActionPayload): string {
  if (!payload.reasoningPathId) {
    throw new Error('Reasoning path action requires reasoningPathId.');
  }
  return payload.reasoningPathId;
}

function requireArtifactId(payload: ReasoningPathActionPayload): string {
  if (!payload.artifactId) {
    throw new Error('Reasoning draft validation requires artifactId.');
  }
  return payload.artifactId;
}

function requireArtifactType(payload: ReasoningPathActionPayload): string {
  if (!payload.artifactType) {
    throw new Error('Reasoning draft validation requires artifactType.');
  }
  return payload.artifactType;
}
