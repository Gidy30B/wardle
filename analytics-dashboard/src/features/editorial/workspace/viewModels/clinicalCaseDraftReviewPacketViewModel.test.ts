/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { WorkspaceClinicalCaseDraft } from '../../../../api/admin.types.ts';
import {
  actionIdsForDraft,
  buildClinicalCaseDraftReviewPacket,
} from './clinicalCaseDraftReviewPacketViewModel.ts';

describe('buildClinicalCaseDraftReviewPacket', () => {
  it('keeps pending review separate from controlled application', () => {
    const packet = buildClinicalCaseDraftReviewPacket(draft());

    assert.equal(packet.id, 'draft-1');
    assert.equal(packet.title, 'Late discriminator case');
    assert.deepEqual(packet.actionIds, [
      'caseDraft.accept',
      'caseDraft.requestChanges',
      'caseDraft.reject',
    ]);
    assert.equal(packet.provenance.isSecondaryEvidence, true);
    assert.match(packet.validation.disclaimer, /not APP-006 approval/i);
    assert.equal(packet.generatedCase.clues[0], 'Opening clue keeps mimic plausible.');
  });

  it('exposes apply only after acceptance and application eligibility', () => {
    assert.deepEqual(
      actionIdsForDraft({
        reviewStatus: 'ACCEPTED',
        applicationAllowed: true,
      }),
      ['caseDraft.apply'],
    );
    assert.deepEqual(
      actionIdsForDraft({
        reviewStatus: 'ACCEPTED',
        applicationAllowed: false,
      }),
      [],
    );
  });
});

function draft(
  overrides: Partial<WorkspaceClinicalCaseDraft> = {},
): WorkspaceClinicalCaseDraft {
  return {
    id: 'draft-1',
    diagnosisRegistryId: 'dx-1',
    diagnosisDisplayName: 'Subarachnoid Hemorrhage',
    generationPurpose: 'TARGETED_DISCRIMINATOR_CASE',
    generationPurposeLabel: 'Targeted discriminator case',
    generationMethod: 'AI_GENERATED',
    selectionSource: 'workspace',
    sourceIssue: null,
    sourceIssueSummary: 'Migraine discriminator needs case support.',
    generatedCase: {
      title: 'Late discriminator case',
      finalDiagnosis: 'Subarachnoid Hemorrhage',
      difficulty: 'intermediate',
      clueCount: 2,
      clues: [
        { value: 'Opening clue keeps mimic plausible.' },
        { value: 'Later CT clue separates the target.' },
      ],
      differentials: ['Migraine'],
      explanation: { summary: 'Thunderclap and CT blood win.' },
      summary: 'A generated case candidate.',
    },
    validation: {
      status: 'PASSED',
      summary: { verdict: 'valid' },
      findings: {},
      blockers: [],
      warnings: ['Needs human review.'],
      blockerCount: 0,
      warningCount: 1,
      passed: true,
    },
    provenance: {
      generationContext: {},
      generationContextHash: 'hash-1',
      generatedContent: {},
      generatorVersion: 'test-v1',
      generatedAt: '2026-08-22T00:00:00.000Z',
      targetDifficulty: 'intermediate',
    },
    reviewStatus: 'PENDING_REVIEW',
    currentRequiredDecision: 'Accept, reject, or request changes.',
    applicationAllowed: false,
    resultingCaseId: null,
    resultingCaseRevisionId: null,
    latestReviewDecision: null,
    governanceHistory: [],
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
    ...overrides,
  };
}
