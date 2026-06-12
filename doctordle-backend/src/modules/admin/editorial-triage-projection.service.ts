import { Injectable } from '@nestjs/common';

export type EditorialTriageQueueId =
  | 'needs_review'
  | 'high_publication_risk'
  | 'weak_discriminator_coverage'
  | 'unsupported_claims'
  | 'sparse_diagnosis'
  | 'draft_heavy'
  | 'escalation_coverage_gaps';

export type EditorialTriageTier = 'low' | 'medium' | 'high' | 'critical';
export type EditorialTriageSeverity = 'info' | 'warning' | 'blocker';
export type EditorialTriageTargetTab =
  | 'overview'
  | 'teaching-rules'
  | 'editorial-brief'
  | 'education'
  | 'cases'
  | 'graph';

export type EditorialTriageProjectionInput = {
  workspaceBlockerCount?: number;
  coverageBlockerCount?: number;
  missingGraphGapCount?: number;
  unsupportedClaimCount?: number;
  unsupportedClaimBlockerCount?: number;
  escalationMissing?: boolean;
  totalDifferentials?: number;
  resolvedDifferentials?: number;
  discriminatorRuleCount?: number;
  totalCases?: number;
  usableCases?: number;
  playableCases?: number;
  evidenceCoverageScore?: number | null;
  lowTrustDraftCount?: number;
  blockedDraftCount?: number;
  hallucinationRiskDraftCount?: number;
  pendingDraftCount?: number;
  reviewBacklogCount?: number;
  maturityOverall?: number | null;
  lifecyclePlayable?: boolean;
  lifecycleActive?: boolean;
  hasEducation?: boolean;
  activeTeachingRuleCount?: number;
  graphRelationshipCount?: number;
};

export type EditorialTriageProjection = {
  editorialPriority: {
    score: number;
    tier: EditorialTriageTier;
    reasons: string[];
  };
  publicationRisk: {
    score: number;
    tier: EditorialTriageTier;
  };
  learnerRisk: {
    score: number;
    tier: EditorialTriageTier;
  };
  reasoningRisk: {
    score: number;
    tier: EditorialTriageTier;
  };
  workflowQueues: Array<{
    id: EditorialTriageQueueId;
    label: string;
    count: number;
    severity: EditorialTriageSeverity;
  }>;
  highestImpactFixes: Array<{
    id: string;
    label: string;
    reason: string;
    targetTab: EditorialTriageTargetTab;
    severity: EditorialTriageSeverity;
  }>;
  triageReasons: string[];
  recommendedNextAction: string;
  targetTab: EditorialTriageTargetTab;
  queues: EditorialTriageProjection['workflowQueues'];
};

