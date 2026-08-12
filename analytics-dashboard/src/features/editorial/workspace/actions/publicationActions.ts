import {
  createCaseDiscriminatorAnnotation,
  createCaseEscalationAnnotation,
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
    default:
      throw new Error(`Unsupported publication action: ${actionId}`);
  }
};

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
