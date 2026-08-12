import {
  applyCaseClueRevisionDraft,
  approveCaseClueRevisionDraft,
  rejectCaseClueRevisionDraft,
  requestChangesForCaseClueRevisionDraft,
  supersedeCaseClueRevisionDraft,
  updateCaseClueRevisionDraft,
} from '../../../../api/admin.ts';
import type {
  CaseClueRevisionDraftPayload,
} from '../../../../api/admin.types.ts';
import type {
  ClueRevisionActionPayload,
  WorkspaceActionExecutor,
} from './workspaceActionTypes.ts';

export const runClueRevisionAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  const actionPayload = payload as ClueRevisionActionPayload;
  const draftId = requireDraftId(actionPayload);

  switch (actionId) {
    case 'clueRevision.approve':
      return approveCaseClueRevisionDraft(context.client, draftId, {
        note: actionPayload.note,
      });
    case 'clueRevision.reject':
      return rejectCaseClueRevisionDraft(context.client, draftId, {
        note: actionPayload.note,
      });
    case 'clueRevision.requestChanges':
      return requestChangesForCaseClueRevisionDraft(context.client, draftId, {
        note: actionPayload.note,
      });
    case 'clueRevision.supersede':
      return supersedeCaseClueRevisionDraft(context.client, draftId, {
        note: actionPayload.note,
      });
    case 'clueRevision.apply':
      return applyCaseClueRevisionDraft(context.client, draftId);
    case 'clueRevision.update':
      return updateCaseClueRevisionDraft(
        context.client,
        draftId,
        requirePatch(actionPayload),
      );
    default:
      throw new Error(`Unsupported clue revision action: ${actionId}`);
  }
};

function requireDraftId(payload: ClueRevisionActionPayload): string {
  if (!payload.draftId) {
    throw new Error('Clue revision action requires draftId.');
  }
  return payload.draftId;
}

function requirePatch(
  payload: ClueRevisionActionPayload,
): CaseClueRevisionDraftPayload {
  if (!payload.patch) {
    throw new Error('Clue revision update requires patch.');
  }
  return payload.patch as CaseClueRevisionDraftPayload;
}
