/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDiagnosticReasoningViewModel } from './diagnosticReasoningViewModel.ts';
import type { KnowledgeGraphViewModel } from './knowledgeGraphViewModel.ts';

describe('buildDiagnosticReasoningViewModel', () => {
  it('turns normalized mimic separation into A-vs-B diagnostic comparisons', () => {
    const viewModel = buildDiagnosticReasoningViewModel(
      knowledgeFixture({
        differentials: {
          ...knowledgeFixture().differentials,
          mimicSeparation: [
            {
              id: 'relationship-1',
              targetDiagnosisId: 'mimic-1',
              targetDiagnosisName: 'Migraine',
              relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
              status: 'ACTIVE',
              strength: 0.9,
              discriminatorSummary:
                'Thunderclap onset and neck stiffness beat migraine.',
              commonConfusionReason: 'Both can present with severe headache.',
              learnerPitfall: null,
              readinessReasons: [],
              raw: unknownRaw(),
            },
          ],
        },
        evidence: {
          ...knowledgeFixture().evidence,
          relationships: [
            {
              id: 'evidence-1',
              label: 'Thunderclap onset',
              relationshipType: 'DISCRIMINATES',
              status: 'ACTIVE',
              strength: 0.9,
              discriminatorWeight: 0.9,
              trust: 'high',
              isActive: true,
              isCandidate: false,
              isRejected: false,
              isLowTrust: false,
              supportsDiscrimination: true,
              reasoningSummary: 'Supports SAH over migraine.',
              targetDiagnosisName: 'Migraine',
              readinessReasons: [],
              raw: unknownRaw(),
            },
          ],
        },
        reasoning: {
          ...knowledgeFixture().reasoning,
          paths: [
            {
              id: 'path-1',
              title: 'Differentiate thunderclap headache',
              status: 'ACTIVE',
              reasoningGoal: 'DIFFERENTIAL_DISCRIMINATION',
              generationPurpose: 'CASE_GENERATION',
              readinessScore: 0.9,
              readinessTier: 'ready',
              readinessReasons: [],
              qualityWarnings: [],
              isActive: true,
              isWeak: false,
              isGenerationReady: true,
              primaryDifferentialIds: ['mimic-1'],
              supportingTeachingRelationshipIds: ['relationship-1'],
              supportingEvidenceRelationshipIds: ['evidence-1'],
              requiredTeachingPoints: ['Thunderclap onset is dangerous.'],
              raw: unknownRaw(),
            },
          ],
        },
      }),
    );

    assert.equal(viewModel.diagnosticComparisons.length, 1);
    assert.equal(
      viewModel.diagnosticComparisons[0]?.verdict,
      'target_beats_mimic',
    );
    assert.equal(viewModel.diagnosticComparisons[0]?.mimicName, 'Migraine');
    assert.equal(
      viewModel.diagnosticComparisons[0]?.whyTargetWins,
      'Thunderclap onset and neck stiffness beat migraine.',
    );
    assert.deepEqual(
      viewModel.diagnosticComparisons[0]?.supportingEvidenceRelationshipIds,
      ['evidence-1'],
    );
    assert.deepEqual(
      viewModel.diagnosticComparisons[0]?.supportingReasoningPathIds,
      ['path-1'],
    );
    assert.equal(viewModel.discriminatorMap[0]?.label, viewModel.diagnosticComparisons[0]?.whyTargetWins);
  });

  it('creates teaching risks and publication blockers when a linked mimic lacks a discriminator', () => {
    const viewModel = buildDiagnosticReasoningViewModel(
      knowledgeFixture({
        differentials: {
          ...knowledgeFixture().differentials,
          linkedMimics: [
            {
              id: 'mimic-1',
              diagnosisRegistryId: 'mimic-1',
              displayLabel: 'Migraine',
              role: 'PRIMARY_MIMIC',
              confidence: 0.8,
              sourceText: 'Common mimic',
              raw: unknownRaw(),
            },
          ],
          mimicSeparation: [],
        },
      }),
    );

    assert.equal(viewModel.diagnosticComparisons.length, 1);
    assert.equal(
      viewModel.diagnosticComparisons[0]?.verdict,
      'not_enough_evidence',
    );
    assert.match(
      viewModel.diagnosticComparisons[0]?.whyTargetWins ?? '',
      /has not yet explained/,
    );
    assert.equal(viewModel.teachingRisks[0]?.severity, 'warning');
    assert.equal(viewModel.publicationReasoningBlockers.length, 0);
    assert.equal(viewModel.coreDiagnosticClaim.supportLevel, 'watch');
  });

  it('maps case clues into clue interpretation and blocks premature lock-in', () => {
    const viewModel = buildDiagnosticReasoningViewModel(
      knowledgeFixture({
        cases: {
          ...knowledgeFixture().cases,
          caseReasoning: [
            {
              id: 'case-1',
              title: 'Headache case',
              editorialStatus: 'READY_TO_PUBLISH',
              difficulty: 'intermediate',
              hasClueProgression: true,
              prematureLockIn: true,
              unresolvedAmbiguity: true,
              ambiguityScore: 0.8,
              confidenceEstimate: 0.7,
              leadingDifferentials: ['Subarachnoid Hemorrhage'],
              remainingMimics: ['Migraine'],
              discriminatorSignals: ['Thunderclap onset'],
              blockerCount: 0,
              warningCount: 0,
              clueInterpretations: [
                {
                  clueIndex: 0,
                  clue: 'Sudden thunderclap headache.',
                  clueType: 'history',
                  leadingDifferentials: ['Subarachnoid Hemorrhage'],
                  remainingMimics: ['Migraine'],
                  collapsedMimics: [],
                  discriminatorSignals: ['Thunderclap onset'],
                  ambiguityScore: 0.8,
                  learnerConfusionRisk: 'high',
                  progressionQuality: 'weak',
                  editorialConcern: 'Too direct.',
                },
              ],
              mimicEliminations: [
                {
                  mimicName: 'Migraine',
                  finalStatus: 'persistent',
                  discriminatorUsed: null,
                  eliminationStrength: 'weak',
                  educationalValue: 'high',
                  prematureCollapseRisk: false,
                  remainingConfusionRisk: true,
                },
              ],
              discriminatorAnnotations: [],
              raw: unknownRaw(),
            },
          ],
        },
      }),
    );

    assert.equal(viewModel.clueInterpretation.length, 1);
    assert.equal(viewModel.clueInterpretation[0]?.risk, 'weak');
    assert.deepEqual(viewModel.clueInterpretation[0]?.remainingMimics, [
      'Migraine',
    ]);
    assert.equal(viewModel.caseReasoningChecks[0]?.verdict, 'blocked');
    assert.deepEqual(viewModel.caseReasoningChecks[0]?.unresolvedMimics, [
      'Migraine',
    ]);
    assert.equal(viewModel.publicationReasoningBlockers[0]?.caseId, 'case-1');
  });

  it('keeps reasoning paths as support for narratives rather than final UI meaning', () => {
    const viewModel = buildDiagnosticReasoningViewModel(
      knowledgeFixture({
        reasoning: {
          ...knowledgeFixture().reasoning,
          paths: [
            {
              id: 'weak-path',
              title: 'Weak discriminator path',
              status: 'ACTIVE',
              reasoningGoal: 'DIFFERENTIAL_DISCRIMINATION',
              generationPurpose: 'CASE_GENERATION',
              readinessScore: 0.2,
              readinessTier: 'weak',
              readinessReasons: ['Missing active discriminator.'],
              qualityWarnings: ['Path is not grounded enough.'],
              isActive: true,
              isWeak: true,
              isGenerationReady: false,
              primaryDifferentialIds: ['mimic-1'],
              supportingTeachingRelationshipIds: [],
              supportingEvidenceRelationshipIds: [],
              requiredTeachingPoints: [],
              raw: unknownRaw(),
            },
          ],
          ungroundedWarnings: [
            {
              id: 'reasoning-warning:weak-path:0',
              severity: 'blocker',
              title: 'Weak discriminator path',
              reason: 'Missing active discriminator.',
              reasoningPathId: 'weak-path',
              raw: unknownRaw(),
            },
          ],
        },
      }),
    );

    assert.equal(viewModel.reasoningNarratives.length, 1);
    assert.equal(viewModel.reasoningNarratives[0]?.readiness, 'weak');
    assert.deepEqual(viewModel.reasoningNarratives[0]?.blockerReasons, [
      'Missing active discriminator.',
      'Path is not grounded enough.',
    ]);
    assert.equal(
      viewModel.publicationReasoningBlockers[0]?.reasoningPathId,
      'weak-path',
    );
  });
});