@Injectable()
export class EditorialTriageProjectionService {
  project(input: EditorialTriageProjectionInput): EditorialTriageProjection {
    const unsupportedBlockers =
      input.unsupportedClaimBlockerCount ?? input.unsupportedClaimCount ?? 0;
    const unsupportedSignals =
      input.unsupportedClaimCount ??
      unsupportedBlockers +
        (input.hallucinationRiskDraftCount && input.hallucinationRiskDraftCount > 0
          ? input.hallucinationRiskDraftCount
          : 0);
    const blockerCount =
      (input.workspaceBlockerCount ?? 0) + (input.coverageBlockerCount ?? 0);
    const escalationMissing = input.escalationMissing === true;
    const totalDifferentials = input.totalDifferentials ?? 0;
    const resolvedDifferentials = input.resolvedDifferentials ?? 0;
    const unresolvedDifferentials = Math.max(
      0,
      totalDifferentials - resolvedDifferentials,
    );
    const weakDiscriminatorCoverage =
      unresolvedDifferentials > 0 ||
      (input.discriminatorRuleCount ?? 0) === 0 ||
      (input.missingGraphGapCount ?? 0) > 0;
    const totalCases = input.totalCases ?? 0;
    const usableCases = input.usableCases ?? input.playableCases ?? 0;
    const pendingDrafts =
      (input.pendingDraftCount ?? 0) + (input.reviewBacklogCount ?? 0);
    const lowTrustDrafts = input.lowTrustDraftCount ?? 0;
    const blockedDrafts = input.blockedDraftCount ?? 0;
    const hallucinationDrafts = input.hallucinationRiskDraftCount ?? 0;
    const sparseDiagnosis =
      totalCases === 0 ||
      (!input.hasEducation &&
        (input.activeTeachingRuleCount ?? 0) === 0 &&
        (input.graphRelationshipCount ?? 0) === 0);
    const maturityPenalty =
      typeof input.maturityOverall === 'number'
        ? Math.max(0, 1 - input.maturityOverall) * 20
        : 10;

    const publicationRisk = this.clampScore(
      blockerCount * 22 +
        unsupportedBlockers * 28 +
        (unsupportedSignals - unsupportedBlockers) * 12 +
        (escalationMissing ? 18 : 0) +
        (usableCases === 0 ? 16 : 0) +
        (input.lifecyclePlayable === false ? 14 : 0) +
        (input.lifecycleActive === false ? 10 : 0) +
        maturityPenalty,
    );
    const learnerRisk = this.clampScore(
      unsupportedBlockers * 24 +
        unresolvedDifferentials * 10 +
        (input.missingGraphGapCount ?? 0) * 8 +
        ((input.discriminatorRuleCount ?? 1) === 0 ? 16 : 0) +
        (escalationMissing ? 18 : 0) +
        (usableCases === 0 ? 12 : 0),
    );
    const reasoningRisk = this.clampScore(
      blockedDrafts * 22 +
        hallucinationDrafts * 18 +
        lowTrustDrafts * 8 +
        unsupportedBlockers * 18 +
        (input.evidenceCoverageScore === null ||
        input.evidenceCoverageScore === undefined
          ? 20
          : Math.max(0, 80 - input.evidenceCoverageScore)),
    );
    const editorialPriority = this.clampScore(
      publicationRisk * 0.45 + learnerRisk * 0.35 + reasoningRisk * 0.2,
    );

    const highestImpactFixes = [
      unsupportedSignals
        ? {
            id: 'repair_unsupported_claims',
            label: 'Repair unsupported claims',
            reason: `${unsupportedSignals} unsupported claim signal${unsupportedSignals === 1 ? '' : 's'} need editorial review.`,
            targetTab: 'education' as const,
            severity: unsupportedBlockers ? 'blocker' as const : 'warning' as const,
          }
        : null,
      escalationMissing
        ? {
            id: 'resolve_escalation_gap',
            label: 'Resolve escalation gap',
            reason:
              'Escalation teaching, evidence, or playable case coverage is incomplete.',
            targetTab: 'graph' as const,
            severity: 'blocker' as const,
          }
        : null,
      weakDiscriminatorCoverage
        ? {
            id: 'strengthen_differential_coverage',
            label: 'Strengthen differential quality',
            reason:
              unresolvedDifferentials > 0
                ? `${unresolvedDifferentials} required differential link${unresolvedDifferentials === 1 ? '' : 's'} still need support.`
                : 'Discriminator teaching or graph coverage is incomplete.',
            targetTab: 'graph' as const,
            severity: learnerRisk >= 60 ? 'blocker' as const : 'warning' as const,
          }
        : null,
      usableCases === 0
        ? {
            id: 'create_usable_case',
            label: 'Create usable case coverage',
            reason: 'No usable case currently supports this diagnosis.',
            targetTab: 'cases' as const,
            severity: 'warning' as const,
          }
        : null,
      pendingDrafts
        ? {
            id: 'review_ai_drafts',
            label: 'Review pending editorial work',
            reason: `${pendingDrafts} draft or review item${pendingDrafts === 1 ? '' : 's'} await an editor decision.`,
            targetTab: 'overview' as const,
            severity: 'warning' as const,
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    const workflowQueues = [
      pendingDrafts
        ? {
            id: 'needs_review' as const,
            label: 'Needs review',
            count: pendingDrafts,
            severity: 'warning' as const,
          }
        : null,
      publicationRisk >= 60
        ? {
            id: 'high_publication_risk' as const,
            label: 'High publication risk',
            count: Math.max(1, blockerCount + unsupportedSignals),
            severity: 'blocker' as const,
          }
        : null,
      weakDiscriminatorCoverage
        ? {
            id: 'weak_discriminator_coverage' as const,
            label: 'Weak discriminator coverage',
            count: Math.max(1, unresolvedDifferentials),
            severity: learnerRisk >= 60 ? 'blocker' as const : 'warning' as const,
          }
        : null,
      unsupportedSignals
        ? {
            id: 'unsupported_claims' as const,
            label: 'Unsupported claims',
            count: unsupportedSignals,
            severity: unsupportedBlockers ? 'blocker' as const : 'warning' as const,
          }
        : null,
      sparseDiagnosis
        ? {
            id: 'sparse_diagnosis' as const,
            label: 'Sparse diagnosis',
            count: 1,
            severity: 'warning' as const,
          }
        : null,
      pendingDrafts + lowTrustDrafts + blockedDrafts > 1
        ? {
            id: 'draft_heavy' as const,
            label: 'Draft-heavy diagnosis',
            count: pendingDrafts + lowTrustDrafts + blockedDrafts,
            severity: 'warning' as const,
          }
        : null,
      escalationMissing
        ? {
            id: 'escalation_coverage_gaps' as const,
            label: 'Escalation coverage gaps',
            count: 1,
            severity: 'blocker' as const,
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    const triageReasons = highestImpactFixes.length
      ? highestImpactFixes.map((fix) => fix.reason)
      : ['No high-impact editorial triage issue is currently reported.'];
    const nextFix = highestImpactFixes[0];

    return {
      editorialPriority: {
        score: editorialPriority,
        tier: this.priorityTier(editorialPriority),
        reasons: triageReasons,
      },
      publicationRisk: {
        score: publicationRisk,
        tier: this.priorityTier(publicationRisk),
      },
      learnerRisk: {
        score: learnerRisk,
        tier: this.priorityTier(learnerRisk),
      },
      reasoningRisk: {
        score: reasoningRisk,
        tier: this.priorityTier(reasoningRisk),
      },
      workflowQueues,
      highestImpactFixes,
      triageReasons,
      recommendedNextAction: nextFix?.label ?? 'Continue routine editorial review',
      targetTab: nextFix?.targetTab ?? 'overview',
      queues: workflowQueues,
    };
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private priorityTier(score: number): EditorialTriageTier {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }
}
