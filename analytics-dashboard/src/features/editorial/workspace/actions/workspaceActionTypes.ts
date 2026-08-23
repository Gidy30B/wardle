import type { ApiClient } from '../../../../api/client.ts';
import type {
  CaseEscalationAnnotationPayload,
  CaseLearningGoalCoveragePayload,
  CreateCaseClueDiscriminatorAnnotationPayload,
  DiagnosisRegistryLifecycleAction,
  DiagnosisTeachingRuleReviewAction,
  EvidenceGraphReviewAction,
  ReasoningPathReviewAction,
  RegenerateEducationSectionPayload,
  ReviewClinicalCaseDraftPayload,
  UpdateCaseClueDiscriminatorAnnotationPayload,
} from '../../../../api/admin.types.ts';
import type {
  WorkspaceWorkflowId,
} from '../viewModels/workflowNavigationViewModel.ts';

export type WorkspaceActionDomain =
  | 'teachingRule'
  | 'evidence'
  | 'reasoningPath'
  | 'clueRevision'
  | 'education'
  | 'publication'
  | 'claimRepair'
  | 'lifecycle'
  | 'caseCoverage'
  | 'caseAnnotation'
  | 'caseRevision'
  | 'caseDraft';

export type WorkspaceActionIntent =
  | 'approve'
  | 'reject'
  | 'requestChanges'
  | 'supersede'
  | 'apply'
  | 'generate'
  | 'repair'
  | 'normalize'
  | 'markReady'
  | 'authorize'
  | 'review'
  | 'create'
  | 'update'
  | 'delete';

export type WorkspaceActionId =
  | 'teachingRule.approve'
  | 'teachingRule.reject'
  | 'teachingRule.requestChanges'
  | 'teachingRule.generateCandidates'
  | 'teachingRule.seedLegacy'
  | 'evidence.approveRelationship'
  | 'evidence.rejectRelationship'
  | 'evidence.generateCandidates'
  | 'reasoningPath.approve'
  | 'reasoningPath.reject'
  | 'reasoningPath.requestChanges'
  | 'reasoningPath.generateCandidates'
  | 'reasoningPath.validateDraft'
  | 'clueRevision.approve'
  | 'clueRevision.reject'
  | 'clueRevision.requestChanges'
  | 'clueRevision.supersede'
  | 'clueRevision.apply'
  | 'clueRevision.update'
  | 'education.repairUnsupportedClaim'
  | 'education.regenerateSection'
  | 'education.review'
  | 'publication.normalizeLifecycle'
  | 'publication.performLifecycleAction'
  | 'publication.markCaseReady'
  | 'publication.authorizeRevision'
  | 'caseRevision.startReview'
  | 'caseRevision.approve'
  | 'caseCoverage.create'
  | 'caseCoverage.update'
  | 'caseCoverage.delete'
  | 'caseAnnotation.create'
  | 'caseAnnotation.update'
  | 'caseAnnotation.delete'
  | 'caseDraft.accept'
  | 'caseDraft.reject'
  | 'caseDraft.requestChanges'
  | 'caseDraft.apply';

export type WorkspaceActionDescriptor = {
  id: WorkspaceActionId;
  domain: WorkspaceActionDomain;
  intent: WorkspaceActionIntent;
  label: string;
  description: string;
  requiredAccess: 'editorial' | 'seniorEditorial';
  destructive?: boolean;
  confirmationRequired?: boolean;
  successMessage: string;
  failureMessage: string;
  sourceWorkflows: WorkspaceWorkflowId[];
};

export type WorkspaceActionAccess = {
  canAccessEditorial: boolean;
  canPublishEditorial: boolean;
};

export type WorkspaceActionRunnerContext = {
  client: ApiClient;
  diagnosisRegistryId: string;
  access: WorkspaceActionAccess;
  refreshWorkspace: () => Promise<void>;
  showPending?: (message: string) => void;
  showSuccess?: (message: string) => void;
  showError?: (message: string) => void;
};

