/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DiagnosisEditorialWorkspace } from '../../../../api/admin.types.ts';
import type { CaseReasoningViewModel } from './caseReasoningViewModel.ts';
import { buildContentCoverageViewModel } from './contentCoverageViewModel.ts';
import type { DiagnosticReasoningViewModel } from './diagnosticReasoningViewModel.ts';
import type { KnowledgeGraphViewModel } from './knowledgeGraphViewModel.ts';

describe('buildContentCoverageViewModel', () => {
  it('consumes Knowledge, Diagnostic Reasoning, and Case Reasoning layers', () => {
    const model = buildContentCoverageViewModel({
      workspace: workspaceFixture(),
      knowledge: knowledgeFixture(),
      diagnosticReasoning: diagnosticReasoningFixture(),
      caseReasoning: caseReasoningFixture(),
    });

    assert.equal(model.education.length, 2);
    assert.equal(model.coverage[0]?.label, 'Pulmonary embolism vs Pneumonia');
    assert.equal(model.coverage[0]?.caseCovered, true);
    assert.equal(model.coverage[0]?.educationCovered, true);
  });

  it('produces scoring systems, mnemonics, and recall prompt projections', () => {
    const model = buildContentCoverageViewModel({
      workspace: workspaceFixture(),
      knowledge: knowledgeFixture(),
      diagnosticReasoning: diagnosticReasoningFixture(),
      caseReasoning: caseReasoningFixture(),
    });

    assert.equal(model.scoringSystems[0]?.name, 'Wells');
    assert.equal(model.scoringSystems[0]?.criteriaCount, 2);
    assert.equal(model.scoringSystems[0]?.hasMnemonic, true);
    assert.equal(model.mnemonics[0]?.associatedScoringSystem, 'Wells');
    assert.equal(model.recallPrompts.length, 3);
    assert.equal(
      model.recallPrompts.some(
        (prompt) => prompt.reasoningDepth === 'definition_only',
      ),
      true,
    );
  });

  it('identifies unsupported claims, missing coverage, scoring gaps, and weak prompts', () => {
    const model = buildContentCoverageViewModel({
      workspace: workspaceFixture({
        revisions: {
          latest: ({
            ...workspaceFixture().revisions.latest!,
            snapshot: {
              scoringSystems: [
                {
                  name: 'Wells',
                  explanation: 'Wells estimates pulmonary embolism probability.',
                  criteria: ['DVT signs'],
                },
              ],
              examPearls: [],
              recallPrompts: [{ prompt: 'Define pulmonary embolism.' }],
            },
          } as unknown) as DiagnosisEditorialWorkspace['revisions']['latest'],
          items: [],
        },
      }),
      knowledge: knowledgeFixture(),
      diagnosticReasoning: diagnosticReasoningFixture(),
      caseReasoning: {
        ...caseReasoningFixture(),
        reasoningCoverage: [
          {
            id: 'reasoning-coverage:comparison-1',
            comparisonId: 'comparison-1',
            label: 'Pulmonary embolism vs Pneumonia',
            evidenceCovered: true,
            educationCovered: false,
            casesCovered: false,
            caseTitles: [],
            tone: 'danger',
            gapReason: 'No case support.',
          },
        ],
        discriminatorCoverage: [
          {
            id: 'discriminator-coverage:disc-1',
            discriminatorId: 'disc-1',
            label: 'Pleuritic chest pain with hypoxia',
            mimicName: 'Pneumonia',
            evidenceCovered: true,
            educationCovered: false,
            casesCovered: false,
            caseTitles: [],
            unsupportedClaimCount: 0,
            tone: 'danger',
            gapReason: 'No discriminator case support.',
          },
        ],
      },
    });

    assert.equal(model.blockers[0]?.title, 'Unsupported education claim');
    assert.equal(
      model.teachingRisks.some(
        (risk) => risk.title === 'Missing reasoning coverage in education',
      ),
      true,
    );
    assert.equal(
      model.teachingRisks.some(
        (risk) => risk.title === 'Scoring system lacks recall support',
      ),
      true,
    );
    assert.equal(
      model.teachingRisks.some(
        (risk) => risk.title === 'Definition-only recall prompt',
      ),
      true,
    );
    assert.equal(model.reviewItems.length > 0, true);
  });

  it('handles an empty workspace safely', () => {
    const model = buildContentCoverageViewModel({
      workspace: workspaceFixture({
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
        revisions: { latest: null, items: [] },
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
      }),
      knowledge: {
        ...knowledgeFixture(),
        evidence: {
          ...knowledgeFixture().evidence,
          unsupportedClaims: [],
        },
      },
      diagnosticReasoning: {
        ...diagnosticReasoningFixture(),
        diagnosticComparisons: [],
        discriminatorMap: [],
      },
      caseReasoning: {
        ...caseReasoningFixture(),
        cases: [],
        reasoningCoverage: [],
        discriminatorCoverage: [],
      },
    });

    assert.equal(model.education.length, 1);
    assert.equal(model.scoringSystems.length, 0);
    assert.equal(model.mnemonics.length, 0);
    assert.equal(model.recallPrompts.length, 0);
  });
});

