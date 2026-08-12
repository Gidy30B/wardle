/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DiagnosisEditorialWorkspace } from '../../../../api/admin.types.ts';
import { buildCaseReasoningViewModel } from './caseReasoningViewModel.ts';
import { buildDiagnosticReasoningViewModel } from './diagnosticReasoningViewModel.ts';
import { buildKnowledgeGraphViewModel } from './knowledgeGraphViewModel.ts';

describe('buildCaseReasoningViewModel', () => {
  it('consumes Knowledge and Diagnostic Reasoning layers to produce case boards', () => {
    const workspace = workspaceWithComparisonAndCase();
    const knowledge = buildKnowledgeGraphViewModel(workspace);
    const diagnosticReasoning = buildDiagnosticReasoningViewModel(knowledge);

    const viewModel = buildCaseReasoningViewModel({
      workspace,
      knowledge,
      diagnosticReasoning,
    });

    assert.equal(viewModel.cases.length, 1);
    assert.equal(viewModel.clueProgression.length, 1);
    assert.equal(viewModel.reasoningCoverage.length, 1);
    assert.equal(viewModel.discriminatorCoverage.length, 1);
    assert.equal(viewModel.reasoningCoverage[0]?.casesCovered, true);
    assert.equal(viewModel.discriminatorCoverage[0]?.casesCovered, true);
  });

  it('identifies missing case support for diagnostic comparisons and discriminators', () => {
    const workspace = workspaceWithComparisonAndCase({
      cases: {
        summary: emptyWorkspace().cases.summary,
        items: [],
      },
      caseLearningGoalCoverage: [],
      learningGoalCoverage: [],
    });
    const knowledge = buildKnowledgeGraphViewModel(workspace);
    const diagnosticReasoning = buildDiagnosticReasoningViewModel(knowledge);

    const viewModel = buildCaseReasoningViewModel({
      workspace,
      knowledge,
      diagnosticReasoning,
    });

    assert.equal(viewModel.reasoningCoverage[0]?.casesCovered, false);
    assert.equal(viewModel.discriminatorCoverage[0]?.casesCovered, false);
    assert.ok(
      viewModel.reviewItems.some(
        (item) => item.title === 'Reasoning path lacks case support',
      ),
    );
    assert.ok(
      viewModel.reviewItems.some(
        (item) => item.title === 'Missing case for discriminator',
      ),
    );
  });

  it('identifies weak clue progression and learning-goal gaps', () => {
    const workspace = workspaceWithComparisonAndCase({
      learningGoalCoverage: [
        {
          learningGoalId: 'goal-2',
          learningGoal: 'Separate SAH from meningitis',
          coveredByCaseIds: [],
          uncoveredDiscriminators: ['neck stiffness'],
          missingMimics: ['Meningitis'],
          generationPriority: 'high',
          coveragePct: 0,
        },
      ],
    });
    const knowledge = buildKnowledgeGraphViewModel(workspace);
    const diagnosticReasoning = buildDiagnosticReasoningViewModel(knowledge);

    const viewModel = buildCaseReasoningViewModel({
      workspace,
      knowledge,
      diagnosticReasoning,
    });

    assert.ok(
      viewModel.teachingRisks.some((risk) => risk.title === 'Weak clue progression'),
    );
    assert.ok(
      viewModel.teachingRisks.some(
        (risk) => risk.title === 'Learning goal lacks case coverage',
      ),
    );
    assert.ok(viewModel.blockers.length > 0);
  });

  it('handles an empty workspace safely', () => {
    const workspace = emptyWorkspace();
    const knowledge = buildKnowledgeGraphViewModel(workspace);
    const diagnosticReasoning = buildDiagnosticReasoningViewModel(knowledge);

    const viewModel = buildCaseReasoningViewModel({
      workspace,
      knowledge,
      diagnosticReasoning,
    });

    assert.deepEqual(viewModel.cases, []);
    assert.deepEqual(viewModel.clueProgression, []);
    assert.deepEqual(viewModel.reasoningCoverage, []);
    assert.deepEqual(viewModel.discriminatorCoverage, []);
    assert.deepEqual(viewModel.reviewItems, []);
  });
});

