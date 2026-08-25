/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  DiagnosisEditorialWorkspace,
  DiagnosisEducationCandidate,
  EducationGovernanceDecisionSummary,
} from '../../../../api/admin.types.ts';
import { buildEducationWorkPackets } from './educationWorkPacketViewModel.ts';

test('builds pending section candidate packet with current and proposed material', () => {
  const packets = buildEducationWorkPackets(
    workspace({
      educationCandidates: {
        summary: candidateSummary(),
        groups: {
          pendingReview: [sectionCandidate()],
          needsChanges: [],
          acceptedAwaitingApplication: [],
          applied: [],
          rejected: [],
        },
        items: [sectionCandidate()],
      },
    }),
  );

  const packet = packets.candidates[0];

  assert.equal(packet?.title, 'Management Education candidate');
  assert.equal(packet?.currentMaterial.content, 'Current management');
  assert.equal(packet?.proposedMaterial.content, 'Proposed management');
  assert.deepEqual(packet?.actionIds, [
    'educationCandidate.accept',
    'educationCandidate.requestChanges',
    'educationCandidate.reject',
  ]);
  assert.ok(
    packet?.provenance.some(
      (fact) => fact.label === 'Context hash' && fact.value === 'hash-1',
    ),
  );
});

test('accepted candidate exposes Apply and not review decisions', () => {
  const packets = buildEducationWorkPackets(
    workspace({
      educationCandidates: {
        summary: candidateSummary(),
        groups: {
          pendingReview: [],
          needsChanges: [],
          acceptedAwaitingApplication: [
            sectionCandidate({
              reviewStatus: 'ACCEPTED',
              applicationAllowed: true,
            }),
          ],
          applied: [],
          rejected: [],
        },
        items: [
          sectionCandidate({
            reviewStatus: 'ACCEPTED',
            applicationAllowed: true,
          }),
        ],
      },
    }),
  );

  assert.deepEqual(packets.candidates[0]?.actionIds, [
    'educationCandidate.apply',
  ]);
  assert.match(
    packets.candidates[0]?.application.confirmationMessage ?? '',
    /NEEDS_REVIEW/,
  );
});

test('stale accepted candidate remains visible but cannot apply', () => {
  const packets = buildEducationWorkPackets(
    workspace({
      educationCandidates: {
        summary: candidateSummary(),
        groups: {
          pendingReview: [],
          needsChanges: [],
          acceptedAwaitingApplication: [
            sectionCandidate({
              reviewStatus: 'ACCEPTED',
              applicationAllowed: false,
              stale: true,
            }),
          ],
          applied: [],
          rejected: [],
        },
        items: [
          sectionCandidate({
            reviewStatus: 'ACCEPTED',
            applicationAllowed: false,
            stale: true,
          }),
        ],
      },
    }),
  );

  assert.deepEqual(packets.candidates[0]?.actionIds, []);
  assert.equal(packets.candidates[0]?.tone, 'danger');
  assert.match(packets.candidates[0]?.purpose.nextStep ?? '', /cannot be applied/i);
});

test('needs-changes rejected superseded and stale candidates cannot apply', () => {
  for (const reviewStatus of ['NEEDS_CHANGES', 'REJECTED', 'SUPERSEDED'] as const) {
    const packets = buildEducationWorkPackets(
      workspace({
        educationCandidates: {
          summary: candidateSummary(),
          groups: {
            pendingReview: [],
            needsChanges: [],
            acceptedAwaitingApplication: [],
            applied: [],
            rejected: [],
          },
          items: [
            sectionCandidate({
              reviewStatus,
              applicationAllowed: false,
              stale: reviewStatus === 'SUPERSEDED',
            }),
          ],
        },
      }),
    );

    assert.deepEqual(packets.candidates[0]?.actionIds, [], reviewStatus);
  }
});

