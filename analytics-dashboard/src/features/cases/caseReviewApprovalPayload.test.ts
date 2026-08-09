/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { EditorialCaseDetail } from '../../api/admin';
import { buildReviewPayload, isStaleApprovalConflict } from './caseReviewApprovalPayload.ts';

const detail = (overrides: Partial<EditorialCaseDetail> = {}) =>
  ({
    id: 'case-1',
    currentRevisionId: 'revision-3',
    reviews: [
      {
        id: 'review-1',
        revisionId: 'revision-3',
        reviewerUserId: 'senior-1',
        decision: null,
        notes: null,
        source: null,
        publishTrack: null,
        createdAt: '2026-04-20T00:00:00.000Z',
        decidedAt: null,
      },
    ],
    ...overrides,
  }) as EditorialCaseDetail;

describe('case review approval payload', () => {
  it('sends governed approval command identity for approvals', () => {
    assert.deepEqual(
      buildReviewPayload({
        detail: detail(),
        decision: 'APPROVED',
        notes: ' Approved ',
        commandIdempotencyKey: 'approve-1',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
      {
        decision: 'APPROVED',
        expectedRevisionId: 'revision-3',
        expectedReviewId: 'review-1',
        commandIdempotencyKey: 'approve-1',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
        notes: 'Approved',
      },
    );
  });

  it('keeps non-approval review actions on the compatible contract', () => {
    assert.deepEqual(
      buildReviewPayload({
        detail: detail(),
        decision: 'REJECTED',
        notes: ' Not ready ',
        commandIdempotencyKey: 'ignored-for-rejection',
      }),
      {
        decision: 'REJECTED',
        notes: 'Not ready',
      },
    );
  });

  it('requires exact revision and review identity for approvals', () => {
    assert.throws(
      () =>
        buildReviewPayload({
          detail: detail({ currentRevisionId: null }),
          decision: 'APPROVED',
          commandIdempotencyKey: 'approve-1',
        }),
      /current revision and active review/,
    );
  });

  it('classifies stale approval conflicts without retrying against new state', () => {
    assert.equal(
      isStaleApprovalConflict(
        new Error('Stale approval command: expected revision does not match current revision'),
      ),
      true,
    );
    assert.equal(isStaleApprovalConflict(new Error('Network failed')), false);
  });
});
