/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConfusionCandidates,
  buildDiscriminatorTeachingSummary,
  buildEscalationNarrative,
  buildExemplarProgression,
  buildRecognitionAnchor,
  buildRecognitionGovernanceSummary,
} from './clinicalRecognition.ts';
import type {
  CaseClueProgressionAnalysis,
  CaseDifferentialElimination,
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRelationship,
} from '../../../api/admin';

function relationship(
  overrides: Partial<DiagnosisTeachingRelationship> = {},
): DiagnosisTeachingRelationship {
  return {
    id: 'rel-1',
    sourceDiagnosisRegistryId: 'dx-source',
    targetDiagnosisRegistryId: 'dx-target',
    relationshipType: 'MIMIC_CONFUSION',
    teachingPurpose: 'TEACH_DISCRIMINATOR',
    discriminatorSummary: null,
    commonConfusionReason: null,
    learnerPitfall: null,
    strength: 0.5,
    status: 'ACTIVE',
    targetDiagnosisRegistry: {
      id: 'dx-target',
      displayLabel: 'Aortic dissection',
      canonicalName: 'Aortic Dissection',
    },
    sourceDiagnosisRegistry: {
      id: 'dx-source',
      displayLabel: 'Pulmonary embolism',
      canonicalName: 'Pulmonary Embolism',
    },
    ...overrides,
  } as unknown as DiagnosisTeachingRelationship;
}

function elimination(
  overrides: Partial<CaseDifferentialElimination> = {},
): CaseDifferentialElimination {
  return {
    mimicName: 'Aortic dissection',
    mimicDiagnosisId: 'dx-target',
    initialPlausibility: 'medium',
    finalStatus: 'eliminated',
    eliminationStrength: 'moderate',
    educationalValue: 'medium',
    prematureCollapseRisk: false,
    remainingConfusionRisk: false,
    ...overrides,
  };
}

