/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildKnowledgeGraphViewModel } from './knowledgeGraphViewModel.ts';
import type {
  DiagnosisEditorialWorkspace,
  DiagnosisEvidenceRelationship,
  DiagnosisTeachingRelationship,
  ReasoningPath,
} from '../../../../api/admin.types.ts';

describe('buildKnowledgeGraphViewModel', () => {
  it('normalizes evidence relationships once into active, candidate, rejected, and low-trust groups', () => {
    const workspace = baseWorkspace({
      evidenceGraph: {
        ...baseWorkspace().evidenceGraph,
        relationships: [
          evidenceRelationship({
            id: 'active-evidence',
            status: 'ACTIVE',
            strength: 0.9,
            discriminatorWeight: 0.8,
          }),
          evidenceRelationship({
            id: 'candidate-evidence',
            status: 'CANDIDATE',
            strength: 0.6,
            discriminatorWeight: 0.5,
          }),
          evidenceRelationship({
            id: 'weak-evidence',
            status: 'ACTIVE',
            strength: 0.2,
            discriminatorWeight: 0.1,
            readiness: { ready: false, reasons: ['Needs source review.'] },
          }),
          evidenceRelationship({
            id: 'rejected-evidence',
            status: 'REJECTED',
          }),
        ],
      },
    });

    const viewModel = buildKnowledgeGraphViewModel(workspace);

    assert.deepEqual(
      viewModel.evidence.active.map((item) => item.id),
      ['active-evidence', 'weak-evidence'],
    );
    assert.deepEqual(
      viewModel.evidence.candidates.map((item) => item.id),
      ['candidate-evidence'],
    );
    assert.deepEqual(
      viewModel.evidence.rejected.map((item) => item.id),
      ['rejected-evidence'],
    );
    assert.deepEqual(
      viewModel.evidence.lowTrust.map((item) => item.id),
      ['weak-evidence'],
    );
    assert.equal(viewModel.evidence.lowTrust[0]?.trust, 'low');
  });

  it('centralizes review items and sorts blockers before warnings', () => {
    const workspace = baseWorkspace({
      workspaceSummary: {
        ...baseWorkspace().workspaceSummary,
        blockers: ['Publication is blocked.'],
        warnings: ['Coverage is thin.'],
      },
      unsupportedClaimsBySection: [
        {
          sectionId: 'summary',
          sectionType: 'summary',
          claimId: 'claim-1',
          claimText: 'Unsupported teaching claim',
          severity: 'warning',
          artifactId: 'education-1',
          evidenceIds: [],
          repairTarget: 'summary',
          sourceType: 'education',
          createdAt: '2026-01-01T00:00:00.000Z',
          repairableAutomatically: true,
          blocksPublication: true,
        },
      ],
      readinessBreakdown: [
        {
          severity: 'warning',
          source: 'Graph',
          message: 'Needs graph review.',
          actionId: 'review-graph',
          targetTab: 'graph',
        },
      ],
    });

    const viewModel = buildKnowledgeGraphViewModel(workspace);

    assert.equal(viewModel.blockers.length, 2);
    assert.equal(viewModel.reviewItems[0]?.severity, 'blocker');
    assert.equal(viewModel.reviewItems[1]?.severity, 'blocker');
    assert.equal(
      viewModel.reviewItems.find((item) => item.kind === 'readiness')
        ?.targetWorkflow,
      'reasoning',
    );
    assert.equal(
      viewModel.reviewItems.find(
        (item) => item.id === 'unsupported-claim:claim-1',
      )?.targetWorkflow,
      'publish',
    );
  });

  it('normalizes differential separation and flags linked mimics without active discriminators', () => {
    const workspace = baseWorkspace({
      linkedDifferentials: [
        {
          id: 'mimic-link-1',
          diagnosisRegistryId: 'mimic-1',
          displayLabel: 'Migraine',
          canonicalName: 'migraine',
          role: 'PRIMARY_MIMIC',
          confidence: 0.8,
          sourceText: 'Common mimic',
        },
        {
          id: 'mimic-link-2',
          diagnosisRegistryId: 'mimic-2',
          displayLabel: 'Cluster Headache',
          canonicalName: 'cluster headache',
          role: 'DIFFERENTIAL',
          confidence: 0.7,
          sourceText: 'Another mimic',
        },
      ],
      graph: {
        ...baseWorkspace().graph,
        teachingRelationships: [
          teachingRelationship({
            targetDiagnosisRegistryId: 'mimic-1',
            targetDiagnosisRegistry: {
              id: 'mimic-1',
              displayLabel: 'Migraine',
              canonicalName: 'migraine',
            },
            status: 'ACTIVE',
            discriminatorSummary: 'Thunderclap onset beats migraine.',
          }),
        ],
      },
    });

    const viewModel = buildKnowledgeGraphViewModel(workspace);

    assert.equal(viewModel.differentials.mimicSeparation.length, 1);
    assert.deepEqual(
      viewModel.differentials.discriminatorGaps.map((gap) => gap.mimicName),
      ['Cluster Headache'],
    );
  });

  it('normalizes reasoning path readiness and case reasoning risk once', () => {
    const workspace = baseWorkspace({
      reasoningPaths: [
        reasoningPath({
          id: 'ready-path',
          status: 'ACTIVE',
          readinessScore: 0.9,
          readinessTier: 'ready',
        }),
        reasoningPath({
          id: 'weak-path',
          readinessScore: 0.2,
          readinessTier: 'weak',
          readinessReasons: ['Missing discriminator evidence.'],
        }),
      ],
      cases: {
        ...baseWorkspace().cases,
        items: [
          {
            id: 'case-1',
            title: 'Thunderclap headache case',
            editorialStatus: 'READY_TO_PUBLISH',
            difficulty: 'intermediate',
            updatedAt: '2026-01-01T00:00:00.000Z',
            qualityProjection: { blockers: [], warnings: [] },
            clueProgression: {
              caseId: 'case-1',
              diagnosisRegistryId: 'dx-1',
              analysisVersion: 'v1',
              diagnosticStates: [
                {
                  clueIndex: 0,
                  clue: 'Sudden severe headache.',
                  clueType: 'history',
                  leadingDifferentials: ['Subarachnoid Hemorrhage'],
                  confidenceEstimate: 0.4,
                  confidenceShift: 0.2,
                  remainingMimics: ['Migraine'],
                  collapsedMimics: [],
                  discriminatorSignals: ['Thunderclap onset'],
                  ambiguityScore: 0.8,
                  prematureLeakFlag: true,
                  unresolvedAmbiguityFlag: true,
                  learnerConfusionRisk: 'high',
                  editorialConcern: 'Too revealing too early.',
                  progressionQuality: 'weak',
                },
              ],
              mimicCollapses: [],
              discriminatorEmergences: [],
              differentialElimination: [
                {
                  mimicName: 'Migraine',
                  initialPlausibility: 'high',
                  finalStatus: 'persistent',
                  eliminationStrength: 'weak',
                  educationalValue: 'high',
                  prematureCollapseRisk: false,
                  remainingConfusionRisk: true,
                },
              ],
              targetedGenerationOpportunities: [],
              leadingDifferentials: ['Subarachnoid Hemorrhage'],
              remainingMimics: ['Migraine'],
              discriminatorSignals: ['Thunderclap onset'],
              editorialSignals: [],
              likelyLockInClue: 0,
              confidenceEstimate: 0.4,
              ambiguityScore: 0.8,
              prematureLeakFlag: true,
              unresolvedAmbiguityFlag: true,
              totalMimicsTracked: 1,
              eliminatedMimicCount: 0,
              unresolvedMimicCount: 1,
              persistentConfusionCount: 1,
              weakEliminationCount: 1,
              explicitDiscriminatorAnnotationCount: 0,
              heuristicOnlyEliminationCount: 1,
              missingEditorialAnnotationCount: 1,
              editorialNotes: null,
              generatedAt: '2026-01-01T00:00:00.000Z',
            },
          },
        ] as unknown as DiagnosisEditorialWorkspace['cases']['items'],
      },
    });

    const viewModel = buildKnowledgeGraphViewModel(workspace);

    assert.deepEqual(
      viewModel.reasoning.generationReadyPaths.map((path) => path.id),
      ['ready-path'],
    );
    assert.deepEqual(
      viewModel.reasoning.weakPaths.map((path) => path.id),
      ['weak-path'],
    );
    assert.equal(viewModel.reasoning.ungroundedWarnings[0]?.severity, 'blocker');
    assert.deepEqual(
      viewModel.cases.prematureLockInCases.map((item) => item.id),
      ['case-1'],
    );
    assert.deepEqual(
      viewModel.cases.unresolvedMimicCases.map((item) => item.id),
      ['case-1'],
    );
  });
});

