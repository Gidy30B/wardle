/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEditorialWorkflowViewModel } from './editorialWorkflowViewModel.ts';
import type {
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRule,
} from '../../../../api/admin.types.ts';

describe('buildEditorialWorkflowViewModel', () => {
  it('maps a workspace into all seven workflow keys', () => {
    const viewModel = buildEditorialWorkflowViewModel(baseWorkspace());

    assert.deepEqual(Object.keys(viewModel.workflows), [
      'reviewQueue',
      'overview',
      'teaching',
      'reasoning',
      'cases',
      'content',
      'publish',
    ]);
    assert.equal(viewModel.reviewQueue.question, 'Editorial review queue');
    assert.equal(viewModel.overview.boards[0]?.id, 'diagnosisHealth');
    assert.equal(viewModel.teaching.boards.length, 2);
    assert.equal(viewModel.reasoning.boards.length, 4);
    assert.equal(viewModel.reasoning.boards[0]?.id, 'diagnosticReasoning');
    assert.deepEqual(
      viewModel.cases.boards.map((board) => board.id),
      [
        'diagnosticCases',
        'clueProgression',
        'reasoningCoverage',
        'discriminatorCoverage',
      ],
    );
    assert.equal(viewModel.content.boards.length, 4);
  });

  it('consumes Knowledge and Diagnostic Reasoning layers for workflow summaries', () => {
    const workspace = baseWorkspace({
      workspaceSummary: {
        ...baseWorkspace().workspaceSummary,
        blockers: ['Needs senior review.'],
      },
      linkedDifferentials: [
        {
          id: 'mimic-link',
          diagnosisRegistryId: 'mimic-1',
          displayLabel: 'Migraine',
          canonicalName: 'migraine',
          role: 'PRIMARY_MIMIC',
          confidence: 0.8,
          sourceText: 'Common mimic',
        },
      ],
      graph: {
        ...baseWorkspace().graph,
        teachingRelationships: [
          {
            id: 'relationship-1',
            sourceDiagnosisRegistryId: 'dx-1',
            targetDiagnosisRegistryId: 'mimic-1',
            relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
            teachingPurpose: 'TEACH_DISCRIMINATOR',
            discriminatorSummary: 'Thunderclap onset beats migraine.',
            commonConfusionReason: 'Both can present with headache.',
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
    });

    const viewModel = buildEditorialWorkflowViewModel(workspace);

    assert.equal(viewModel.knowledge.blockers.length, 1);
    assert.equal(viewModel.diagnosticReasoning.diagnosticComparisons.length, 1);
    assert.match(viewModel.reasoning.verdict, /1 diagnostic comparison/);
    assert.equal(viewModel.publish.tone, 'danger');
  });

  it('keeps content section boards separate', () => {
    const viewModel = buildEditorialWorkflowViewModel(baseWorkspace());

    assert.deepEqual(
      viewModel.content.boards.map((board) => board.id),
      ['education', 'scoringSystems', 'mnemonics', 'recallPrompts'],
    );
  });

  it('populates Content workflow from education snapshots and reasoning layers', () => {
    const viewModel = buildEditorialWorkflowViewModel(contentWorkspace());

    assert.equal(viewModel.content.education.sections.length, 1);
    assert.equal(viewModel.content.scoringSystems.scoringSystems[0]?.name, 'Wells');
    assert.equal(viewModel.content.mnemonics.mnemonics[0]?.mnemonic, 'WELLS');
    assert.equal(viewModel.content.recallPrompts.recallPrompts.length, 2);
    assert.equal(viewModel.content.boards.length, 4);
  });

  it('prioritizes Content verdicts by teaching risk before content counts', () => {
    const withUnsupportedClaim = buildEditorialWorkflowViewModel(
      contentWorkspace({
        unsupportedClaimsBySection: [
          {
            sectionId: 'differentials',
            sectionType: 'differentials',
            claimId: 'claim-1',
            claimText: 'Unsupported education claim.',
            severity: 'blocker',
            artifactId: 'education-1',
            evidenceIds: [],
            repairTarget: 'differentials',
            sourceType: 'education',
            createdAt: '2026-01-01T00:00:00.000Z',
            repairableAutomatically: true,
            blocksPublication: true,
          },
        ],
      }),
    );
    const withMissingReasoning = buildEditorialWorkflowViewModel(
      contentWorkspace({
        revisions: {
          latest: contentRevision({
            scoringSystems: [],
            examPearls: [],
            recallPrompts: [],
            differentials: 'Generic education without the mimic discriminator.',
          }),
          items: [],
        },
      }),
    );

    assert.match(withUnsupportedClaim.content.verdict, /unsupported education claim/i);
    assert.match(withMissingReasoning.content.verdict, /diagnostic reasoning coverage gap/i);
  });

  it('feeds Content review items into the Review Queue', () => {
    const viewModel = buildEditorialWorkflowViewModel(
      contentWorkspace({
        revisions: {
          latest: contentRevision({
            scoringSystems: [
              {
                name: 'Wells',
                explanation: 'Wells estimates PE probability.',
                criteria: ['DVT signs'],
              },
            ],
            examPearls: [],
            recallPrompts: [{ prompt: 'Define pulmonary embolism.' }],
          }),
          items: [],
        },
      }),
    );

    assert.ok(
      viewModel.reviewQueue.items.some(
        (item) => item.targetWorkflow === 'content',
      ),
    );
    assert.ok(
      viewModel.reviewQueue.groups.some(
        (group) => group.id === 'contentCoverage',
      ),
    );
  });

  it('returns a safe empty Content model', () => {
    const viewModel = buildEditorialWorkflowViewModel(baseWorkspace());

    assert.equal(viewModel.content.education.sections.length, 1);
    assert.equal(viewModel.content.scoringSystems.scoringSystems.length, 0);
    assert.equal(viewModel.content.mnemonics.mnemonics.length, 0);
    assert.equal(viewModel.content.recallPrompts.recallPrompts.length, 0);
  });

  it('groups Review Queue items with blockers before warnings', () => {
    const viewModel = buildEditorialWorkflowViewModel(
      baseWorkspace({
        workspaceSummary: {
          ...baseWorkspace().workspaceSummary,
          blockers: ['Publication blocker'],
          warnings: ['Editorial warning'],
        },
        coverageGaps: [
          {
            teachingRuleId: 'rule-1',
            title: 'Missing discriminator coverage',
            missingEducation: false,
            missingCases: true,
            missingGraph: false,
            severity: 'warning',
            recommendedAction: 'Generate a discriminator case.',
            targetTab: 'cases',
          },
        ],
      }),
    );

    assert.equal(viewModel.reviewQueue.items[0]?.severity, 'blocker');
    assert.equal(viewModel.reviewQueue.items.at(-1)?.severity, 'warning');
    assert.deepEqual(
      viewModel.reviewQueue.groups.map((group) => group.id),
      ['publicationBlockers', 'coverageGaps', 'governance'],
    );
  });

  it('keeps Review Queue source attribution and deduplicates repeated signals', () => {
    const viewModel = buildEditorialWorkflowViewModel(
      contentWorkspace({
        unsupportedClaimsBySection: [
          {
            sectionId: 'differentials',
            sectionType: 'differentials',
            claimId: 'claim-1',
            claimText: 'Unsupported education claim.',
            severity: 'blocker',
            artifactId: 'education-1',
            evidenceIds: [],
            repairTarget: 'differentials',
            sourceType: 'education',
            createdAt: '2026-01-01T00:00:00.000Z',
            repairableAutomatically: true,
            blocksPublication: true,
          },
        ],
      }),
    );
    const duplicatedClaimItems = viewModel.reviewQueue.items.filter(
      (item) =>
        item.kind === 'unsupported_claim' &&
        item.sourceId === 'claim-1',
    );

    assert.equal(duplicatedClaimItems.length, 1);
    assert.ok(
      viewModel.reviewQueue.items.every((item) =>
        item.metadata.some((entry) => entry.startsWith('Workflow:')),
      ),
    );
  });

  it('retains actionable review metadata without changing blocker ordering', () => {
    const viewModel = buildEditorialWorkflowViewModel(
      baseWorkspace({
        workspaceSummary: {
          ...baseWorkspace().workspaceSummary,
          blockers: ['Publication blocker'],
        },
        teachingRules: {
          summary: {
            total: 1,
            active: 0,
            approved: 0,
            candidates: 1,
            needsReview: 0,
            critical: 1,
          },
          items: [teachingRule('CANDIDATE')],
        },
      }),
    );
    const item = viewModel.reviewQueue.items.find(
      (candidate) => candidate.kind === 'teaching_rule',
    );

    assert.equal(viewModel.reviewQueue.items[0]?.severity, 'blocker');
    assert.equal(item?.sourceId, 'rule-review-1');
    assert.equal(item?.reviewStatus, 'CANDIDATE');
    assert.equal(item?.targetWorkflow, 'teaching');
    assert.equal(item?.targetBoard, 'teachingRules');
  });

  it('produces safe defaults for all seven workflows on an empty workspace', () => {
    const viewModel = buildEditorialWorkflowViewModel(baseWorkspace());

    assert.deepEqual(Object.keys(viewModel.workflows), [
      'reviewQueue',
      'overview',
      'teaching',
      'reasoning',
      'cases',
      'content',
      'publish',
    ]);
    Object.values(viewModel.workflows).forEach((workflow) => {
      assert.equal(typeof workflow.verdict, 'string');
      assert.equal(typeof workflow.detail, 'string');
      assert.ok(Array.isArray(workflow.reviewItems));
      assert.ok(Array.isArray(workflow.boards));
    });
  });

  it('includes diagnostic reasoning risks and knowledge blockers in Overview', () => {
    const viewModel = buildEditorialWorkflowViewModel(
      baseWorkspace({
        workspaceSummary: {
          ...baseWorkspace().workspaceSummary,
          blockers: ['Needs senior review.'],
        },
        linkedDifferentials: [
          {
            id: 'mimic-link',
            diagnosisRegistryId: 'mimic-1',
            displayLabel: 'Migraine',
            canonicalName: 'migraine',
            role: 'PRIMARY_MIMIC',
            confidence: 0.8,
            sourceText: 'Common mimic',
          },
        ],
      }),
    );

    assert.match(viewModel.overview.clinicalVerdict, /Not ready|caution/i);
    assert.equal(viewModel.overview.concerns.length, 2);
    assert.ok(
      viewModel.overview.concerns.some((concern) =>
        concern.title.includes('Missing discriminator'),
      ),
    );
    assert.ok(
      viewModel.overview.concerns.some((concern) =>
        concern.detail.includes('Needs senior review'),
      ),
    );
  });

  it('includes diagnostic reasoning blockers in Publish', () => {
    const viewModel = buildEditorialWorkflowViewModel(
      baseWorkspace({
        graph: {
          ...baseWorkspace().graph,
          teachingRelationships: [
            {
              id: 'relationship-1',
              sourceDiagnosisRegistryId: 'dx-1',
              targetDiagnosisRegistryId: 'mimic-1',
              relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
              teachingPurpose: 'TEACH_DISCRIMINATOR',
              discriminatorSummary: null,
              commonConfusionReason: 'Both can present with headache.',
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
      }),
    );

    const diagnosticReasoning = viewModel.publish.checklist.find(
      (item) => item.id === 'diagnostic-reasoning',
    );

    assert.equal(diagnosticReasoning?.status, 'blocked');
    assert.equal(viewModel.publish.blocked.includes(diagnosticReasoning!), true);
  });

  it('includes already-passing publish checks and handles empty workspace safely', () => {
    const viewModel = buildEditorialWorkflowViewModel(baseWorkspace());

    assert.ok(viewModel.publish.passing.length > 0);
    assert.ok(
      viewModel.publish.checklist.some((item) => item.status === 'passing'),
    );
    assert.equal(viewModel.reviewQueue.items.length, 0);
    assert.equal(viewModel.overview.standing.length, 5);
  });

  it('exposes Teaching curriculum coverage and teaching rules', () => {
    const viewModel = buildEditorialWorkflowViewModel(
      baseWorkspace({
        coverageMatrix: [
          {
            teachingRuleId: 'rule-1',
            stableKey: 'rule-1',
            title: 'Thunderclap headache discriminator',
            category: 'differential_concept',
            importance: 'critical',
            ruleStatus: 'ACTIVE',
            educationCoverage: 'covered',
            caseCoverage: 'missing',
            graphCoverage: 'covered',
            fullCoverageStatus: 'partial',
            recommendedAction: 'Add a case that teaches the discriminator.',
          },
        ],
        coverageGaps: [
          {
            teachingRuleId: 'rule-1',
            title: 'Thunderclap headache discriminator',
            missingEducation: false,
            missingCases: true,
            missingGraph: false,
            severity: 'warning',
            recommendedAction: 'Add a case that teaches the discriminator.',
            targetTab: 'cases',
          },
        ],
        teachingRules: {
          summary: {
            total: 1,
            active: 1,
            approved: 0,
            candidates: 0,
            needsReview: 0,
            critical: 1,
          },
          items: [
            {
              id: 'rule-1',
              diagnosisRegistryId: 'dx-1',
              stableKey: 'rule-1',
              title: 'Thunderclap headache discriminator',
              category: 'differential_concept',
              importance: 'critical',
              rationale: 'Separates SAH from migraine.',
              acceptableManifestations: null,
              requiredDifferentials: null,
              expectedEvidence: null,
              difficultyHints: null,
              generationMetadata: null,
              reasoningQualityWarnings: [],
              avoidTooEarly: true,
              appliesToEducation: true,
              appliesToCaseGeneration: true,
              appliesToGraph: true,
              status: 'ACTIVE',
              source: 'EDITOR_CREATED',
              version: 1,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      }),
    );

    assert.equal(viewModel.teaching.curriculumCoverage.goals.length, 1);
    assert.equal(
      viewModel.teaching.curriculumCoverage.missingCaseSupportCount,
      1,
    );
    assert.equal(viewModel.teaching.teachingRules.activeRules.length, 1);
    assert.equal(
      viewModel.teaching.teachingRules.activeRules[0]
        ?.supportsDiagnosticDiscrimination,
      true,
    );
  });

  it('keeps Teaching safe when coverage is missing', () => {
    const viewModel = buildEditorialWorkflowViewModel(baseWorkspace());

    assert.equal(viewModel.teaching.curriculumCoverage.goals.length, 0);
    assert.match(viewModel.teaching.curriculumCoverage.verdict, /No curriculum/);
    assert.equal(viewModel.teaching.teachingRules.activeRules.length, 0);
  });

  it('exposes Reasoning diagnostic, evidence, differential, and path boards', () => {
    const viewModel = buildEditorialWorkflowViewModel(
      baseWorkspace({
        linkedDifferentials: [
          {
            id: 'mimic-link',
            diagnosisRegistryId: 'mimic-1',
            displayLabel: 'Migraine',
            canonicalName: 'migraine',
            role: 'PRIMARY_MIMIC',
            confidence: 0.8,
            sourceText: 'Both can present with headache.',
          },
        ],
        reasoningPaths: [
          {
            id: 'path-1',
            diagnosisRegistryId: 'dx-1',
            diagnosisName: 'Subarachnoid Hemorrhage',
            normalizedKey: 'subarachnoid-hemorrhage-headache',
            title: 'Headache discriminator path',
            status: 'ACTIVE',
            reasoningGoal: 'DIFFERENTIAL_DISCRIMINATION',
            primaryDifferentialIds: ['mimic-1'],
            supportingTeachingRelationshipIds: [],
            supportingEvidenceRelationshipIds: [],
            discriminatorEvidenceNodeIds: [],
            escalationEvidenceNodeIds: [],
            contradictoryEvidenceNodeIds: [],
            requiredTeachingPoints: ['Thunderclap onset is the anchor.'],
            forbiddenEvidencePatterns: [],
            recommendedClueDistribution: {},
            generationPurpose: 'CASE_GENERATION',
            readinessScore: 0.8,
            readinessTier: 'ready',
            readinessReasons: [],
            reasoningQualityWarnings: [],
            reviewedByUser: null,
            reviewedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'path-candidate',
            diagnosisRegistryId: 'dx-1',
            diagnosisName: 'Subarachnoid Hemorrhage',
            normalizedKey: 'candidate-headache-path',
            title: 'Candidate headache path',
            status: 'CANDIDATE',
            reasoningGoal: 'DIFFERENTIAL_DISCRIMINATION',
            primaryDifferentialIds: ['mimic-1'],
            supportingTeachingRelationshipIds: [],
            supportingEvidenceRelationshipIds: [],
            discriminatorEvidenceNodeIds: [],
            escalationEvidenceNodeIds: [],
            contradictoryEvidenceNodeIds: [],
            requiredTeachingPoints: ['Use onset to separate the mimic.'],
            forbiddenEvidencePatterns: [],
            recommendedClueDistribution: {},
            generationPurpose: 'CASE_GENERATION',
            readinessScore: 0.9,
            readinessTier: 'ready',
            readinessReasons: [],
            reasoningQualityWarnings: [],
            reviewedByUser: null,
            reviewedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );

    assert.equal(
      viewModel.reasoning.diagnosticReasoning.comparisons.length,
      1,
    );
    assert.equal(viewModel.reasoning.differentials.linkedMimics.length, 1);
    assert.equal(viewModel.reasoning.reasoningPaths.activePaths.length, 1);
    assert.equal(viewModel.reasoning.reasoningPaths.candidatePaths.length, 1);
    assert.equal(viewModel.reasoning.evidence.activeRelationships.length, 0);
  });

  it('lets Diagnostic Reasoning risks drive the Reasoning verdict before graph counts', () => {
    const viewModel = buildEditorialWorkflowViewModel(
      baseWorkspace({
        linkedDifferentials: [
          {
            id: 'mimic-link',
            diagnosisRegistryId: 'mimic-1',
            displayLabel: 'Migraine',
            canonicalName: 'migraine',
            role: 'PRIMARY_MIMIC',
            confidence: 0.8,
            sourceText: 'Common mimic',
          },
        ],
      }),
    );

    assert.equal(viewModel.reasoning.tone, 'warning');
    assert.equal(viewModel.reasoning.differentials.weakComparisons.length, 1);
    assert.equal(viewModel.reasoning.evidence.itemCount, 0);
  });

  it('populates Cases workflow and prioritizes reasoning coverage gaps over inventory counts', () => {
    const viewModel = buildEditorialWorkflowViewModel(
      baseWorkspace({
        cases: {
          summary: {
            total: 1,
            usable: 1,
            byStatus: {},
            warningCount: 0,
            blockerCount: 0,
            latest: null,
          },
          items: [
            {
              id: 'case-1',
              title: 'Generic headache case',
              editorialStatus: 'READY_TO_PUBLISH',
              difficulty: 'intermediate',
              updatedAt: '2026-01-01T00:00:00.000Z',
              qualityProjection: caseQualityProjection(),
            },
          ],
        },
        linkedDifferentials: [
          {
            id: 'mimic-link',
            diagnosisRegistryId: 'mimic-1',
            displayLabel: 'Migraine',
            canonicalName: 'migraine',
            role: 'PRIMARY_MIMIC',
            confidence: 0.8,
            sourceText: 'Common headache mimic',
          },
        ],
      }),
    );

    assert.match(viewModel.cases.verdict, /lack case support/);
    assert.equal(viewModel.cases.reasoningCoverage.gapCount, 1);
    assert.equal(viewModel.cases.diagnosticCases.cases.length, 1);
  });

  it('feeds Cases review items into the Review Queue', () => {
    const viewModel = buildEditorialWorkflowViewModel(
      baseWorkspace({
        learningGoalCoverage: [
          {
            learningGoalId: 'goal-1',
            learningGoal: 'Separate SAH from migraine',
            coveredByCaseIds: [],
            uncoveredDiscriminators: ['thunderclap onset'],
            missingMimics: ['Migraine'],
            generationPriority: 'high',
            coveragePct: 0,
          },
        ],
      }),
    );

    assert.ok(
      viewModel.reviewQueue.items.some(
        (item) =>
          item.targetWorkflow === 'cases' &&
          item.title === 'Learning goal lacks case coverage',
      ),
    );
    assert.ok(
      viewModel.reviewQueue.groups.some((group) => group.id === 'caseReasoning'),
    );
  });

  it('returns a safe empty Cases model', () => {
    const viewModel = buildEditorialWorkflowViewModel(baseWorkspace());

    assert.equal(viewModel.cases.diagnosticCases.cases.length, 0);
    assert.equal(viewModel.cases.clueProgression.cases.length, 0);
    assert.equal(viewModel.cases.reasoningCoverage.rows.length, 0);
    assert.equal(viewModel.cases.discriminatorCoverage.rows.length, 0);
  });
});

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

function contentWorkspace(
  overrides: Partial<DiagnosisEditorialWorkspace> = {},
): DiagnosisEditorialWorkspace {
  const base = baseWorkspace({
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
      ],
      blockers: [],
      warnings: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
      acceptedRepairs: [],
    },
    revisions: {
      latest: contentRevision(),
      items: [],
    },
    linkedDifferentials: [
      {
        id: 'mimic-link',
        diagnosisRegistryId: 'mimic-1',
        displayLabel: 'Pneumonia',
        canonicalName: 'pneumonia',
        role: 'PRIMARY_MIMIC',
        confidence: 0.8,
        sourceText: 'Common chest pain mimic',
      },
    ],
    graph: {
      ...baseWorkspace().graph,
      teachingRelationships: [
        {
          id: 'relationship-1',
          sourceDiagnosisRegistryId: 'dx-1',
          targetDiagnosisRegistryId: 'mimic-1',
          relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
          teachingPurpose: 'TEACH_DISCRIMINATOR',
          discriminatorSummary:
            'Pleuritic chest pain with hypoxia separates PE from Pneumonia.',
          commonConfusionReason: 'Both can present with pleuritic pain.',
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
            displayLabel: 'Pulmonary Embolism',
            canonicalName: 'pulmonary embolism',
          },
          targetDiagnosisRegistry: {
            id: 'mimic-1',
            displayLabel: 'Pneumonia',
            canonicalName: 'pneumonia',
          },
        },
      ],
    },
  });

  return {
    ...base,
    ...overrides,
  } as DiagnosisEditorialWorkspace;
}

function teachingRule(
  status: DiagnosisTeachingRule['status'],
): DiagnosisTeachingRule {
  return {
    id: 'rule-review-1',
    diagnosisRegistryId: 'dx-1',
    stableKey: 'rule-review-1',
    title: 'Review the key discriminator',
    category: 'differential_concept',
    importance: 'critical',
    rationale: 'The target must be separated from its primary mimic.',
    acceptableManifestations: null,
    requiredDifferentials: null,
    expectedEvidence: null,
    difficultyHints: null,
    generationMetadata: null,
    reasoningQualityWarnings: [],
    avoidTooEarly: true,
    appliesToEducation: true,
    appliesToCaseGeneration: true,
    appliesToGraph: true,
    status,
    source: 'EDITOR_CREATED',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function contentRevision(snapshot: Record<string, unknown> = {}) {
  return {
    id: 'revision-1',
    educationId: 'education-1',
    version: 2,
    editorialStatus: 'NEEDS_REVIEW' as const,
    source: 'AI_ASSISTED' as const,
    createdByUserId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    changedSections: [],
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
          explanation: 'Wells estimates PE probability.',
          criteria: ['DVT signs', 'PE most likely'],
          mnemonic: 'WELLS',
        },
      ],
      examPearls: [
        {
          type: 'MNEMONIC',
          title: 'WELLS',
          content: 'Use WELLS to remember PE probability criteria.',
        },
      ],
      recallPrompts: [
        {
          prompt:
            'Why does pleuritic chest pain with hypoxia make PE beat Pneumonia?',
        },
        { prompt: 'Which Wells criterion changes pretest probability?' },
      ],
      ...snapshot,
    },
  };
}

function caseQualityProjection() {
  const dimension = {
    status: 'good' as const,
    score: 0.9,
    warnings: [],
    blockers: [],
    summary: 'No quality concerns.',
  };

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
    warnings: [],
    blockers: [],
    sourceSummary: {
      hasValidationRun: false,
      hasValidationFindings: false,
      hasGenerationQuality: false,
      hasTeachingAlignment: false,
    },
  };
}
