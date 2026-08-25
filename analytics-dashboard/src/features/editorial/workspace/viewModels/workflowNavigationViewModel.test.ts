/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkflowSearchParams,
  buildWorkflowNavigationViewModel,
  getWorkflowForBoard,
  resolveBoardId,
  resolveWorkflowId,
} from './workflowNavigationViewModel.ts';

describe('workflowNavigationViewModel', () => {
  it('defaults to the review queue when no workflow is selected', () => {
    const viewModel = buildWorkflowNavigationViewModel({});

    assert.equal(viewModel.activeWorkflowId, 'reviewQueue');
    assert.equal(viewModel.activeBoardId, null);
    assert.deepEqual(
      viewModel.items.map((item) => item.id),
      [
        'reviewQueue',
        'overview',
        'teaching',
        'reasoning',
        'cases',
        'content',
        'publish',
      ],
    );
  });

  it('accepts workflow and board params when they belong together', () => {
    const viewModel = buildWorkflowNavigationViewModel({
      workflowParam: 'reasoning',
      boardParam: 'differentials',
    });

    assert.equal(viewModel.activeWorkflowId, 'reasoning');
    assert.equal(viewModel.activeBoardId, 'differentials');
  });

  it('falls back to the workflow default board when the board belongs elsewhere', () => {
    assert.equal(resolveBoardId('education', 'reasoning'), 'diagnosticReasoning');
    assert.equal(resolveBoardId('education', 'cases'), 'diagnosticCases');
    assert.equal(resolveBoardId('publicationReadiness', 'publish'), 'publicationReadiness');
  });

  it('maps legacy tab params to the new workflow destination', () => {
    assert.equal(resolveWorkflowId(null, 'graph'), 'reasoning');
    assert.equal(
      buildWorkflowNavigationViewModel({ legacyTabParam: 'graph' })
        .activeBoardId,
      'differentials',
    );
    assert.equal(
      buildWorkflowNavigationViewModel({ legacyTabParam: 'integrity' })
        .activeBoardId,
      'publicationReadiness',
    );
  });

  it('knows which workflow owns each board', () => {
    assert.equal(getWorkflowForBoard('diagnosticReasoning'), 'reasoning');
    assert.equal(getWorkflowForBoard('curriculumCoverage'), 'teaching');
    assert.equal(getWorkflowForBoard('clueProgression'), 'cases');
    assert.equal(getWorkflowForBoard('reasoningCoverage'), 'cases');
    assert.equal(getWorkflowForBoard('discriminatorCoverage'), 'cases');
    assert.equal(getWorkflowForBoard('recallPrompts'), 'content');
  });

  it('supports all Cases workflow boards', () => {
    const viewModel = buildWorkflowNavigationViewModel({
      workflowParam: 'cases',
      boardParam: 'discriminatorCoverage',
    });

    assert.equal(viewModel.activeWorkflowId, 'cases');
    assert.equal(viewModel.activeBoardId, 'discriminatorCoverage');
    assert.deepEqual(
      viewModel.items.find((item) => item.id === 'cases')?.boardIds,
      [
        'diagnosticCases',
        'clueProgression',
        'reasoningCoverage',
        'discriminatorCoverage',
      ],
    );
  });

  it('supports all Content workflow boards', () => {
    const viewModel = buildWorkflowNavigationViewModel({
      workflowParam: 'content',
      boardParam: 'recallPrompts',
    });

    assert.equal(viewModel.activeWorkflowId, 'content');
    assert.equal(viewModel.activeBoardId, 'recallPrompts');
    assert.equal(resolveBoardId('diagnosticCases', 'content'), 'education');
    assert.deepEqual(
      viewModel.items.find((item) => item.id === 'content')?.boardIds,
      ['education', 'scoringSystems', 'mnemonics', 'recallPrompts'],
    );
  });

  it('builds workflow search params while preserving shell and unrelated URL state', () => {
    const params = new URLSearchParams(
      'workspaceShell=workflow&tab=graph&claimId=claim-1',
    );
    const next = buildWorkflowSearchParams(params, {
      workflowId: 'content',
      boardId: 'recallPrompts',
    });

    assert.equal(next.get('workspaceShell'), 'workflow');
    assert.equal(next.get('workflow'), 'content');
    assert.equal(next.get('board'), 'recallPrompts');
    assert.equal(next.get('claimId'), 'claim-1');
    assert.equal(next.has('tab'), false);
  });

  it('builds workflow search params with safe default board fallback', () => {
    const next = buildWorkflowSearchParams(new URLSearchParams(), {
      workflowId: 'reasoning',
      boardId: 'education',
    });

    assert.equal(next.get('workspaceShell'), null);
    assert.equal(next.get('workflow'), 'reasoning');
    assert.equal(next.get('board'), 'diagnosticReasoning');
  });

  it('preserves exact packet identity for queue to packet deep links', () => {
    const params = new URLSearchParams('workflow=reviewQueue');
    const next = buildWorkflowSearchParams(params, {
      workflowId: 'content',
      boardId: 'education',
      packetType: 'educationCandidate',
      packetId: 'candidate-1',
    });
    const viewModel = buildWorkflowNavigationViewModel({
      workflowParam: next.get('workflow'),
      boardParam: next.get('board'),
      packetTypeParam: next.get('packet'),
      packetIdParam: next.get('packetId'),
    });

    assert.equal(next.get('packet'), 'educationCandidate');
    assert.equal(next.get('packetId'), 'candidate-1');
    assert.deepEqual(viewModel.activePacketTarget, {
      type: 'educationCandidate',
      id: 'candidate-1',
    });
  });
});
