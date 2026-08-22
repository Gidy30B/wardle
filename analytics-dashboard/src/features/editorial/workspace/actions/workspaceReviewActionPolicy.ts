import {
  canRunWorkspaceAction,
  isWorkspaceActionId,
  requiresConfirmation,
} from './workspaceActionRegistry.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionId,
  WorkspaceActionPayload,
} from './workspaceActionTypes.ts';

export type SafeReviewSubject = {
  kind:
    | 'teachingRule'
    | 'evidenceRelationship'
    | 'reasoningPath'
    | 'clueRevision'
    | 'unsupportedClaim'
    | 'caseDraft'
    | 'caseRevision'
    | 'aiDraft'
    | 'publication'
    | 'publicationAuthorization'
    | 'lifecycle'
    | 'delete'
    | 'bulk'
    | 'generation';
  sourceId?: string | null;
  status?: string | null;
  repairable?: boolean;
  raw?: unknown;
};

export type ReviewItemActionSource = {
  kind: string;
  sourceId: string | null;
  reviewStatus?: string | null;
  repairable?: boolean;
  raw?: unknown;
};

export type WorkflowActionPolicyState =
  | 'wired'
  | 'deferred'
  | 'blockedByPermission'
  | 'blockedByConfirmationRequirement'
  | 'notApplicable';

export type WorkflowActionPolicyDecision = {
  actionId: WorkspaceActionId | null;
  state: WorkflowActionPolicyState;
};

const WORKFLOW_SAFE_ACTIONS = new Set<WorkspaceActionId>([
  'teachingRule.approve',
  'teachingRule.reject',
  'teachingRule.requestChanges',
  'evidence.approveRelationship',
  'evidence.rejectRelationship',
  'reasoningPath.approve',
  'reasoningPath.reject',
  'reasoningPath.requestChanges',
  'clueRevision.approve',
  'clueRevision.reject',
  'clueRevision.requestChanges',
  'clueRevision.supersede',
  'caseDraft.accept',
  'caseDraft.reject',
  'caseDraft.requestChanges',
  'caseRevision.startReview',
  'caseRevision.approve',
  'publication.authorizeRevision',
  'education.repairUnsupportedClaim',
  'education.regenerateSection',
]);

export function getReviewItemActions(
  subject: SafeReviewSubject,
): WorkspaceActionId[] {
  if (!subject.sourceId) return [];

  return applicableActions(subject).filter(
    (actionId) =>
      isActionSafeForWorkflowShell(actionId) &&
      !requiresConfirmation(actionId),
  );
}

export const getSafeReviewActionIds = getReviewItemActions;

export function getDeferredReviewItemActions(
  subject: SafeReviewSubject,
): WorkspaceActionId[] {
  if (!subject.sourceId) return [];

  return applicableActions(subject).filter(
    (actionId) =>
      !isActionSafeForWorkflowShell(actionId) || requiresConfirmation(actionId),
  );
}

export function isActionSafeForWorkflowShell(actionId: string): boolean {
  return isWorkspaceActionId(actionId) && WORKFLOW_SAFE_ACTIONS.has(actionId);
}

export function classifyReviewItemActions(
  subject: SafeReviewSubject,
  access: WorkspaceActionAccess,
): WorkflowActionPolicyDecision[] {
  if (!subject.sourceId) {
    return [{ actionId: null, state: 'notApplicable' }];
  }

  const actions = applicableActions(subject);
  if (!actions.length) {
    return [
      {
        actionId: null,
        state:
          subject.kind === 'aiDraft' || subject.kind === 'bulk'
            ? 'deferred'
            : 'notApplicable',
      },
    ];
  }

  return actions.map((actionId) => ({
    actionId,
    state: actionPolicyState(actionId, access),
  }));
}

export function getReviewActionSubject(
  item: ReviewItemActionSource,
): SafeReviewSubject | null {
  const common = {
    sourceId: item.sourceId,
    status: item.reviewStatus,
    raw: item.raw,
  };

  switch (item.kind) {
    case 'teaching_rule':
      return { kind: 'teachingRule', ...common };
    case 'evidence_relationship':
      return { kind: 'evidenceRelationship', ...common };
    case 'reasoning_path':
      return { kind: 'reasoningPath', ...common };
    case 'clue_revision_draft':
      return { kind: 'clueRevision', ...common };
    case 'clinical_case_draft':
      return { kind: 'caseDraft', ...common };
    case 'case_revision':
      return { kind: 'caseRevision', ...common };
    case 'publication_authorization':
      return { kind: 'publicationAuthorization', ...common };
    case 'unsupported_claim':
      return {
        kind: 'unsupportedClaim',
        ...common,
        repairable: item.repairable,
      };
    default:
      return null;
  }
}

