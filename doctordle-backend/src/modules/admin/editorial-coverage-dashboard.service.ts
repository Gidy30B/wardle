import { Injectable, Optional } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  DiagnosisRegistryCandidateStatus,
  DiagnosisRegistryStatus,
  DiagnosisTeachingRelationshipStatus,
  DiagnosisEvidenceRelationshipStatus,
  DiagnosisEvidenceRelationshipType,
  DifferentialResolutionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service';
import { EditorialReviewInboxService } from './editorial-review-inbox.service';
import { EvidenceCoverageService } from './evidence-coverage.service';
import { EditorialTriageProjectionService } from './editorial-triage-projection.service';
import { normalizeSpecialtyDisplayName } from '../diagnosis-registry/diagnosis-registry-specialty';

export type CoverageWeakness =
  | 'missing_teaching_rules'
  | 'weak_teaching_rules'
  | 'missing_required_differentials'
  | 'weak_differential_breadth'
  | 'unresolved_differentials'
  | 'missing_playable_cases'
  | 'missing_graph_coverage'
  | 'stalled_onboarding'
  | 'duplicate_risk'
  | 'merge_risk';

export type EditorialCoverageQuery = {
  specialty?: string;
  lifecycleState?: string;
  onboardingState?: string;
  coverageWeakness?: CoverageWeakness | string;
  playableOnly?: boolean;
};

const ACTIVE_RULE_STATUSES = new Set(['APPROVED', 'ACTIVE', 'PUBLISHED']);
const REVIEW_RULE_STATUSES = new Set(['CANDIDATE', 'NEEDS_REVIEW', 'DRAFT']);
const REVIEW_BRIEF_STATUSES = new Set(['DRAFT', 'NEEDS_REVIEW', 'INACTIVE']);
const UNRESOLVED_DIFFERENTIAL_STATUSES = [
  DifferentialResolutionStatus.UNRESOLVED,
  DifferentialResolutionStatus.AMBIGUOUS,
];
const REVIEW_CASE_STATUSES = [
  CaseEditorialStatus.REVIEW,
  CaseEditorialStatus.NEEDS_EDIT,
  CaseEditorialStatus.APPROVED,
  CaseEditorialStatus.READY_TO_PUBLISH,
];
const REVIEW_CANDIDATE_STATUSES = [
  DiagnosisRegistryCandidateStatus.CANDIDATE,
  DiagnosisRegistryCandidateStatus.NEEDS_REVIEW,
  DiagnosisRegistryCandidateStatus.APPROVED_PENDING_CREATE,
];
const STALLED_ONBOARDING_STATUSES = new Set<DiagnosisEditorialOnboardingStatus>([
  DiagnosisEditorialOnboardingStatus.NEW,
  DiagnosisEditorialOnboardingStatus.RULES_STARTED,
  DiagnosisEditorialOnboardingStatus.BRIEF_STARTED,
  DiagnosisEditorialOnboardingStatus.EDUCATION_STARTED,
  DiagnosisEditorialOnboardingStatus.CASE_STARTED,
  DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW,
]);