function workspaceFixture(
  overrides: Partial<DiagnosisEditorialWorkspace> = {},
): DiagnosisEditorialWorkspace {
  return {
    diagnosis: {
      id: 'dx-1',
      canonicalName: 'pulmonary embolism',
      displayLabel: 'Pulmonary Embolism',
      specialty: 'Emergency Medicine',
      bodySystem: 'Respiratory',
      category: null,
      difficultyBand: null,
      aliases: [],
    },
    lifecycle: {
      curriculum: 'complete',
      brief: 'complete',
      education: 'complete',
      cases: 'complete',
      graph: 'complete',
      ready: 'in_progress',
    },
    workspaceSummary: {
      status: 'needs_review',
      overallScore: null,
      graphReadiness: null,
      educationScore: null,
      caseQualitySummary: {
        status: 'good',
        totalCases: 1,
        usableCases: 1,
        blockerCount: 0,
        warningCount: 0,
        strongestCaseId: 'case-1',
      },
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
      sectionHealth: [
        {
          section: 'differentials',
          score: 0.8,
          coverageScore: 0.7,
          patternComplianceScore: 0.9,
          blockers: [],
          warnings: [],
          regenerationRecommended: false,
          reason: null,
        },
        {
          section: 'recallPrompts',
          score: 0.6,
          coverageScore: 0.5,
          patternComplianceScore: 0.7,
          blockers: [],
          warnings: ['Prompt quality needs review.'],
          regenerationRecommended: false,
          reason: null,
        },
      ],
      blockers: [],
      warnings: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
      acceptedRepairs: [],
    },
    revisions: {
      latest: {
        id: 'revision-1',
        educationId: 'education-1',
        version: 2,
        editorialStatus: 'NEEDS_REVIEW',
        source: 'AI_ASSISTED',
        createdByUserId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        quality: {
          overallScore: 0.8,
          graphReadiness: 0.8,
          sectionScores: {},
          coverageScores: {},
          patternComplianceScores: {},
          warnings: [],
          blockers: [],
          sectionHealth: [],
          warningCount: 0,
          blockerCount: 0,
        },
        snapshot: {
          differentials:
            'Pleuritic chest pain with hypoxia separates pulmonary embolism from Pneumonia.',
          scoringSystems: [
            {
              name: 'Wells',
              explanation: 'Wells estimates pulmonary embolism probability.',
              criteria: ['DVT signs', 'PE most likely'],
              mnemonic: 'WELLS',
            },
          ],
          examPearls: [
            {
              type: 'MNEMONIC',
              title: 'WELLS',
              content: 'Use WELLS to remember PE risk criteria.',
            },
          ],
          recallPrompts: [
            {
              prompt:
                'Why does pleuritic chest pain with hypoxia make PE beat Pneumonia?',
            },
            { prompt: 'Which Wells criterion changes pretest probability?' },
            { prompt: 'Define pulmonary embolism.' },
          ],
        },
      },
      items: [],
    },
    cases: {
      summary: {
        total: 1,
        usable: 1,
        byStatus: {},
        warningCount: 0,
        blockerCount: 0,
        latest: null,
      },
      items: [],
    },
    graph: {
      readiness: 'fact_ready',
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
    learningGoalCoverage: [],
    caseLearningGoalCoverage: [],
    caseEscalationCoverage: [],
    escalationCoverage: null,
    unsupportedClaimsBySection: [],
    maturityBreakdown: null,
    maturityWeighting: null,
    maturityExplanation: null,
    editorialPrioritization: null,
    aiDraftAuditTrail: [],
    discriminatorDraftReviews: [],
    materializedClueRevisionDrafts: [],
    recommendedActions: [],
    availableActions: [],
    ...overrides,
  } as unknown as DiagnosisEditorialWorkspace;
}

function knowledgeFixture(): KnowledgeGraphViewModel {
  return {
    diagnosis: {
      id: 'dx-1',
      name: 'Pulmonary Embolism',
      canonicalName: 'pulmonary embolism',
    },
    evidence: {
      relationships: [],
      active: [],
      candidates: [],
      rejected: [],
      lowTrust: [],
      unsupportedClaims: [
        {
          id: 'claim-1',
          sectionId: 'differentials',
          sectionType: 'differentials',
          claimText: 'Unsupported PE claim.',
          severity: 'blocker',
          blocksPublication: true,
        evidenceIds: [],
        repairableAutomatically: true,
        raw: {
            sectionId: 'differentials',
            sectionType: 'differentials',
            claimId: 'claim-1',
            claimText: 'Unsupported PE claim.',
            severity: 'blocker',
            artifactId: 'education-1',
            evidenceIds: [],
            repairTarget: 'differentials',
            sourceType: 'education',
            createdAt: '2026-01-01T00:00:00.000Z',
            repairableAutomatically: true,
            blocksPublication: true,
          },
        },
      ],
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
}

function diagnosticReasoningFixture(): DiagnosticReasoningViewModel {
  return {
    diagnosis: { id: 'dx-1', name: 'Pulmonary Embolism' },
    coreDiagnosticClaim: {
      diagnosisId: 'dx-1',
      diagnosisName: 'Pulmonary Embolism',
      claim: 'PE wins when hypoxia and pleuritic pain outpace infection signs.',
      supportLevel: 'strong',
      supportSummary: 'Comparison is supported.',
      blockerCount: 0,
      warningCount: 0,
    },
    diagnosticComparisons: [
      {
        id: 'comparison-1',
        targetDiagnosisId: 'dx-1',
        targetDiagnosisName: 'Pulmonary embolism',
        mimicDiagnosisId: 'mimic-1',
        mimicName: 'Pneumonia',
        verdict: 'target_beats_mimic',
        confidence: 'strong',
        whyTargetWins:
          'Pleuritic chest pain with hypoxia beats Pneumonia when fever and consolidation are absent.',
        sharedConfusion: 'Both can cause pleuritic chest pain.',
        discriminators: [
          {
            id: 'disc-1',
            comparisonId: 'comparison-1',
            mimicName: 'Pneumonia',
            label: 'Pleuritic chest pain with hypoxia',
            strength: 'strong',
            evidenceRelationshipIds: ['evidence-1'],
            teachingRelationshipId: 'teaching-1',
            reasoningPathIds: [],
          },
        ],
        supportingEvidenceRelationshipIds: ['evidence-1'],
        supportingTeachingRelationshipIds: ['teaching-1'],
        supportingReasoningPathIds: [],
        risks: [],
        source: 'teaching_relationship',
      },
    ],
    discriminatorMap: [
      {
        id: 'disc-1',
        comparisonId: 'comparison-1',
        mimicName: 'Pneumonia',
        label: 'Pleuritic chest pain with hypoxia',
        strength: 'strong',
        evidenceRelationshipIds: ['evidence-1'],
        teachingRelationshipId: 'teaching-1',
        reasoningPathIds: [],
      },
    ],
    clueInterpretation: [],
    reasoningNarratives: [],
    caseReasoningChecks: [],
    teachingRisks: [],
    publicationReasoningBlockers: [],
  };
}

function caseReasoningFixture(): CaseReasoningViewModel {
  return {
    cases: [
      {
        id: 'case-1',
        title: 'Hypoxic chest pain case',
        status: 'READY_TO_PUBLISH',
        difficulty: 'intermediate',
        quality: 'clean',
        tone: 'success',
        reasoningObjective: 'Teach why PE beats Pneumonia.',
        linkedLearningGoals: ['Apply Wells to PE probability.'],
        linkedDiscriminators: ['Pleuritic chest pain with hypoxia'],
        linkedComparisonIds: ['comparison-1'],
        reasoningConfidence: 'strong',
        teachingRisks: [],
        blockerCount: 0,
        warningCount: 0,
      },
    ],
    clueProgression: [],
    reasoningCoverage: [
      {
        id: 'reasoning-coverage:comparison-1',
        comparisonId: 'comparison-1',
        label: 'Pulmonary embolism vs Pneumonia',
        evidenceCovered: true,
        educationCovered: true,
        casesCovered: true,
        caseTitles: ['Hypoxic chest pain case'],
        tone: 'success',
        gapReason: null,
      },
    ],
    discriminatorCoverage: [
      {
        id: 'discriminator-coverage:disc-1',
        discriminatorId: 'disc-1',
        label: 'Pleuritic chest pain with hypoxia',
        mimicName: 'Pneumonia',
        evidenceCovered: true,
        educationCovered: true,
        casesCovered: true,
        caseTitles: ['Hypoxic chest pain case'],
        unsupportedClaimCount: 0,
        tone: 'success',
        gapReason: null,
      },
    ],
    teachingRisks: [],
    blockers: [],
    reviewItems: [],
  };
}