function clueProgression(
  overrides: Partial<CaseClueProgressionAnalysis> = {},
): CaseClueProgressionAnalysis {
  return {
    caseId: 'case-1',
    diagnosisRegistryId: 'dx-source',
    analysisVersion: 'v1',
    diagnosticStates: [],
    mimicCollapses: [],
    discriminatorEmergences: [],
    differentialElimination: [],
    targetedGenerationOpportunities: [],
    leadingDifferentials: [],
    remainingMimics: [],
    discriminatorSignals: [],
    editorialSignals: [],
    likelyLockInClue: null,
    confidenceEstimate: null,
    ambiguityScore: 0,
    prematureLeakFlag: false,
    unresolvedAmbiguityFlag: false,
    totalMimicsTracked: 0,
    eliminatedMimicCount: 0,
    unresolvedMimicCount: 0,
    persistentConfusionCount: 0,
    weakEliminationCount: 0,
    explicitDiscriminatorAnnotationCount: 0,
    heuristicOnlyEliminationCount: 0,
    missingEditorialAnnotationCount: 0,
    editorialNotes: null,
    generatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as CaseClueProgressionAnalysis;
}

function baseWorkspace(
  overrides: Record<string, unknown> = {},
): DiagnosisEditorialWorkspace {
  return {
    diagnosis: {
      id: 'dx-source',
      displayLabel: 'Pulmonary embolism',
      canonicalName: 'Pulmonary Embolism',
      aliases: ['PE'],
      specialty: 'Respiratory',
      category: 'Vascular',
      bodySystem: 'Cardiovascular',
      difficultyBand: 'intermediate',
    },
    cases: { summary: {}, items: [] },
    graph: { teachingRelationships: [] },
    education: { sectionHealth: [] },
    ...overrides,
  } as unknown as DiagnosisEditorialWorkspace;
}

describe('buildRecognitionAnchor', () => {
  it('maps diagnosis identity fields', () => {
    const anchor = buildRecognitionAnchor(baseWorkspace());

    assert.equal(anchor.displayLabel, 'Pulmonary embolism');
    assert.equal(anchor.canonicalName, 'Pulmonary Embolism');
    assert.deepEqual(anchor.aliases, ['PE']);
    assert.equal(anchor.specialty, 'Respiratory');
    assert.equal(anchor.bodySystem, 'Cardiovascular');
    assert.equal(anchor.difficultyBand, 'intermediate');
  });

  it('reads learner risk from editorial prioritization when present', () => {
    const anchor = buildRecognitionAnchor(
      baseWorkspace({
        editorialPrioritization: {
          learnerRisk: { score: 7, tier: 'high' },
        },
      }),
    );

    assert.equal(anchor.learnerRiskTier, 'high');
    assert.equal(anchor.learnerRiskScore, 7);
  });

  it('defaults learner risk and escalation fields when absent', () => {
    const anchor = buildRecognitionAnchor(baseWorkspace());

    assert.equal(anchor.learnerRiskTier, null);
    assert.equal(anchor.learnerRiskScore, null);
    assert.equal(anchor.escalationType, null);
    assert.equal(anchor.coversEscalation, false);
  });

  it('reads escalation coverage when present', () => {
    const anchor = buildRecognitionAnchor(
      baseWorkspace({
        escalationCoverage: {
          coversEscalation: true,
          escalationType: 'massive PE with hemodynamic collapse',
        },
      }),
    );

    assert.equal(anchor.coversEscalation, true);
    assert.equal(anchor.escalationType, 'massive PE with hemodynamic collapse');
  });

  it('reports hasUsableCase from cases summary', () => {
    assert.equal(
      buildRecognitionAnchor(baseWorkspace({ cases: { summary: { usable: 0 }, items: [] } }))
        .hasUsableCase,
      false,
    );
    assert.equal(
      buildRecognitionAnchor(baseWorkspace({ cases: { summary: { usable: 2 }, items: [] } }))
        .hasUsableCase,
      true,
    );
  });
});

describe('buildExemplarProgression', () => {
  it('returns null when no case has analyzed clue progression', () => {
    const workspace = baseWorkspace({
      cases: { summary: {}, items: [{ id: 'case-1', title: 'Case 1' }] },
    });
    assert.equal(buildExemplarProgression(workspace), null);
  });

  it('picks the case with the most diagnostic states as the exemplar', () => {
    const workspace = baseWorkspace({
      cases: {
        summary: { progressionSignals: { abruptGiveawayCases: 1 } },
        items: [
          {
            id: 'case-1',
            title: 'Short case',
            clueProgression: clueProgression({
              diagnosticStates: [
                {
                  clueIndex: 0,
                  clue: 'Sudden dyspnea',
                  clueType: 'symptom',
                  leadingDifferentials: [],
                  confidenceEstimate: 0.4,
                  confidenceShift: 0.1,
                  remainingMimics: [],
                  collapsedMimics: [],
                  discriminatorSignals: [],
                  ambiguityScore: 0.5,
                  prematureLeakFlag: false,
                  unresolvedAmbiguityFlag: false,
                  learnerConfusionRisk: 'medium',
                  editorialConcern: null,
                  progressionQuality: 'watch',
                },
              ],
              confidenceEstimate: 0.4,
              ambiguityScore: 0.5,
              prematureLeakFlag: false,
              unresolvedAmbiguityFlag: false,
            }),
          },
          {
            id: 'case-2',
            title: 'Long case',
            clueProgression: clueProgression({
              diagnosticStates: [
                {
                  clueIndex: 0,
                  clue: 'Sudden dyspnea',
                  clueType: 'symptom',
                  leadingDifferentials: [],
                  confidenceEstimate: 0.3,
                  confidenceShift: 0.1,
                  remainingMimics: [],
                  collapsedMimics: [],
                  discriminatorSignals: [],
                  ambiguityScore: 0.6,
                  prematureLeakFlag: false,
                  unresolvedAmbiguityFlag: false,
                  learnerConfusionRisk: 'high',
                  editorialConcern: null,
                  progressionQuality: 'weak',
                },
                {
                  clueIndex: 1,
                  clue: 'Pleuritic chest pain',
                  clueType: 'symptom',
                  leadingDifferentials: [],
                  confidenceEstimate: 0.6,
                  confidenceShift: 0.3,
                  remainingMimics: [],
                  collapsedMimics: [],
                  discriminatorSignals: ['D-dimer negative'],
                  ambiguityScore: 0.3,
                  prematureLeakFlag: false,
                  unresolvedAmbiguityFlag: true,
                  learnerConfusionRisk: 'medium',
                  editorialConcern: null,
                  progressionQuality: 'strong',
                },
              ],
              confidenceEstimate: 0.6,
              ambiguityScore: 0.3,
              prematureLeakFlag: false,
              unresolvedAmbiguityFlag: true,
            }),
          },
        ],
      },
    });

    const exemplar = buildExemplarProgression(workspace);

    assert.ok(exemplar);
    assert.equal(exemplar?.caseId, 'case-2');
    assert.equal(exemplar?.caseTitle, 'Long case');
    assert.equal(exemplar?.states.length, 2);
    assert.equal(exemplar?.confidenceEstimate, 0.6);
    assert.equal(exemplar?.ambiguityScore, 0.3);
    assert.equal(exemplar?.unresolvedAmbiguityFlag, true);
    assert.equal(exemplar?.totalAnalyzedCases, 2);
    assert.equal(exemplar?.abruptGiveawayCases, 1);
  });
});

describe('buildConfusionCandidates', () => {
  it('only includes active mimic-confusion and shared-presentation relationships', () => {
    const workspace = baseWorkspace({
      cases: { summary: { usable: 1 }, items: [] },
      graph: {
        teachingRelationships: [
          relationship({ id: 'rel-mimic', relationshipType: 'MIMIC_CONFUSION' }),
          relationship({ id: 'rel-shared', relationshipType: 'SHARED_PRESENTATION' }),
          relationship({ id: 'rel-discriminator', relationshipType: 'DIFFERENTIAL_DISCRIMINATOR' }),
          relationship({ id: 'rel-inactive', status: 'REJECTED' }),
        ],
      },
    });

    const candidates = buildConfusionCandidates(workspace);
    const ids = candidates.map((candidate) => candidate.id);

    assert.ok(ids.includes('rel-mimic'));
    assert.ok(ids.includes('rel-shared'));
    assert.ok(!ids.includes('rel-discriminator'));
    assert.ok(!ids.includes('rel-inactive'));
  });

  it('sorts unresolved mimics ahead of separated mimics', () => {
    const workspace = baseWorkspace({
      cases: {
        summary: { usable: 1 },
        items: [
          {
            id: 'case-1',
            title: 'Case 1',
            clueProgression: clueProgression({
              differentialElimination: [
                elimination({
                  mimicName: 'Separated mimic',
                  mimicDiagnosisId: 'dx-separated',
                  finalStatus: 'eliminated',
                  discriminatorUsed: 'CT angiogram',
                  eliminationStrength: 'strong',
                }),
                elimination({
                  mimicName: 'Unresolved mimic',
                  mimicDiagnosisId: 'dx-unresolved',
                  finalStatus: 'unresolved',
                }),
              ],
            }),
          },
        ],
      },
      graph: {
        teachingRelationships: [
          relationship({
            id: 'rel-separated',
            targetDiagnosisRegistryId: 'dx-separated',
            targetDiagnosisRegistry: {
              id: 'dx-separated',
              displayLabel: 'Separated mimic',
              canonicalName: 'Separated Mimic',
            },
          }),
          relationship({
            id: 'rel-unresolved',
            targetDiagnosisRegistryId: 'dx-unresolved',
            targetDiagnosisRegistry: {
              id: 'dx-unresolved',
              displayLabel: 'Unresolved mimic',
              canonicalName: 'Unresolved Mimic',
            },
          }),
        ],
      },
    });

    const candidates = buildConfusionCandidates(workspace);

    assert.equal(candidates[0].label, 'Unresolved mimic');
    assert.equal(candidates[0].survivalState, 'unresolved');
    assert.equal(candidates[1].label, 'Separated mimic');
    assert.equal(candidates[1].survivalState, 'separated');
  });

  it('prefers an elimination with a documented discriminator as topElimination', () => {
    const workspace = baseWorkspace({
      cases: {
        summary: { usable: 1 },
        items: [
          {
            id: 'case-1',
            title: 'Case 1',
            clueProgression: clueProgression({
              differentialElimination: [
                elimination({
                  mimicName: 'Aortic dissection',
                  mimicDiagnosisId: 'dx-target',
                  finalStatus: 'persistent',
                }),
                elimination({
                  mimicName: 'Aortic dissection',
                  mimicDiagnosisId: 'dx-target',
                  finalStatus: 'eliminated',
                  discriminatorUsed: 'Widened mediastinum on CXR',
                }),
              ],
            }),
          },
        ],
      },
      graph: { teachingRelationships: [relationship()] },
    });

    const [candidate] = buildConfusionCandidates(workspace);

    assert.equal(candidate.topElimination?.discriminatorUsed, 'Widened mediastinum on CXR');
  });

  it('respects the limit parameter', () => {
    const workspace = baseWorkspace({
      cases: { summary: { usable: 1 }, items: [] },
      graph: {
        teachingRelationships: [
          relationship({ id: 'rel-1', targetDiagnosisRegistryId: 'dx-1', targetDiagnosisRegistry: { id: 'dx-1', displayLabel: 'Mimic 1', canonicalName: 'Mimic 1' } }),
          relationship({ id: 'rel-2', targetDiagnosisRegistryId: 'dx-2', targetDiagnosisRegistry: { id: 'dx-2', displayLabel: 'Mimic 2', canonicalName: 'Mimic 2' } }),
          relationship({ id: 'rel-3', targetDiagnosisRegistryId: 'dx-3', targetDiagnosisRegistry: { id: 'dx-3', displayLabel: 'Mimic 3', canonicalName: 'Mimic 3' } }),
        ],
      },
    });

    assert.equal(buildConfusionCandidates(workspace, 2).length, 2);
  });
});

describe('buildDiscriminatorTeachingSummary', () => {
  it('includes active relationship discriminator summaries as editorial items', () => {
    const workspace = baseWorkspace({
      cases: { summary: {}, items: [] },
      graph: {
        teachingRelationships: [
          relationship({
            discriminatorSummary: 'D-dimer negative excludes PE in low-risk patients',
            strength: 0.8,
            supportingGraphFact: { id: 'fact-1', type: 'FINDING', label: 'D-dimer assay', status: 'ACTIVE' },
          }),
          relationship({
            id: 'rel-inactive',
            status: 'REJECTED',
            discriminatorSummary: 'Should not appear',
          }),
          relationship({
            id: 'rel-no-summary',
            discriminatorSummary: null,
          }),
        ],
      },
    });

    const summary = buildDiscriminatorTeachingSummary(workspace);

    assert.equal(summary.items.length, 1);
    assert.equal(summary.items[0].source, 'relationship');
    assert.equal(summary.items[0].strength, 'strong');
    assert.equal(summary.items[0].annotationSource, 'editorial');
    assert.equal(summary.items[0].evidence, 'D-dimer assay');
    assert.equal(summary.explicitCount, 1);
  });

  it('counts case eliminations with discriminators, split by annotation source', () => {
    const workspace = baseWorkspace({
      cases: {
        summary: { progressionSignals: { missingEditorialAnnotationCount: 2 } },
        items: [
          {
            id: 'case-1',
            title: 'Case 1',
            clueProgression: clueProgression({
              differentialElimination: [
                elimination({
                  mimicName: 'Mimic A',
                  discriminatorUsed: 'Editorial discriminator',
                  eliminationStrength: 'strong',
                  annotationSource: 'editorial',
                }),
                elimination({
                  mimicName: 'Mimic B',
                  discriminatorUsed: 'Heuristic discriminator',
                  eliminationStrength: 'weak',
                  annotationSource: 'heuristic',
                }),
                elimination({
                  mimicName: 'Mimic C',
                  discriminatorUsed: undefined,
                }),
              ],
            }),
          },
        ],
      },
      graph: { teachingRelationships: [] },
    });

    const summary = buildDiscriminatorTeachingSummary(workspace);

    assert.equal(summary.items.length, 2);
    assert.equal(summary.explicitCount, 1);
    assert.equal(summary.heuristicOnlyCount, 1);
    assert.equal(summary.missingAnnotationCount, 2);
    assert.equal(summary.items[0].label, 'Editorial discriminator');
    assert.equal(summary.items[1].label, 'Heuristic discriminator');
  });
});

describe('buildEscalationNarrative', () => {
  it('defaults to a missing-coverage narrative when escalationCoverage is absent', () => {
    const workspace = baseWorkspace({
      cases: { summary: {}, items: [] },
      graph: { teachingRelationships: [] },
    });

    const narrative = buildEscalationNarrative(workspace);

    assert.equal(narrative.coversEscalation, false);
    assert.equal(narrative.escalationType, null);
    assert.equal(narrative.missingEscalationTeaching, true);
    assert.equal(narrative.noPlayableEscalationCase, true);
    assert.deepEqual(narrative.caseRows, []);
    assert.deepEqual(narrative.escalationRelationships, []);
    assert.equal(narrative.escalationScore, null);
  });

  it('maps escalation coverage, case rows, relationships, and maturity score when present', () => {
    const workspace = baseWorkspace({
      cases: { summary: {}, items: [] },
      escalationCoverage: {
        coversEscalation: true,
        escalationType: 'hemodynamic collapse',
        missingEscalationTeaching: false,
        weakEscalationEvidence: true,
        noPlayableEscalationCase: false,
      },
      caseEscalationCoverage: [
        {
          caseId: 'case-1',
          escalationType: 'hemodynamic collapse',
          covered: true,
          evidenceStrength: 0.7,
          reasoningPathId: null,
          notes: null,
        },
      ],
      graph: {
        teachingRelationships: [
          relationship({ id: 'rel-escalation', relationshipType: 'ESCALATION_CONTRAST' }),
          relationship({ id: 'rel-other', relationshipType: 'MIMIC_CONFUSION' }),
        ],
      },
      maturityBreakdown: { escalationCoverage: 0.65 },
    });

    const narrative = buildEscalationNarrative(workspace);

    assert.equal(narrative.coversEscalation, true);
    assert.equal(narrative.escalationType, 'hemodynamic collapse');
    assert.equal(narrative.weakEscalationEvidence, true);
    assert.equal(narrative.noPlayableEscalationCase, false);
    assert.equal(narrative.caseRows.length, 1);
    assert.equal(narrative.escalationRelationships.length, 1);
    assert.equal(narrative.escalationRelationships[0].id, 'rel-escalation');
    assert.equal(narrative.escalationScore, 0.65);
  });
});

describe('buildRecognitionGovernanceSummary', () => {
  it('summarizes claims, accepted repairs, pending drafts, and weak sections', () => {
    const workspace = baseWorkspace({
      unsupportedClaimsBySection: [
        { sectionId: 'differentials', claimId: 'claim-1', blocksPublication: true },
        { sectionId: 'pitfalls', claimId: 'claim-2', blocksPublication: false },
      ],
      education: {
        sectionHealth: [
          { section: 'differentials', score: 0.4, regenerationRecommended: true, blockers: ['x'], warnings: [] },
          { section: 'pitfalls', score: 0.9, regenerationRecommended: false, blockers: [], warnings: [] },
          { section: 'examPearls', score: 0.6, regenerationRecommended: false, blockers: [], warnings: ['weak coverage'] },
        ],
        acceptedRepairs: [{ section: 'differentials' }],
      },
      discriminatorDraftReviews: [
        { auditId: 'audit-1', reviewStatus: 'PENDING_REVIEW' },
        { auditId: 'audit-2', reviewStatus: 'APPROVED' },
      ],
    });

    const summary = buildRecognitionGovernanceSummary(workspace);

    assert.equal(summary.unsupportedClaimCount, 2);
    assert.equal(summary.blockingClaimCount, 1);
    assert.equal(summary.acceptedRepairCount, 1);
    assert.equal(summary.pendingDiscriminatorDraftCount, 1);
    assert.equal(summary.weakSectionCount, 2);
    assert.equal(summary.weakestSectionLabel, 'differentials');
  });

  it('reports null weakest section label when no sections are weak', () => {
    const workspace = baseWorkspace({
      education: {
        sectionHealth: [
          { section: 'differentials', score: 0.9, regenerationRecommended: false, blockers: [], warnings: [] },
        ],
      },
    });

    const summary = buildRecognitionGovernanceSummary(workspace);

    assert.equal(summary.weakSectionCount, 0);
    assert.equal(summary.weakestSectionLabel, null);
  });
});
