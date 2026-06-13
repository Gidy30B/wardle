/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { EditorialCoverageOverview } from '../../api/admin';
import {
  buildEditorialQueues,
  diagnosisQueueIds,
  sortDiagnosesByEditorialPriority,
} from './coverageQueues.ts';

type WeakDiagnosis = EditorialCoverageOverview['weakDiagnoses'][number];

function makeDiagnosis(overrides: Partial<WeakDiagnosis> = {}): WeakDiagnosis {
  return {
    diagnosisRegistryId: 'dx-1',
    diagnosisName: 'Appendicitis',
    canonicalName: 'appendicitis',
    specialty: 'General Surgery',
    bodySystem: 'Gastrointestinal',
    category: 'Surgical',
    lifecycleState: 'ACTIVE',
    onboardingState: 'COMPLETE',
    lifecycle: {
      active: true,
      playable: true,
      generatable: true,
      readiness: 'ready',
    },
    weaknesses: [],
    inventory: {
      caseCount: 1,
      playableCaseCount: 1,
      dailyInventoryCount: 0,
    },
    graph: {
      relationshipCount: 2,
      activeTeachingRelationshipCount: 1,
      mimicRelationshipCount: 1,
      pendingCandidateCount: 0,
    },
    teaching: {
      ruleCount: 1,
      activeRuleCount: 1,
      requiredDifferentialCount: 1,
      rulesWithoutRequiredDifferentials: 0,
      discriminatorRuleCount: 1,
    },
    differentials: {
      requiredDifferentialCoverage: 1,
      linkedDifferentialCount: 1,
      unresolvedMappings: 0,
      weakBreadth: false,
      oneWayRelationships: 0,
    },
    education: {
      status: 'APPROVED',
      completeness: 'complete',
      version: 1,
    },
    risk: {
      reviewBacklog: 0,
      duplicateRisk: 0,
      mergeRisk: 0,
    },
    evidenceGraph: {
      activeRelationshipCount: 2,
      discriminatorEvidenceCount: 1,
      evidenceDiversityCount: 2,
      weakDiversity: false,
    },
    evidenceCoverage: {
      coverageScore: 72,
      coverageBreakdown: {
        evidenceNodeCount: 3,
        activeReasoningPathCount: 2,
        reasoningPathGoalDiversity: 2,
        constrainedTeachingRuleCount: 1,
        constrainedEducationGenerationCount: 1,
        unconstrainedEducationGenerationCount: 0,
        lowTrustDraftCount: 0,
        blockedDraftCount: 0,
        hallucinationRiskDraftCount: 0,
        discriminatorEvidenceCount: 1,
        evidenceDiversityCount: 2,
        teachingRelationshipEvidenceCoverage: 1,
        caseEvidenceCoverage: 1,
        educationEvidenceCoverage: 1,
        ruleEvidenceCoverage: 1,
      },
      evidenceByType: {},
      missingEvidence: [],
      redundancy: {
        overusedEvidence: [],
        lowDiversity: false,
        repeatedDiscriminators: [],
        shallowReasoningPatterns: [],
      },
      generationReadiness: {
        caseGeneration: { score: 80, tier: 'ready', reasons: [] },
        teachingRuleGeneration: { score: 80, tier: 'ready', reasons: [] },
        discriminatorGeneration: { score: 80, tier: 'ready', reasons: [] },
        differentialGeneration: { score: 80, tier: 'ready', reasons: [] },
      },
      generationReadinessScore: 80,
      generationReadinessTier: 'ready',
      generationReadinessReasons: [],
      generationHooks: {
        suggestedEvidenceExpansion: false,
        suggestedDiscriminatorCoverage: false,
        suggestedReasoningPathCoverage: false,
        suggestedEducationalConstraintCoverage: false,
        suggestedDraftValidationReview: false,
        suggestedGenerationPrerequisites: [],
      },
      diagnosisRegistryId: 'dx-1',
      diagnosisName: 'Appendicitis',
      canonicalName: 'appendicitis',
      specialty: 'General Surgery',
      bodySystem: 'Gastrointestinal',
      category: 'Surgical',
      onboardingStatus: 'COMPLETE',
      lifecycle: {
        active: true,
        playable: true,
        generatable: true,
        status: 'READY',
      },
      coverageWeaknesses: [],
      targetUrl: '/editorial/diagnoses/dx-1',
    },
    recommendations: {
      recommendedTeachingRuleGeneration: false,
      recommendedDifferentialExpansion: false,
      recommendedGraphExpansion: false,
      recommendedTeachingRelationshipActivation: false,
      recommendedEvidenceGraphExpansion: false,
      recommendedCaseGeneration: false,
    },
    targetUrl: '/editorial/diagnoses/dx-1',
    ...overrides,
  } as WeakDiagnosis;
}

