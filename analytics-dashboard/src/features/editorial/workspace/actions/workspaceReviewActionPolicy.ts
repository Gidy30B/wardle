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
    | 'aiDraft'
    | 'publication'
    | 'lifecycle'
    | 'delete'
    | 'bulk'
    | 'generation';
  sourceId?: string | null;
  status?: string | null;
  repairable?: boolean;
};

export type ReviewItemActionSource = {
  kind: string;
  sourceId: string | null;
  reviewStatus?: string | null;
  repairable?: boolean;
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
  'education.repairUnsupportedClaim',
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
): WorkspaceActionPayload {
  if (actionId.startsWith('teachingRule.')) return { ruleId: sourceId };
  if (actionId.startsWith('evidence.')) return { relationshipId: sourceId };
  if (actionId.startsWith('reasoningPath.')) {
    return { reasoningPathId: sourceId };
  }
  if (actionId.startsWith('clueRevision.')) return { draftId: sourceId };
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