function workspaceWithComparisonAndCase(
  overrides: Partial<DiagnosisEditorialWorkspace> = {},
): DiagnosisEditorialWorkspace {
  const base = emptyWorkspace();

  return {
    ...base,
    graph: {
      ...base.graph,
      teachingRelationships: [
        {
          id: 'relationship-1',
          sourceDiagnosisRegistryId: 'dx-1',
          targetDiagnosisRegistryId: 'mimic-1',
          relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
          teachingPurpose: 'TEACH_DISCRIMINATOR',
          discriminatorSummary: 'Thunderclap onset separates SAH from migraine.',
          commonConfusionReason: 'Both can present with severe headache.',
          learnerPitfall: null,
          suggestedTeachingRuleStableKey: null,
          supportingGraphFactId: null,
          supportingDifferentialLinkId: null,
          supportingTeachingRuleId: null,
          strength: 0.9,
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
        },
      ],
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
    cases: {
      summary: {
        total: 1,
        usable: 1,
        byStatus: {},
        warningCount: 1,
        blockerCount: 0,
        latest: null,
      },
      items: [
        {
          id: 'case-1',
          title: 'Thunderclap headache case',
          editorialStatus: 'READY_TO_PUBLISH',
          difficulty: 'intermediate',
          updatedAt: '2026-01-01T00:00:00.000Z',
          qualityProjection: caseQualityProjection(['Weak transition']),
          clueDiscriminatorAnnotations: [
            {
              id: 'annotation-1',
              caseId: 'case-1',
              clueOrder: 2,
              clueIndex: 1,
              eliminatedDiagnosisId: 'mimic-1',
              eliminatedDiagnosisName: 'Migraine',
              discriminator: 'Thunderclap onset separates SAH from migraine.',
              reasoning: 'Migraine is less likely with thunderclap onset.',
              eliminationStrength: 'strong',
              educationalValue: 'high',
              reviewerUserId: null,
              reviewedAt: null,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          clueRevisionDrafts: [],
          clueProgression: {
            caseId: 'case-1',
            diagnosisRegistryId: 'dx-1',
            analysisVersion: 'test',
            diagnosticStates: [
              {
                clueIndex: 0,
                clue: 'Severe headache begins suddenly.',
                clueType: 'history',
                leadingDifferentials: ['Migraine'],
                confidenceEstimate: 0.4,
                confidenceShift: 0.1,
                remainingMimics: ['Migraine'],
                collapsedMimics: [],
                discriminatorSignals: [],
                ambiguityScore: 0.8,
                prematureLeakFlag: false,
                unresolvedAmbiguityFlag: true,
                learnerConfusionRisk: 'medium',
                editorialConcern: 'Weak progression',
                progressionQuality: 'weak',
              },
              {
                clueIndex: 1,
                clue: 'The onset is thunderclap and maximal immediately.',
                clueType: 'history',
                leadingDifferentials: ['Subarachnoid Hemorrhage'],
                confidenceEstimate: 0.8,
                confidenceShift: 0.4,
                remainingMimics: [],
                collapsedMimics: ['Migraine'],
                discriminatorSignals: ['Thunderclap onset'],
                ambiguityScore: 0.2,
                prematureLeakFlag: false,
                unresolvedAmbiguityFlag: false,
                learnerConfusionRisk: 'low',
                editorialConcern: null,
                progressionQuality: 'strong',
              },
            ],
            mimicCollapses: [],
            discriminatorEmergences: [
              {
                clueIndex: 1,
                signal: 'Thunderclap onset',
                evidence: 'Maximal at onset',
                strength: 'high',
              },
            ],
            differentialElimination: [
              {
                mimicDiagnosisId: 'mimic-1',
                mimicName: 'Migraine',
                initialPlausibility: 'high',
                finalStatus: 'eliminated',
                eliminatedAtClueIndex: 1,
                discriminatorUsed:
                  'Thunderclap onset separates SAH from migraine.',
                eliminationStrength: 'strong',
                educationalValue: 'high',
                prematureCollapseRisk: false,
                remainingConfusionRisk: false,
              },
            ],
            targetedGenerationOpportunities: [],
            leadingDifferentials: ['Subarachnoid Hemorrhage'],
            remainingMimics: [],
            discriminatorSignals: ['Thunderclap onset'],
            editorialSignals: ['weak_transition'],
            likelyLockInClue: null,
            confidenceEstimate: 0.8,
            ambiguityScore: 0.2,
            prematureLeakFlag: false,
            unresolvedAmbiguityFlag: false,
            totalMimicsTracked: 1,
            eliminatedMimicCount: 1,
            unresolvedMimicCount: 0,
            persistentConfusionCount: 0,
            weakEliminationCount: 0,
            explicitDiscriminatorAnnotationCount: 1,
            heuristicOnlyEliminationCount: 0,
            missingEditorialAnnotationCount: 0,
            editorialNotes: null,
            generatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      ],
    },
    learningGoalCoverage: [
      {
        learningGoalId: 'goal-1',
        learningGoal: 'Separate SAH from migraine',
        coveredByCaseIds: ['case-1'],
        uncoveredDiscriminators: [],
        missingMimics: [],
        generationPriority: 'medium',
        coveragePct: 1,
      },
    ],
    caseLearningGoalCoverage: [
      {
        caseId: 'case-1',
        caseTitle: 'Thunderclap headache case',
        learningGoalId: 'goal-1',
        learningGoal: 'Separate SAH from migraine',
        coverageStrength: 0.9,
        coveredDiscriminators: ['Thunderclap onset'],
        missingDiscriminators: [],
        coveredMimics: ['Migraine'],
        missingMimics: [],
        evidenceSource: 'test',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    ...overrides,
  } as DiagnosisEditorialWorkspace;
}

function emptyWorkspace(): DiagnosisEditorialWorkspace {
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
  } as unknown as DiagnosisEditorialWorkspace;
}

function caseQualityProjection(warnings: string[]) {
  const dimension = {
    status: warnings.length > 0 ? 'warning' : 'good',
    score: warnings.length > 0 ? 0.6 : 0.9,
    warnings,
    blockers: [],
    summary: warnings.length > 0 ? warnings.join(', ') : 'No quality concerns.',
  } as const;

  return {
    dimensions: {
      clinicalValidity: dimension,
      differentialPlausibility: dimension,
      teachingAlignment: dimension,
      revealTiming: dimension,
      mimicPersistence: dimension,
      playability: dimension,
      difficultyFit: dimension,
    },
    warnings,
    blockers: [],
    sourceSummary: {
      hasValidationRun: false,
      hasValidationFindings: warnings.length > 0,
      hasGenerationQuality: false,
      hasTeachingAlignment: false,
    },
  };
}