type BaseActionPayload = {
  confirmed?: boolean;
};

export type TeachingRuleActionPayload = BaseActionPayload & {
  ruleId?: string;
  action?: DiagnosisTeachingRuleReviewAction;
  note?: string;
};

export type EvidenceRelationshipActionPayload = BaseActionPayload & {
  relationshipId?: string;
  action?: EvidenceGraphReviewAction;
  note?: string;
};

export type ReasoningPathActionPayload = BaseActionPayload & {
  reasoningPathId?: string;
  action?: ReasoningPathReviewAction;
  note?: string;
  artifactType?: string;
  artifactId?: string;
};

export type ClueRevisionActionPayload = BaseActionPayload & {
  draftId?: string;
  note?: string;
  patch?: Record<string, unknown>;
};

export type CaseDraftActionPayload = BaseActionPayload & {
  draftId?: string;
  note?: string;
  decision?: ReviewClinicalCaseDraftPayload['decision'];
  idempotencyKey?: string;
};

export type ClaimRepairActionPayload = BaseActionPayload & {
  claimId?: string;
};

export type EducationActionPayload = BaseActionPayload & {
  educationId?: string;
  section?: RegenerateEducationSectionPayload['section'];
  expectedVersion?: number;
  status?: string;
  note?: string;
};

export type LifecycleActionPayload = BaseActionPayload & {
  action?: DiagnosisRegistryLifecycleAction;
  isGeneratable?: boolean;
};

export type CaseReadyActionPayload = BaseActionPayload & {
  caseId?: string;
};

export type CaseRevisionActionPayload = BaseActionPayload & {
  caseId?: string;
  revisionId?: string;
  reviewId?: string | null;
  commandIdempotencyKey?: string;
  notes?: string;
  authorityAssignmentReferences?: string[];
};

export type PublicationAuthorizationActionPayload = BaseActionPayload & {
  caseId?: string;
  revisionId?: string;
  expectedApprovalDecisionId?: string | null;
  expectedMaterialContextHash?: string | null;
  expectedValidationRunId?: string | null;
  expectedActivePublicationDecisionId?: string | null;
  commandIdempotencyKey?: string;
  authorityAssignmentReferences?: string[];
  rationale?: string;
};

export type CaseCoverageActionPayload = BaseActionPayload & {
  coverageId?: string;
  payload?: CaseLearningGoalCoveragePayload;
};

export type CaseAnnotationActionPayload = BaseActionPayload & {
  caseId?: string;
  annotationId?: string;
  payload?:
    | CaseEscalationAnnotationPayload
    | CreateCaseClueDiscriminatorAnnotationPayload
    | UpdateCaseClueDiscriminatorAnnotationPayload;
  annotationType?: 'escalation' | 'discriminator';
};

export type WorkspaceActionPayload =
  | TeachingRuleActionPayload
  | EvidenceRelationshipActionPayload
  | ReasoningPathActionPayload
  | ClueRevisionActionPayload
  | CaseDraftActionPayload
  | ClaimRepairActionPayload
  | EducationActionPayload
  | LifecycleActionPayload
  | CaseReadyActionPayload
  | CaseRevisionActionPayload
  | PublicationAuthorizationActionPayload
  | CaseCoverageActionPayload
  | CaseAnnotationActionPayload;

export type WorkspaceActionResult = {
  ok: boolean;
  actionId: WorkspaceActionId | string;
  message: string;
  error?: string;
  data?: unknown;
};

export type WorkspaceActionRequestHandler = (
  actionId: WorkspaceActionId,
  payload: WorkspaceActionPayload,
  subjectId: string,
) => Promise<WorkspaceActionResult>;

export type WorkspaceActionExecutor = (
  actionId: WorkspaceActionId,
  payload: WorkspaceActionPayload,
  context: WorkspaceActionRunnerContext,
) => Promise<unknown>;

export type WorkspaceActionExecutorMap = Partial<
  Record<WorkspaceActionDomain, WorkspaceActionExecutor>
>;