@Injectable()
export class EditorialCoverageDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caseEligibilityPolicy: CaseEligibilityPolicyService,
    private readonly editorialReviewInboxService: EditorialReviewInboxService,
    private readonly editorialTriageProjectionService: EditorialTriageProjectionService,
    @Optional()
    private readonly evidenceCoverageService?: EvidenceCoverageService,
  ) {}

  async getOverview(query: EditorialCoverageQuery = {}) {
    const [
      diagnoses,
      specialties,
      inventory,
      differentialCoverage,
      teachingCoverage,
      graphCoverage,
      evidenceGraphCoverage,
      evidenceCoverageOverview,
      reviewCoverage,
    ] = await Promise.all([
      this.getDiagnoses(query),
      this.getSpecialties(query),
      this.getInventoryCoverage(),
      this.getDifferentialCoverage(),
      this.getTeachingCoverage(),
      this.getGraphCoverage(),
      this.getEvidenceGraphCoverage(),
      this.evidenceCoverageService?.getOverview({
        specialty: query.specialty,
        playableOnly: query.playableOnly,
        onboardingStatus: query.onboardingState,
      }) ?? Promise.resolve(null),
      this.getReviewCoverage(query.specialty),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      filters: this.normalizeQuery(query),
      globalSummary: {
        diagnosisCount: diagnoses.length,
        playableDiagnoses: diagnoses.filter((item) => item.lifecycle.playable)
          .length,
        playableCases: inventory.playableCases,
        unresolvedDifferentials: differentialCoverage.unresolvedDifferentials,
        onboardingBacklog: reviewCoverage.inbox.byType.onboarding,
        graphBacklog: graphCoverage.graphCandidatesPendingReview,
        teachingRelationshipGaps:
          graphCoverage.graphFactsWithoutTeachingRelationships +
          graphCoverage.differentialLinksWithoutTeachingRelationships,
        evidenceCoverageGaps: evidenceGraphCoverage.evidenceCoverageGaps,
        inventoryDaysRemaining: inventory.scheduledDaysRemaining,
      },
      inventory,
      differentialCoverage,
      teachingCoverage,
      graphCoverage,
      evidenceGraphCoverage,
      evidenceCoverageReadiness: evidenceCoverageOverview?.summary ?? {
        diagnosisCount: 0,
        averageCoverageScore: 0,
        averageGenerationReadinessScore: 0,
        readyDiagnoses: 0,
        partialDiagnoses: 0,
        weakDiagnoses: 0,
        diagnosesLackingDiscriminatorEvidence: 0,
        diagnosesWithWeakEvidenceDiversity: 0,
        overusedEvidencePatterns: 0,
        missingEvidenceGaps: 0,
      },
      reviewCoverage,
      weakDiagnoses: diagnoses
        .filter((diagnosis) => diagnosis.weaknesses.length)
        .slice(0, 50),
      specialties,
      recommendations: {
        recommendedTeachingRuleGeneration: diagnoses.filter(
          (item) => item.recommendations.recommendedTeachingRuleGeneration,
        ).length,
        recommendedDifferentialExpansion: diagnoses.filter(
          (item) => item.recommendations.recommendedDifferentialExpansion,
        ).length,
        recommendedGraphExpansion: diagnoses.filter(
          (item) => item.recommendations.recommendedGraphExpansion,
        ).length,
        recommendedTeachingRelationshipActivation: diagnoses.filter(
          (item) =>
            item.recommendations.recommendedTeachingRelationshipActivation,
        ).length,
        recommendedEvidenceGraphExpansion: diagnoses.filter(
          (item) => item.recommendations.recommendedEvidenceGraphExpansion,
        ).length,
        recommendedCaseGeneration: diagnoses.filter(
          (item) => item.recommendations.recommendedCaseGeneration,
        ).length,
      },
    };
  }

  async getDiagnoses(query: EditorialCoverageQuery = {}) {
    const rows = await this.loadDiagnosisRows(query);
    const duplicateCounts = await this.loadDuplicateRiskCounts(rows);
    const reviewBacklog = await this.loadReviewBacklogCounts(rows);
    const oneWayGraphTargets = await this.loadOneWayGraphTargets();
    const unsupportedClaimsByDiagnosis =
      await this.loadUnsupportedClaimSummaries(rows);
    const evidenceCoverageRows = this.evidenceCoverageService
      ? await this.evidenceCoverageService.getDiagnoses({
          specialty: query.specialty,
          playableOnly: query.playableOnly,
          onboardingStatus: query.onboardingState,
        })
      : [];
    const evidenceCoverageByDiagnosis = new Map(
      evidenceCoverageRows.map((item) => [item.diagnosisRegistryId, item]),
    );

    const diagnoses = rows.map((row) => {
      const diagnosis = {
        ...this.toDiagnosisCoverage(row, {
          duplicateRisk: duplicateCounts.get(row.id) ?? 0,
          reviewBacklog: reviewBacklog.get(row.id) ?? 0,
          hasOneWayGraphTarget: oneWayGraphTargets.has(row.id),
        }),
        evidenceCoverage:
          evidenceCoverageByDiagnosis.get(row.id) ?? null,
        unsupportedClaims:
          unsupportedClaimsByDiagnosis.get(row.id) ??
          this.emptyUnsupportedClaimSummary(),
      };
      const editorialTriage = this.editorialTriageProjectionService.project({
        workspaceBlockerCount: diagnosis.weaknesses.filter((weakness) =>
          [
            'missing_playable_cases',
            'missing_graph_coverage',
            'unresolved_differentials',
          ].includes(weakness),
        ).length,
        missingGraphGapCount:
          diagnosis.graph.relationshipCount === 0 ||
          diagnosis.graph.mimicRelationshipCount === 0
            ? 1
            : 0,
        escalationMissing:
          diagnosis.evidenceCoverage?.coverageWeaknesses.includes(
            'weak_escalation_evidence',
          ) ?? false,
        unsupportedClaimCount: diagnosis.unsupportedClaims.unsupportedClaimCount,
        unsupportedClaimBlockerCount:
          diagnosis.unsupportedClaims.blockingUnsupportedClaimCount,
        totalDifferentials: Math.max(
          diagnosis.teaching.requiredDifferentialCount,
          diagnosis.differentials.linkedDifferentialCount,
        ),
        resolvedDifferentials: diagnosis.differentials.linkedDifferentialCount,
        discriminatorRuleCount: diagnosis.teaching.discriminatorRuleCount,
        totalCases: diagnosis.inventory.caseCount,
        playableCases: diagnosis.inventory.playableCaseCount,
        evidenceCoverageScore: diagnosis.evidenceCoverage?.coverageScore ?? null,
        lowTrustDraftCount:
          diagnosis.evidenceCoverage?.coverageBreakdown.lowTrustDraftCount ?? 0,
        blockedDraftCount:
          diagnosis.evidenceCoverage?.coverageBreakdown.blockedDraftCount ?? 0,
        hallucinationRiskDraftCount:
          diagnosis.evidenceCoverage?.coverageBreakdown
            .hallucinationRiskDraftCount ?? 0,
        reviewBacklogCount: diagnosis.risk.reviewBacklog,
        lifecyclePlayable: diagnosis.lifecycle.playable,
        lifecycleActive: diagnosis.lifecycle.active,
        hasEducation: diagnosis.education.version !== null,
        activeTeachingRuleCount: diagnosis.teaching.activeRuleCount,
        graphRelationshipCount: diagnosis.graph.relationshipCount,
      });

      return {
        ...diagnosis,
        editorialTriage,
        editorialPrioritization: editorialTriage,
      };
    });

    return diagnoses.filter((item) => this.matchesWeakness(item, query));
  }

  async getSpecialties(query: EditorialCoverageQuery = {}) {
    const diagnoses = await this.getDiagnoses(query);
    const bySpecialty = new Map<string, typeof diagnoses>();

    for (const diagnosis of diagnoses) {
      const specialty =
        normalizeSpecialtyDisplayName(diagnosis.specialty) ?? 'Unassigned';
      bySpecialty.set(specialty, [
        ...(bySpecialty.get(specialty) ?? []),
        diagnosis,
      ]);
    }

    return [...bySpecialty.entries()]
      .map(([specialty, items]) => {
        const diagnosisCount = items.length;
        const educationCovered = items.filter(
          (item) => item.education.completeness === 'complete',
        ).length;
        const graphCovered = items.filter(
          (item) => item.graph.relationshipCount > 0,
        ).length;
        return {
          specialty,
          diagnosisCount,
          playableDiagnosisCount: items.filter((item) => item.lifecycle.playable)
            .length,
          caseCount: items.reduce(
            (total, item) => total + item.inventory.caseCount,
            0,
          ),
          dailyInventoryCount: items.reduce(
            (total, item) => total + item.inventory.dailyInventoryCount,
            0,
          ),
          educationCoveragePercent: percent(educationCovered, diagnosisCount),
          graphCoveragePercent: percent(graphCovered, diagnosisCount),
          unresolvedDifferentialCount: items.reduce(
            (total, item) => total + item.differentials.unresolvedMappings,
            0,
          ),
          weakDiagnosisCount: items.filter((item) => item.weaknesses.length)
            .length,
        };
      })
      .sort((left, right) => right.diagnosisCount - left.diagnosisCount);
  }

  private async loadDiagnosisRows(query: EditorialCoverageQuery) {
    const normalized = this.normalizeQuery(query);
    return this.prisma.diagnosisRegistry.findMany({
      where: {
        ...(normalized.specialty ? { specialty: normalized.specialty } : {}),
        ...(normalized.lifecycleState
          ? { status: normalized.lifecycleState as DiagnosisRegistryStatus }
          : {}),
        ...(normalized.onboardingState
          ? {
              onboardingStatus:
                normalized.onboardingState as DiagnosisEditorialOnboardingStatus,
            }
          : {}),
        ...(normalized.playableOnly
          ? {
              status: DiagnosisRegistryStatus.ACTIVE,
              active: true,
              isPlayable: true,
            }
          : {}),
      },
      orderBy: [{ specialty: 'asc' }, { displayLabel: 'asc' }],
      select: {
        id: true,
        canonicalName: true,
        canonicalNormalized: true,
        displayLabel: true,
        status: true,
        active: true,
        isPlayable: true,
        isGeneratable: true,
        onboardingStatus: true,
        specialty: true,
        bodySystem: true,
        category: true,
        updatedAt: true,
        education: {
          select: {
            editorialStatus: true,
            publishedAt: true,
            version: true,
            differentials: true,
            examPearls: true,
            investigations: true,
            management: true,
            pitfalls: true,
          },
        },
        editorialBrief: { select: { status: true, version: true } },
        teachingRules: {
          select: {
            id: true,
            status: true,
            category: true,
            requiredDifferentials: true,
            appliesToGraph: true,
            appliesToCaseGeneration: true,
          },
        },
        cases: {
          select: {
            id: true,
            editorialStatus: true,
            diagnosisMappingStatus: true,
            clues: true,
            explanation: true,
            dailyCases: { select: { id: true } },
          },
        },
        graphFacts: {
          where: { status: DiagnosisGraphFactStatus.ACTIVE },
          select: {
            id: true,
            type: true,
            targetDiagnosisRegistryId: true,
          },
        },
        sourceTeachingRelationships: {
          where: { status: DiagnosisTeachingRelationshipStatus.ACTIVE },
          select: { id: true, targetDiagnosisRegistryId: true },
        },
        evidenceRelationships: {
          where: { status: DiagnosisEvidenceRelationshipStatus.ACTIVE },
          select: {
            id: true,
            evidenceNodeId: true,
            relationshipType: true,
            discriminatorWeight: true,
            evidenceNode: { select: { evidenceType: true, normalizedKey: true } },
          },
        },
        graphCandidates: {
          select: {
            id: true,
            type: true,
            status: true,
            targetDiagnosisRegistryId: true,
            unresolvedTargetText: true,
          },
        },
        caseDifferentialLinks: {
          select: { id: true, diagnosisRegistryId: true, role: true },
        },
        educationDifferentialLinks: {
          select: { id: true, diagnosisRegistryId: true, role: true },
        },
      },
    });
  }

  private async loadDuplicateRiskCounts(
    rows: Array<{ id: string; canonicalNormalized: string }>,
  ) {
    const counts = new Map<string, number>();

    await Promise.all(
      rows.map(async (row) => {
        const [aliasMatches, candidateMatches] = await Promise.all([
          this.prisma.diagnosisAlias.count({
            where: {
              diagnosisRegistryId: { not: row.id },
              normalizedTerm: row.canonicalNormalized,
              active: true,
            },
          }),
          this.prisma.diagnosisRegistryCandidate.count({
            where: {
              proposedCanonicalNormalized: row.canonicalNormalized,
              status: { in: REVIEW_CANDIDATE_STATUSES },
            },
          }),
        ]);
        counts.set(row.id, aliasMatches + candidateMatches);
      }),
    );

    return counts;
  }

  private async loadReviewBacklogCounts(rows: Array<{ id: string }>) {
    const counts = new Map<string, number>(rows.map((row) => [row.id, 0]));
    const [
      teachingRules,
      briefs,
      education,
      cases,
      graphCandidates,
      caseDifferentials,
      educationDifferentials,
      candidates,
    ] = await Promise.all([
      this.prisma.diagnosisTeachingRule.groupBy({
        by: ['diagnosisRegistryId'],
        where: { status: { in: [...REVIEW_RULE_STATUSES] } },
        _count: { _all: true },
      }),
      this.prisma.diagnosisEditorialBrief.groupBy({
        by: ['diagnosisRegistryId'],
        where: { status: { in: [...REVIEW_BRIEF_STATUSES] } },
        _count: { _all: true },
      }),
      this.prisma.diagnosisEducation.groupBy({
        by: ['diagnosisRegistryId'],
        where: {
          editorialStatus: {
            in: [
              DiagnosisEducationStatus.GENERATED,
              DiagnosisEducationStatus.NEEDS_REVIEW,
              DiagnosisEducationStatus.NEEDS_EDIT,
              DiagnosisEducationStatus.APPROVED,
            ],
          },
        },
        _count: { _all: true },
      }),
      this.prisma.case.groupBy({
        by: ['diagnosisRegistryId'],
        where: {
          diagnosisRegistryId: { not: null },
          editorialStatus: { in: REVIEW_CASE_STATUSES },
        },
        _count: { _all: true },
      }),
      this.prisma.diagnosisGraphCandidate.groupBy({
        by: ['diagnosisRegistryId'],
        where: { status: DiagnosisGraphCandidateStatus.CANDIDATE },
        _count: { _all: true },
      }),
      this.prisma.caseDifferentialMapping.groupBy({
        by: ['resolvedDiagnosisRegistryId'],
        where: { status: { in: UNRESOLVED_DIFFERENTIAL_STATUSES } },
        _count: { _all: true },
      }),
      this.prisma.educationDifferentialMapping.groupBy({
        by: ['diagnosisRegistryId'],
        where: { status: { in: UNRESOLVED_DIFFERENTIAL_STATUSES } },
        _count: { _all: true },
      }),
      this.prisma.diagnosisRegistryCandidate.groupBy({
        by: ['contextDiagnosisRegistryId'],
        where: { status: { in: REVIEW_CANDIDATE_STATUSES } },
        _count: { _all: true },
      }),
    ]);

    for (const group of [
      ...teachingRules,
      ...briefs,
      ...education,
      ...cases,
      ...graphCandidates,
      ...educationDifferentials,
    ]) {
      if (!group.diagnosisRegistryId) {
        continue;
      }
      counts.set(
        group.diagnosisRegistryId,
        (counts.get(group.diagnosisRegistryId) ?? 0) + group._count._all,
      );
    }

    for (const group of caseDifferentials) {
      if (group.resolvedDiagnosisRegistryId) {
        counts.set(
          group.resolvedDiagnosisRegistryId,
          (counts.get(group.resolvedDiagnosisRegistryId) ?? 0) +
            group._count._all,
        );
      }
    }

    for (const group of candidates) {
      if (group.contextDiagnosisRegistryId) {
        counts.set(
          group.contextDiagnosisRegistryId,
          (counts.get(group.contextDiagnosisRegistryId) ?? 0) +
            group._count._all,
        );
      }
    }

    return counts;
  }

  private async loadUnsupportedClaimSummaries(rows: Array<{ id: string }>) {
    const diagnosisIds = rows.map((row) => row.id);
    const summaries = new Map(
      diagnosisIds.map((id) => [id, this.emptyUnsupportedClaimSummary()]),
    );
    if (!diagnosisIds.length) {
      return summaries;
    }

    const runs = await this.prisma.reasoningDraftValidationRun.findMany({
      where: { diagnosisRegistryId: { in: diagnosisIds } },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        diagnosisRegistryId: true,
        artifactType: true,
        artifactId: true,
        trustTier: true,
        validationStatus: true,
        unsupportedClaimSignals: true,
        createdAt: true,
      },
    });

    const claimsByDiagnosis = new Map<
      string,
      Map<
        string,
        {
          claimId: string;
          sectionId: string;
          sectionType: string;
          claimText: string;
          severity: 'blocker' | 'warning';
          targetTab: 'education';
          repairable: boolean;
          blocksPublication: boolean;
          createdAt: string;
        }
      >
    >();

    for (const run of runs) {
      const diagnosisClaims =
        claimsByDiagnosis.get(run.diagnosisRegistryId) ?? new Map();
      for (const signal of this.asRecordArray(run.unsupportedClaimSignals)) {
        const claimText =
          this.stringValue(signal.message) ??
          this.stringValue(signal.claimText) ??
          this.stringValue(signal.code) ??
          'Unsupported claim requires review.';
        const sectionType =
          this.stringValue(signal.sectionType) ??
          this.sectionTypeFromArtifact(String(run.artifactType));
        const sectionId =
          this.stringValue(signal.sectionId) ??
          `${run.artifactType}:${run.artifactId}`;
        const claimId =
          this.stringValue(signal.claimId) ??
          this.stableKey(`${sectionId}:${claimText}`);
        const key = `${sectionId}:${claimId}`;
        if (diagnosisClaims.has(key)) {
          continue;
        }

        diagnosisClaims.set(key, {
          claimId,
          sectionId,
          sectionType,
          claimText,
          severity:
            run.trustTier === 'BLOCKED' || run.validationStatus === 'FAILED'
              ? 'blocker'
              : 'warning',
          targetTab: 'education',
          repairable:
            run.artifactType === 'EDUCATION_SECTION' ||
            run.artifactType === 'TEACHING_RULE',
          blocksPublication:
            run.trustTier === 'BLOCKED' || run.validationStatus === 'FAILED',
          createdAt: run.createdAt.toISOString(),
        });
      }
      claimsByDiagnosis.set(run.diagnosisRegistryId, diagnosisClaims);
    }

    for (const [diagnosisId, claims] of claimsByDiagnosis.entries()) {
      const values = [...claims.values()];
      const blockerCount = values.filter(
        (claim) => claim.severity === 'blocker',
      ).length;
      const warningCount = values.length - blockerCount;
      summaries.set(diagnosisId, {
        unsupportedClaimCount: values.length,
        blockingUnsupportedClaimCount: blockerCount,
        unsupportedClaimSeveritySummary: {
          blocker: blockerCount,
          warning: warningCount,
        },
        unsupportedClaimSectionTypes: [...new Set(values.map((claim) => claim.sectionType))],
        unsupportedClaimSignalsPreview: values.slice(0, 3).map((claim) => ({
          sectionType: claim.sectionType,
          sectionId: claim.sectionId,
          claimId: claim.claimId,
          claimText: claim.claimText,
          targetTab: claim.targetTab,
          repairable: claim.repairable,
          severity: claim.severity,
          blocksPublication: claim.blocksPublication,
          createdAt: claim.createdAt,
        })),
      });
    }

    return summaries;
  }

  private emptyUnsupportedClaimSummary() {
    return {
      unsupportedClaimCount: 0,
      blockingUnsupportedClaimCount: 0,
      unsupportedClaimSeveritySummary: {
        blocker: 0,
        warning: 0,
      },
      unsupportedClaimSectionTypes: [] as string[],
      unsupportedClaimSignalsPreview: [] as Array<{
        claimId: string;
        sectionId: string;
        sectionType: string;
        claimText: string;
        targetTab: 'education';
        repairable: boolean;
        severity: 'blocker' | 'warning';
        blocksPublication: boolean;
        createdAt: string;
      }>,
    };
  }

  private async loadOneWayGraphTargets() {
    const facts = await this.prisma.diagnosisGraphFact.findMany({
      where: {
        status: DiagnosisGraphFactStatus.ACTIVE,
        targetDiagnosisRegistryId: { not: null },
      },
      select: {
        diagnosisRegistryId: true,
        targetDiagnosisRegistryId: true,
        type: true,
      },
    });
    const keys = new Set(
      facts.map(
        (fact) =>
          `${fact.type}:${fact.diagnosisRegistryId}:${fact.targetDiagnosisRegistryId}`,
      ),
    );
    const oneWayTargets = new Set<string>();

    for (const fact of facts) {
      const reverseKey = `${fact.type}:${fact.targetDiagnosisRegistryId}:${fact.diagnosisRegistryId}`;
      if (fact.targetDiagnosisRegistryId && !keys.has(reverseKey)) {
        oneWayTargets.add(fact.diagnosisRegistryId);
      }
    }

    return oneWayTargets;
  }

  private toDiagnosisCoverage(
    row: Awaited<ReturnType<EditorialCoverageDashboardService['loadDiagnosisRows']>>[number],
    counts: {
      duplicateRisk: number;
      reviewBacklog: number;
      hasOneWayGraphTarget: boolean;
    },
  ) {
    const playableCases = row.cases.filter((caseRecord) =>
      this.isGameplayPlayableCase(caseRecord, row),
    );
    const requiredDifferentialCount = row.teachingRules.reduce(
      (total, rule) =>
        total + this.jsonArrayLength(rule.requiredDifferentials),
      0,
    );
    const linkedDifferentialIds = new Set([
      ...row.caseDifferentialLinks.map((link) => link.diagnosisRegistryId),
      ...row.educationDifferentialLinks.map((link) => link.diagnosisRegistryId),
    ]);
    const unresolvedMappings =
      row.cases.filter((caseRecord) => caseRecord.diagnosisMappingStatus !== 'MATCHED')
        .length +
      row.graphCandidates.filter((candidate) => candidate.unresolvedTargetText)
        .length;
    const activeTeachingRules = row.teachingRules.filter((rule) =>
      ACTIVE_RULE_STATUSES.has(rule.status),
    );
    const discriminatorRuleCount = activeTeachingRules.filter((rule) =>
      ['differential_concept', 'pitfall_concept'].includes(rule.category),
    ).length;
    const graphRelationshipCount = row.graphFacts.length;
    const activeTeachingRelationshipCount = row.sourceTeachingRelationships.length;
    const discriminatorEvidenceCount = row.evidenceRelationships.filter(
      (relationship) =>
        relationship.relationshipType ===
          DiagnosisEvidenceRelationshipType.DISCRIMINATES ||
        relationship.discriminatorWeight >= 3,
    ).length;
    const evidenceDiversityCount = new Set(
      row.evidenceRelationships.map(
        (relationship) => relationship.evidenceNode.normalizedKey,
      ),
    ).size;
    const mimicFactCount = row.graphFacts.filter(
      (fact) => fact.type === DiagnosisGraphCandidateType.MIMIC,
    ).length;
    const weaknesses = this.diagnosisWeaknesses({
      activeTeachingRuleCount: activeTeachingRules.length,
      requiredDifferentialCount,
      linkedDifferentialCount: linkedDifferentialIds.size,
      playableCaseCount: playableCases.length,
      graphRelationshipCount,
      unresolvedMappings,
      discriminatorRuleCount,
      onboardingStatus: row.onboardingStatus,
      duplicateRisk: counts.duplicateRisk,
      hasOneWayGraphTarget: counts.hasOneWayGraphTarget,
    });

    return {
      diagnosisRegistryId: row.id,
      diagnosisName: row.displayLabel || row.canonicalName,
      canonicalName: row.canonicalName,
      specialty: row.specialty,
      bodySystem: row.bodySystem,
      category: row.category,
      lifecycleState: row.status,
      onboardingState: row.onboardingStatus,
      lifecycle: {
        active: row.active,
        playable: this.caseEligibilityPolicy.isRegistryPlayable(row),
        generatable:
          row.active &&
          row.status === DiagnosisRegistryStatus.ACTIVE &&
          row.isPlayable &&
          row.isGeneratable,
        readiness:
          row.status === DiagnosisRegistryStatus.ACTIVE && row.active
            ? 'active'
            : row.status === DiagnosisRegistryStatus.DEPRECATED
              ? 'deprecated'
              : 'not_active',
      },
      teaching: {
        ruleCount: row.teachingRules.length,
        activeRuleCount: activeTeachingRules.length,
        requiredDifferentialCount,
        rulesWithoutRequiredDifferentials: row.teachingRules.filter(
          (rule) => this.jsonArrayLength(rule.requiredDifferentials) === 0,
        ).length,
        discriminatorRuleCount,
      },
      differentials: {
        requiredDifferentialCoverage: percent(
          Math.min(linkedDifferentialIds.size, requiredDifferentialCount),
          requiredDifferentialCount,
        ),
        linkedDifferentialCount: linkedDifferentialIds.size,
        unresolvedMappings,
        weakBreadth: linkedDifferentialIds.size < 3,
        oneWayRelationships: counts.hasOneWayGraphTarget ? 1 : 0,
      },
      education: {
        status: row.education?.editorialStatus ?? null,
        completeness: this.educationCompleteness(row.education),
        version: row.education?.version ?? null,
      },
      inventory: {
        caseCount: row.cases.length,
        playableCaseCount: playableCases.length,
        dailyInventoryCount: row.cases.reduce(
          (total, caseRecord) => total + caseRecord.dailyCases.length,
          0,
        ),
      },
      graph: {
        relationshipCount: graphRelationshipCount,
        activeTeachingRelationshipCount,
        mimicRelationshipCount: mimicFactCount,
        pendingCandidateCount: row.graphCandidates.filter(
          (candidate) =>
            candidate.status === DiagnosisGraphCandidateStatus.CANDIDATE,
        ).length,
      },
      evidenceGraph: {
        activeRelationshipCount: row.evidenceRelationships.length,
        discriminatorEvidenceCount,
        evidenceDiversityCount,
        weakDiversity: row.evidenceRelationships.length > 0 && evidenceDiversityCount < 3,
      },
      risk: {
        duplicateRisk: counts.duplicateRisk,
        mergeRisk:
          counts.duplicateRisk +
          (unresolvedMappings > 0 ? 1 : 0) +
          (counts.hasOneWayGraphTarget ? 1 : 0),
        reviewBacklog: counts.reviewBacklog,
      },
      weaknesses,
      recommendations: {
        recommendedTeachingRuleGeneration: activeTeachingRules.length < 3,
        recommendedDifferentialExpansion: linkedDifferentialIds.size < 3,
        recommendedGraphExpansion: graphRelationshipCount === 0 || mimicFactCount === 0,
        recommendedTeachingRelationshipActivation:
          graphRelationshipCount > 0 && activeTeachingRelationshipCount === 0,
        recommendedEvidenceGraphExpansion:
          discriminatorEvidenceCount === 0 || evidenceDiversityCount < 3,
        recommendedCaseGeneration: playableCases.length === 0,
      },
      targetUrl: `/editorial/diagnoses/${row.id}`,
    };
  }

  private async getInventoryCoverage() {
    const cases = await this.prisma.case.findMany({
      select: {
        id: true,
        editorialStatus: true,
        diagnosisMappingStatus: true,
        diagnosisRegistryId: true,
        clues: true,
        explanation: true,
        diagnosisRegistry: {
          select: { status: true, active: true, isPlayable: true },
        },
        dailyCases: { select: { id: true } },
      },
    });
    const scheduledDays = await this.prisma.dailyCase.groupBy({
      by: ['date'],
      _count: { _all: true },
    });
    const readyToPublishCases = cases.filter(
      (item) => item.editorialStatus === CaseEditorialStatus.READY_TO_PUBLISH,
    ).length;
    const approvedCases = cases.filter(
      (item) => item.editorialStatus === CaseEditorialStatus.APPROVED,
    ).length;
    const assignableCases = cases.filter((item) =>
      this.isPlayableCase(item, item.diagnosisRegistry),
    ).length;

    return {
      approvedCases,
      readyToPublishCases,
      playableCases: cases.filter((item) =>
        this.isGameplayPlayableCase(item, item.diagnosisRegistry),
      ).length,
      assignableCases,
      scheduledDaysRemaining: scheduledDays.length,
      inventoryExhaustionForecast: {
        scheduledDays: scheduledDays.length,
        assignableCases,
        estimatedExhaustionDays: scheduledDays.length + assignableCases,
      },
      diagnosesWithNoPlayableCases: await this.prisma.diagnosisRegistry.count({
        where: {
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          isPlayable: true,
          cases: {
            none: {
              editorialStatus: {
                in: [
                  CaseEditorialStatus.APPROVED,
                  CaseEditorialStatus.READY_TO_PUBLISH,
                  CaseEditorialStatus.PUBLISHED,
                ],
              },
            },
          },
        },
      }),
    };
  }

  private async getDifferentialCoverage() {
    const [
      unresolvedCase,
      unresolvedEducation,
      linkedCase,
      linkedEducation,
      orphanedCaseLinks,
      orphanedEducationLinks,
    ] = await Promise.all([
      this.prisma.caseDifferentialMapping.count({
        where: { status: { in: UNRESOLVED_DIFFERENTIAL_STATUSES } },
      }),
      this.prisma.educationDifferentialMapping.count({
        where: { status: { in: UNRESOLVED_DIFFERENTIAL_STATUSES } },
      }),
      this.prisma.caseDifferentialLink.groupBy({
        by: ['caseId'],
        _count: { _all: true },
      }),
      this.prisma.educationDifferentialLink.groupBy({
        by: ['educationId'],
        _count: { _all: true },
      }),
      this.prisma.caseDifferentialLink.count({ where: { sourceMappingId: null } }),
      this.prisma.educationDifferentialLink.count({
        where: { sourceMappingId: null },
      }),
    ]);

    return {
      unresolvedDifferentials: unresolvedCase + unresolvedEducation,
      ambiguousMappings:
        (await this.prisma.caseDifferentialMapping.count({
          where: { status: DifferentialResolutionStatus.AMBIGUOUS },
        })) +
        (await this.prisma.educationDifferentialMapping.count({
          where: { status: DifferentialResolutionStatus.AMBIGUOUS },
        })),
      diagnosesWithWeakDifferentialBreadth: [
        ...linkedCase,
        ...linkedEducation,
      ].filter((group) => group._count._all < 3).length,
      orphanedDifferentialLinks: orphanedCaseLinks + orphanedEducationLinks,
      oneWayDifferentialRelationships: (await this.loadOneWayGraphTargets()).size,
    };
  }

  private async getTeachingCoverage() {
    const diagnoses = await this.prisma.diagnosisRegistry.findMany({
      select: {
        id: true,
        teachingRules: {
          select: {
            id: true,
            category: true,
            requiredDifferentials: true,
            status: true,
          },
        },
      },
    });

    return {
      diagnosesMissingTeachingRules: diagnoses.filter(
        (diagnosis) => diagnosis.teachingRules.length === 0,
      ).length,
      weakTeachingRuleDensity: diagnoses.filter(
        (diagnosis) =>
          diagnosis.teachingRules.filter((rule) =>
            ACTIVE_RULE_STATUSES.has(rule.status),
          ).length < 3,
      ).length,
      rulesWithoutRequiredDifferentials: diagnoses.reduce(
        (total, diagnosis) =>
          total +
          diagnosis.teachingRules.filter(
            (rule) => this.jsonArrayLength(rule.requiredDifferentials) === 0,
          ).length,
        0,
      ),
      diagnosesLackingDiscriminatorTeaching: diagnoses.filter(
        (diagnosis) =>
          !diagnosis.teachingRules.some((rule) =>
            ['differential_concept', 'pitfall_concept'].includes(rule.category),
          ),
      ).length,
    };
  }

  private async getGraphCoverage() {
    const [
      diagnosisCount,
      factGroups,
      weakMimics,
      pendingCandidates,
      teachingRelationshipCoverage,
    ] = await Promise.all([
        this.prisma.diagnosisRegistry.count(),
        this.prisma.diagnosisGraphFact.groupBy({
          by: ['diagnosisRegistryId'],
          where: { status: DiagnosisGraphFactStatus.ACTIVE },
          _count: { _all: true },
        }),
        this.prisma.diagnosisRegistry.count({
          where: {
            graphFacts: {
              none: {
                status: DiagnosisGraphFactStatus.ACTIVE,
                type: DiagnosisGraphCandidateType.MIMIC,
              },
            },
          },
        }),
        this.prisma.diagnosisGraphCandidate.count({
          where: { status: DiagnosisGraphCandidateStatus.CANDIDATE },
        }),
        this.getTeachingRelationshipCoverage(),
      ]);
    const totalFacts = factGroups.reduce(
      (sum, group) => sum + group._count._all,
      0,
    );

    return {
      diagnosesWithoutGraphFacts: Math.max(0, diagnosisCount - factGroups.length),
      weakMimicRelationships: weakMimics,
      graphCandidatesPendingReview: pendingCandidates,
      graphRelationshipDensity: diagnosisCount ? round(totalFacts / diagnosisCount) : 0,
      ...teachingRelationshipCoverage,
    };
  }

  private async getEvidenceGraphCoverage() {
    const [activeRegistries, activeRelationships, discriminatorGroups, nodes] =
      await Promise.all([
        this.prisma.diagnosisRegistry.count({
          where: { status: DiagnosisRegistryStatus.ACTIVE, active: true },
        }),
        this.prisma.diagnosisEvidenceRelationship.findMany({
          where: { status: DiagnosisEvidenceRelationshipStatus.ACTIVE },
          select: {
            diagnosisRegistryId: true,
            evidenceNodeId: true,
            evidenceNode: { select: { normalizedKey: true } },
          },
        }),
        this.prisma.diagnosisEvidenceRelationship.groupBy({
          by: ['diagnosisRegistryId'],
          where: {
            status: DiagnosisEvidenceRelationshipStatus.ACTIVE,
            OR: [
              {
                relationshipType:
                  DiagnosisEvidenceRelationshipType.DISCRIMINATES,
              },
              { discriminatorWeight: { gte: 3 } },
            ],
          },
          _count: { _all: true },
        }),
        this.prisma.evidenceNode.count(),
      ]);
    const discriminatorDiagnosisIds = new Set(
      discriminatorGroups.map((group) => group.diagnosisRegistryId),
    );
    const evidenceByDiagnosis = new Map<string, Set<string>>();
    const patternCounts = new Map<string, number>();
    for (const relationship of activeRelationships) {
      evidenceByDiagnosis.set(relationship.diagnosisRegistryId, new Set([
        ...(evidenceByDiagnosis.get(relationship.diagnosisRegistryId) ?? []),
        relationship.evidenceNodeId,
      ]));
      const key = relationship.evidenceNode.normalizedKey;
      patternCounts.set(key, (patternCounts.get(key) ?? 0) + 1);
    }

    return {
      evidenceNodeCount: nodes,
      activeEvidenceRelationships: activeRelationships.length,
      diagnosesLackingDiscriminatorEvidence: Math.max(
        0,
        activeRegistries - discriminatorDiagnosisIds.size,
      ),
      weakEvidenceDiversity: [...evidenceByDiagnosis.values()].filter(
        (items) => items.size > 0 && items.size < 3,
      ).length,
      overusedEvidencePatterns: [...patternCounts.values()].filter(
        (count) => count >= 5,
      ).length,
      evidenceCoverageGaps: Math.max(0, activeRegistries - evidenceByDiagnosis.size),
    };
  }

  private async getTeachingRelationshipCoverage() {
    const [graphFacts, caseLinks, educationLinks, relationships] =
      await Promise.all([
        this.prisma.diagnosisGraphFact.findMany({
          where: {
            status: DiagnosisGraphFactStatus.ACTIVE,
            targetDiagnosisRegistryId: { not: null },
          },
          select: {
            diagnosisRegistryId: true,
            targetDiagnosisRegistryId: true,
          },
        }),
        this.prisma.caseDifferentialLink.findMany({
          select: {
            diagnosisRegistryId: true,
            case: { select: { diagnosisRegistryId: true } },
          },
        }),
        this.prisma.educationDifferentialLink.findMany({
          select: {
            diagnosisRegistryId: true,
            education: { select: { diagnosisRegistryId: true } },
          },
        }),
        this.prisma.diagnosisTeachingRelationship.findMany({
          where: { status: DiagnosisTeachingRelationshipStatus.ACTIVE },
          select: {
            sourceDiagnosisRegistryId: true,
            targetDiagnosisRegistryId: true,
          },
        }),
      ]);
    const activePairs = new Set(
      relationships.map((row) =>
        this.relationshipPairKey(
          row.sourceDiagnosisRegistryId,
          row.targetDiagnosisRegistryId,
        ),
      ),
    );
    const graphPairs = graphFacts
      .filter((fact) => fact.targetDiagnosisRegistryId)
      .map((fact) =>
        this.relationshipPairKey(
          fact.diagnosisRegistryId,
          fact.targetDiagnosisRegistryId!,
        ),
      );
    const differentialPairs = [
      ...caseLinks.map((link) => ({
        source: link.case.diagnosisRegistryId,
        target: link.diagnosisRegistryId,
      })),
      ...educationLinks.map((link) => ({
        source: link.education.diagnosisRegistryId,
        target: link.diagnosisRegistryId,
      })),
    ].filter((link) => link.source && link.source !== link.target);
    const graphSources = new Set(graphFacts.map((fact) => fact.diagnosisRegistryId));
    const relationshipSources = new Set(
      relationships.map((row) => row.sourceDiagnosisRegistryId),
    );

    return {
      activeTeachingRelationships: relationships.length,
      graphFactsWithoutTeachingRelationships: graphPairs.filter(
        (pair) => !activePairs.has(pair),
      ).length,
      differentialLinksWithoutTeachingRelationships: differentialPairs.filter(
        (pair) =>
          !activePairs.has(this.relationshipPairKey(pair.source!, pair.target)),
      ).length,
      diagnosesWithWeakTeachingGraphCoverage: [...graphSources].filter(
        (id) => !relationshipSources.has(id),
      ).length,
    };
  }

  private relationshipPairKey(sourceId: string, targetId: string) {
    return `${sourceId}:${targetId}`;
  }

  private async getReviewCoverage(specialty?: string) {
    const inbox = await this.editorialReviewInboxService.getInbox({
      specialty,
      limit: 1,
    });
    return {
      inbox: inbox.summary,
      stalledOnboarding: await this.prisma.diagnosisRegistry.count({
        where: {
          onboardingStatus: {
            in: [...STALLED_ONBOARDING_STATUSES],
          },
          ...(specialty ? { specialty } : {}),
        },
      }),
      reviewBacklogByType: inbox.summary.byType,
    };
  }

  private diagnosisWeaknesses(input: {
    activeTeachingRuleCount: number;
    requiredDifferentialCount: number;
    linkedDifferentialCount: number;
    playableCaseCount: number;
    graphRelationshipCount: number;
    unresolvedMappings: number;
    discriminatorRuleCount: number;
    onboardingStatus: DiagnosisEditorialOnboardingStatus | null;
    duplicateRisk: number;
    hasOneWayGraphTarget: boolean;
  }): CoverageWeakness[] {
    return [
      input.activeTeachingRuleCount === 0 ? 'missing_teaching_rules' : null,
      input.activeTeachingRuleCount > 0 && input.activeTeachingRuleCount < 3
        ? 'weak_teaching_rules'
        : null,
      input.requiredDifferentialCount === 0
        ? 'missing_required_differentials'
        : null,
      input.linkedDifferentialCount < 3 ? 'weak_differential_breadth' : null,
      input.unresolvedMappings > 0 ? 'unresolved_differentials' : null,
      input.playableCaseCount === 0 ? 'missing_playable_cases' : null,
      input.graphRelationshipCount === 0 ? 'missing_graph_coverage' : null,
      input.discriminatorRuleCount === 0 ? 'weak_teaching_rules' : null,
      input.onboardingStatus &&
      STALLED_ONBOARDING_STATUSES.has(input.onboardingStatus)
        ? 'stalled_onboarding'
        : null,
      input.duplicateRisk > 0 ? 'duplicate_risk' : null,
      input.hasOneWayGraphTarget ? 'merge_risk' : null,
    ].filter((item): item is CoverageWeakness => Boolean(item));
  }

  private isPlayableCase(
    caseRecord: {
      editorialStatus: CaseEditorialStatus | null;
      diagnosisMappingStatus: string | null;
      clues: Prisma.JsonValue | null;
      explanation: Prisma.JsonValue | null;
      diagnosisRegistryId?: string | null;
    },
    registry:
      | {
          status?: DiagnosisRegistryStatus | null;
          active?: boolean | null;
          isPlayable?: boolean | null;
        }
      | null
      | undefined,
  ) {
    return (
      this.caseEligibilityPolicy.isAssignableEditorialStatus(
        caseRecord.editorialStatus,
      ) &&
      this.hasPlayableCaseBasics(caseRecord, registry)
    );
  }

  private isGameplayPlayableCase(
    caseRecord: {
      editorialStatus: CaseEditorialStatus | null;
      diagnosisMappingStatus: string | null;
      clues: Prisma.JsonValue | null;
      explanation: Prisma.JsonValue | null;
      diagnosisRegistryId?: string | null;
    },
    registry:
      | {
          status?: DiagnosisRegistryStatus | null;
          active?: boolean | null;
          isPlayable?: boolean | null;
        }
      | null
      | undefined,
  ) {
    return (
      this.caseEligibilityPolicy.isGameplayEditorialStatus(
        caseRecord.editorialStatus,
      ) &&
      this.hasPlayableCaseBasics(caseRecord, registry)
    );
  }

  private hasPlayableCaseBasics(
    caseRecord: {
      diagnosisMappingStatus: string | null;
      clues: Prisma.JsonValue | null;
      explanation: Prisma.JsonValue | null;
      diagnosisRegistryId?: string | null;
    },
    registry:
      | {
          status?: DiagnosisRegistryStatus | null;
          active?: boolean | null;
          isPlayable?: boolean | null;
        }
      | null
      | undefined,
  ) {
    return (
      caseRecord.diagnosisMappingStatus === 'MATCHED' &&
      this.caseEligibilityPolicy.isRegistryPlayable(registry) &&
      this.caseEligibilityPolicy.validatePlayableClues(caseRecord.clues).valid &&
      caseRecord.explanation !== null &&
      caseRecord.explanation !== undefined
    );
  }

  private matchesWeakness(
    item: { weaknesses: CoverageWeakness[] },
    query: EditorialCoverageQuery,
  ) {
    return query.coverageWeakness
      ? item.weaknesses.includes(query.coverageWeakness as CoverageWeakness)
      : true;
  }

  private educationCompleteness(
    education:
      | {
          editorialStatus: DiagnosisEducationStatus;
          differentials: Prisma.JsonValue | null;
          examPearls: Prisma.JsonValue | null;
          investigations: Prisma.JsonValue | null;
          management: Prisma.JsonValue | null;
          pitfalls: Prisma.JsonValue | null;
        }
      | null,
  ) {
    if (!education) return 'missing';
    const filledSections = [
      education.differentials,
      education.examPearls,
      education.investigations,
      education.management,
      education.pitfalls,
    ].filter((value) => this.hasJsonContent(value)).length;

    if (
      filledSections >= 4 &&
      (education.editorialStatus === DiagnosisEducationStatus.APPROVED ||
        education.editorialStatus === DiagnosisEducationStatus.PUBLISHED)
    ) {
      return 'complete';
    }

    return filledSections >= 3 ? 'partial' : 'weak';
  }

  private normalizeQuery(query: EditorialCoverageQuery) {
    return {
      specialty: normalizeSpecialtyDisplayName(query.specialty) ?? undefined,
      lifecycleState: query.lifecycleState?.trim() || undefined,
      onboardingState: query.onboardingState?.trim() || undefined,
      coverageWeakness: query.coverageWeakness?.trim() || undefined,
      playableOnly: query.playableOnly === true,
    };
  }

  private jsonArrayLength(value: Prisma.JsonValue | null): number {
    return Array.isArray(value) ? value.length : 0;
  }

  private hasJsonContent(value: Prisma.JsonValue | null) {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return typeof value === 'string' && value.trim().length > 0;
  }

  private asRecordArray(
    value: Prisma.JsonValue | null | undefined,
  ): Array<Record<string, Prisma.JsonValue>> {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is Record<string, Prisma.JsonValue> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    );
  }

  private stringValue(value: Prisma.JsonValue | null | undefined) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private sectionTypeFromArtifact(artifactType: string) {
    if (artifactType.includes('EDUCATION')) return 'education';
    if (artifactType.includes('TEACHING')) return 'teaching_rule';
    if (artifactType.includes('CASE')) return 'case';
    return artifactType.toLowerCase();
  }

  private stableKey(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96);
  }
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