test('revision packet targets exact current Education revision', () => {
  const packets = buildEducationWorkPackets(workspace());

  assert.equal(packets.revision?.id, 'revision-2');
  assert.deepEqual(packets.revision?.actionIds, [
    'educationRevision.approve',
    'educationRevision.requestChanges',
    'educationRevision.reject',
  ]);
  assert.deepEqual(packets.revision?.actionTarget, {
    educationId: 'education-1',
    revisionId: 'revision-2',
    expectedVersion: 2,
  });
});

test('standing summary distinguishes current approved and published revisions', () => {
  const packets = buildEducationWorkPackets(
    workspace({
      education: {
        id: 'education-1',
        status: 'review',
        version: 3,
        qualityScore: 0.8,
        sectionHealth: [],
        blockers: [],
        warnings: [],
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      educationGovernance: {
        currentRevisionId: 'revision-3',
        currentVersion: 3,
        latestApprovedRevision: decisionSummary({
          id: 'approval-3',
          kind: 'approval',
          version: 3,
          educationRevisionId: 'revision-3',
        }),
        standingPublication: decisionSummary({
          id: 'publication-2',
          kind: 'publication',
          version: 2,
          educationRevisionId: 'revision-2',
        }),
        history: [
          decisionSummary({
            id: 'approval-3',
            kind: 'approval',
            version: 3,
            educationRevisionId: 'revision-3',
          }),
        ],
        publicationReadiness: publicationReadiness(),
        reviewAction: null,
        publicationAction: null,
      },
    }),
  );

  assert.deepEqual(
    packets.standingSummary.rows.map((row) => row.value),
    ['v3', 'v3 (approval-3)', 'v2 (publication-2)'],
  );
  assert.match(packets.standingSummary.detail, /learner publication remains v2/i);
  assert.match(packets.revision?.history[0]?.target ?? '', /revision-3/);
});

test('publication packet exposes authorization only when readiness is ready', () => {
  const ready = buildEducationWorkPackets(workspace()).publication;
  const blocked = buildEducationWorkPackets(
    workspace({
      educationGovernance: {
        currentRevisionId: 'revision-2',
        currentVersion: 2,
        reviewAction: null,
        publicationAction: null,
        publicationReadiness: {
          ...publicationReadiness(),
          result: 'BLOCKED',
          blockers: [{ code: 'missing_summary', message: 'Missing summary.' }],
        },
      },
    }),
  ).publication;

  assert.deepEqual(ready?.actionIds, ['educationPublication.authorizeRevision']);
  assert.deepEqual(blocked?.actionIds, []);
  assert.deepEqual(blocked?.blockers, ['Missing summary.']);
});

test('publication packet offers withdrawal for the standing published revision without false authorization', () => {
  const packets = buildEducationWorkPackets(
    workspace({
      educationGovernance: {
        currentRevisionId: 'revision-2',
        currentVersion: 2,
        latestApprovedRevision: decisionSummary({
          id: 'approval-1',
          kind: 'approval',
        }),
        standingPublication: decisionSummary({
          id: 'publication-1',
          kind: 'publication',
        }),
        history: [],
        publicationReadiness: publicationReadiness(),
        reviewAction: null,
        publicationAction: null,
      },
    }),
  );

  assert.deepEqual(packets.publication?.actionIds, [
    'educationPublication.withdraw',
  ]);
  assert.equal(
    packets.publication?.actionTarget.publicationDecisionId,
    'publication-1',
  );
});

function workspace(
  overrides: Partial<DiagnosisEditorialWorkspace> = {},
): DiagnosisEditorialWorkspace {
  return {
    diagnosis: {
      id: 'dx-1',
      canonicalName: 'condition',
      displayLabel: 'Condition',
      specialty: null,
      bodySystem: null,
      category: null,
      difficultyBand: null,
      aliases: [],
    },
    lifecycle: {
      curriculum: 'complete',
      brief: 'complete',
      education: 'warning',
      cases: 'complete',
      graph: 'complete',
      ready: 'warning',
    },
    workspaceSummary: {
      status: 'needs_review',
      overallScore: null,
      graphReadiness: null,
      educationScore: null,
      caseQualitySummary: {},
      blockers: [],
      warnings: [],
      recommendedActions: [],
    },
    readinessBreakdown: [],
    coverageMatrix: [],
    coverageGaps: [],
    teachingRules: {
      summary: {
        total: 0,
        active: 0,
        approved: 0,
        candidates: 0,
        needsReview: 0,
        critical: 0,
      },
      items: [],
    },
    editorialBrief: {
      status: null,
      version: null,
      activeForGeneration: false,
      summary: null,
      updatedAt: null,
    },
    education: {
      id: 'education-1',
      status: 'review',
      version: 2,
      qualityScore: 0.8,
      sectionHealth: [],
      blockers: [],
      warnings: ['Needs review.'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    educationGovernance: {
      currentRevisionId: 'revision-2',
      currentVersion: 2,
      publicationReadiness: publicationReadiness(),
      reviewAction: {
        id: 'review-education-revision',
        label: 'Review Education revision',
        source: 'education_revision',
        severity: 'warning',
        targetTab: 'education',
        enabled: true,
        disabledReason: null,
      },
      publicationAction: {
        id: 'authorize-education-publication',
        label: 'Authorize Education publication',
        source: 'education_publication',
        severity: 'warning',
        targetTab: 'education',
        enabled: true,
        disabledReason: null,
      },
    },
    revisions: {
      latest: {
        id: 'revision-2',
        educationId: 'education-1',
        version: 2,
        editorialStatus: 'NEEDS_REVIEW',
        source: 'AI_ASSISTED',
        createdByUserId: 'editor-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        changedSections: ['management'],
        quality: {
          overallScore: 0.8,
          graphReadiness: 0.5,
          sectionScores: {},
          coverageScores: {},
          patternComplianceScores: {},
          warnings: ['Needs review.'],
          blockers: [],
          sectionHealth: [],
          warningCount: 1,
          blockerCount: 0,
        },
        snapshot: {
          summary: { definition: 'Condition summary' },
          management: 'Current management',
        },
      },
      items: [],
    },
    cases: {
      summary: {
        total: 0,
        usable: 0,
        byStatus: {},
        warningCount: 0,
        blockerCount: 0,
        latest: null,
      },
      items: [],
    },
    clinicalCaseDrafts: {
      summary: {
        total: 0,
        pendingReview: 0,
        changesRequested: 0,
        accepted: 0,
        awaitingApplication: 0,
        applied: 0,
        rejected: 0,
        blockerCount: 0,
        warningCount: 0,
        byStatus: {},
      },
      items: [],
    },
    educationCandidates: {
      summary: candidateSummary(),
      groups: {
        pendingReview: [],
        needsChanges: [],
        acceptedAwaitingApplication: [],
        applied: [],
        rejected: [],
      },
      items: [],
    },
    graph: {
      candidates: [],
      facts: [],
      summary: {
        candidates: { total: 0, byType: {}, byStatus: {} },
        facts: { total: 0, byType: {} },
        readiness: 'none',
      },
      teachingRelationships: [],
      evidenceRelationships: [],
      reasoningPaths: [],
    },
    linkedDifferentials: [],
    differentialResolution: {
      resolved: 0,
      unresolved: 0,
      needsReview: 0,
      newRegistryNeeded: 0,
      byStatus: {},
    },
    differentialCoverage: {
      diagnosisRegistryId: 'dx-1',
      trustedLinkCount: 0,
      publishedEducationDifferentialCount: 0,
      coverageRatio: null,
      missingDifferentials: [],
      staleDifferentials: [],
      trustStatus: 'NO_PUBLISHED_EDUCATION',
    },
    learningGoalCoverage: [],
    escalationAnnotations: [],
    unsupportedClaimsBySection: [],
    prioritization: {
      editorialPriority: { score: 0, tier: 'low', reasons: [] },
      publicationRisk: { score: 0, tier: 'low' },
      learnerRisk: { score: 0, tier: 'low' },
      reasoningRisk: { score: 0, tier: 'low' },
      highestImpactFixes: [],
      queues: [],
    },
    aiDraftAuditTrail: [],
    compositionWarnings: [],
    recommendedActions: [],
    availableActions: [],
    ...overrides,
  } as DiagnosisEditorialWorkspace;
}

function sectionCandidate(
  overrides: Partial<DiagnosisEducationCandidate> = {},
): DiagnosisEducationCandidate {
  return {
    id: 'candidate-1',
    diagnosisRegistryId: 'dx-1',
    educationId: 'education-1',
    scope: 'SECTION' as const,
    section: 'management' as const,
    baseEducationVersion: 2,
    baseEducationRevisionId: 'revision-2',
    currentEducationVersion: 2,
    stale: false,
    originalSection: 'Current management',
    proposedEducation: null,
    proposedSection: 'Proposed management',
    proposedReferences: [{ citation: 'Reference' }],
    reviewStatus: 'PENDING_REVIEW' as const,
    applicationStatus: 'NOT_REQUESTED' as const,
    applicationAllowed: false,
    validationStatus: 'PASSED',
    validationSummary: {},
    validationBlockers: [],
    validationWarnings: ['Check references.'],
    validationMetadata: { validator: 'test' },
    generationProvider: 'openai',
    generationModel: 'gpt-test',
    generatorVersion: 'generator-v1',
    promptVersion: 'prompt-v1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    generationPurpose: 'AI_DIAGNOSIS_EDUCATION_SECTION_REGENERATION',
    inputContext: {},
    contextHash: 'hash-1',
    sourceArtifactIds: ['issue-1'],
    acceptedAt: null,
    appliedAt: null,
    resultingEducationId: null,
    resultingEducationVersion: null,
    resultingRevisionId: null,
    applicationFailureReason: null,
    reviewDecisions: [],
    applicationCommands: [],
    validation: {
      status: 'PASSED',
      summary: {},
      blockers: [],
      warnings: ['Check references.'],
      blockerCount: 0,
      warningCount: 1,
      metadata: { validator: 'test' },
      passed: true,
    },
    provenance: {
      generationProvider: 'openai',
      generationModel: 'gpt-test',
      generatorVersion: 'generator-v1',
      promptVersion: 'prompt-v1',
      generationPurpose: 'AI_DIAGNOSIS_EDUCATION_SECTION_REGENERATION',
      inputContext: {},
      contextHash: 'hash-1',
      sourceArtifactIds: ['issue-1'],
    },
    ...overrides,
  };
}

function publicationReadiness() {
  return {
    educationId: 'education-1',
    diagnosisRegistryId: 'dx-1',
    educationRevisionId: 'revision-2',
    version: 2,
    result: 'READY' as const,
    blockers: [],
    warnings: [{ code: 'watch', message: 'Review carefully.' }],
    approvalDecisionId: 'approval-1',
    activePublicationDecisionId: 'publication-1',
    currentEducationVersion: 2,
    materialContextHash: 'material-hash',
  };
}

function decisionSummary(
  overrides: Partial<EducationGovernanceDecisionSummary> = {},
): EducationGovernanceDecisionSummary {
  return {
    id: 'decision-1',
    kind: 'approval' as const,
    educationId: 'education-1',
    diagnosisRegistryId: 'dx-1',
    educationRevisionId: 'revision-2',
    version: 2,
    outcome: 'APPROVED',
    standing: 'AUTHORIZED',
    actorUserId: 'editor-1',
    authorityRationale: 'Test rationale.',
    occurredAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function candidateSummary() {
  return {
    total: 1,
    pendingReview: 1,
    needsChanges: 0,
    accepted: 0,
    awaitingApplication: 0,
    applied: 0,
    rejected: 0,
    superseded: 0,
    actionable: 1,
    blockerCount: 0,
    warningCount: 1,
    byStatus: { PENDING_REVIEW: 1 },
  };
}
