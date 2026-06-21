import { Injectable } from '@nestjs/common';
import {
  DiagnosisEditorialOnboardingStatus,
  DiagnosisRegistryStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import {
  EditorialCoverageDashboardService,
  type EditorialCoverageQuery,
} from './editorial-coverage-dashboard.service';
import { normalizeSpecialtyDisplayName } from '../diagnosis-registry/diagnosis-registry-specialty';

type CoverageDiagnosis = Awaited<
  ReturnType<EditorialCoverageDashboardService['getDiagnoses']>
>[number];
type CoverageSpecialty = Awaited<
  ReturnType<EditorialCoverageDashboardService['getSpecialties']>
>[number];

export type CurriculumPriorityTier = 'high' | 'medium' | 'low';

export type CurriculumPlannerQuery = EditorialCoverageQuery & {
  onboardingStatus?: string;
  lifecycleReadiness?: string;
  priorityTier?: CurriculumPriorityTier | string;
  track?: string;
};

export type CurriculumDependency = {
  type: 'shared_differential' | 'mimic' | 'specialty' | 'teaching_rule' | 'graph';
  diagnosisRegistryId: string;
  diagnosisName: string;
  strength: number;
  reason: string;
};

export type CurriculumPlannerDiagnosis = {
  diagnosisRegistryId: string;
  diagnosisName: string;
  specialty: string | null;
  bodySystem: string | null;
  category: string | null;
  lifecycleReadiness: string;
  onboardingState: DiagnosisEditorialOnboardingStatus | null;
  track: string;
  priorityScore: number;
  priorityTier: CurriculumPriorityTier;
  priorityReasons: string[];
  blockers: string[];
  missingAreas: string[];
  dependencies: CurriculumDependency[];
  recommendations: string[];
  planningHooks: {
    suggestedTeachingRuleExpansion: boolean;
    suggestedDifferentialExpansion: boolean;
    suggestedGraphExpansion: boolean;
    suggestedTeachingRelationshipActivation: boolean;
    suggestedEvidenceGraphExpansion: boolean;
    suggestedEvidenceExpansion: boolean;
    suggestedDiscriminatorCoverage: boolean;
    suggestedReasoningPathCoverage: boolean;
    suggestedGenerationPrerequisites: string[];
    suggestedCaseGeneration: boolean;
    suggestedReviewPriority: CurriculumPriorityTier;
  };
  evidenceCoverage: {
    coverageScore: number;
    generationReadinessScore: number;
    generationReadinessTier: string;
    weaknessCount: number;
  } | null;
  inventory: {
    caseCount: number;
    playableCaseCount: number;
    dailyInventoryCount: number;
    overused: boolean;
    needsPlayableInventory: boolean;
  };
  targetUrl: string;
};

export type CurriculumTrack = {
  track: string;
  label: string;
  diagnosisCount: number;
  highPriorityCount: number;
  averagePriorityScore: number;
  specialties: string[];
  missingAreas: string[];
  diagnoses: Array<{
    diagnosisRegistryId: string;
    diagnosisName: string;
    priorityScore: number;
    targetUrl: string;
  }>;
};

export type CurriculumDependencyCluster = {
  type: CurriculumDependency['type'];
  label: string;
  diagnosisIds: string[];
  diagnosisNames: string[];
  strength: number;
  reason: string;
};

export type CurriculumPlannerOverview = {
  generatedAt: string;
  filters: CurriculumPlannerQuery;
  summary: {
    diagnosisCount: number;
    highPriorityDiagnoses: number;
    specialtyRiskCount: number;
    inventoryExhaustionRisk: number;
    onboardingBottlenecks: number;
    unresolvedDifferentialBacklog: number;
  };
  priorityDiagnoses: CurriculumPlannerDiagnosis[];
  tracks: CurriculumTrack[];
  dependencyClusters: CurriculumDependencyCluster[];
  inventoryPlanning: {
    overusedDiagnoses: CurriculumPlannerDiagnosis[];
    noCaseDiagnoses: CurriculumPlannerDiagnosis[];
    specialtiesAtRisk: Array<{
      specialty: string;
      diagnosisCount: number;
      caseCount: number;
      dailyInventoryCount: number;
      weakDiagnosisCount: number;
      riskScore: number;
    }>;
    projectedExhaustion: {
      scheduledDays: number;
      assignableCases: number;
      estimatedExhaustionDays: number;
    };
  };
  recommendations: Array<{
    diagnosisRegistryId: string;
    diagnosisName: string;
    priorityScore: number;
    recommendations: string[];
    targetUrl: string;
  }>;
};

const STALLED_ONBOARDING_STATUSES = new Set<DiagnosisEditorialOnboardingStatus>([
  DiagnosisEditorialOnboardingStatus.NEW,
  DiagnosisEditorialOnboardingStatus.RULES_STARTED,
  DiagnosisEditorialOnboardingStatus.BRIEF_STARTED,
  DiagnosisEditorialOnboardingStatus.EDUCATION_STARTED,
  DiagnosisEditorialOnboardingStatus.CASE_STARTED,
  DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW,
]);

@Injectable()
export class CurriculumPlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coverageDashboardService: EditorialCoverageDashboardService,
  ) {}

  async getOverview(
    query: CurriculumPlannerQuery = {},
  ): Promise<CurriculumPlannerOverview> {
    const normalized = this.normalizeQuery(query);
    const coverageQuery = this.toCoverageQuery(normalized);
    const [coverageOverview, coverageDiagnoses, specialties] =
      await Promise.all([
        this.coverageDashboardService.getOverview(coverageQuery),
        this.coverageDashboardService.getDiagnoses(coverageQuery),
        this.coverageDashboardService.getSpecialties(coverageQuery),
      ]);
    const dependencyContext = await this.loadDependencyContext(
      coverageDiagnoses.map((diagnosis) => diagnosis.diagnosisRegistryId),
    );
    const specialtyRisk = this.calculateSpecialtyRisk(specialties);
    const diagnoses = coverageDiagnoses
      .map((diagnosis) =>
        this.toPlannerDiagnosis(
          diagnosis,
          dependencyContext.dependenciesByDiagnosis.get(
            diagnosis.diagnosisRegistryId,
          ) ?? [],
          specialtyRisk.get(diagnosis.specialty ?? 'Unassigned') ?? 0,
        ),
      )
      .filter((diagnosis) => this.matchesPlannerFilters(diagnosis, normalized))
      .sort(
        (left, right) =>
          right.priorityScore - left.priorityScore ||
          left.diagnosisName.localeCompare(right.diagnosisName),
      );
    const tracks = this.buildTracks(diagnoses);
    const dependencyClusters = this.buildDependencyClusters(
      dependencyContext.clusters,
      diagnoses,
    );
    const specialtiesAtRisk = this.buildSpecialtiesAtRisk(specialties);

    return {
      generatedAt: new Date().toISOString(),
      filters: normalized,
      summary: {
        diagnosisCount: diagnoses.length,
        highPriorityDiagnoses: diagnoses.filter(
          (diagnosis) => diagnosis.priorityTier === 'high',
        ).length,
        specialtyRiskCount: specialtiesAtRisk.length,
        inventoryExhaustionRisk:
          coverageOverview.inventory.inventoryExhaustionForecast
            .estimatedExhaustionDays,
        onboardingBottlenecks: diagnoses.filter(
          (diagnosis) =>
            diagnosis.onboardingState &&
            STALLED_ONBOARDING_STATUSES.has(diagnosis.onboardingState),
        ).length,
        unresolvedDifferentialBacklog:
          coverageOverview.differentialCoverage.unresolvedDifferentials,
      },
      priorityDiagnoses: diagnoses.slice(0, 50),
      tracks,
      dependencyClusters,
      inventoryPlanning: {
        overusedDiagnoses: diagnoses
          .filter((diagnosis) => diagnosis.inventory.overused)
          .slice(0, 20),
        noCaseDiagnoses: diagnoses
          .filter((diagnosis) => diagnosis.inventory.needsPlayableInventory)
          .slice(0, 20),
        specialtiesAtRisk,
        projectedExhaustion:
          coverageOverview.inventory.inventoryExhaustionForecast,
      },
      recommendations: diagnoses
        .filter((diagnosis) => diagnosis.recommendations.length > 0)
        .slice(0, 30)
        .map((diagnosis) => ({
          diagnosisRegistryId: diagnosis.diagnosisRegistryId,
          diagnosisName: diagnosis.diagnosisName,
          priorityScore: diagnosis.priorityScore,
          recommendations: diagnosis.recommendations,
          targetUrl: diagnosis.targetUrl,
        })),
    };
  }

  async getDiagnoses(query: CurriculumPlannerQuery = {}) {
    return (await this.getOverview(query)).priorityDiagnoses;
  }

  async getTracks(query: CurriculumPlannerQuery = {}) {
    return (await this.getOverview(query)).tracks;
  }

  private toPlannerDiagnosis(
    diagnosis: CoverageDiagnosis,
    dependencies: CurriculumDependency[],
    specialtyRiskScore: number,
  ): CurriculumPlannerDiagnosis {
    const priority = this.scoreDiagnosis(diagnosis, specialtyRiskScore);
    const recommendations = this.recommendationsFor(diagnosis);
    const evidenceCoverage = this.evidenceCoverageFor(diagnosis);

    return {
      diagnosisRegistryId: diagnosis.diagnosisRegistryId,
      diagnosisName: diagnosis.diagnosisName,
      specialty: diagnosis.specialty,
      bodySystem: diagnosis.bodySystem,
      category: diagnosis.category,
      lifecycleReadiness: diagnosis.lifecycle.readiness,
      onboardingState: diagnosis.onboardingState,
      track: this.inferTrack(diagnosis),
      priorityScore: priority.score,
      priorityTier: this.toPriorityTier(priority.score),
      priorityReasons: priority.reasons,
      blockers: this.blockersFor(diagnosis),
      missingAreas: this.missingAreasFor(diagnosis),
      dependencies: dependencies
        .sort((left, right) => right.strength - left.strength)
        .slice(0, 8),
      recommendations,
      planningHooks: {
        suggestedTeachingRuleExpansion:
          diagnosis.recommendations.recommendedTeachingRuleGeneration,
        suggestedDifferentialExpansion:
          diagnosis.recommendations.recommendedDifferentialExpansion,
        suggestedGraphExpansion:
          diagnosis.recommendations.recommendedGraphExpansion,
        suggestedTeachingRelationshipActivation:
          diagnosis.recommendations.recommendedTeachingRelationshipActivation ??
          false,
        suggestedEvidenceGraphExpansion:
          diagnosis.recommendations.recommendedEvidenceGraphExpansion ?? false,
        suggestedEvidenceExpansion:
          evidenceCoverage?.generationHooks.suggestedEvidenceExpansion ?? false,
        suggestedDiscriminatorCoverage:
          evidenceCoverage?.generationHooks.suggestedDiscriminatorCoverage ??
          false,
        suggestedReasoningPathCoverage:
          evidenceCoverage?.generationHooks.suggestedReasoningPathCoverage ??
          false,
        suggestedGenerationPrerequisites:
          evidenceCoverage?.generationHooks.suggestedGenerationPrerequisites ??
          [],
        suggestedCaseGeneration:
          diagnosis.recommendations.recommendedCaseGeneration,
        suggestedReviewPriority: this.toPriorityTier(priority.score),
      },
      evidenceCoverage: evidenceCoverage
        ? {
            coverageScore: evidenceCoverage.coverageScore,
            generationReadinessScore:
              evidenceCoverage.generationReadinessScore,
            generationReadinessTier: evidenceCoverage.generationReadinessTier,
            weaknessCount: evidenceCoverage.coverageWeaknesses.length,
          }
        : null,
      inventory: {
        caseCount: diagnosis.inventory.caseCount,
        playableCaseCount: diagnosis.inventory.playableCaseCount,
        dailyInventoryCount: diagnosis.inventory.dailyInventoryCount,
        overused:
          diagnosis.inventory.dailyInventoryCount >= 2 &&
          diagnosis.inventory.playableCaseCount <= 1,
        needsPlayableInventory: diagnosis.inventory.playableCaseCount < 2,
      },
      targetUrl: diagnosis.targetUrl,
    };
  }

  private scoreDiagnosis(
    diagnosis: CoverageDiagnosis,
    specialtyRiskScore: number,
  ) {
    const evidenceGraph = this.evidenceGraphFor(diagnosis);
    const evidenceCoverage = this.evidenceCoverageFor(diagnosis);
    const factors: Array<[boolean, number, string]> = [
      [
        diagnosis.inventory.playableCaseCount === 0,
        40,
        'No playable cases',
      ],
      [
        diagnosis.teaching.activeRuleCount === 0,
        30,
        'No active teaching rules',
      ],
      [
        diagnosis.differentials.unresolvedMappings > 0,
        20,
        'Unresolved differential mappings',
      ],
      [
        diagnosis.onboardingState !== null &&
          STALLED_ONBOARDING_STATUSES.has(diagnosis.onboardingState),
        15,
        `Onboarding stalled at ${diagnosis.onboardingState}`,
      ],
      [
        diagnosis.graph.relationshipCount === 0,
        15,
        'No graph coverage',
      ],
      [
        diagnosis.graph.relationshipCount > 0 &&
          diagnosis.graph.activeTeachingRelationshipCount === 0,
        12,
        'No active teaching relationships',
      ],
      [
        evidenceGraph.discriminatorEvidenceCount === 0,
        12,
        'No discriminator evidence',
      ],
      [
        evidenceGraph.weakDiversity,
        8,
        'Weak evidence diversity',
      ],
      [
        Boolean(evidenceCoverage) &&
          evidenceCoverage!.generationReadinessTier === 'weak',
        14,
        'Generation readiness weak',
      ],
      [
        Boolean(evidenceCoverage) &&
          evidenceCoverage!.coverageWeaknesses.includes(
            'missing_imaging_discriminator',
          ),
        8,
        'Missing imaging discriminator evidence',
      ],
      [
        Boolean(evidenceCoverage) &&
          evidenceCoverage!.coverageWeaknesses.includes('weak_escalation_evidence'),
        6,
        'Weak escalation evidence',
      ],
      [specialtyRiskScore > 0, Math.min(10, specialtyRiskScore), 'Specialty undercovered'],
      [
        diagnosis.risk.duplicateRisk > 0,
        10,
        'Duplicate or merge risk',
      ],
      [
        diagnosis.teaching.discriminatorRuleCount === 0,
        10,
        'Missing discriminator teaching',
      ],
      [
        diagnosis.risk.reviewBacklog > 0,
        Math.min(10, diagnosis.risk.reviewBacklog * 2),
        'Editorial review backlog',
      ],
      [
        diagnosis.inventory.playableCaseCount === 1,
        8,
        'Thin playable inventory',
      ],
    ];
    let score = 0;
    const reasons: string[] = [];

    for (const [condition, weight, reason] of factors) {
      if (!condition) {
        continue;
      }
      score += weight;
      reasons.push(reason);
    }

    return { score: Math.min(100, score), reasons };
  }

  private recommendationsFor(diagnosis: CoverageDiagnosis): string[] {
    const evidenceGraph = this.evidenceGraphFor(diagnosis);
    const evidenceCoverage = this.evidenceCoverageFor(diagnosis);
    return [
      diagnosis.teaching.discriminatorRuleCount === 0
        ? 'Generate additional discriminator teaching'
        : null,
      diagnosis.inventory.playableCaseCount < 2
        ? 'Needs at least 2 playable cases'
        : null,
      diagnosis.differentials.linkedDifferentialCount < 3
        ? 'Expand differential breadth'
        : null,
      diagnosis.differentials.unresolvedMappings > 0
        ? 'Resolve unresolved differential mappings'
        : null,
      diagnosis.graph.mimicRelationshipCount === 0
        ? 'Graph mimic coverage weak'
        : null,
      diagnosis.graph.relationshipCount > 0 &&
      diagnosis.graph.activeTeachingRelationshipCount === 0
        ? 'Create or activate teaching relationships for high-yield differentials'
        : null,
      evidenceGraph.discriminatorEvidenceCount === 0
        ? 'Add lab discriminator evidence'
        : null,
      evidenceGraph.evidenceDiversityCount < 3
        ? 'Expand imaging contrast coverage'
        : null,
      evidenceCoverage?.coverageWeaknesses.includes(
        'missing_imaging_discriminator',
      )
        ? 'Expand imaging discriminator evidence'
        : null,
      evidenceCoverage?.coverageWeaknesses.includes('weak_escalation_evidence')
        ? 'Add escalation evidence'
        : null,
      evidenceCoverage?.coverageWeaknesses.includes('weak_evidence_diversity')
        ? 'Increase evidence diversity'
        : null,
      evidenceCoverage?.generationReadinessTier === 'weak'
        ? 'Generation readiness weak'
        : null,
      diagnosis.onboardingState &&
      STALLED_ONBOARDING_STATUSES.has(diagnosis.onboardingState)
        ? `Onboarding stalled at ${diagnosis.onboardingState}`
        : null,
      diagnosis.risk.reviewBacklog > 0 ? 'Review pending editorial items' : null,
    ].filter((item): item is string => Boolean(item));
  }

  private blockersFor(diagnosis: CoverageDiagnosis): string[] {
    return [
      diagnosis.lifecycle.readiness !== 'active'
        ? 'Lifecycle not active'
        : null,
      diagnosis.inventory.playableCaseCount === 0
        ? 'No playable case inventory'
        : null,
      diagnosis.differentials.unresolvedMappings > 0
        ? 'Unresolved differential mappings'
        : null,
      diagnosis.risk.duplicateRisk > 0 ? 'Duplicate risk' : null,
    ].filter((item): item is string => Boolean(item));
  }

  private missingAreasFor(diagnosis: CoverageDiagnosis): string[] {
    const evidenceGraph = this.evidenceGraphFor(diagnosis);
    const evidenceCoverage = this.evidenceCoverageFor(diagnosis);
    return [
      diagnosis.teaching.activeRuleCount === 0 ? 'Teaching rules' : null,
      diagnosis.teaching.discriminatorRuleCount === 0
        ? 'Discriminator teaching'
        : null,
      diagnosis.differentials.linkedDifferentialCount < 3
        ? 'Differentials'
        : null,
      diagnosis.graph.relationshipCount === 0 ? 'Graph' : null,
      diagnosis.graph.relationshipCount > 0 &&
      diagnosis.graph.activeTeachingRelationshipCount === 0
        ? 'Teaching relationships'
        : null,
      evidenceGraph.activeRelationshipCount === 0
        ? 'Evidence graph'
        : null,
      evidenceCoverage?.coverageWeaknesses.includes(
        'missing_discriminator_evidence',
      )
        ? 'Discriminator evidence'
        : null,
      evidenceCoverage?.generationReadinessTier === 'weak'
        ? 'Generation readiness'
        : null,
      diagnosis.inventory.playableCaseCount < 2 ? 'Playable cases' : null,
      diagnosis.education.completeness === 'missing' ? 'Education' : null,
    ].filter((item): item is string => Boolean(item));
  }

  private evidenceGraphFor(diagnosis: CoverageDiagnosis) {
    return (
      diagnosis.evidenceGraph ?? {
        activeRelationshipCount: 0,
        discriminatorEvidenceCount: 0,
        evidenceDiversityCount: 0,
        weakDiversity: false,
      }
    );
  }

  private evidenceCoverageFor(diagnosis: CoverageDiagnosis) {
    return diagnosis.evidenceCoverage ?? null;
  }

  private async loadDependencyContext(diagnosisIds: string[]) {
    if (diagnosisIds.length === 0) {
      return {
        dependenciesByDiagnosis: new Map<string, CurriculumDependency[]>(),
        clusters: [] as CurriculumDependencyCluster[],
      };
    }

    const [registries, caseLinks, educationLinks, graphFacts] =
      await Promise.all([
        this.prisma.diagnosisRegistry.findMany({
          where: { id: { in: diagnosisIds } },
          select: {
            id: true,
            displayLabel: true,
            canonicalName: true,
            specialty: true,
          },
        }),
        this.prisma.caseDifferentialLink.findMany({
          where: { diagnosisRegistryId: { in: diagnosisIds } },
          select: { caseId: true, diagnosisRegistryId: true },
        }),
        this.prisma.educationDifferentialLink.findMany({
          where: { diagnosisRegistryId: { in: diagnosisIds } },
          select: { educationId: true, diagnosisRegistryId: true },
        }),
        this.prisma.diagnosisGraphFact.findMany({
          where: {
            status: DiagnosisGraphFactStatus.ACTIVE,
            OR: [
              { diagnosisRegistryId: { in: diagnosisIds } },
              { targetDiagnosisRegistryId: { in: diagnosisIds } },
            ],
          },
          select: {
            diagnosisRegistryId: true,
            targetDiagnosisRegistryId: true,
            type: true,
          },
        }),
      ]);
    const registryNames = new Map(
      registries.map((registry) => [
        registry.id,
        registry.displayLabel || registry.canonicalName,
      ]),
    );
    const dependenciesByDiagnosis = new Map<string, CurriculumDependency[]>(
      diagnosisIds.map((id) => [id, []]),
    );
    const clusters: CurriculumDependencyCluster[] = [];

    this.addSharedLinkDependencies(
      caseLinks,
      'shared_differential',
      'Shared case differential context',
      registryNames,
      dependenciesByDiagnosis,
      clusters,
    );
    this.addSharedLinkDependencies(
      educationLinks.map((link) => ({
        caseId: link.educationId,
        diagnosisRegistryId: link.diagnosisRegistryId,
      })),
      'teaching_rule',
      'Repeated together in education differential teaching',
      registryNames,
      dependenciesByDiagnosis,
      clusters,
    );
    for (const fact of graphFacts) {
      if (!fact.targetDiagnosisRegistryId) {
        continue;
      }
      const type =
        fact.type === DiagnosisGraphCandidateType.MIMIC ? 'mimic' : 'graph';
      this.addDependency(
        dependenciesByDiagnosis,
        registryNames,
        fact.diagnosisRegistryId,
        fact.targetDiagnosisRegistryId,
        type,
        3,
        `Graph ${fact.type.toLowerCase()} relationship`,
      );
      clusters.push({
        type,
        label: `Graph link: ${registryNames.get(fact.diagnosisRegistryId) ?? fact.diagnosisRegistryId}`,
        diagnosisIds: [fact.diagnosisRegistryId, fact.targetDiagnosisRegistryId],
        diagnosisNames: [
          registryNames.get(fact.diagnosisRegistryId) ??
            fact.diagnosisRegistryId,
          registryNames.get(fact.targetDiagnosisRegistryId) ??
            fact.targetDiagnosisRegistryId,
        ],
        strength: 3,
        reason: `Graph ${fact.type.toLowerCase()} relationship`,
      });
    }

    const bySpecialty = new Map<string, typeof registries>();
    for (const registry of registries) {
      const specialty =
        normalizeSpecialtyDisplayName(registry.specialty) ?? 'Unassigned';
      bySpecialty.set(specialty, [
        ...(bySpecialty.get(specialty) ?? []),
        registry,
      ]);
    }
    for (const [specialty, group] of bySpecialty.entries()) {
      if (group.length < 2) {
        continue;
      }
      clusters.push({
        type: 'specialty',
        label: `${specialty} specialty cluster`,
        diagnosisIds: group.map((item) => item.id),
        diagnosisNames: group.map(
          (item) => item.displayLabel || item.canonicalName,
        ),
        strength: group.length,
        reason: 'Shared specialty planning sequence',
      });
    }

    return { dependenciesByDiagnosis, clusters };
  }

  private addSharedLinkDependencies(
    links: Array<{ caseId: string; diagnosisRegistryId: string }>,
    type: CurriculumDependency['type'],
    reason: string,
    registryNames: Map<string, string>,
    dependenciesByDiagnosis: Map<string, CurriculumDependency[]>,
    clusters: CurriculumDependencyCluster[],
  ) {
    const bySource = new Map<string, string[]>();
    for (const link of links) {
      bySource.set(link.caseId, [
        ...(bySource.get(link.caseId) ?? []),
        link.diagnosisRegistryId,
      ]);
    }

    for (const ids of bySource.values()) {
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length < 2) {
        continue;
      }
      clusters.push({
        type,
        label: reason,
        diagnosisIds: uniqueIds,
        diagnosisNames: uniqueIds.map((id) => registryNames.get(id) ?? id),
        strength: uniqueIds.length,
        reason,
      });
      for (const sourceId of uniqueIds) {
        for (const targetId of uniqueIds) {
          this.addDependency(
            dependenciesByDiagnosis,
            registryNames,
            sourceId,
            targetId,
            type,
            uniqueIds.length,
            reason,
          );
        }
      }
    }
  }

  private addDependency(
    dependenciesByDiagnosis: Map<string, CurriculumDependency[]>,
    registryNames: Map<string, string>,
    sourceId: string,
    targetId: string,
    type: CurriculumDependency['type'],
    strength: number,
    reason: string,
  ) {
    if (sourceId === targetId || !dependenciesByDiagnosis.has(sourceId)) {
      return;
    }
    dependenciesByDiagnosis.get(sourceId)?.push({
      type,
      diagnosisRegistryId: targetId,
      diagnosisName: registryNames.get(targetId) ?? targetId,
      strength,
      reason,
    });
  }

  private buildTracks(diagnoses: CurriculumPlannerDiagnosis[]): CurriculumTrack[] {
    const groups = new Map<string, CurriculumPlannerDiagnosis[]>();
    for (const diagnosis of diagnoses) {
      groups.set(diagnosis.track, [...(groups.get(diagnosis.track) ?? []), diagnosis]);
    }

    return [...groups.entries()]
      .map(([track, items]) => ({
        track,
        label: this.formatTrackLabel(track),
        diagnosisCount: items.length,
        highPriorityCount: items.filter((item) => item.priorityTier === 'high')
          .length,
        averagePriorityScore: Math.round(
          items.reduce((total, item) => total + item.priorityScore, 0) /
            Math.max(1, items.length),
        ),
        specialties: [
          ...new Set(items.map((item) => item.specialty ?? 'Unassigned')),
        ],
        missingAreas: [
          ...new Set(items.flatMap((item) => item.missingAreas)),
        ].slice(0, 8),
        diagnoses: items.slice(0, 12).map((item) => ({
          diagnosisRegistryId: item.diagnosisRegistryId,
          diagnosisName: item.diagnosisName,
          priorityScore: item.priorityScore,
          targetUrl: item.targetUrl,
        })),
      }))
      .sort(
        (left, right) =>
          right.highPriorityCount - left.highPriorityCount ||
          right.averagePriorityScore - left.averagePriorityScore,
      );
  }

  private buildDependencyClusters(
    clusters: CurriculumDependencyCluster[],
    diagnoses: CurriculumPlannerDiagnosis[],
  ) {
    const visibleIds = new Set(diagnoses.map((diagnosis) => diagnosis.diagnosisRegistryId));
    const deduped = new Map<string, CurriculumDependencyCluster>();

    for (const cluster of clusters) {
      const diagnosisIds = cluster.diagnosisIds.filter((id) => visibleIds.has(id));
      if (diagnosisIds.length < 2) {
        continue;
      }
      const key = `${cluster.type}:${diagnosisIds.sort().join(',')}:${cluster.reason}`;
      deduped.set(key, { ...cluster, diagnosisIds });
    }

    return [...deduped.values()]
      .sort((left, right) => right.strength - left.strength)
      .slice(0, 20);
  }

  private calculateSpecialtyRisk(specialties: CoverageSpecialty[]) {
    return new Map(
      specialties.map((specialty) => [
        specialty.specialty,
        specialty.diagnosisCount === 0
          ? 0
          : Math.round(
              ((specialty.weakDiagnosisCount / specialty.diagnosisCount) * 6 +
                (specialty.caseCount < specialty.diagnosisCount ? 4 : 0)) *
                10,
            ) / 10,
      ]),
    );
  }

  private buildSpecialtiesAtRisk(specialties: CoverageSpecialty[]) {
    return specialties
      .map((specialty) => ({
        specialty: specialty.specialty,
        diagnosisCount: specialty.diagnosisCount,
        caseCount: specialty.caseCount,
        dailyInventoryCount: specialty.dailyInventoryCount,
        weakDiagnosisCount: specialty.weakDiagnosisCount,
        riskScore:
          specialty.weakDiagnosisCount * 5 +
          Math.max(0, specialty.diagnosisCount - specialty.caseCount) * 4 +
          Math.max(0, specialty.diagnosisCount - specialty.dailyInventoryCount),
      }))
      .filter((specialty) => specialty.riskScore > 0)
      .sort((left, right) => right.riskScore - left.riskScore)
      .slice(0, 10);
  }

  private inferTrack(diagnosis: CoverageDiagnosis) {
    const text = [
      diagnosis.diagnosisName,
      diagnosis.canonicalName,
      diagnosis.specialty,
      diagnosis.bodySystem,
      diagnosis.category,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (/(chest|myocard|cardiac|angina|embol|aortic)/.test(text)) {
      return 'chest_pain';
    }
    if (/(abdomen|abdominal|gastro|append|ulcer|bowel|pancrea|hepat)/.test(text)) {
      return 'acute_abdomen';
    }
    if (/(shock|sepsis|bleed|hemorrhage|anaphyl|hypotension)/.test(text)) {
      return 'shock';
    }
    if (/(stroke|seizure|mening|neuro|headache|weakness|cord)/.test(text)) {
      return 'neuro_emergencies';
    }
    if (/(diabet|thyroid|adrenal|endocrine|dka|glucose)/.test(text)) {
      return 'endocrine_emergencies';
    }
    if (/(asthma|copd|pneumonia|respiratory|dyspnea)/.test(text)) {
      return 'respiratory_distress';
    }

    return this.slugify(diagnosis.specialty ?? diagnosis.bodySystem ?? 'general');
  }

  private toPriorityTier(score: number): CurriculumPriorityTier {
    if (score >= 70) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
  }

  private matchesPlannerFilters(
    diagnosis: CurriculumPlannerDiagnosis,
    query: CurriculumPlannerQuery,
  ) {
    return (
      (!query.priorityTier || diagnosis.priorityTier === query.priorityTier) &&
      (!query.track || diagnosis.track === query.track) &&
      (!query.lifecycleReadiness ||
        diagnosis.lifecycleReadiness === query.lifecycleReadiness)
    );
  }

  private toCoverageQuery(query: CurriculumPlannerQuery): EditorialCoverageQuery {
    return {
      specialty: query.specialty,
      lifecycleState: query.lifecycleState,
      onboardingState: query.onboardingState ?? query.onboardingStatus,
      playableOnly: query.playableOnly,
    };
  }

  private normalizeQuery(query: CurriculumPlannerQuery): CurriculumPlannerQuery {
    return {
      specialty: normalizeSpecialtyDisplayName(query.specialty) ?? undefined,
      lifecycleState: query.lifecycleState?.trim() || undefined,
      lifecycleReadiness: query.lifecycleReadiness?.trim() || undefined,
      onboardingState:
        query.onboardingState?.trim() || query.onboardingStatus?.trim() || undefined,
      priorityTier: query.priorityTier?.trim() || undefined,
      track: query.track?.trim() || undefined,
      playableOnly: query.playableOnly === true,
    };
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'general';
  }

  private formatTrackLabel(track: string) {
    return track
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