describe('editorial coverage queues', () => {
  it('assigns queue membership from real coverage payload fields', () => {
    const diagnosis = makeDiagnosis({
      weaknesses: ['missing_playable_cases', 'missing_required_differentials'],
      lifecycle: {
        active: true,
        playable: false,
        generatable: true,
        readiness: 'blocked',
      },
      risk: {
        reviewBacklog: 2,
        duplicateRisk: 0,
        mergeRisk: 0,
      },
      teaching: {
        ruleCount: 0,
        activeRuleCount: 0,
        requiredDifferentialCount: 0,
        rulesWithoutRequiredDifferentials: 0,
        discriminatorRuleCount: 0,
      },
      inventory: {
        caseCount: 0,
        playableCaseCount: 0,
        dailyInventoryCount: 0,
      },
      education: {
        status: null,
        completeness: 'missing',
        version: null,
      },
      evidenceCoverage: {
        coverageScore: 35,
        coverageBreakdown: {
          evidenceNodeCount: 1,
          activeReasoningPathCount: 0,
          reasoningPathGoalDiversity: 0,
          constrainedTeachingRuleCount: 0,
          constrainedEducationGenerationCount: 0,
          unconstrainedEducationGenerationCount: 1,
          lowTrustDraftCount: 1,
          blockedDraftCount: 1,
          hallucinationRiskDraftCount: 1,
          discriminatorEvidenceCount: 0,
          evidenceDiversityCount: 1,
          teachingRelationshipEvidenceCoverage: 0,
          caseEvidenceCoverage: 0,
          educationEvidenceCoverage: 0,
          ruleEvidenceCoverage: 0,
        },
        coverageWeaknesses: [],
        evidenceByType: {},
        missingEvidence: [],
        redundancy: {
          overusedEvidence: [],
          lowDiversity: true,
          repeatedDiscriminators: [],
          shallowReasoningPatterns: [],
        },
        generationReadiness: {
          caseGeneration: { score: 20, tier: 'weak', reasons: [] },
          teachingRuleGeneration: { score: 20, tier: 'weak', reasons: [] },
          discriminatorGeneration: { score: 20, tier: 'weak', reasons: [] },
          differentialGeneration: { score: 20, tier: 'weak', reasons: [] },
        },
        generationReadinessScore: 20,
        generationReadinessTier: 'weak',
        generationReadinessReasons: [],
        generationHooks: {
          suggestedEvidenceExpansion: true,
          suggestedDiscriminatorCoverage: true,
          suggestedReasoningPathCoverage: true,
          suggestedEducationalConstraintCoverage: true,
          suggestedDraftValidationReview: true,
          suggestedGenerationPrerequisites: ['Add escalation evidence'],
        },
        diagnosisRegistryId: 'dx-1',
        diagnosisName: 'Appendicitis',
        canonicalName: 'appendicitis',
        specialty: 'General Surgery',
        bodySystem: 'Gastrointestinal',
        category: 'Surgical',
        onboardingStatus: 'COMPLETE',
        lifecycle: {
          active: true,
          playable: false,
          generatable: true,
          status: 'DRAFT',
        },
        targetUrl: '/editorial/diagnoses/dx-1',
      },
    });

    assert.deepEqual(diagnosisQueueIds(diagnosis), [
      'needs_review',
      'high_publication_risk',
      'weak_discriminator_coverage',
      'unsupported_claims',
      'sparse_diagnosis',
      'draft_heavy',
      'escalation_coverage_gaps',
    ]);
  });

  it('prefers backend triage queues when present', () => {
    const diagnosis = makeDiagnosis({
      editorialTriage: {
        editorialPriority: { score: 70, tier: 'high', reasons: [] },
        publicationRisk: { score: 70, tier: 'high' },
        learnerRisk: { score: 20, tier: 'low' },
        reasoningRisk: { score: 30, tier: 'medium' },
        highestImpactFixes: [],
        workflowQueues: [
          {
            id: 'high_publication_risk',
            label: 'High publication risk',
            count: 2,
            severity: 'blocker',
          },
        ],
        queues: [],
      },
    });

    assert.deepEqual(diagnosisQueueIds(diagnosis), ['high_publication_risk']);
    assert.deepEqual(buildEditorialQueues([diagnosis]), [
      {
        id: 'high_publication_risk',
        label: 'High publication risk',
        tone: 'danger',
        description: 'Publication blockers or readiness failures.',
        count: 1,
      },
    ]);
  });

  it('builds only queues with matching diagnoses', () => {
    const queues = buildEditorialQueues([
      makeDiagnosis({
        risk: {
          reviewBacklog: 1,
          duplicateRisk: 0,
          mergeRisk: 0,
        },
      }),
      makeDiagnosis({
        weaknesses: ['missing_graph_coverage'],
      }),
    ]);

    assert.deepEqual(
      queues.map((queue) => [queue.id, queue.count]),
      [
        ['needs_review', 1],
        ['high_publication_risk', 1],
      ],
    );
  });

  it('sorts diagnoses by backend editorial priority when available', () => {
    const low = makeDiagnosis({
      diagnosisRegistryId: 'low',
      diagnosisName: 'Low priority',
      editorialTriage: {
        editorialPriority: { score: 20, tier: 'low', reasons: [] },
        publicationRisk: { score: 20, tier: 'low' },
        learnerRisk: { score: 20, tier: 'low' },
        reasoningRisk: { score: 20, tier: 'low' },
        highestImpactFixes: [],
        workflowQueues: [],
        queues: [],
      },
    });
    const high = makeDiagnosis({
      diagnosisRegistryId: 'high',
      diagnosisName: 'High priority',
      editorialTriage: {
        editorialPriority: { score: 90, tier: 'critical', reasons: [] },
        publicationRisk: { score: 90, tier: 'critical' },
        learnerRisk: { score: 60, tier: 'medium' },
        reasoningRisk: { score: 70, tier: 'high' },
        highestImpactFixes: [],
        workflowQueues: [],
        queues: [],
      },
    });
    const unscored = makeDiagnosis({
      diagnosisRegistryId: 'unscored',
      diagnosisName: 'Unscored',
    });

    assert.deepEqual(
      sortDiagnosesByEditorialPriority([low, unscored, high]).map(
        (diagnosis) => diagnosis.diagnosisRegistryId,
      ),
      ['high', 'low', 'unscored'],
    );
  });
});