function knowledgeFixture(
  overrides: Partial<KnowledgeGraphViewModel> = {},
): KnowledgeGraphViewModel {
  const base: KnowledgeGraphViewModel = {
    diagnosis: {
      id: 'dx-1',
      name: 'Subarachnoid Hemorrhage',
      canonicalName: 'subarachnoid hemorrhage',
    },
    evidence: {
      relationships: [],
      active: [],
      candidates: [],
      rejected: [],
      lowTrust: [],
      unsupportedClaims: [],
      coverage: {
        score: null,
        tier: null,
        weaknesses: [],
        discriminatorEvidenceCount: 0,
        missingEvidenceLabels: [],
        raw: null,
      },
    },
    differentials: {
      linkedMimics: [],
      unresolvedMappings: [],
      mimicSeparation: [],
      discriminatorGaps: [],
    },
    reasoning: {
      paths: [],
      activePaths: [],
      weakPaths: [],
      generationReadyPaths: [],
      ungroundedWarnings: [],
    },
    cases: {
      caseReasoning: [],
      prematureLockInCases: [],
      unresolvedMimicCases: [],
      discriminatorDrafts: [],
      clueRevisionDrafts: [],
    },
    blockers: [],
    reviewItems: [],
  };

  return {
    ...base,
    ...overrides,
  };
}

function unknownRaw<T>(): T {
  return {} as T;
}
