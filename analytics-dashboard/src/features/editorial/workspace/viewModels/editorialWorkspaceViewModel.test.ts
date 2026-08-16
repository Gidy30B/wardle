/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEditorialWorkspaceViewModel } from './editorialWorkspaceViewModel.ts';
import type {
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRelationship,
} from '../../../../api/admin';

describe('buildEditorialWorkspaceViewModel', () => {
  it('handles empty workspace sections truthfully', () => {
    const viewModel = buildEditorialWorkspaceViewModel(baseWorkspace());

    assert.equal(viewModel.coverageMatrix.rows.length, 0);
    assert.equal(viewModel.teachingRulesBoard.activeRules.length, 0);
    assert.equal(viewModel.educationBoard.sections.length, 0);
    assert.equal(viewModel.caseInventoryBoard.caseCards.length, 0);
    assert.equal(viewModel.graphBoard.pendingCandidates, 0);
    assert.equal(viewModel.integrityBoard.blockerCount, 0);
  });

  it('detects missing advanced case coverage', () => {
    const workspace = baseWorkspace({
      cases: {
        summary: {
          ...baseWorkspace().cases.summary,
          total: 2,
          usable: 2,
        },
        items: [
          caseItem({ id: 'easy', difficulty: 'easy' }),
          caseItem({ id: 'medium', difficulty: 'medium' }),
        ],
      },
    });

    const viewModel = buildEditorialWorkspaceViewModel(workspace);

    assert.deepEqual(viewModel.caseInventoryBoard.missingDifficultyBands, ['Hard']);
    assert.equal(
      viewModel.diagnosisHealth.tiles.find((tile) => tile.id === 'advanced-case')
        ?.value,
      'Missing',
    );
  });

  it('maps education blockers and warnings into section cards', () => {
    const workspace = baseWorkspace({
      education: {
        ...baseWorkspace().education,
        sectionHealth: [
          {
            section: 'findings',
            score: 0.2,
            coverageScore: null,
            patternComplianceScore: null,
            blockers: ['Definition is unsupported.'],
            warnings: [],
            regenerationRecommended: true,
            reason: 'Needs evidence.',
          },
          {
            section: 'management',
            score: 0.6,
            coverageScore: null,
            patternComplianceScore: null,
            blockers: [],
            warnings: ['Management lacks urgency layer.'],
            regenerationRecommended: true,
            reason: null,
          },
        ],
      },
    });

    const viewModel = buildEditorialWorkspaceViewModel(workspace);

    assert.equal(viewModel.educationBoard.sections[0]?.tone, 'danger');
    assert.equal(viewModel.educationBoard.sections[0]?.status, 'Blocked');
    assert.equal(viewModel.educationBoard.sections[1]?.tone, 'warning');
    assert.equal(viewModel.educationBoard.sections[1]?.status, 'Needs review');
  });

  it('groups graph relationships into mockup relationship lanes', () => {
    const workspace = baseWorkspace({
      graph: {
        ...baseWorkspace().graph,
        teachingRelationships: [
          relationship({
            id: 'mimic',
            relationshipType: 'MIMIC_CONFUSION',
          }),
          relationship({
            id: 'rule-out',
            relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
          }),
          relationship({
            id: 'support',
            relationshipType: 'SHARED_PRESENTATION',
            supportingTeachingRuleId: 'rule-1',
          }),
          relationship({
            id: 'complication',
            relationshipType: 'COMPLICATION_RELATIONSHIP',
          }),
        ],
      },
    });

    const viewModel = buildEditorialWorkspaceViewModel(workspace);

    assert.equal(groupCount(viewModel, 'mimics'), 1);
    assert.equal(groupCount(viewModel, 'rules-out'), 1);
    assert.equal(groupCount(viewModel, 'supports'), 1);
    assert.equal(groupCount(viewModel, 'complications'), 1);
  });

  it('derives integrity blocker pressure from validation and blocking claims', () => {
    const workspace = baseWorkspace({
      education: {
        ...baseWorkspace().education,
        sectionHealth: [
          {
            section: 'findings',
            score: 0.1,
            coverageScore: null,
            patternComplianceScore: null,
            blockers: ['Missing source.'],
            warnings: [],
            regenerationRecommended: true,
            reason: null,
          },
        ],
      },
      unsupportedClaimsBySection: [
        {
          sectionId: 'summary',
          sectionType: 'summary',
          claimId: 'claim-1',
          claimText: 'Unsupported claim',
          severity: 'blocker',
          artifactId: 'education-1',
          blocksPublication: true,
          evidenceIds: [],
          repairTarget: 'definition',
          sourceType: 'education',
          createdAt: '2026-01-01T00:00:00.000Z',
          repairableAutomatically: true,
        },
      ],
    });

    const viewModel = buildEditorialWorkspaceViewModel(workspace);

    assert.equal(viewModel.integrityBoard.blockerCount, 2);
    assert.deepEqual(viewModel.integrityBoard.blockers, [
      'Missing source.',
      'Unsupported claim',
    ]);
  });
});