function evidenceRelationship(
  overrides: Partial<DiagnosisEvidenceRelationship> = {},
): DiagnosisEvidenceRelationship {
  return {
    id: 'evidence-1',
    diagnosisRegistryId: 'dx-1',
    evidenceNodeId: 'node-1',
    relationshipType: 'DISCRIMINATES',
    strength: 0.8,
    discriminatorWeight: 0.7,
    reasoningSummary: 'Supports the target diagnosis.',
    contradictoryDiagnosisIds: null,
    supportingTeachingRelationshipId: null,
    supportingTeachingRuleId: null,
    supportingCaseId: null,
    status: 'ACTIVE',
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    evidenceNode: {
      id: 'node-1',
      normalizedKey: 'thunderclap_onset',
      displayLabel: 'Thunderclap onset',
      evidenceType: 'HISTORY',
      clinicalCategory: 'NEUROLOGIC',
      synonyms: null,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

function teachingRelationship(
  overrides: Partial<DiagnosisTeachingRelationship> = {},
): DiagnosisTeachingRelationship {
  return {
    id: 'relationship-1',
    sourceDiagnosisRegistryId: 'dx-1',
    targetDiagnosisRegistryId: 'mimic-1',
    relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
    teachingPurpose: 'TEACH_DISCRIMINATOR',
    discriminatorSummary: 'Thunderclap onset separates this diagnosis.',
    commonConfusionReason: 'Both can present with headache.',
    learnerPitfall: null,
    suggestedTeachingRuleStableKey: null,
    supportingGraphFactId: null,
    supportingDifferentialLinkId: null,
    supportingTeachingRuleId: null,
    strength: 0.8,
    status: 'ACTIVE',
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sourceDiagnosisRegistry: {
      id: 'dx-1',
      displayLabel: 'Subarachnoid Hemorrhage',
      canonicalName: 'subarachnoid hemorrhage',
    },
    targetDiagnosisRegistry: {
      id: 'mimic-1',
      displayLabel: 'Migraine',
      canonicalName: 'migraine',
    },
    ...overrides,
  };
}

function reasoningPath(overrides: Partial<ReasoningPath> = {}): ReasoningPath {
  return {
    id: 'path-1',
    diagnosisRegistryId: 'dx-1',
    diagnosisName: 'Subarachnoid Hemorrhage',
    normalizedKey: 'sah_discrimination',
    title: 'Distinguish thunderclap headache',
    reasoningGoal: 'DIFFERENTIAL_DISCRIMINATION',
    primaryDifferentialIds: ['mimic-1'],
    supportingTeachingRelationshipIds: [],
    supportingEvidenceRelationshipIds: [],
    discriminatorEvidenceNodeIds: [],
    escalationEvidenceNodeIds: [],
    contradictoryEvidenceNodeIds: [],
    requiredTeachingPoints: ['Thunderclap onset is dangerous.'],
    forbiddenEvidencePatterns: [],
    recommendedClueDistribution: {},
    generationPurpose: 'CASE_GENERATION',
    readinessScore: 0.8,
    readinessTier: 'ready',
    readinessReasons: [],
    reasoningQualityWarnings: [],
    status: 'ACTIVE',
    reviewedByUser: null,
    reviewedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function baseWorkspace(
  overrides: Partial<DiagnosisEditorialWorkspace> = {},
): DiagnosisEditorialWorkspace {
  return {
    diagnosis: {
      id: 'dx-1',
      canonicalName: 'subarachnoid hemorrhage',
      displayLabel: 'Subarachnoid Hemorrhage',
      specialty: 'Neurology',
      bodySystem: 'Nervous System',
      category: null,
      difficultyBand: null,
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
  } as DiagnosisEditorialWorkspace;
}
