import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canRunWorkspaceAction,
  requiresConfirmation,
} from './workspaceActionRegistry.ts';
import {
  classifyReviewItemActions,
  getDeferredReviewItemActions,
  getReviewActionPayload,
  getReviewItemActions,
  getWorkspaceActionPendingKey,
  isActionSafeForWorkflowShell,
} from './workspaceReviewActionPolicy.ts';

const SENIOR_ACCESS = {
  canAccessEditorial: true,
  canPublishEditorial: true,
};

test('teaching rule candidates expose approve, reject, and request changes', () => {
  assert.deepEqual(
    getReviewItemActions({
      kind: 'teachingRule',
      sourceId: 'rule-1',
      status: 'CANDIDATE',
    }),
    [
      'teachingRule.approve',
      'teachingRule.reject',
      'teachingRule.requestChanges',
    ],
  );
});

test('evidence candidates expose approve and reject', () => {
  assert.deepEqual(
    getReviewItemActions({
      kind: 'evidenceRelationship',
      sourceId: 'evidence-1',
      status: 'CANDIDATE',
    }),
    ['evidence.approveRelationship', 'evidence.rejectRelationship'],
  );
});

test('reasoning path candidates expose all safe review decisions', () => {
  assert.deepEqual(
    getReviewItemActions({
      kind: 'reasoningPath',
      sourceId: 'path-1',
      status: 'CANDIDATE',
    }),
    [
      'reasoningPath.approve',
      'reasoningPath.reject',
      'reasoningPath.requestChanges',
    ],
  );
});

test('pending clue revisions expose decisions while apply stays deferred', () => {
  assert.deepEqual(
    getReviewItemActions({
      kind: 'clueRevision',
      sourceId: 'draft-1',
      status: 'PENDING_REVIEW',
    }),
    [
      'clueRevision.approve',
      'clueRevision.reject',
      'clueRevision.requestChanges',
      'clueRevision.supersede',
    ],
  );
  assert.deepEqual(
    getDeferredReviewItemActions({
      kind: 'clueRevision',
      sourceId: 'draft-1',
      status: 'APPROVED',
    }),
    ['clueRevision.apply'],
  );
});

test('clinical case drafts expose review decisions and defer controlled apply', () => {
  assert.deepEqual(
    getReviewItemActions({
      kind: 'caseDraft',
      sourceId: 'draft-1',
      status: 'PENDING_REVIEW',
    }),
    ['caseDraft.accept', 'caseDraft.requestChanges', 'caseDraft.reject'],
  );
  assert.deepEqual(
    getDeferredReviewItemActions({
      kind: 'caseDraft',
      sourceId: 'draft-1',
      status: 'ACCEPTED',
    }),
    ['caseDraft.apply'],
  );
  assert.deepEqual(getReviewActionPayload('caseDraft.accept', 'draft-1'), {
    draftId: 'draft-1',
  });
});

test('education candidates expose review decisions and confirmation-gated apply', () => {
  assert.deepEqual(
    getReviewItemActions({
      kind: 'educationCandidate',
      sourceId: 'candidate-1',
      status: 'PENDING_REVIEW',
    }),
    [
      'educationCandidate.accept',
      'educationCandidate.requestChanges',
      'educationCandidate.reject',
    ],
  );
  assert.deepEqual(
    getDeferredReviewItemActions({
      kind: 'educationCandidate',
      sourceId: 'candidate-1',
      status: 'ACCEPTED',
    }),
    ['educationCandidate.apply'],
  );
  assert.equal(isActionSafeForWorkflowShell('educationCandidate.apply'), true);
  assert.equal(requiresConfirmation('educationCandidate.apply'), true);
});

test('education revision and publication actions carry exact governance payloads', () => {
  const revisionSubject = {
    kind: 'educationRevision' as const,
    sourceId: 'revision-1',
    status: 'NEEDS_REVIEW',
    raw: {
      educationId: 'education-1',
      revisionId: 'revision-1',
      expectedVersion: 3,
    },
  };
  const publicationSubject = {
    kind: 'educationPublication' as const,
    sourceId: 'revision-1',
    status: 'READY',
    raw: {
      ready: true,
      educationId: 'education-1',
      revisionId: 'revision-1',
      expectedVersion: 3,
      expectedApprovalDecisionId: 'approval-1',
      expectedActivePublicationDecisionId: 'publication-1',
    },
  };

  assert.deepEqual(getDeferredReviewItemActions(revisionSubject), [
    'educationRevision.approve',
    'educationRevision.requestChanges',
    'educationRevision.reject',
  ]);
  assert.deepEqual(
    getReviewActionPayload(
      'educationRevision.approve',
      'revision-1',
      revisionSubject,
    ),
    {
      educationId: 'education-1',
      revisionId: 'revision-1',
      expectedVersion: 3,
      note: 'Workspace Education revision decision.',
    },
  );
  assert.deepEqual(getDeferredReviewItemActions(publicationSubject), [
    'educationPublication.authorizeRevision',
  ]);
  assert.deepEqual(
    getReviewActionPayload(
      'educationPublication.authorizeRevision',
      'revision-1',
      publicationSubject,
    ),
    {
      educationId: 'education-1',
      revisionId: 'revision-1',
      expectedVersion: 3,
      expectedApprovalDecisionId: 'approval-1',
      expectedActivePublicationDecisionId: 'publication-1',
      publicationDecisionId: undefined,
      note: 'Workspace Education publication decision.',
    },
  );
});

