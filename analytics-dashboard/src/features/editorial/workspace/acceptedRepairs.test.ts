/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { repairsBySection, visibleAcceptedRepairs } from './acceptedRepairs.ts';
import type { DiagnosisEditorialWorkspace } from '../../../api/admin';

describe('accepted education repairs', () => {
  const repairs = [
    {
      section: 'management',
      originalClaim: 'Antibiotics always cure appendicitis',
      acceptedClaim: 'Antibiotics can support selected cases.',
      evidenceIds: ['evidence-1'],
      acceptedAt: '2026-06-01T12:00:00.000Z',
      reviewerUserId: 'admin-1',
      sourceAuditId: 'audit-1',
    },
    {
      section: 'investigations',
      originalClaim: 'CT is never needed',
      acceptedClaim: 'CT may be used when diagnosis is uncertain.',
      evidenceIds: [],
      acceptedAt: null,
      reviewerUserId: null,
      sourceAuditId: 'audit-2',
    },
  ];

  it('groups repairs by education section', () => {
    assert.deepEqual(Object.keys(repairsBySection(repairs)), [
      'management',
      'investigations',
    ]);
    assert.equal(repairsBySection(repairs).management[0].sourceAuditId, 'audit-1');
  });

  it('filters visible repairs for a section', () => {
    const workspace = {
      education: {
        acceptedRepairs: repairs,
      },
    } as DiagnosisEditorialWorkspace;

    assert.equal(visibleAcceptedRepairs(workspace, 'management').length, 1);
    assert.equal(visibleAcceptedRepairs(workspace).length, 2);
  });
});
