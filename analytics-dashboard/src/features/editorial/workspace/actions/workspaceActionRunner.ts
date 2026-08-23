import { runCaseDraftAction } from './caseDraftActions.ts';
import { runCaseRevisionAction } from './caseRevisionActions.ts';
import { runClueRevisionAction } from './clueRevisionActions.ts';
import { runEducationAction } from './educationActions.ts';
import { runEvidenceAction } from './evidenceActions.ts';
import {
  runCaseAnnotationAction,
  runCaseCoverageAction,
  runPublicationAction,
} from './publicationActions.ts';
import { runReasoningPathAction } from './reasoningPathActions.ts';
import { runTeachingRuleAction } from './teachingRuleActions.ts';
import {
  canRunWorkspaceAction,
  getWorkspaceActionDescriptor,
  isWorkspaceActionId,
  requiresConfirmation,
} from './workspaceActionRegistry.ts';
import type {
  WorkspaceActionExecutorMap,
  WorkspaceActionId,
  WorkspaceActionPayload,
  WorkspaceActionResult,
  WorkspaceActionRunnerContext,
} from './workspaceActionTypes.ts';

export const DEFAULT_WORKSPACE_ACTION_EXECUTORS: WorkspaceActionExecutorMap = {
  caseAnnotation: runCaseAnnotationAction,
  caseDraft: runCaseDraftAction,
  caseRevision: runCaseRevisionAction,
  caseCoverage: runCaseCoverageAction,
  claimRepair: runEducationAction,
  clueRevision: runClueRevisionAction,
  education: runEducationAction,
  evidence: runEvidenceAction,
  lifecycle: runPublicationAction,
  publication: runPublicationAction,
  reasoningPath: runReasoningPathAction,
  teachingRule: runTeachingRuleAction,
};

export async function runWorkspaceAction(
  actionId: WorkspaceActionId | string,
  payload: WorkspaceActionPayload = {},
  context: WorkspaceActionRunnerContext,
  executors: WorkspaceActionExecutorMap = DEFAULT_WORKSPACE_ACTION_EXECUTORS,
): Promise<WorkspaceActionResult> {
  if (!isWorkspaceActionId(actionId)) {
    return failure(actionId, 'Unknown workspace action.', 'Unknown action id.');
  }

  const descriptor = getWorkspaceActionDescriptor(actionId);

  if (!canRunWorkspaceAction(actionId, context.access)) {
    return failure(
      actionId,
      descriptor.failureMessage,
      descriptor.requiredAccess === 'seniorEditorial'
        ? 'Senior editorial access is required for this action.'
        : 'Editorial access is required for this action.',
    );
  }

  if (requiresConfirmation(actionId) && payload.confirmed !== true) {
    return failure(
      actionId,
      descriptor.failureMessage,
      'This action requires explicit confirmation.',
    );
  }

  const executor = executors[descriptor.domain];
  if (!executor) {
    return failure(
      actionId,
      descriptor.failureMessage,
      `No executor registered for ${descriptor.domain}.`,
    );
  }

  safeCall(context.showPending, descriptor.label);

  try {
    const data = await executor(actionId, payload, context);
    await context.refreshWorkspace();
    safeCall(context.showSuccess, descriptor.successMessage);

    return {
      ok: true,
      actionId,
      data,
      message: descriptor.successMessage,
    };
  } catch (error) {
    const errorText = toErrorMessage(error);
    if (isStaleEducationConflict(errorText)) {
      await context.refreshWorkspace();
    }
    safeCall(context.showError, `${descriptor.failureMessage} ${errorText}`);

    return failure(actionId, descriptor.failureMessage, errorText);
  }
}

function isStaleEducationConflict(message: string): boolean {
  return message.includes('Education changed since this view was loaded.');
}

function failure(
  actionId: WorkspaceActionId | string,
  message: string,
  error: string,
): WorkspaceActionResult {
  return {
    ok: false,
    actionId,
    message,
    error,
  };
}

function safeCall(
  callback: ((message: string) => void) | undefined,
  message: string,
) {
  try {
    callback?.(message);
  } catch {
    // Action callbacks are UI affordances; they must not make actions fail.
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return 'Unknown error.';
}
