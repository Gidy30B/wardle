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
    'caseDraft.apply',
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
