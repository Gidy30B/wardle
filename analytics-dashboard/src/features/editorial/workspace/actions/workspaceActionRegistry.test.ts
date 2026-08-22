import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_ACTION_DOMAINS,
  WORKSPACE_ACTION_INTENTS,
  WORKSPACE_ACTION_REGISTRY,
  canRunWorkspaceAction,
  getWorkspaceActionDescriptor,
  requiresConfirmation,
} from './workspaceActionRegistry.ts';
import type { WorkspaceActionId } from './workspaceActionTypes.ts';

const ACTION_IDS = Object.keys(WORKSPACE_ACTION_REGISTRY) as WorkspaceActionId[];

test('workspace action registry has valid descriptors', () => {
  assert.ok(ACTION_IDS.length > 0);

  for (const actionId of ACTION_IDS) {
    const descriptor = getWorkspaceActionDescriptor(actionId);

    assert.equal(descriptor.id, actionId);
    assert.ok(WORKSPACE_ACTION_DOMAINS.includes(descriptor.domain));
    assert.ok(WORKSPACE_ACTION_INTENTS.includes(descriptor.intent));
    assert.ok(descriptor.label.length > 0);
    assert.ok(descriptor.description.length > 0);
    assert.ok(descriptor.successMessage.length > 0);
    assert.ok(descriptor.failureMessage.length > 0);
    assert.ok(descriptor.sourceWorkflows.length > 0);
  }
});

test('workspace action registry has no duplicate action ids', () => {
  assert.equal(ACTION_IDS.length, new Set(ACTION_IDS).size);
});

test('senior and destructive actions are marked explicitly', () => {
  assert.equal(
    getWorkspaceActionDescriptor('teachingRule.approve').requiredAccess,
    'seniorEditorial',
  );
  assert.equal(
    getWorkspaceActionDescriptor('publication.normalizeLifecycle').requiredAccess,
    'seniorEditorial',
  );
  assert.equal(requiresConfirmation('publication.normalizeLifecycle'), true);
  assert.equal(requiresConfirmation('clueRevision.apply'), true);
  assert.equal(requiresConfirmation('caseDraft.apply'), true);
  assert.equal(
    getWorkspaceActionDescriptor('publication.authorizeRevision').requiredAccess,
    'seniorEditorial',
  );
  assert.equal(requiresConfirmation('publication.authorizeRevision'), true);
  assert.equal(requiresConfirmation('caseRevision.approve'), true);
  assert.equal(requiresConfirmation('caseRevision.startReview'), false);
  assert.equal(requiresConfirmation('caseDraft.accept'), false);
  assert.equal(getWorkspaceActionDescriptor('caseCoverage.delete').destructive, true);
  assert.equal(requiresConfirmation('caseCoverage.delete'), true);
  assert.equal(requiresConfirmation('teachingRule.reject'), false);
  assert.equal(requiresConfirmation('evidence.rejectRelationship'), false);
  assert.equal(requiresConfirmation('reasoningPath.reject'), false);
  assert.equal(requiresConfirmation('clueRevision.reject'), false);
  assert.equal(requiresConfirmation('clueRevision.supersede'), false);
});

test('registry access helper blocks senior actions without publish access', () => {
  assert.equal(
    canRunWorkspaceAction('teachingRule.approve', {
      canAccessEditorial: true,
      canPublishEditorial: false,
    }),
    false,
  );
  assert.equal(
    canRunWorkspaceAction('teachingRule.requestChanges', {
      canAccessEditorial: true,
      canPublishEditorial: false,
    }),
    true,
  );
  assert.equal(
    canRunWorkspaceAction('teachingRule.requestChanges', {
      canAccessEditorial: false,
      canPublishEditorial: true,
    }),
    false,
  );
});