export function getReviewActionPayload(
  actionId: WorkspaceActionId,
  sourceId: string,
  source?: { raw?: unknown },
): WorkspaceActionPayload {
  if (actionId.startsWith('teachingRule.')) return { ruleId: sourceId };
  if (actionId.startsWith('evidence.')) return { relationshipId: sourceId };
  if (actionId.startsWith('reasoningPath.')) {
    return { reasoningPathId: sourceId };
  }
  if (actionId.startsWith('clueRevision.')) return { draftId: sourceId };
  if (actionId.startsWith('caseDraft.')) return { draftId: sourceId };
  if (actionId.startsWith('caseRevision.')) {
    const raw = recordPayload(source);
    return {
      caseId: stringValue(raw.caseId) ?? sourceId,
      revisionId: stringValue(raw.revisionId),
      reviewId: stringValue(raw.reviewId) ?? null,
    };
  }
  if (actionId === 'publication.authorizeRevision') {
    const raw = recordPayload(source);
    return {
      caseId: stringValue(raw.caseId) ?? sourceId,
      revisionId: stringValue(raw.revisionId),
      expectedApprovalDecisionId: stringValue(raw.expectedApprovalDecisionId),
      expectedMaterialContextHash: stringValue(raw.expectedMaterialContextHash),
      expectedValidationRunId: stringValue(raw.expectedValidationRunId),
      expectedActivePublicationDecisionId: stringValue(
        raw.expectedActivePublicationDecisionId,
      ),
    };
  }
  if (actionId === 'education.repairUnsupportedClaim') {
    return { claimId: sourceId };
  }
  return {};
}

export function getWorkspaceActionPendingKey(
  actionId: WorkspaceActionId,
  subjectId: string,
): string {
  return `${actionId}:${subjectId}`;
}

function applicableActions(subject: SafeReviewSubject): WorkspaceActionId[] {
  if (subject.kind === 'teachingRule') {
    if (subject.status === 'CANDIDATE') {
      return [
        'teachingRule.approve',
        'teachingRule.reject',
        'teachingRule.requestChanges',
      ];
    }
    if (subject.status === 'NEEDS_REVIEW') {
      return ['teachingRule.approve', 'teachingRule.reject'];
    }
  }

  if (
    subject.kind === 'evidenceRelationship' &&
    subject.status === 'CANDIDATE'
  ) {
    return ['evidence.approveRelationship', 'evidence.rejectRelationship'];
  }

  if (subject.kind === 'reasoningPath' && subject.status === 'CANDIDATE') {
    return [
      'reasoningPath.approve',
      'reasoningPath.reject',
      'reasoningPath.requestChanges',
    ];
  }

  if (subject.kind === 'clueRevision') {
    if (isPendingClueRevisionStatus(subject.status)) {
      return [
        'clueRevision.approve',
        'clueRevision.reject',
        'clueRevision.requestChanges',
        'clueRevision.supersede',
      ];
    }
    if (subject.status === 'APPROVED') return ['clueRevision.apply'];
  }

  if (subject.kind === 'caseDraft') {
    if (subject.status === 'PENDING_REVIEW') {
      return [
        'caseDraft.accept',
        'caseDraft.requestChanges',
        'caseDraft.reject',
      ];
    }
    if (subject.status === 'ACCEPTED') return ['caseDraft.apply'];
  }

  if (subject.kind === 'caseRevision') {
    if (subject.status === 'NEEDS_REVIEW') return ['caseRevision.startReview'];
    if (subject.status === 'IN_REVIEW') return ['caseRevision.approve'];
  }

  if (subject.kind === 'publicationAuthorization') {
    const raw = recordPayload(subject);
    if (subject.status === 'READY' && raw.ready === true) {
      return ['publication.authorizeRevision'];
    }
    return [];
  }

  if (subject.kind === 'unsupportedClaim' && subject.repairable) {
    return ['education.repairUnsupportedClaim'];
  }

  if (subject.kind === 'generation') {
    return ['teachingRule.generateCandidates'];
  }
  if (subject.kind === 'lifecycle') {
    return ['publication.performLifecycleAction'];
  }
  if (subject.kind === 'publication') {
    return ['publication.markCaseReady'];
  }
  if (subject.kind === 'delete') return ['caseCoverage.delete'];

  return [];
}

function actionPolicyState(
  actionId: WorkspaceActionId,
  access: WorkspaceActionAccess,
): WorkflowActionPolicyState {
  if (requiresConfirmation(actionId)) {
    return 'blockedByConfirmationRequirement';
  }
  if (!isActionSafeForWorkflowShell(actionId)) return 'deferred';
  if (!canRunWorkspaceAction(actionId, access)) return 'blockedByPermission';
  return 'wired';
}

function isPendingClueRevisionStatus(status: string | null | undefined) {
  return [
    'DRAFT',
    'REVIEW_REQUIRED',
    'PENDING_REVIEW',
    'NEEDS_CHANGES',
    'pending',
    'needs_review',
  ].includes(status ?? '');
}

function recordPayload(source?: { raw?: unknown }): Record<string, unknown> {
  return source?.raw &&
    typeof source.raw === 'object' &&
    !Array.isArray(source.raw)
    ? (source.raw as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length ? value : undefined;
}