function groupCount(
  viewModel: ReturnType<typeof buildEditorialWorkspaceViewModel>,
  id: string,
) {
  return (
    viewModel.graphBoard.relationships.find((group) => group.id === id)
      ?.relationships.length ?? 0
  );
}

function relationship(
  overrides: Partial<DiagnosisTeachingRelationship> = {},
): DiagnosisTeachingRelationship {
  return {
    id: 'rel-1',
    sourceDiagnosisRegistryId: 'dx-1',
    targetDiagnosisRegistryId: 'dx-2',
    relationshipType: 'MIMIC_CONFUSION',
    teachingPurpose: 'TEACH_DISCRIMINATOR',
    discriminatorSummary: null,
    commonConfusionReason: null,
    learnerPitfall: null,
    suggestedTeachingRuleStableKey: null,
    supportingGraphFactId: null,
    supportingDifferentialLinkId: null,
    supportingTeachingRuleId: null,
    strength: 0.5,
    status: 'ACTIVE',
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sourceDiagnosisRegistry: {
      id: 'dx-1',
      displayLabel: 'SIADH',
      canonicalName: 'SIADH',
    },
    targetDiagnosisRegistry: {
      id: 'dx-2',
      displayLabel: 'Adrenal insufficiency',
      canonicalName: 'Adrenal Insufficiency',
    },
    ...overrides,
  };
}

function caseItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-1',
    title: 'Case 1',
    editorialStatus: 'APPROVED',
    difficulty: 'easy',
    updatedAt: '2026-01-01T00:00:00.000Z',
    qualityProjection: {
      blockers: [],
      warnings: [],
    },
    ...overrides,
  } as unknown as DiagnosisEditorialWorkspace['cases']['items'][number];
}

function baseWorkspace(
  overrides: Partial<DiagnosisEditorialWorkspace> = {},
): DiagnosisEditorialWorkspace {
  return {
    diagnosis: {
      id: 'dx-1',
      canonicalName: 'SIADH',
      displayLabel: 'SIADH',
      specialty: 'Endocrinology',
      bodySystem: 'Endocrine',
      category: null,
      aliases: [],
    },
    lifecycle: {
      curriculum: 'not_started',
      brief: 'not_started',
      education: 'not_started',
      cases: 'not_started',
      graph: 'not_started',
      ready: 'not_started',
    },
    lifecycleGovernance: null,
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
      id: null,
      status: 'missing',
      version: null,
      qualityScore: null,
      sectionHealth: [],
      blockers: [],
      warnings: [],
      updatedAt: null,
      acceptedRepairs: [],
    },
    revisions: {
      latest: null,
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
    graph: {
      readiness: 'none',
      factCount: 0,
      candidateCount: 0,
      reviewableCandidateCount: 0,
      candidates: [],
      teachingRelationships: [],
      factsSummary: {
        total: 0,
        byType: {},
        recent: [],
      },
    },
    evidenceGraph: {
      summary: {
        total: 0,
        active: 0,
        discriminatorEvidence: 0,
        weakEvidenceCoverage: 0,
        byType: {},
      },
      relationships: [],
    },
    evidenceCoverage: null,
    reasoningPaths: [],
    linkedDifferentials: [],
    editorialLearning: {
      available: false,
      candidateCounts: {
        teachingRuleCandidates: 0,
        graphFactCandidates: 0,
        patternImprovementCandidates: 0,
        diagnosisSpecificPearlCandidates: 0,
      },
      recentThemes: [],
    },
    recommendedActions: [],
    availableActions: [],
    ...overrides,
  } as unknown as DiagnosisEditorialWorkspace;
}
