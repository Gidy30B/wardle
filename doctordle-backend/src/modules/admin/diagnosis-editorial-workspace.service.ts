import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DifferentialResolutionStatus,
  DiagnosisRegistryCandidateStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  ValidationOutcome,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { DiagnosisGraphCandidatesService } from '../diagnosis-graph/diagnosis-graph-candidates.service';
import { DifferentialLinkService } from '../diagnosis-graph/differential-link.service';
import {
  EducationRevisionQualityAnalyzer,
  type EducationRevisionAnalysis,
} from '../education/education-revision-quality-analyzer.service';
import { CaseQualityProjectionService } from './case-quality-projection.service';
import {
  DiagnosisWorkspaceQualityService,
  type DiagnosisWorkspaceQualitySummary,
} from './diagnosis-workspace-quality.service';
import { TeachingRulesAdminService } from './teaching-rules-admin.service';
import {
  TeachingUnitCoverageService,
  type TeachingUnitCoverageMap,
} from './teaching-unit-coverage.service';
import { DiagnosisEditorialBriefService } from '../education/diagnosis-editorial-brief.service';
import { DiagnosisEditorialOnboardingService } from './diagnosis-editorial-onboarding.service';
import { DiagnosisRegistryLifecyclePolicyService } from '../diagnosis-registry/diagnosis-registry-lifecycle-policy.service';
import { EvidenceCoverageService } from './evidence-coverage.service';
import { ReasoningPathService } from './reasoning-path.service';

type LifecycleState = 'complete' | 'warning' | 'blocked' | 'not_started';
type ReadinessSeverity = 'info' | 'warning' | 'blocker';
type TargetTab =
  | 'overview'
  | 'teaching-rules'
  | 'editorial-brief'
  | 'education'
  | 'cases'
  | 'graph';

type CoverageStatus = 'covered' | 'partial' | 'missing' | 'unknown';

type ActionDescriptor = {
  id: string;
  label: string;
  source?: string;
  severity?: ReadinessSeverity;
  permission?: string;
  targetTab: TargetTab;
  enabled: boolean;
  disabledReason: string | null;
  targetEndpoint?: string;
};

type CaseRow = {
  id: string;
  title: string;
  difficulty: string;
  editorialStatus: CaseEditorialStatus | null;
  date: Date;
  explanation: Prisma.JsonValue | null;
  validationRuns: Array<{
    outcome: ValidationOutcome | null;
    summary: Prisma.JsonValue | null;
    findings: Prisma.JsonValue | null;
  }>;
};

type GraphFactRow = {
  id: string;
  type: DiagnosisGraphCandidateType;
  label: string;
  targetDiagnosisRegistryId: string | null;
  updatedAt: Date;
};

type RegistryRow = {
  id: string;
  canonicalName: string;
  displayLabel: string;
  onboardingStatus: string | null;
  onboardingStartedAt: Date | null;
  onboardingCompletedAt: Date | null;
  specialty: string | null;
  category: string | null;
  bodySystem: string | null;
  difficultyBand: string | null;
  aliases: Array<{ term: string }>;
  education: {
    id: string;
    editorialStatus: string;
    version: number;
    updatedAt: Date;
  } | null;
  editorialBrief: {
    id: string;
    status: string;
    version: number;
    summary: string;
    updatedAt: Date;
  } | null;
  cases: CaseRow[];
  graphFacts: GraphFactRow[];
};

