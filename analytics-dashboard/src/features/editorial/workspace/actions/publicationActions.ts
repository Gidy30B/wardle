import {
  createCaseDiscriminatorAnnotation,
  createCaseEscalationAnnotation,
  authorizeCaseRevisionPublication,
  createCaseLearningGoalCoverage,
  deleteCaseDiscriminatorAnnotation,
  deleteCaseEscalationAnnotation,
  deleteCaseLearningGoalCoverage,
  markCaseReadyToPublish,
  normalizeDiagnosisRegistryLifecycleRow,
  updateCaseDiscriminatorAnnotation,
  updateCaseEscalationAnnotation,
  updateCaseLearningGoalCoverage,
  updateDiagnosisRegistryLifecycle,
} from '../../../../api/admin.ts';
import type {
  CaseEscalationAnnotationPayload,
  CaseLearningGoalCoveragePayload,
  CreateCaseClueDiscriminatorAnnotationPayload,
  UpdateCaseClueDiscriminatorAnnotationPayload,
} from '../../../../api/admin.types.ts';
import type {
  CaseAnnotationActionPayload,
  CaseCoverageActionPayload,
  CaseReadyActionPayload,
  LifecycleActionPayload,
  PublicationAuthorizationActionPayload,
  WorkspaceActionExecutor,
} from './workspaceActionTypes.ts';

export const runPublicationAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  switch (actionId) {
    case 'publication.normalizeLifecycle':
      return normalizeDiagnosisRegistryLifecycleRow(
        context.client,
        context.diagnosisRegistryId,
      );
    case 'publication.performLifecycleAction': {
      const actionPayload = payload as LifecycleActionPayload;
      if (!actionPayload.action) {
        throw new Error('Lifecycle action requires action.');
      }
      return updateDiagnosisRegistryLifecycle(
        context.client,
        context.diagnosisRegistryId,
        actionPayload.action,
        { isGeneratable: actionPayload.isGeneratable },
      );
    }
    case 'publication.markCaseReady': {
      const actionPayload = payload as CaseReadyActionPayload;
      if (!actionPayload.caseId) {
        throw new Error('Mark case ready action requires caseId.');
      }
      return markCaseReadyToPublish(context.client, actionPayload.caseId);
    }
    case 'publication.authorizeRevision': {
      const actionPayload = payload as PublicationAuthorizationActionPayload;
      const caseId = requirePublicationCaseId(actionPayload);
      const revisionId = requirePublicationRevisionId(actionPayload);
      const expectedApprovalDecisionId = requireString(
        actionPayload.expectedApprovalDecisionId,
        'Publication authorization requires expectedApprovalDecisionId.',
      );
      const expectedMaterialContextHash = requireString(
        actionPayload.expectedMaterialContextHash,
        'Publication authorization requires expectedMaterialContextHash.',
      );
      return authorizeCaseRevisionPublication(context.client, caseId, revisionId, {
        expectedRevisionId: revisionId,
        expectedApprovalDecisionId,
        expectedMaterialContextHash,
        expectedValidationRunId:
          actionPayload.expectedValidationRunId ?? undefined,
        expectedActivePublicationDecisionId:
          actionPayload.expectedActivePublicationDecisionId ?? null,
        commandIdempotencyKey:
          actionPayload.commandIdempotencyKey ??
          createPublicationIdempotencyKey(caseId, revisionId),
        authorityAssignmentReferences:
          actionPayload.authorityAssignmentReferences,
        rationale: actionPayload.rationale,
      });
    }
    default:
      throw new Error(`Unsupported publication action: ${actionId}`);
  }
};

function requirePublicationCaseId(
  payload: PublicationAuthorizationActionPayload,
): string {
  if (!payload.caseId) {
    throw new Error('Publication authorization requires caseId.');
  }
  return payload.caseId;
}

function requirePublicationRevisionId(
  payload: PublicationAuthorizationActionPayload,
): string {
  if (!payload.revisionId) {
    throw new Error('Publication authorization requires revisionId.');
  }
  return payload.revisionId;
}

function requireString(
  value: string | null | undefined,
  message: string,
): string {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function createPublicationIdempotencyKey(caseId: string, revisionId: string) {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `authorize-case-revision-publication:${caseId}:${revisionId}:${randomId}`;
}

export const runCaseCoverageAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  const actionPayload = payload as CaseCoverageActionPayload;

  switch (actionId) {
    case 'caseCoverage.create':
      return createCaseLearningGoalCoverage(
        context.client,
        context.diagnosisRegistryId,
        requireCoveragePayload(actionPayload),
      );
    case 'caseCoverage.update':
      return updateCaseLearningGoalCoverage(
        context.client,
        context.diagnosisRegistryId,
        requireCoverageId(actionPayload),
        requireCoveragePayload(actionPayload),
      );
    case 'caseCoverage.delete':
      return deleteCaseLearningGoalCoverage(
        context.client,
        context.diagnosisRegistryId,
        requireCoverageId(actionPayload),
      );
    default:
      throw new Error(`Unsupported case coverage action: ${actionId}`);
  }
};