test('case revisions expose start review and confirmation-gated APP-006 approval', () => {
  assert.deepEqual(
    getReviewItemActions({
      kind: 'caseRevision',
      sourceId: 'case-1',
      status: 'NEEDS_REVIEW',
      raw: { caseId: 'case-1', revisionId: 'revision-1' },
    }),
    ['caseRevision.startReview'],
  );
  assert.deepEqual(
    getDeferredReviewItemActions({
      kind: 'caseRevision',
      sourceId: 'case-1',
      status: 'IN_REVIEW',
      raw: { caseId: 'case-1', revisionId: 'revision-1', reviewId: 'review-1' },
    }),
    ['caseRevision.approve'],
  );
  assert.deepEqual(
    getReviewActionPayload('caseRevision.approve', 'case-1', {
      raw: { caseId: 'case-1', revisionId: 'revision-1', reviewId: 'review-1' },
    }),
    { caseId: 'case-1', revisionId: 'revision-1', reviewId: 'review-1' },
  );
});

test('publication authorization requires READY projection and keeps confirmation external', () => {
  const subject = {
    kind: 'publicationAuthorization' as const,
    sourceId: 'case-1',
    status: 'READY',
    raw: {
      ready: true,
      caseId: 'case-1',
      revisionId: 'revision-1',
      expectedApprovalDecisionId: 'approval-1',
      expectedMaterialContextHash: 'hash-1',
      expectedValidationRunId: 'validation-1',
      expectedActivePublicationDecisionId: null,
    },
  };
  assert.deepEqual(getDeferredReviewItemActions(subject), [
    'publication.authorizeRevision',
  ]);
  assert.deepEqual(
    getReviewActionPayload('publication.authorizeRevision', 'case-1', subject),
    {
      caseId: 'case-1',
      revisionId: 'revision-1',
      expectedApprovalDecisionId: 'approval-1',
      expectedMaterialContextHash: 'hash-1',
      expectedValidationRunId: 'validation-1',
      expectedActivePublicationDecisionId: undefined,
    },
  );
  assert.equal(requiresConfirmation('publication.authorizeRevision'), true);
});

test('repairable unsupported claims expose repair', () => {
  assert.deepEqual(
    getReviewItemActions({
      kind: 'unsupportedClaim',
      sourceId: 'claim-1',
      repairable: true,
    }),
    ['education.repairUnsupportedClaim'],
  );
});

test('unsafe workflow operations are never surfaced', () => {
  const unsafe = [
    'publication.performLifecycleAction',
    'publication.normalizeLifecycle',
    'caseCoverage.delete',
    'teachingRule.generateCandidates',
    'clueRevision.apply',
    'bulk.review',
  ];

  unsafe.forEach((actionId) => {
    assert.equal(isActionSafeForWorkflowShell(actionId), false, actionId);
  });
});

test('education regeneration remains workflow-safe while preserving confirmation and permission gates', () => {
  assert.equal(isActionSafeForWorkflowShell('education.regenerateSection'), true);
  assert.equal(canRunWorkspaceAction('education.regenerateSection', SENIOR_ACCESS), true);
  assert.equal(requiresConfirmation('education.regenerateSection'), true);
  assert.equal(
    classifyReviewItemActions(
      { kind: 'generation', sourceId: 'dx-1' },
      SENIOR_ACCESS,
    )[0]?.state,
    'deferred',
  );
  assert.equal(
    classifyReviewItemActions(
      { kind: 'unsupportedClaim', sourceId: 'claim-1', repairable: true },
      SENIOR_ACCESS,
    )[0]?.state,
    'wired',
  );
});

test('classifies permission, confirmation, deferred, and not-applicable states', () => {
  const nonSenior = {
    canAccessEditorial: true,
    canPublishEditorial: false,
  };
  assert.equal(
    classifyReviewItemActions(
      {
        kind: 'teachingRule',
        sourceId: 'rule-1',
        status: 'CANDIDATE',
      },
      nonSenior,
    )[0]?.state,
    'blockedByPermission',
  );
  assert.equal(
    classifyReviewItemActions(
      { kind: 'clueRevision', sourceId: 'draft-1', status: 'APPROVED' },
      SENIOR_ACCESS,
    )[0]?.state,
    'blockedByConfirmationRequirement',
  );
  assert.equal(
    classifyReviewItemActions(
      { kind: 'generation', sourceId: 'dx-1' },
      SENIOR_ACCESS,
    )[0]?.state,
    'deferred',
  );
  assert.equal(
    classifyReviewItemActions(
      { kind: 'unsupportedClaim', sourceId: 'claim-1', repairable: false },
      SENIOR_ACCESS,
    )[0]?.state,
    'notApplicable',
  );
});

test('missing artifact ids expose no actions', () => {
  assert.deepEqual(
    getReviewItemActions({ kind: 'reasoningPath', status: 'CANDIDATE' }),
    [],
  );
});

test('builds typed payloads and stable per-subject pending keys', () => {
  assert.deepEqual(
    getReviewActionPayload('clueRevision.reject', 'draft-1'),
    { draftId: 'draft-1' },
  );
  assert.equal(
    getWorkspaceActionPendingKey('teachingRule.approve', 'rule-1'),
    'teachingRule.approve:rule-1',
  );
});