@Injectable()
export class DiagnosisEditorialWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosisWorkspaceQualityService: DiagnosisWorkspaceQualityService,
    private readonly teachingUnitCoverageService: TeachingUnitCoverageService,
    private readonly teachingRulesAdminService: TeachingRulesAdminService,
    private readonly diagnosisEditorialBriefService: DiagnosisEditorialBriefService,
    private readonly educationRevisionQualityAnalyzer: EducationRevisionQualityAnalyzer,
    private readonly caseQualityProjectionService: CaseQualityProjectionService,
    private readonly diagnosisGraphCandidatesService: DiagnosisGraphCandidatesService,
    private readonly differentialLinkService?: DifferentialLinkService,
    @Optional()
    private readonly diagnosisEditorialOnboardingService?: DiagnosisEditorialOnboardingService,
    @Optional()
    private readonly diagnosisRegistryLifecyclePolicyService?: DiagnosisRegistryLifecyclePolicyService,
    @Optional()
    private readonly evidenceCoverageService?: EvidenceCoverageService,
    @Optional()
    private readonly reasoningPathService?: ReasoningPathService,
  ) {}

  async getFullWorkspace(diagnosisRegistryId: string) {
    const registry = await this.loadRegistry(diagnosisRegistryId);
    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const [
      summaryResult,
      coverageResult,
      rulesResult,
      briefResult,
      revisionsResult,
      graphCandidatesResult,
      differentialSummaryResult,
      differentialCoverageResult,
      linkedDifferentialsResult,
      teachingRelationshipsResult,
      evidenceGraphResult,
      registryCandidateCountsResult,
      onboardingResult,
      lifecycleGovernanceResult,
      evidenceCoverageResult,
      reasoningPathsResult,
    ] = await Promise.allSettled([
      this.diagnosisWorkspaceQualityService.getSummary(diagnosisRegistryId),
      this.teachingUnitCoverageService.getCoverage(diagnosisRegistryId),
      this.teachingRulesAdminService.listRules(diagnosisRegistryId),
      this.diagnosisEditorialBriefService.getBrief(diagnosisRegistryId),
      this.educationRevisionQualityAnalyzer.listRevisions(diagnosisRegistryId),
      this.diagnosisGraphCandidatesService.listCandidates({
        diagnosisRegistryId,
      }),
      this.getDifferentialResolutionSummary(diagnosisRegistryId),
      this.differentialLinkService?.getCoverageForDiagnosis(
        diagnosisRegistryId,
      ),
      this.differentialLinkService?.getLinkedDifferentialsForDiagnosis(
        diagnosisRegistryId,
      ),
      this.getTeachingRelationships(diagnosisRegistryId),
      this.getEvidenceGraph(diagnosisRegistryId),
      this.getRegistryCandidateCounts(diagnosisRegistryId),
      this.diagnosisEditorialOnboardingService?.getOnboarding(
        diagnosisRegistryId,
      ),
      this.diagnosisRegistryLifecyclePolicyService?.getLifecycle(
        diagnosisRegistryId,
      ),
      this.evidenceCoverageService?.getDiagnosis(diagnosisRegistryId),
      this.reasoningPathService?.listPaths({ diagnosisRegistryId }),
    ]);

    const compositionWarnings = this.compositionWarnings({
      summaryResult,
      coverageResult,
      rulesResult,
      briefResult,
      revisionsResult,
      graphCandidatesResult,
    });
    const summary = this.valueOrNull(summaryResult);
    const coverage = this.valueOrNull(coverageResult);
    const rules = this.valueOrNull(rulesResult) ?? {
      diagnosisRegistryId,
      diagnosisName: this.diagnosisName(registry),
      rules: [],
    };
    const briefResponse = this.valueOrNull(briefResult);
    const revisions = this.valueOrNull(revisionsResult)?.revisions ?? [];
    const graphCandidates = this.valueOrNull(graphCandidatesResult) ?? [];
    const differentialResolutionSummary =
      this.valueOrNull(differentialSummaryResult) ??
      this.emptyDifferentialResolutionSummary();
    const differentialCoverage =
      this.valueOrNull(differentialCoverageResult) ??
      this.emptyDifferentialCoverage();
    const linkedDifferentials =
      this.valueOrNull(linkedDifferentialsResult) ?? [];
    const teachingRelationships =
      this.valueOrNull(teachingRelationshipsResult) ?? [];
    const evidenceGraph =
      this.valueOrNull(evidenceGraphResult) ?? this.emptyEvidenceGraph();
    const registryCandidateCounts =
      this.valueOrNull(registryCandidateCountsResult) ??
      this.emptyRegistryCandidateCounts();
    const onboarding = this.valueOrNull(onboardingResult) ?? null;
    const lifecycleGovernance =
      this.valueOrNull(lifecycleGovernanceResult) ?? null;
    const evidenceCoverage = this.valueOrNull(evidenceCoverageResult) ?? null;
    const reasoningPaths = this.valueOrNull(reasoningPathsResult) ?? [];
    const cases = this.buildCases(registry.cases);
    const coverageMatrix = this.buildCoverageMatrix({
      coverage,
      rules: rules.rules,
    });
    const coverageGaps = this.buildCoverageGaps(coverageMatrix);
    const lifecycle = this.buildLifecycle({
      rules: rules.rules,
      summary,
      registry,
      coverageGaps,
    });
    const readinessBreakdown = this.buildReadinessBreakdown({
      summary,
      coverageGaps,
      compositionWarnings,
    });
    const recommendedActions = this.buildRecommendedActions({
      registry,
      summary,
      coverageGaps,
      graphCandidateCount: graphCandidates.length,
    });
    const availableActions = this.buildAvailableActions({
      registry,
      hasEducation: Boolean(registry.education),
    });

    return {
      diagnosis: {
        id: registry.id,
        displayLabel: registry.displayLabel,
        canonicalName: registry.canonicalName,
        aliases: registry.aliases.map((alias) => alias.term),
        specialty: registry.specialty,
        category: registry.category,
        bodySystem: registry.bodySystem,
        difficultyBand: registry.difficultyBand,
        onboardingStatus: registry.onboardingStatus,
        onboardingStartedAt: registry.onboardingStartedAt
          ? this.toIso(registry.onboardingStartedAt)
          : null,
        onboardingCompletedAt: registry.onboardingCompletedAt
          ? this.toIso(registry.onboardingCompletedAt)
          : null,
      },
      onboarding,
      onboardingStatus: onboarding?.onboardingStatus ?? registry.onboardingStatus,
      onboardingProgress: onboarding?.progress ?? null,
      onboardingRecommendations: onboarding?.recommendedActions ?? [],
      lifecycle,
      lifecycleGovernance,
      workspaceSummary: {
        status:
          summary?.overallWorkspaceStatus ??
          (lifecycle.ready === 'complete' ? 'ready' : 'needs_review'),
        overallScore: summary?.teachingCoverage.overall ?? null,
        graphReadiness: summary?.educationQuality.graphReadiness ?? null,
        educationScore: summary?.educationQuality.score ?? null,
        caseQualitySummary: summary?.caseQuality ?? cases.summary,
        blockers: summary?.blockers ?? [],
        warnings: this.unique([
          ...(summary?.warnings ?? []),
          ...compositionWarnings,
        ]),
        recommendedActions: summary?.recommendedNextActions ?? [],
        unresolvedDifferentialCount:
          differentialResolutionSummary.unresolved +
          differentialResolutionSummary.ambiguous,
        registryCandidateCount: registryCandidateCounts.registryCandidateCount,
        pendingRegistryCandidateCount:
          registryCandidateCounts.pendingRegistryCandidateCount,
        differentialResolutionSummary,
        differentialCoverage,
      },
      readinessBreakdown,
      coverageMatrix,
      coverageGaps,
      teachingRules: {
        summary: this.teachingRuleSummary(rules.rules),
        items: rules.rules,
      },
      editorialBrief: this.buildEditorialBrief(
        briefResponse?.brief ?? registry.editorialBrief,
      ),
      education: this.buildEducation(registry.education, summary, revisions[0]),
      revisions: {
        latest: revisions[0] ?? null,
        items: revisions,
      },
      cases,
      graph: {
        readiness:
          summary?.graphReadiness.status ??
          this.graphReadinessFromRegistry(registry),
        factCount:
          summary?.graphReadiness.factCount ?? registry.graphFacts.length,
        candidateCount:
          summary?.graphReadiness.candidateCount ?? graphCandidates.length,
        reviewableCandidateCount:
          summary?.graphReadiness.reviewableCandidateCount ??
          graphCandidates.filter((candidate) =>
            this.isReviewableCandidateStatus(String(candidate.status)),
          ).length,
        candidates: graphCandidates,
        factsSummary: this.graphFactsSummary(registry.graphFacts),
        teachingRelationships,
      },
      evidenceGraph,
      evidenceCoverage,
      reasoningPaths,
      linkedDifferentials,
      editorialLearning: {
        available: revisions.length >= 2,
        candidateCounts: {
          teachingRuleCandidates: rules.rules.filter(
            (rule) => rule.status === 'CANDIDATE',
          ).length,
          graphFactCandidates: graphCandidates.filter((candidate) =>
            this.isReviewableCandidateStatus(String(candidate.status)),
          ).length,
          patternImprovementCandidates: 0,
          diagnosisSpecificPearlCandidates: 0,
        },
        recentThemes: this.recentLearningThemes(revisions),
      },
      recommendedActions,
      availableActions,
    };
  }

  async loadRegistry(diagnosisRegistryId: string): Promise<RegistryRow | null> {
    return this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        displayLabel: true,
        onboardingStatus: true,
        onboardingStartedAt: true,
        onboardingCompletedAt: true,
        specialty: true,
        category: true,
        bodySystem: true,
        difficultyBand: true,
        aliases: {
          where: { active: true },
          select: { term: true },
          orderBy: { term: 'asc' },
        },
        education: {
          select: {
            id: true,
            editorialStatus: true,
            version: true,
            updatedAt: true,
          },
        },
        editorialBrief: {
          select: {
            id: true,
            status: true,
            version: true,
            summary: true,
            updatedAt: true,
          },
        },
        cases: {
          orderBy: [{ date: 'desc' }],
          take: 50,
          select: {
            id: true,
            title: true,
            difficulty: true,
            editorialStatus: true,
            date: true,
            explanation: true,
            validationRuns: {
              orderBy: [{ startedAt: 'desc' }],
              take: 1,
              select: {
                outcome: true,
                summary: true,
                findings: true,
              },
            },
          },
        },
        graphFacts: {
          where: { status: DiagnosisGraphFactStatus.ACTIVE },
          orderBy: [{ type: 'asc' }, { label: 'asc' }],
          select: {
            id: true,
            type: true,
            label: true,
            targetDiagnosisRegistryId: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  private async getTeachingRelationships(diagnosisRegistryId: string) {
    return this.prisma.diagnosisTeachingRelationship.findMany({
      where: {
        OR: [
          { sourceDiagnosisRegistryId: diagnosisRegistryId },
          { targetDiagnosisRegistryId: diagnosisRegistryId },
        ],
      },
      include: {
        sourceDiagnosisRegistry: {
          select: { id: true, displayLabel: true, canonicalName: true },
        },
        targetDiagnosisRegistry: {
          select: { id: true, displayLabel: true, canonicalName: true },
        },
        supportingGraphFact: {
          select: { id: true, type: true, label: true, status: true },
        },
        supportingTeachingRule: {
          select: { id: true, stableKey: true, title: true, status: true },
        },
      },
      orderBy: [
        {
          status: 'asc',
        },
        { updatedAt: 'desc' },
      ],
      take: 100,
    });
  }

  private async getEvidenceGraph(diagnosisRegistryId: string) {
    const relationships =
      await this.prisma.diagnosisEvidenceRelationship.findMany({
        where: { diagnosisRegistryId },
        include: {
          evidenceNode: true,
          supportingTeachingRelationship: {
            select: {
              id: true,
              relationshipType: true,
              teachingPurpose: true,
              status: true,
            },
          },
          supportingTeachingRule: {
            select: { id: true, stableKey: true, title: true, status: true },
          },
          supportingCase: {
            select: { id: true, title: true, editorialStatus: true },
          },
        },
        orderBy: [
          { status: 'asc' },
          { discriminatorWeight: 'desc' },
          { strength: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: 150,
      });
    const active = relationships.filter(
      (relationship) => relationship.status === 'ACTIVE',
    );

    return {
      summary: {
        total: relationships.length,
        active: active.length,
        discriminatorEvidence: relationships.filter(
          (relationship) =>
            relationship.relationshipType === 'DISCRIMINATES' ||
            relationship.discriminatorWeight >= 3,
        ).length,
        weakEvidenceCoverage: active.filter(
          (relationship) => relationship.strength <= 1,
        ).length,
        byType: relationships.reduce<Record<string, number>>(
          (acc, relationship) => {
            const type = relationship.evidenceNode.evidenceType;
            acc[type] = (acc[type] ?? 0) + 1;
            return acc;
          },
          {},
        ),
      },
      relationships,
    };
  }

  private emptyEvidenceGraph() {
    return {
      summary: {
        total: 0,
        active: 0,
        discriminatorEvidence: 0,
        weakEvidenceCoverage: 0,
        byType: {},
      },
      relationships: [],
    };
  }

  private async getDifferentialResolutionSummary(diagnosisRegistryId: string) {
    const [caseRows, educationRows] = await Promise.all([
      this.prisma.caseDifferentialMapping.groupBy({
        by: ['status'],
        where: {
          case: { diagnosisRegistryId },
        },
        _count: { _all: true },
      }),
      this.prisma.educationDifferentialMapping.groupBy({
        by: ['status'],
        where: { diagnosisRegistryId },
        _count: { _all: true },
      }),
    ]);
    const summary = this.emptyDifferentialResolutionSummary();

    for (const row of [...caseRows, ...educationRows]) {
      const count = row._count._all;
      if (row.status === DifferentialResolutionStatus.RESOLVED) {
        summary.resolved += count;
      } else if (row.status === DifferentialResolutionStatus.AMBIGUOUS) {
        summary.ambiguous += count;
      } else if (row.status === DifferentialResolutionStatus.UNRESOLVED) {
        summary.unresolved += count;
      } else if (row.status === DifferentialResolutionStatus.REJECTED) {
        summary.rejected += count;
      }
    }

    return summary;
  }

  private async getRegistryCandidateCounts(diagnosisRegistryId: string) {
    const [registryCandidateCount, pendingRegistryCandidateCount] =
      await Promise.all([
        this.prisma.diagnosisRegistryCandidate.count({
          where: { contextDiagnosisRegistryId: diagnosisRegistryId },
        }),
        this.prisma.diagnosisRegistryCandidate.count({
          where: {
            contextDiagnosisRegistryId: diagnosisRegistryId,
            status: {
              in: [
                DiagnosisRegistryCandidateStatus.CANDIDATE,
                DiagnosisRegistryCandidateStatus.NEEDS_REVIEW,
                DiagnosisRegistryCandidateStatus.APPROVED_PENDING_CREATE,
              ],
            },
          },
        }),
      ]);

    return {
      registryCandidateCount,
      pendingRegistryCandidateCount,
    };
  }

  private emptyDifferentialResolutionSummary() {
    return {
      resolved: 0,
      ambiguous: 0,
      unresolved: 0,
      rejected: 0,
    };
  }

  private emptyDifferentialCoverage() {
    return {
      totalDifferentials: 0,
      resolvedLinks: 0,
      unresolvedMappings: 0,
    };
  }

  private emptyRegistryCandidateCounts() {
    return {
      registryCandidateCount: 0,
      pendingRegistryCandidateCount: 0,
    };
  }

  private buildCases(cases: CaseRow[]) {
    const items = cases.map((caseRecord) => {
      const qualityProjection =
        this.caseQualityProjectionService.buildProjection(caseRecord);
      return {
        id: caseRecord.id,
        title: caseRecord.title,
        editorialStatus: caseRecord.editorialStatus,
        difficulty: caseRecord.difficulty,
        updatedAt: this.toIso(caseRecord.date),
        qualityProjection,
      };
    });
    const usableCases = cases.filter((caseRecord) =>
      this.isUsableCaseStatus(caseRecord.editorialStatus),
    );
    const latest = items[0] ?? null;

    return {
      summary: {
        total: cases.length,
        usable: usableCases.length,
        byStatus: this.countBy(
          cases.map((caseRecord) => caseRecord.editorialStatus),
        ),
        warningCount: items.reduce(
          (count, item) => count + item.qualityProjection.warnings.length,
          0,
        ),
        blockerCount: items.reduce(
          (count, item) => count + item.qualityProjection.blockers.length,
          0,
        ),
        latest: latest
          ? {
              id: latest.id,
              title: latest.title,
              editorialStatus: latest.editorialStatus,
              difficulty: latest.difficulty,
              updatedAt: latest.updatedAt,
            }
          : null,
      },
      items,
    };
  }

  private buildCoverageMatrix(input: {
    coverage: TeachingUnitCoverageMap | null;
    rules: Array<{
      id: string;
      stableKey: string;
      title: string;
      category: string;
      importance: string;
      status: string;
    }>;
  }) {
    const ruleByStableKey = new Map(
      input.rules.map((rule) => [rule.stableKey, rule]),
    );

    return (input.coverage?.teachingUnits ?? []).map((unit) => {
      const rule = ruleByStableKey.get(unit.id);
      return {
        teachingRuleId: rule?.id ?? null,
        stableKey: unit.id,
        title: rule?.title ?? unit.title,
        category: rule?.category ?? 'legacy_teaching_rule',
        importance: rule?.importance ?? 'supporting',
        ruleStatus:
          rule?.status ??
          (unit.source === 'legacy_teaching_rules' ? 'LEGACY' : 'UNKNOWN'),
        educationCoverage: unit.educationCoverage,
        caseCoverage: unit.caseCoverage.status,
        graphCoverage: unit.graphCoverage,
        fullCoverageStatus: unit.status,
        recommendedAction: unit.recommendedAction,
      };
    });
  }

  private buildCoverageGaps(
    matrix: ReturnType<
      DiagnosisEditorialWorkspaceService['buildCoverageMatrix']
    >,
  ) {
    return matrix
      .filter(
        (row) =>
          this.isGap(row.educationCoverage) ||
          this.isGap(row.caseCoverage) ||
          this.isGap(row.graphCoverage),
      )
      .map((row) => ({
        teachingRuleId: row.teachingRuleId,
        title: row.title,
        missingEducation: this.isGap(row.educationCoverage),
        missingCases: this.isGap(row.caseCoverage),
        missingGraph: this.isGap(row.graphCoverage),
        severity: (row.importance === 'critical' &&
        (this.isGap(row.educationCoverage) || this.isGap(row.caseCoverage))
          ? 'blocker'
          : 'warning') as ReadinessSeverity,
        recommendedAction: row.recommendedAction,
        targetTab: this.targetTabForCoverage(row),
      }));
  }

  private buildLifecycle(input: {
    rules: Array<{ status: string; importance: string }>;
    summary: DiagnosisWorkspaceQualitySummary | null;
    registry: RegistryRow;
    coverageGaps: ReturnType<
      DiagnosisEditorialWorkspaceService['buildCoverageGaps']
    >;
  }): Record<string, LifecycleState> {
    const activeRules = input.rules.filter((rule) =>
      ['ACTIVE', 'APPROVED'].includes(rule.status),
    );
    const pendingRules = input.rules.filter((rule) =>
      ['CANDIDATE', 'NEEDS_REVIEW'].includes(rule.status),
    );
    const briefStatus =
      input.summary?.editorialBrief.status ??
      input.registry.editorialBrief?.status ??
      null;
    const educationBlockers =
      input.summary?.educationQuality.blockerCount ??
      input.summary?.blockers.filter((blocker) =>
        blocker.startsWith('education:'),
      ).length ??
      0;
    const criticalCoverageBlockers = input.coverageGaps.some(
      (gap) => gap.severity === 'blocker',
    );

    const lifecycle: Record<string, LifecycleState> = {
      curriculum: activeRules.length
        ? pendingRules.length
          ? 'warning'
          : 'complete'
        : input.rules.length
          ? 'warning'
          : 'not_started',
      brief: !briefStatus
        ? 'not_started'
        : ['APPROVED', 'ACTIVE'].includes(briefStatus)
          ? 'complete'
          : 'warning',
      education: !input.registry.education
        ? 'not_started'
        : educationBlockers
          ? 'blocked'
          : input.summary?.educationQuality.status === 'published' &&
              !input.summary.educationQuality.warningCount
            ? 'complete'
            : 'warning',
      cases: input.summary
        ? this.lifecycleFromCaseStatus(input.summary.caseQuality.status)
        : input.registry.cases.length
          ? 'warning'
          : 'not_started',
      graph: input.summary
        ? this.lifecycleFromGraphStatus(input.summary.graphReadiness.status)
        : this.lifecycleFromGraphStatus(
            this.graphReadinessFromRegistry(input.registry),
          ),
      ready: 'warning',
    };

    lifecycle.ready =
      lifecycle.curriculum === 'complete' &&
      lifecycle.brief === 'complete' &&
      lifecycle.education === 'complete' &&
      lifecycle.cases === 'complete' &&
      lifecycle.graph === 'complete' &&
      !criticalCoverageBlockers &&
      !input.summary?.blockers.length
        ? 'complete'
        : input.summary?.blockers.length || criticalCoverageBlockers
          ? 'blocked'
          : 'warning';

    return lifecycle;
  }

  private buildReadinessBreakdown(input: {
    summary: DiagnosisWorkspaceQualitySummary | null;
    coverageGaps: ReturnType<
      DiagnosisEditorialWorkspaceService['buildCoverageGaps']
    >;
    compositionWarnings: string[];
  }) {
    return [
      ...(input.summary?.blockers.map((message) => ({
        severity: 'blocker' as const,
        source: 'workspace_quality',
        message,
        actionId: 'review-workspace-blocker',
        targetTab: this.targetTabFromMessage(message),
      })) ?? []),
      ...(input.summary?.warnings.map((message) => ({
        severity: 'warning' as const,
        source: 'workspace_quality',
        message,
        actionId: 'review-workspace-warning',
        targetTab: this.targetTabFromMessage(message),
      })) ?? []),
      ...input.coverageGaps.slice(0, 12).map((gap) => ({
        severity: gap.severity,
        source: 'coverage',
        message: `${gap.title}: ${gap.recommendedAction}`,
        actionId: 'resolve-coverage-gap',
        targetTab: gap.targetTab,
      })),
      ...input.compositionWarnings.map((message) => ({
        severity: 'warning' as const,
        source: 'workspace_read_model',
        message,
        actionId: 'retry-workspace-read',
        targetTab: 'overview' as const,
      })),
    ];
  }

  private buildRecommendedActions(input: {
    registry: RegistryRow;
    summary: DiagnosisWorkspaceQualitySummary | null;
    coverageGaps: ReturnType<
      DiagnosisEditorialWorkspaceService['buildCoverageGaps']
    >;
    graphCandidateCount: number;
  }): ActionDescriptor[] {
    const endpointBase = `/api/admin/diagnosis-workspace/${input.registry.id}`;
    const actions: ActionDescriptor[] = [];

    if (!input.registry.education) {
      actions.push({
        id: 'generate-education',
        label: 'Generate education draft',
        source: 'education',
        severity: 'warning',
        targetTab: 'education',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `/api/admin/education/diagnoses/${input.registry.id}/generate`,
      });
    }

    const caseGap = input.coverageGaps.find((gap) => gap.missingCases);
    if (caseGap) {
      actions.push({
        id: 'generate-targeted-case',
        label: 'Generate aligned case',
        source: 'coverage',
        severity: caseGap.severity,
        targetTab: 'cases',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `${endpointBase}/generate-case`,
      });
    }

    if (
      input.summary?.graphReadiness.status === 'review_needed' ||
      input.graphCandidateCount > 0
    ) {
      actions.push({
        id: 'review-graph-candidates',
        label: 'Review graph candidates',
        source: 'graph',
        severity: 'warning',
        targetTab: 'graph',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `/api/admin/diagnosis-graph/candidates?diagnosisRegistryId=${input.registry.id}`,
      });
    }

    return this.uniqueActions([
      ...actions,
      ...(input.summary?.recommendedNextActions.map((label, index) => ({
        id: `workspace-next-${index + 1}`,
        label,
        source: 'workspace_quality',
        severity: 'warning' as const,
        targetTab: this.targetTabFromMessage(label),
        enabled: true,
        disabledReason: null,
      })) ?? []),
    ]).slice(0, 10);
  }

  private buildAvailableActions(input: {
    registry: RegistryRow;
    hasEducation: boolean;
  }): ActionDescriptor[] {
    const endpointBase = `/api/admin/diagnosis-workspace/${input.registry.id}`;
    return [
      {
        id: 'generate-teaching-rule-candidates',
        label: 'Generate teaching rule candidates',
        permission: 'editor',
        targetTab: 'teaching-rules',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `${endpointBase}/teaching-rules/generate`,
      },
      {
        id: 'seed-legacy-teaching-rules',
        label: 'Seed legacy teaching rules',
        permission: 'editor',
        targetTab: 'teaching-rules',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `${endpointBase}/teaching-rules/seed-legacy`,
      },
      {
        id: 'generate-editorial-brief',
        label: 'Generate editorial brief',
        permission: 'editor',
        targetTab: 'editorial-brief',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `${endpointBase}/editorial-brief/generate`,
      },
      {
        id: 'generate-education',
        label: 'Generate education draft',
        permission: 'editor',
        targetTab: 'education',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `/api/admin/education/diagnoses/${input.registry.id}/generate`,
      },
      {
        id: 'regenerate-education-section',
        label: 'Regenerate education section',
        permission: 'editor',
        targetTab: 'education',
        enabled: input.hasEducation,
        disabledReason: input.hasEducation
          ? null
          : 'Create an education draft before regenerating sections.',
        targetEndpoint: `/api/admin/education/diagnoses/${input.registry.id}/regenerate-section`,
      },
      {
        id: 'generate-targeted-case',
        label: 'Generate targeted case',
        permission: 'editor',
        targetTab: 'cases',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `${endpointBase}/generate-case`,
      },
    ];
  }

  private buildEditorialBrief(
    brief: {
      status: string;
      version: number;
      summary: string;
      updatedAt: Date | string;
    } | null,
  ) {
    return {
      status: brief?.status ?? null,
      version: brief?.version ?? null,
      activeForGeneration:
        brief?.status === 'APPROVED' || brief?.status === 'ACTIVE',
      summary: brief?.summary ?? null,
      updatedAt: brief ? this.toIso(brief.updatedAt) : null,
    };
  }

  private buildEducation(
    education: RegistryRow['education'],
    summary: DiagnosisWorkspaceQualitySummary | null,
    latestRevision: EducationRevisionAnalysis | null,
  ) {
    return {
      id: education?.id ?? null,
      status:
        summary?.educationQuality.status ??
        education?.editorialStatus ??
        'missing',
      version: summary?.educationQuality.version ?? education?.version ?? null,
      qualityScore: summary?.educationQuality.score ?? null,
      sectionHealth:
        summary?.sectionHealth ?? latestRevision?.quality.sectionHealth ?? [],
      blockers: latestRevision?.quality.blockers ?? [],
      warnings: latestRevision?.quality.warnings ?? [],
      updatedAt: education ? this.toIso(education.updatedAt) : null,
    };
  }

  private teachingRuleSummary(
    rules: Array<{ status: string; importance: string }>,
  ) {
    return {
      total: rules.length,
      active: rules.filter((rule) => rule.status === 'ACTIVE').length,
      approved: rules.filter((rule) => rule.status === 'APPROVED').length,
      candidates: rules.filter((rule) => rule.status === 'CANDIDATE').length,
      needsReview: rules.filter((rule) => rule.status === 'NEEDS_REVIEW')
        .length,
      critical: rules.filter((rule) => rule.importance === 'critical').length,
    };
  }

  private graphFactsSummary(facts: GraphFactRow[]) {
    return {
      total: facts.length,
      byType: this.countBy(facts.map((fact) => fact.type)),
      recent: facts.slice(0, 10).map((fact) => ({
        id: fact.id,
        type: fact.type,
        label: fact.label,
        targetDiagnosisRegistryId: fact.targetDiagnosisRegistryId,
        updatedAt: this.toIso(fact.updatedAt),
      })),
    };
  }

  private recentLearningThemes(
    revisions: EducationRevisionAnalysis[],
  ): string[] {
    return this.unique(
      revisions
        .slice(0, 3)
        .flatMap((revision) => revision.changedSections ?? [])
        .map((section) => `Recent ${this.formatLabel(section)} edits`),
    );
  }

  private compositionWarnings(input: {
    summaryResult: PromiseSettledResult<unknown>;
    coverageResult: PromiseSettledResult<unknown>;
    rulesResult: PromiseSettledResult<unknown>;
    briefResult: PromiseSettledResult<unknown>;
    revisionsResult: PromiseSettledResult<unknown>;
    graphCandidatesResult: PromiseSettledResult<unknown>;
  }): string[] {
    return [
      this.warningFor('workspace summary', input.summaryResult),
      this.warningFor('teaching coverage', input.coverageResult),
      this.warningFor('teaching rules', input.rulesResult),
      this.warningFor('editorial brief', input.briefResult),
      this.warningFor('education revisions', input.revisionsResult),
      this.warningFor('graph candidates', input.graphCandidatesResult),
    ].filter((warning): warning is string => Boolean(warning));
  }

  private warningFor(
    label: string,
    result: PromiseSettledResult<unknown>,
  ): string | null {
    return result.status === 'rejected'
      ? `Unable to load ${label}: ${this.errorMessage(result.reason)}`
      : null;
  }

  private valueOrNull<T>(result: PromiseSettledResult<T>): T | null {
    return result.status === 'fulfilled' ? result.value : null;
  }

  private graphReadinessFromRegistry(registry: RegistryRow) {
    return registry.graphFacts.length ? 'fact_ready' : 'none';
  }

  private lifecycleFromCaseStatus(
    status: DiagnosisWorkspaceQualitySummary['caseQuality']['status'],
  ): LifecycleState {
    if (status === 'missing') return 'not_started';
    if (status === 'blocker') return 'blocked';
    if (status === 'good') return 'complete';
    return 'warning';
  }

  private lifecycleFromGraphStatus(status: string): LifecycleState {
    if (status === 'none') return 'not_started';
    if (status === 'fact_ready') return 'complete';
    return 'warning';
  }

  private targetTabForCoverage(row: {
    educationCoverage: CoverageStatus;
    caseCoverage: CoverageStatus;
    graphCoverage: CoverageStatus;
  }): TargetTab {
    if (this.isGap(row.educationCoverage)) return 'education';
    if (this.isGap(row.caseCoverage)) return 'cases';
    if (this.isGap(row.graphCoverage)) return 'graph';
    return 'overview';
  }

  private targetTabFromMessage(message: string): TargetTab {
    const normalized = message.toLowerCase();
    if (normalized.includes('case')) return 'cases';
    if (normalized.includes('graph')) return 'graph';
    if (normalized.includes('brief')) return 'editorial-brief';
    if (normalized.includes('rule') || normalized.includes('curriculum')) {
      return 'teaching-rules';
    }
    if (normalized.includes('education') || normalized.includes('regenerate')) {
      return 'education';
    }
    return 'overview';
  }

  private isGap(status: CoverageStatus): boolean {
    return status === 'missing' || status === 'partial';
  }

  private isUsableCaseStatus(status: CaseEditorialStatus | null): boolean {
    return (
      status === CaseEditorialStatus.APPROVED ||
      status === CaseEditorialStatus.READY_TO_PUBLISH ||
      status === CaseEditorialStatus.PUBLISHED
    );
  }

  private isReviewableCandidateStatus(status: string): boolean {
    return (
      status === DiagnosisGraphCandidateStatus.CANDIDATE ||
      status === DiagnosisGraphCandidateStatus.APPROVED
    );
  }

  private diagnosisName(registry: RegistryRow): string {
    return registry.displayLabel || registry.canonicalName;
  }

  private countBy(values: Array<string | null>): Record<string, number> {
    return values.reduce<Record<string, number>>((counts, value) => {
      const key = value ?? 'unknown';
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
  }

  private uniqueActions(actions: ActionDescriptor[]): ActionDescriptor[] {
    const seen = new Set<string>();
    return actions.filter((action) => {
      if (seen.has(action.id)) {
        return false;
      }
      seen.add(action.id);
      return true;
    });
  }

  private formatLabel(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .toLowerCase();
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }

  private toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
  }
}