export const runCaseAnnotationAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  const actionPayload = payload as CaseAnnotationActionPayload;
  const annotationType = actionPayload.annotationType ?? 'escalation';

  if (annotationType === 'discriminator') {
    return runCaseDiscriminatorAnnotationAction(actionId, actionPayload, context);
  }

  return runCaseEscalationAnnotationAction(actionId, actionPayload, context);
};

function runCaseEscalationAnnotationAction(
  actionId: string,
  payload: CaseAnnotationActionPayload,
  context: Parameters<WorkspaceActionExecutor>[2],
) {
  switch (actionId) {
    case 'caseAnnotation.create':
      return createCaseEscalationAnnotation(
        context.client,
        context.diagnosisRegistryId,
        requireEscalationAnnotationPayload(payload),
      );
    case 'caseAnnotation.update':
      return updateCaseEscalationAnnotation(
        context.client,
        context.diagnosisRegistryId,
        requireAnnotationId(payload),
        requireEscalationAnnotationPayload(payload),
      );
    case 'caseAnnotation.delete':
      return deleteCaseEscalationAnnotation(
        context.client,
        context.diagnosisRegistryId,
        requireAnnotationId(payload),
      );
    default:
      throw new Error(`Unsupported case annotation action: ${actionId}`);
  }
}

function runCaseDiscriminatorAnnotationAction(
  actionId: string,
  payload: CaseAnnotationActionPayload,
  context: Parameters<WorkspaceActionExecutor>[2],
) {
  switch (actionId) {
    case 'caseAnnotation.create':
      return createCaseDiscriminatorAnnotation(
        context.client,
        requireCaseId(payload),
        requireDiscriminatorCreatePayload(payload),
      );
    case 'caseAnnotation.update':
      return updateCaseDiscriminatorAnnotation(
        context.client,
        requireCaseId(payload),
        requireAnnotationId(payload),
        requireDiscriminatorUpdatePayload(payload),
      );
    case 'caseAnnotation.delete':
      return deleteCaseDiscriminatorAnnotation(
        context.client,
        requireCaseId(payload),
        requireAnnotationId(payload),
      );
    default:
      throw new Error(`Unsupported case annotation action: ${actionId}`);
  }
}

function requireCoverageId(payload: CaseCoverageActionPayload): string {
  if (!payload.coverageId) {
    throw new Error('Case coverage action requires coverageId.');
  }
  return payload.coverageId;
}

function requireCoveragePayload(
  payload: CaseCoverageActionPayload,
): CaseLearningGoalCoveragePayload {
  if (!payload.payload) {
    throw new Error('Case coverage action requires payload.');
  }
  return payload.payload;
}

function requireAnnotationId(payload: CaseAnnotationActionPayload): string {
  if (!payload.annotationId) {
    throw new Error('Case annotation action requires annotationId.');
  }
  return payload.annotationId;
}

function requireCaseId(payload: CaseAnnotationActionPayload): string {
  if (!payload.caseId) {
    throw new Error('Case discriminator annotation action requires caseId.');
  }
  return payload.caseId;
}

function requireEscalationAnnotationPayload(
  payload: CaseAnnotationActionPayload,
): CaseEscalationAnnotationPayload {
  if (!payload.payload) {
    throw new Error('Case escalation annotation action requires payload.');
  }
  return payload.payload as CaseEscalationAnnotationPayload;
}

function requireDiscriminatorCreatePayload(
  payload: CaseAnnotationActionPayload,
): CreateCaseClueDiscriminatorAnnotationPayload {
  if (!payload.payload) {
    throw new Error('Case discriminator annotation action requires payload.');
  }
  return payload.payload as CreateCaseClueDiscriminatorAnnotationPayload;
}

function requireDiscriminatorUpdatePayload(
  payload: CaseAnnotationActionPayload,
): UpdateCaseClueDiscriminatorAnnotationPayload {
  if (!payload.payload) {
    throw new Error('Case discriminator annotation action requires payload.');
  }
  return payload.payload as UpdateCaseClueDiscriminatorAnnotationPayload;
}
