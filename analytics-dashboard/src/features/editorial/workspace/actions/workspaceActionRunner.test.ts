import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiClient } from '../../../../api/client.ts';
import { runWorkspaceAction } from './workspaceActionRunner.ts';
import type {
  WorkspaceActionExecutorMap,
  WorkspaceActionRunnerContext,
} from './workspaceActionTypes.ts';

function makeContext(
  overrides: Partial<WorkspaceActionRunnerContext> = {},
): WorkspaceActionRunnerContext {
  return {
    access: {
      canAccessEditorial: true,
      canPublishEditorial: true,
    },
    client: {} as ApiClient,
    diagnosisRegistryId: 'dx-1',
    refreshWorkspace: async () => {},
    ...overrides,
  };
}

test('runner rejects unknown action ids', async () => {
  const result = await runWorkspaceAction(
    'not.real',
    {},
    makeContext(),
    {},
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, 'Unknown action id.');
});

test('runner returns failure when a domain action is missing required ids', async () => {
  const result = await runWorkspaceAction(
    'teachingRule.requestChanges',
    {},
    makeContext(),
  );

  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /ruleId/);
});

test('runner blocks senior actions without senior editorial access', async () => {
  let called = false;
  const executors: WorkspaceActionExecutorMap = {
    teachingRule: async () => {
      called = true;
    },
  };

  const result = await runWorkspaceAction(
    'teachingRule.approve',
    { ruleId: 'rule-1' },
    makeContext({
      access: {
        canAccessEditorial: true,
        canPublishEditorial: false,
      },
    }),
    executors,
  );

  assert.equal(result.ok, false);
  assert.equal(called, false);
  assert.match(result.error ?? '', /Senior editorial access/);
});

test('runner blocks confirmation-required actions without confirmation', async () => {
  let called = false;
  const executors: WorkspaceActionExecutorMap = {
    teachingRule: async () => {
      called = true;
    },
  };

  const result = await runWorkspaceAction(
    'clueRevision.apply',
    { draftId: 'draft-1' },
    makeContext(),
    executors,
  );

  assert.equal(result.ok, false);
  assert.equal(called, false);
  assert.match(result.error ?? '', /confirmation/);
});

test('runner dispatches Clinical Case Draft review and apply actions', async () => {
  const calls: Array<{ actionId: string; payload: unknown }> = [];
  let refreshCount = 0;
  const executors: WorkspaceActionExecutorMap = {
    caseDraft: async (actionId, payload) => {
      calls.push({ actionId, payload });
      return { ok: true };
    },
  };
  const context = makeContext({
    refreshWorkspace: async () => {
      refreshCount += 1;
    },
  });

  const accept = await runWorkspaceAction(
    'caseDraft.accept',
    { draftId: 'draft-1' },
    context,
    executors,
  );
  const apply = await runWorkspaceAction(
    'caseDraft.apply',
    { draftId: 'draft-1', confirmed: true },
    context,
    executors,
  );

  assert.equal(accept.ok, true);
  assert.equal(apply.ok, true);
  assert.deepEqual(
    calls.map((call) => call.actionId),
    ['caseDraft.accept', 'caseDraft.apply'],
  );
  assert.equal(refreshCount, 2);
});

test('runner dispatches expanded safe review actions and refreshes each success', async () => {
  const calls: Array<{ actionId: string; payload: unknown }> = [];
  let refreshCount = 0;
  const recordCall = async (actionId: string, payload: unknown) => {
    calls.push({ actionId, payload });
    return { saved: true };
  };
  const executors: WorkspaceActionExecutorMap = {
    teachingRule: recordCall,
    evidence: recordCall,
    reasoningPath: recordCall,
    clueRevision: recordCall,
    caseDraft: recordCall,
    claimRepair: recordCall,
  };
  const context = makeContext({
    refreshWorkspace: async () => {
      refreshCount += 1;
    },
  });
  const actions = [
    ['teachingRule.reject', { ruleId: 'rule-1' }],
    ['teachingRule.requestChanges', { ruleId: 'rule-1' }],
    ['evidence.rejectRelationship', { relationshipId: 'evidence-1' }],
    ['reasoningPath.reject', { reasoningPathId: 'path-1' }],
    ['reasoningPath.requestChanges', { reasoningPathId: 'path-1' }],
    ['clueRevision.approve', { draftId: 'draft-1' }],
    ['clueRevision.reject', { draftId: 'draft-1' }],
    ['clueRevision.requestChanges', { draftId: 'draft-1' }],
    ['clueRevision.supersede', { draftId: 'draft-1' }],
    ['caseDraft.accept', { draftId: 'draft-1' }],
    ['caseDraft.reject', { draftId: 'draft-1' }],
    ['caseDraft.requestChanges', { draftId: 'draft-1' }],
    ['education.repairUnsupportedClaim', { claimId: 'claim-1' }],
  ] as const;

  for (const [actionId, payload] of actions) {
    const result = await runWorkspaceAction(
      actionId,
      payload,
      context,
      executors,
    );
    assert.equal(result.ok, true, actionId);
  }

  assert.deepEqual(
    calls.map((call) => call.actionId),
    actions.map(([actionId]) => actionId),
  );
  assert.equal(refreshCount, actions.length);
});

test('runner executes known actions and refreshes on success', async () => {
  let called = false;
  let refreshed = false;
  const pendingMessages: string[] = [];
  const successMessages: string[] = [];
  const executors: WorkspaceActionExecutorMap = {
    teachingRule: async () => {
      called = true;
      return { saved: true };
    },
  };

  const result = await runWorkspaceAction(
    'teachingRule.requestChanges',
    { ruleId: 'rule-1' },
    makeContext({
      refreshWorkspace: async () => {
        refreshed = true;
      },
      showPending: (message) => pendingMessages.push(message),
      showSuccess: (message) => successMessages.push(message),
    }),
    executors,
  );

  assert.equal(result.ok, true);
  assert.equal(called, true);
  assert.equal(refreshed, true);
  assert.deepEqual(result.data, { saved: true });
  assert.deepEqual(pendingMessages, ['Request teaching rule changes']);
  assert.deepEqual(successMessages, ['Teaching rule changes requested.']);
});

test('runner returns structured failure when an executor fails', async () => {
  let refreshed = false;
  const errorMessages: string[] = [];
  const executors: WorkspaceActionExecutorMap = {
    teachingRule: async () => {
      throw new Error('API exploded');
    },
  };

  const result = await runWorkspaceAction(
    'teachingRule.requestChanges',
    { ruleId: 'rule-1' },
    makeContext({
      refreshWorkspace: async () => {
        refreshed = true;
      },
      showError: (message) => errorMessages.push(message),
    }),
    executors,
  );

  assert.equal(result.ok, false);
  assert.equal(refreshed, false);
  assert.equal(result.error, 'API exploded');
  assert.match(errorMessages[0], /Unable to request teaching rule changes/);
});

test('runner treats notification callbacks as best-effort', async () => {
  const executors: WorkspaceActionExecutorMap = {
    teachingRule: async () => ({ saved: true }),
  };

  const result = await runWorkspaceAction(
    'teachingRule.requestChanges',
    { ruleId: 'rule-1' },
    makeContext({
      showPending: () => {
        throw new Error('pending toast broke');
      },
      showSuccess: () => {
        throw new Error('success toast broke');
      },
    }),
    executors,
  );

  assert.equal(result.ok, true);
});
