import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisEvidenceRelationshipStatus,
  DiagnosisEvidenceRelationshipType,
  DiagnosisRegistryStatus,
  DiagnosisTeachingRelationshipPurpose,
  DiagnosisTeachingRelationshipStatus,
  DiagnosisTeachingRelationshipType,
  GenerationPurpose,
  Prisma,
  ReasoningGoal,
  ReasoningPathStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

export type ReasoningPathReviewAction =
  | 'activate'
  | 'reject'
  | 'deprecate'
  | 'needs_review';

export type ReasoningPathQuery = {
  diagnosisRegistryId?: string;
  generationPurpose?: GenerationPurpose | string;
  reasoningGoal?: ReasoningGoal | string;
  status?: ReasoningPathStatus | string;
  readinessTier?: 'ready' | 'partial' | 'weak' | string;
};

export type EducationalReasoningGenerationContext = Awaited<
  ReturnType<ReasoningPathService['buildEducationalGenerationContext']>
>;

type ReasoningPathSeed = {
  diagnosisRegistryId: string;
  title: string;
  reasoningGoal: ReasoningGoal;
  primaryDifferentialIds: string[];
  supportingTeachingRelationshipIds: string[];
  supportingEvidenceRelationshipIds: string[];
  discriminatorEvidenceNodeIds: string[];
  escalationEvidenceNodeIds: string[];
  contradictoryEvidenceNodeIds: string[];
  requiredTeachingPoints: string[];
  forbiddenEvidencePatterns: string[];
  recommendedClueDistribution: Record<string, number>;
  generationPurpose: GenerationPurpose;
  readinessScore: number;
};

type RegistryContext = NonNullable<
  Awaited<ReturnType<ReasoningPathService['loadRegistryContext']>>
>;

const PATH_INCLUDE = {
  diagnosisRegistry: {
    select: {
      id: true,
      displayLabel: true,
      canonicalName: true,
      specialty: true,
      bodySystem: true,
      category: true,
    },
  },
  reviewedByUser: {
    select: { id: true, email: true, username: true },
  },
} satisfies Prisma.ReasoningPathInclude;

@Injectable()
export class ReasoningPathService {
  private readonly logger = new Logger(ReasoningPathService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listPaths(query: ReasoningPathQuery = {}) {
    const rows = await this.prisma.reasoningPath.findMany({
      where: {
        ...(query.diagnosisRegistryId
          ? { diagnosisRegistryId: query.diagnosisRegistryId }
          : {}),
        ...(query.generationPurpose
          ? { generationPurpose: query.generationPurpose as GenerationPurpose }
          : {}),
        ...(query.reasoningGoal
          ? { reasoningGoal: query.reasoningGoal as ReasoningGoal }
          : {}),
        ...(query.status ? { status: query.status as ReasoningPathStatus } : {}),
      },
      include: PATH_INCLUDE,
      orderBy: [{ status: 'asc' }, { readinessScore: 'desc' }, { updatedAt: 'desc' }],
      take: 250,
    });

    return rows
      .map((row) => this.toDto(row))
      .filter((path) =>
        query.readinessTier ? path.readinessTier === query.readinessTier : true,
      );
  }

  async getPath(id: string) {
    const row = await this.prisma.reasoningPath.findUnique({
      where: { id },
      include: PATH_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Reasoning path not found');
    }
    return this.toDto(row);
  }

  async generateCandidates(input: { diagnosisRegistryId?: string } = {}) {
    const contexts = input.diagnosisRegistryId
      ? [await this.loadRegistryContext(input.diagnosisRegistryId)].filter(
          (item): item is RegistryContext => Boolean(item),
        )
      : await this.loadRegistryContexts();
    const seeds = contexts.flatMap((context) => this.buildSeeds(context));
    const created = [];
    let createdCount = 0;
    let existingCount = 0;
    let updatedCount = 0;

    for (const seed of seeds) {
      const normalizedKey = this.normalizedKey(seed);
      const existing = await this.prisma.reasoningPath.findUnique({
        where: { normalizedKey },
        include: PATH_INCLUDE,
      });
      if (existing) {
        existingCount += 1;
        if (existing.status === ReasoningPathStatus.CANDIDATE) {
          const updated = await this.prisma.reasoningPath.update({
            where: { id: existing.id },
            data: this.toUpdateInput(seed),
            include: PATH_INCLUDE,
          });
          updatedCount += 1;
          created.push(updated);
          this.log('reasoning_path.candidate.updated', {
            reasoningPathId: updated.id,
            diagnosisRegistryId: updated.diagnosisRegistryId,
            readinessScore: updated.readinessScore,
          });
        }
        continue;
      }

      const row = await this.prisma.reasoningPath.create({
        data: {
          ...this.toCreateInput(seed, normalizedKey),
          status: ReasoningPathStatus.CANDIDATE,
        },
        include: PATH_INCLUDE,
      });
      createdCount += 1;
      created.push(row);
      this.log('reasoning_path.candidate.created', {
        reasoningPathId: row.id,
        diagnosisRegistryId: row.diagnosisRegistryId,
        reasoningGoal: row.reasoningGoal,
        generationPurpose: row.generationPurpose,
        readinessScore: row.readinessScore,
      });
    }

    this.log('reasoning_path.generate.completed', {
      diagnosisRegistryId: input.diagnosisRegistryId ?? null,
      contextCount: contexts.length,
      seedCount: seeds.length,
      createdCount,
      updatedCount,
      existingCount,
    });

    return {
      createdCount,
      updatedCount,
      existingCount,
      skippedCount: contexts.length === 0 ? 1 : 0,
      paths: created.map((row) => this.toDto(row)),
    };
  }

  async reviewPath(
    id: string,
    reviewedByUserId: string,
    body: { action?: ReasoningPathReviewAction },
  ) {
    if (!body.action) {
      throw new BadRequestException('Review action is required');
    }
    const existing = await this.prisma.reasoningPath.findUnique({
      where: { id },
      include: PATH_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException('Reasoning path not found');
    }
    if (body.action === 'activate' && existing.readinessScore < 60) {
      throw new BadRequestException({
        message: 'Reasoning path is not ready to activate',
        reasons: ['Readiness score must be at least 60.'],
      });
    }
    if (body.action === 'activate') {
      const readiness = await this.validateActivation(existing);
      if (!readiness.ready) {
        throw new BadRequestException({
          message: 'Reasoning path is not ready to activate',
          reasons: readiness.reasons,
        });
      }
    }

    const row = await this.prisma.reasoningPath.update({
      where: { id },
      data: {
        status: this.statusForAction(body.action),
        reviewedByUserId,
        reviewedAt: new Date(),
      },
      include: PATH_INCLUDE,
    });
    this.log('reasoning_path.reviewed', {
      reasoningPathId: row.id,
      diagnosisRegistryId: row.diagnosisRegistryId,
      action: body.action,
      status: row.status,
      reviewedByUserId,
    });
    return this.toDto(row);
  }

  async buildCaseGenerationContext(reasoningPathId: string) {
    return this.buildGenerationContext(reasoningPathId, GenerationPurpose.CASE_GENERATION);
  }

  async buildTeachingRuleGenerationContext(reasoningPathId: string) {
    return this.buildGenerationContext(
      reasoningPathId,
      GenerationPurpose.TEACHING_RULE_GENERATION,
    );
  }

  async buildEducationGenerationContext(reasoningPathId: string) {
    return this.buildGenerationContext(
      reasoningPathId,
      GenerationPurpose.EDUCATION_GENERATION,
    );
  }

  async buildEducationSectionGenerationContext(input: {
    diagnosisRegistryId: string;
    section: string;
  }) {
    return this.buildEducationalGenerationContext({
      diagnosisRegistryId: input.diagnosisRegistryId,
      purpose: GenerationPurpose.EDUCATION_GENERATION,
      section: input.section,
    });
  }

  async buildEducationalGenerationContext(input: {
    diagnosisRegistryId: string;
    purpose: GenerationPurpose;
    section?: string;
  }) {
    const path = await this.prisma.reasoningPath.findFirst({
      where: {
        diagnosisRegistryId: input.diagnosisRegistryId,
        generationPurpose: input.purpose,
        status: ReasoningPathStatus.ACTIVE,
      },
      orderBy: [{ readinessScore: 'desc' }, { updatedAt: 'desc' }],
      include: PATH_INCLUDE,
    });

    if (!path) {
      const metadata = this.unconstrainedEducationalMetadata({
        diagnosisRegistryId: input.diagnosisRegistryId,
        purpose: input.purpose,
        section: input.section,
        warnings: [
          'No active reasoning path constrained this educational draft.',
          'Editor should review discriminator logic for unsupported reasoning.',
        ],
      });
      this.log('reasoning_path.educational_context.unconstrained', metadata);
      return metadata;
    }

    const context = await this.buildGenerationContext(path.id, input.purpose);
    const reasoningQualityWarnings = this.reasoningQualityWarnings({
      discriminatorCount: context.evidenceRelationships.filter(
        (relationship) => relationship.discriminatorWeight >= 3,
      ).length,
      teachingPointCount: context.constraints.requiredTeachingPoints.length,
      evidenceLabels: context.evidenceRelationships.map(
        (relationship) => relationship.evidenceNode.displayLabel,
      ),
      escalationCount: context.evidenceRelationships.filter(
        (relationship) =>
          relationship.relationshipType ===
          DiagnosisEvidenceRelationshipType.ESCALATES,
      ).length,
      differentialCount: context.constraints.primaryDifferentialIds.length,
    });
    const coverageGapsAddressed = this.coverageGapsAddressed(context);
    const constrained = {
      constrained: true as const,
      confidence: 'standard' as const,
      hallucinationRisk: reasoningQualityWarnings.length ? 'moderate' : 'low',
      warnings: reasoningQualityWarnings,
      reasoningPathId: context.reasoningPath.id,
      reasoningGoal: context.reasoningPath.reasoningGoal,
      generationPurpose: context.reasoningPath.generationPurpose,
      section: input.section ?? null,
      sourceTeachingRelationshipIds: context.teachingRelationships.map(
        (relationship) => relationship.id,
      ),
      sourceEvidenceRelationshipIds: context.evidenceRelationships.map(
        (relationship) => relationship.id,
      ),
      discriminatorEvidenceUsed: context.evidenceRelationships
        .filter((relationship) => relationship.discriminatorWeight >= 3)
        .map((relationship) => relationship.evidenceNode.displayLabel),
      contradictoryDiagnosisIds: context.constraints.primaryDifferentialIds,
      requiredTeachingPoints: context.constraints.requiredTeachingPoints,
      forbiddenEvidencePatterns: context.constraints.forbiddenEvidencePatterns,
      coverageGapsAddressed,
      generationCoverageSnapshot: {
        readinessScore: context.reasoningPath.readinessScore,
        readinessTier: context.reasoningPath.readinessTier,
        evidenceRelationshipCount: context.evidenceRelationships.length,
        teachingRelationshipCount: context.teachingRelationships.length,
        discriminatorEvidenceCount: context.evidenceRelationships.filter(
          (relationship) => relationship.discriminatorWeight >= 3,
        ).length,
        coverageGapsAddressed,
      },
      plannerRecommendations: this.plannerRecommendations({
        warnings: reasoningQualityWarnings,
        coverageGapsAddressed,
      }),
      reasoningQualityWarnings,
      promptConstraints: this.educationalPromptConstraints(context),
    };
    this.log('reasoning_path.educational_context.constrained', {
      diagnosisRegistryId: input.diagnosisRegistryId,
      reasoningPathId: constrained.reasoningPathId,
      purpose: input.purpose,
      section: input.section ?? null,
      warnings: constrained.warnings,
    });
    return constrained;
  }

  async buildGenerationContext(
    reasoningPathId: string,
    purpose?: GenerationPurpose,
  ) {
    const path = await this.prisma.reasoningPath.findUnique({
      where: { id: reasoningPathId },
      include: PATH_INCLUDE,
    });
    if (!path) {
      throw new NotFoundException('Reasoning path not found');
    }
    if (purpose && path.status !== ReasoningPathStatus.ACTIVE) {
      throw new BadRequestException('Reasoning path must be active for generation');
    }
    if (purpose && path.generationPurpose !== purpose) {
      throw new BadRequestException('Reasoning path purpose does not match request');
    }

    const evidenceRelationshipIds = this.stringArray(
      path.supportingEvidenceRelationshipIds,
    );
    const teachingRelationshipIds = this.stringArray(
      path.supportingTeachingRelationshipIds,
    );
    const evidenceNodeIds = this.unique([
      ...this.stringArray(path.discriminatorEvidenceNodeIds),
      ...this.stringArray(path.escalationEvidenceNodeIds),
      ...this.stringArray(path.contradictoryEvidenceNodeIds),
    ]);
    const [evidenceRelationships, teachingRelationships, evidenceNodes] =
      await Promise.all([
        this.prisma.diagnosisEvidenceRelationship.findMany({
          where: {
            id: { in: evidenceRelationshipIds },
            status: DiagnosisEvidenceRelationshipStatus.ACTIVE,
          },
          include: {
            evidenceNode: true,
          },
        }),
        this.prisma.diagnosisTeachingRelationship.findMany({
          where: {
            id: { in: teachingRelationshipIds },
            status: DiagnosisTeachingRelationshipStatus.ACTIVE,
          },
          include: {
            targetDiagnosisRegistry: {
              select: {
                id: true,
                displayLabel: true,
                canonicalName: true,
                status: true,
                active: true,
              },
            },
          },
        }),
        this.prisma.evidenceNode.findMany({
          where: { id: { in: evidenceNodeIds } },
        }),
      ]);
    const dependencyWarnings = this.dependencyWarnings({
      requestedEvidenceRelationshipIds: evidenceRelationshipIds,
      requestedTeachingRelationshipIds: teachingRelationshipIds,
      evidenceRelationships,
      teachingRelationships,
    });
    if (purpose && dependencyWarnings.length) {
      this.log('reasoning_path.dependency_warning', {
        reasoningPathId,
        dependencyWarnings,
      });
      throw new BadRequestException({
        message: 'Reasoning path has stale or inactive dependencies',
        reasons: dependencyWarnings,
      });
    }

    return {
      reasoningPath: this.toDto(path),
      constraints: {
        reasoningGoal: path.reasoningGoal,
        generationPurpose: path.generationPurpose,
        requiredTeachingPoints: this.stringArray(path.requiredTeachingPoints),
        forbiddenEvidencePatterns: this.stringArray(
          path.forbiddenEvidencePatterns,
        ),
        recommendedClueDistribution: this.asRecord(
          path.recommendedClueDistribution,
        ),
        primaryDifferentialIds: this.stringArray(path.primaryDifferentialIds),
      },
      dependencyWarnings,
      evidenceNodes: evidenceNodes.map((node) => ({
        id: node.id,
        displayLabel: node.displayLabel,
        evidenceType: node.evidenceType,
        clinicalCategory: node.clinicalCategory,
      })),
      evidenceRelationships: evidenceRelationships.map((relationship) => ({
        id: relationship.id,
        relationshipType: relationship.relationshipType,
        strength: relationship.strength,
        discriminatorWeight: relationship.discriminatorWeight,
        reasoningSummary: relationship.reasoningSummary,
        evidenceNode: {
          id: relationship.evidenceNode.id,
          displayLabel: relationship.evidenceNode.displayLabel,
          evidenceType: relationship.evidenceNode.evidenceType,
        },
      })),
      teachingRelationships: teachingRelationships.map((relationship) => ({
        id: relationship.id,
        relationshipType: relationship.relationshipType,
        teachingPurpose: relationship.teachingPurpose,
        discriminatorSummary: relationship.discriminatorSummary,
        commonConfusionReason: relationship.commonConfusionReason,
        learnerPitfall: relationship.learnerPitfall,
        targetDiagnosis: relationship.targetDiagnosisRegistry
          ? {
              id: relationship.targetDiagnosisRegistry.id,
              displayLabel:
                relationship.targetDiagnosisRegistry.displayLabel ||
                relationship.targetDiagnosisRegistry.canonicalName,
            }
          : null,
      })),
    };
  }

  private async loadRegistryContexts() {
    return this.prisma.diagnosisRegistry.findMany({
      where: {
        active: true,
        isGeneratable: true,
        status: DiagnosisRegistryStatus.ACTIVE,
      },
      select: this.registrySelect(),
      take: 100,
    });
  }

  private async loadRegistryContext(diagnosisRegistryId: string) {
    return this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: this.registrySelect(),
    });
  }

  private registrySelect() {
    return {
      id: true,
      canonicalName: true,
      displayLabel: true,
      status: true,
      active: true,
      isGeneratable: true,
      preferredClueTypes: true,
      sourceTeachingRelationships: {
        where: {
          status: DiagnosisTeachingRelationshipStatus.ACTIVE,
          targetDiagnosisRegistry: {
            active: true,
            status: DiagnosisRegistryStatus.ACTIVE,
          },
        },
        select: {
          id: true,
          targetDiagnosisRegistryId: true,
          relationshipType: true,
          teachingPurpose: true,
          discriminatorSummary: true,
          commonConfusionReason: true,
          learnerPitfall: true,
          strength: true,
        },
      },
      evidenceRelationships: {
        where: {
          status: DiagnosisEvidenceRelationshipStatus.ACTIVE,
          evidenceNode: {
            status: { notIn: ['REJECTED', 'DEPRECATED'] },
          },
        },
        select: {
          id: true,
          relationshipType: true,
          discriminatorWeight: true,
          strength: true,
          reasoningSummary: true,
          contradictoryDiagnosisIds: true,
          evidenceNode: {
            select: {
              id: true,
              displayLabel: true,
              evidenceType: true,
            },
          },
        },
      },
      caseDifferentialLinks: {
        select: {
          diagnosisRegistryId: true,
          role: true,
        },
      },
      educationDifferentialLinks: {
        select: {
          diagnosisRegistryId: true,
          role: true,
        },
      },
      cases: {
        select: { id: true },
        take: 5,
      },
      teachingRules: {
        select: { id: true, title: true, status: true },
        take: 10,
      },
    } satisfies Prisma.DiagnosisRegistrySelect;
  }

  private buildSeeds(context: RegistryContext): ReasoningPathSeed[] {
    if (
      !context.active ||
      context.status !== DiagnosisRegistryStatus.ACTIVE ||
      !context.isGeneratable
    ) {
      return [];
    }

    const teachingRelationships = context.sourceTeachingRelationships;
    const evidenceRelationships = context.evidenceRelationships;
    const discriminatorRelationships = evidenceRelationships.filter(
      (relationship) =>
        relationship.relationshipType ===
          DiagnosisEvidenceRelationshipType.DISCRIMINATES ||
        relationship.discriminatorWeight >= 3,
    );
    const escalationRelationships = evidenceRelationships.filter(
      (relationship) =>
        relationship.relationshipType === DiagnosisEvidenceRelationshipType.ESCALATES,
    );
    const managementRelationships = evidenceRelationships.filter(
      (relationship) =>
        relationship.relationshipType ===
        DiagnosisEvidenceRelationshipType.MANAGEMENT_SIGNAL,
    );
    const complicationRelationships = evidenceRelationships.filter(
      (relationship) =>
        relationship.relationshipType ===
        DiagnosisEvidenceRelationshipType.COMPLICATION_SIGNAL,
    );
    const differentialIds = this.unique([
      ...teachingRelationships.map((relationship) => relationship.targetDiagnosisRegistryId),
      ...context.caseDifferentialLinks.map((link) => link.diagnosisRegistryId),
      ...context.educationDifferentialLinks.map((link) => link.diagnosisRegistryId),
    ].filter((id): id is string => Boolean(id && id !== context.id)));
    const seeds: ReasoningPathSeed[] = [];

    if (differentialIds.length || discriminatorRelationships.length) {
      seeds.push(
        this.seedForGoal({
          context,
          reasoningGoal: ReasoningGoal.DIFFERENTIAL_DISCRIMINATION,
          generationPurpose: GenerationPurpose.CASE_GENERATION,
          differentialIds,
          teachingRelationships: teachingRelationships.filter((relationship) =>
            this.isDifferentialTeachingRelationship(relationship.relationshipType),
          ),
          evidenceRelationships: discriminatorRelationships,
          titleSuffix: 'differential discrimination',
        }),
      );
      seeds.push(
        this.seedForGoal({
          context,
          reasoningGoal: ReasoningGoal.DIFFERENTIAL_DISCRIMINATION,
          generationPurpose: GenerationPurpose.TEACHING_RULE_GENERATION,
          differentialIds,
          teachingRelationships,
          evidenceRelationships: discriminatorRelationships,
          titleSuffix: 'teaching discriminator',
        }),
      );
    }

    if (escalationRelationships.length) {
      seeds.push(
        this.seedForGoal({
          context,
          reasoningGoal: ReasoningGoal.ESCALATION_RECOGNITION,
          generationPurpose: GenerationPurpose.CASE_GENERATION,
          differentialIds,
          teachingRelationships: teachingRelationships.filter(
            (relationship) =>
              relationship.relationshipType ===
              DiagnosisTeachingRelationshipType.ESCALATION_CONTRAST,
          ),
          evidenceRelationships: escalationRelationships,
          titleSuffix: 'escalation recognition',
        }),
      );
    }

    if (managementRelationships.length) {
      seeds.push(
        this.seedForGoal({
          context,
          reasoningGoal: ReasoningGoal.MANAGEMENT_CONTRAST,
          generationPurpose: GenerationPurpose.EDUCATION_GENERATION,
          differentialIds,
          teachingRelationships: teachingRelationships.filter(
            (relationship) =>
              relationship.relationshipType ===
              DiagnosisTeachingRelationshipType.MANAGEMENT_CONTRAST,
          ),
          evidenceRelationships: managementRelationships,
          titleSuffix: 'management contrast',
        }),
      );
    }

    if (complicationRelationships.length) {
      seeds.push(
        this.seedForGoal({
          context,
          reasoningGoal: ReasoningGoal.COMPLICATION_RECOGNITION,
          generationPurpose: GenerationPurpose.EDUCATION_GENERATION,
          differentialIds,
          teachingRelationships: teachingRelationships.filter(
            (relationship) =>
              relationship.relationshipType ===
              DiagnosisTeachingRelationshipType.COMPLICATION_RELATIONSHIP,
          ),
          evidenceRelationships: complicationRelationships,
          titleSuffix: 'complication recognition',
        }),
      );
    }

    if (!seeds.length && evidenceRelationships.length) {
      seeds.push(
        this.seedForGoal({
          context,
          reasoningGoal: ReasoningGoal.EARLY_PRESENTATION_RECOGNITION,
          generationPurpose: GenerationPurpose.CASE_GENERATION,
          differentialIds,
          teachingRelationships,
          evidenceRelationships,
          titleSuffix: 'early presentation recognition',
        }),
      );
    }

    return seeds;
  }

  private seedForGoal(input: {
    context: RegistryContext;
    reasoningGoal: ReasoningGoal;
    generationPurpose: GenerationPurpose;
    differentialIds: string[];
    teachingRelationships: RegistryContext['sourceTeachingRelationships'];
    evidenceRelationships: RegistryContext['evidenceRelationships'];
    titleSuffix: string;
  }): ReasoningPathSeed {
    const discriminatorRelationships = input.evidenceRelationships.filter(
      (relationship) =>
        relationship.relationshipType ===
          DiagnosisEvidenceRelationshipType.DISCRIMINATES ||
        relationship.discriminatorWeight >= 3,
    );
    const escalationRelationships = input.evidenceRelationships.filter(
      (relationship) =>
        relationship.relationshipType === DiagnosisEvidenceRelationshipType.ESCALATES,
    );
    const contradictoryIds = this.unique(
      input.evidenceRelationships.flatMap((relationship) =>
        this.stringArray(relationship.contradictoryDiagnosisIds),
      ),
    );
    const requiredTeachingPoints = this.unique([
      ...input.teachingRelationships.flatMap((relationship) => [
        relationship.discriminatorSummary,
        relationship.commonConfusionReason,
        relationship.learnerPitfall,
      ]),
      ...input.evidenceRelationships.map(
        (relationship) =>
          relationship.reasoningSummary ||
          `${relationship.evidenceNode.displayLabel} supports this reasoning path.`,
      ),
    ].filter((item): item is string => Boolean(item)));
    const readinessScore = this.readinessScore({
      evidenceCount: input.evidenceRelationships.length,
      discriminatorCount: discriminatorRelationships.length,
      teachingRelationshipCount: input.teachingRelationships.length,
      differentialCount: input.differentialIds.length,
      caseCount: input.context.cases.length,
      teachingRuleCount: input.context.teachingRules.length,
    });

    return {
      diagnosisRegistryId: input.context.id,
      title: `${input.context.displayLabel || input.context.canonicalName}: ${input.titleSuffix}`,
      reasoningGoal: input.reasoningGoal,
      primaryDifferentialIds: input.differentialIds.slice(0, 8),
      supportingTeachingRelationshipIds: input.teachingRelationships
        .map((relationship) => relationship.id)
        .slice(0, 8),
      supportingEvidenceRelationshipIds: input.evidenceRelationships
        .map((relationship) => relationship.id)
        .slice(0, 12),
      discriminatorEvidenceNodeIds: discriminatorRelationships
        .map((relationship) => relationship.evidenceNode.id)
        .slice(0, 8),
      escalationEvidenceNodeIds: escalationRelationships
        .map((relationship) => relationship.evidenceNode.id)
        .slice(0, 6),
      contradictoryEvidenceNodeIds: contradictoryIds.slice(0, 8),
      requiredTeachingPoints: requiredTeachingPoints.slice(0, 10),
      forbiddenEvidencePatterns: this.forbiddenPatterns(input),
      recommendedClueDistribution: this.recommendedClueDistribution(input),
      generationPurpose: input.generationPurpose,
      readinessScore,
    };
  }

  private readinessScore(input: {
    evidenceCount: number;
    discriminatorCount: number;
    teachingRelationshipCount: number;
    differentialCount: number;
    caseCount: number;
    teachingRuleCount: number;
  }) {
    return Math.min(
      100,
      input.evidenceCount * 8 +
        input.discriminatorCount * 12 +
        input.teachingRelationshipCount * 12 +
        input.differentialCount * 6 +
        Math.min(input.caseCount, 3) * 5 +
        Math.min(input.teachingRuleCount, 4) * 4,
    );
  }

  private reasoningQualityWarnings(input: {
    discriminatorCount: number;
    teachingPointCount: number;
    evidenceLabels: string[];
    escalationCount: number;
    differentialCount: number;
  }): string[] {
    const warnings: string[] = [];
    if (input.discriminatorCount < 2) warnings.push('weak_discriminator_density');
    if (input.teachingPointCount < 2) warnings.push('shallow_reasoning_path');
    if (new Set(input.evidenceLabels).size < input.evidenceLabels.length) {
      warnings.push('duplicated_discriminator_evidence');
    }
    if (input.escalationCount === 0) warnings.push('no_escalation_evidence');
    if (input.differentialCount === 0) {
      warnings.push('no_contradictory_differential_coverage');
    }
    return warnings;
  }

  private unconstrainedEducationalMetadata(input: {
    diagnosisRegistryId: string;
    purpose: GenerationPurpose;
    section?: string;
    warnings: string[];
  }) {
    return {
      constrained: false as const,
      confidence: 'lower' as const,
      hallucinationRisk: 'high',
      warnings: [...input.warnings, 'unconstrained_educational_generation'],
      diagnosisRegistryId: input.diagnosisRegistryId,
      reasoningPathId: null,
      reasoningGoal: null,
      generationPurpose: input.purpose,
      section: input.section ?? null,
      sourceTeachingRelationshipIds: [],
      sourceEvidenceRelationshipIds: [],
      discriminatorEvidenceUsed: [],
      contradictoryDiagnosisIds: [],
      requiredTeachingPoints: [],
      forbiddenEvidencePatterns: [
        'Do not introduce discriminator claims without evidence support.',
      ],
      coverageGapsAddressed: ['missing_active_reasoning_path'],
      generationCoverageSnapshot: {
        readinessScore: null,
        readinessTier: 'unconstrained',
        evidenceRelationshipCount: 0,
        teachingRelationshipCount: 0,
        discriminatorEvidenceCount: 0,
        coverageGapsAddressed: ['missing_active_reasoning_path'],
      },
      plannerRecommendations: [
        'Activate a reasoning path before relying on generated educational logic.',
        'Expand discriminator education with evidence-backed contrasts.',
      ],
      reasoningQualityWarnings: ['unconstrained_educational_generation'],
      promptConstraints: [
        'Mark unsupported discriminator claims for editor review.',
        'Prefer existing diagnosis-wide context over inventing new contrasts.',
      ],
    };
  }

  private coverageGapsAddressed(
    context: Awaited<ReturnType<ReasoningPathService['buildGenerationContext']>>,
  ) {
    return this.unique([
      context.evidenceRelationships.length < 3
        ? 'weak_evidence_relationship_coverage'
        : null,
      context.teachingRelationships.length < 2
        ? 'weak_teaching_relationship_coverage'
        : null,
      context.evidenceRelationships.filter(
        (relationship) => relationship.discriminatorWeight >= 3,
      ).length < 2
        ? 'weak_discriminator_coverage'
        : null,
      context.constraints.primaryDifferentialIds.length === 0
        ? 'missing_contradictory_differential_coverage'
        : null,
    ].filter((item): item is string => Boolean(item)));
  }

  private plannerRecommendations(input: {
    warnings: string[];
    coverageGapsAddressed: string[];
  }) {
    return this.unique([
      input.warnings.includes('weak_discriminator_density') ||
      input.coverageGapsAddressed.includes('weak_discriminator_coverage')
        ? 'Expand discriminator education'
        : null,
      input.warnings.includes('no_escalation_evidence')
        ? 'Add escalation-focused teaching'
        : null,
      input.coverageGapsAddressed.includes('weak_evidence_relationship_coverage')
        ? 'Weak evidence-backed education'
        : null,
    ].filter((item): item is string => Boolean(item)));
  }

  private educationalPromptConstraints(
    context: Awaited<ReturnType<ReasoningPathService['buildGenerationContext']>>,
  ) {
    return [
      `Reasoning goal: ${context.constraints.reasoningGoal}.`,
      `Required teaching points: ${context.constraints.requiredTeachingPoints.join('; ') || 'none'}.`,
      `Evidence relationships: ${context.evidenceRelationships
        .map(
          (relationship) =>
            `${relationship.evidenceNode.displayLabel} (${relationship.relationshipType})`,
        )
        .join('; ') || 'none'}.`,
      `Teaching relationships: ${context.teachingRelationships
        .map(
          (relationship) =>
            [
              relationship.targetDiagnosis?.displayLabel,
              relationship.discriminatorSummary,
              relationship.commonConfusionReason,
              relationship.learnerPitfall,
            ]
              .filter(Boolean)
              .join(' - '),
        )
        .filter(Boolean)
        .join('; ') || 'none'}.`,
      `Forbidden evidence patterns: ${context.constraints.forbiddenEvidencePatterns.join('; ') || 'none'}.`,
    ];
  }

  private forbiddenPatterns(input: {
    reasoningGoal: ReasoningGoal;
    evidenceRelationships: RegistryContext['evidenceRelationships'];
  }) {
    const labels = input.evidenceRelationships.map(
      (relationship) => relationship.evidenceNode.displayLabel,
    );
    return this.unique([
      'Do not introduce discriminator evidence that is absent from the active evidence graph.',
      'Do not resolve the diagnosis before required discriminator evidence appears.',
      input.reasoningGoal === ReasoningGoal.DIFFERENTIAL_DISCRIMINATION
        ? 'Do not use shared presenting symptoms as the final discriminator.'
        : null,
      labels.length
        ? `Avoid repeating only these evidence nodes without contrast: ${labels
            .slice(0, 4)
            .join(', ')}.`
        : null,
    ].filter((item): item is string => Boolean(item)));
  }

  private recommendedClueDistribution(input: {
    context: RegistryContext;
    reasoningGoal: ReasoningGoal;
  }) {
    const preferred = this.stringArray(input.context.preferredClueTypes);
    const base = preferred.length
      ? preferred
      : ['history', 'exam', 'investigation', 'differential'];
    const distribution = base.reduce<Record<string, number>>((acc, clue, index) => {
      acc[clue] = index + 1;
      return acc;
    }, {});
    if (input.reasoningGoal === ReasoningGoal.ESCALATION_RECOGNITION) {
      distribution.escalation = Math.max(...Object.values(distribution), 0) + 1;
    }
    return distribution;
  }

  private toCreateInput(
    seed: ReasoningPathSeed,
    normalizedKey: string,
  ): Prisma.ReasoningPathCreateInput {
    return {
      diagnosisRegistry: { connect: { id: seed.diagnosisRegistryId } },
      normalizedKey,
      title: seed.title,
      reasoningGoal: seed.reasoningGoal,
      generationPurpose: seed.generationPurpose,
      readinessScore: seed.readinessScore,
      primaryDifferentialIds: seed.primaryDifferentialIds,
      supportingTeachingRelationshipIds: seed.supportingTeachingRelationshipIds,
      supportingEvidenceRelationshipIds: seed.supportingEvidenceRelationshipIds,
      discriminatorEvidenceNodeIds: seed.discriminatorEvidenceNodeIds,
      escalationEvidenceNodeIds: seed.escalationEvidenceNodeIds,
      contradictoryEvidenceNodeIds: seed.contradictoryEvidenceNodeIds,
      requiredTeachingPoints: seed.requiredTeachingPoints,
      forbiddenEvidencePatterns: seed.forbiddenEvidencePatterns,
      recommendedClueDistribution: seed.recommendedClueDistribution,
    };
  }

  private toUpdateInput(seed: ReasoningPathSeed): Prisma.ReasoningPathUpdateInput {
    return {
      title: seed.title,
      reasoningGoal: seed.reasoningGoal,
      generationPurpose: seed.generationPurpose,
      readinessScore: seed.readinessScore,
      primaryDifferentialIds: seed.primaryDifferentialIds,
      supportingTeachingRelationshipIds: seed.supportingTeachingRelationshipIds,
      supportingEvidenceRelationshipIds: seed.supportingEvidenceRelationshipIds,
      discriminatorEvidenceNodeIds: seed.discriminatorEvidenceNodeIds,
      escalationEvidenceNodeIds: seed.escalationEvidenceNodeIds,
      contradictoryEvidenceNodeIds: seed.contradictoryEvidenceNodeIds,
      requiredTeachingPoints: seed.requiredTeachingPoints,
      forbiddenEvidencePatterns: seed.forbiddenEvidencePatterns,
      recommendedClueDistribution: seed.recommendedClueDistribution,
    };
  }

  private normalizedKey(seed: ReasoningPathSeed) {
    return this.normalize(
      [
        seed.diagnosisRegistryId,
        seed.reasoningGoal,
        seed.generationPurpose,
        seed.primaryDifferentialIds.slice(0, 4).join(' '),
      ].join(' '),
    );
  }

  private statusForAction(action: ReasoningPathReviewAction) {
    switch (action) {
      case 'activate':
        return ReasoningPathStatus.ACTIVE;
      case 'reject':
        return ReasoningPathStatus.REJECTED;
      case 'deprecate':
        return ReasoningPathStatus.DEPRECATED;
      case 'needs_review':
      default:
        return ReasoningPathStatus.CANDIDATE;
    }
  }

  private toDto(row: Prisma.ReasoningPathGetPayload<{ include: typeof PATH_INCLUDE }>) {
    return {
      id: row.id,
      diagnosisRegistryId: row.diagnosisRegistryId,
      diagnosisName:
        row.diagnosisRegistry.displayLabel || row.diagnosisRegistry.canonicalName,
      normalizedKey: row.normalizedKey,
      title: row.title,
      reasoningGoal: row.reasoningGoal,
      primaryDifferentialIds: this.stringArray(row.primaryDifferentialIds),
      supportingTeachingRelationshipIds: this.stringArray(
        row.supportingTeachingRelationshipIds,
      ),
      supportingEvidenceRelationshipIds: this.stringArray(
        row.supportingEvidenceRelationshipIds,
      ),
      discriminatorEvidenceNodeIds: this.stringArray(
        row.discriminatorEvidenceNodeIds,
      ),
      escalationEvidenceNodeIds: this.stringArray(row.escalationEvidenceNodeIds),
      contradictoryEvidenceNodeIds: this.stringArray(
        row.contradictoryEvidenceNodeIds,
      ),
      requiredTeachingPoints: this.stringArray(row.requiredTeachingPoints),
      forbiddenEvidencePatterns: this.stringArray(row.forbiddenEvidencePatterns),
      recommendedClueDistribution: this.asRecord(row.recommendedClueDistribution),
      generationPurpose: row.generationPurpose,
      readinessScore: row.readinessScore,
      readinessTier: this.readinessTier(row.readinessScore),
      readinessReasons: this.readinessReasons({
        readinessScore: row.readinessScore,
        primaryDifferentialIds: this.stringArray(row.primaryDifferentialIds),
        supportingTeachingRelationshipIds: this.stringArray(
          row.supportingTeachingRelationshipIds,
        ),
        supportingEvidenceRelationshipIds: this.stringArray(
          row.supportingEvidenceRelationshipIds,
        ),
        discriminatorEvidenceNodeIds: this.stringArray(
          row.discriminatorEvidenceNodeIds,
        ),
        requiredTeachingPoints: this.stringArray(row.requiredTeachingPoints),
      }),
      reasoningQualityWarnings: this.reasoningQualityWarnings({
        discriminatorCount: this.stringArray(row.discriminatorEvidenceNodeIds).length,
        teachingPointCount: this.stringArray(row.requiredTeachingPoints).length,
        evidenceLabels: this.stringArray(row.supportingEvidenceRelationshipIds),
        escalationCount: this.stringArray(row.escalationEvidenceNodeIds).length,
        differentialCount: this.stringArray(row.primaryDifferentialIds).length,
      }),
      status: row.status,
      reviewedByUser: row.reviewedByUser,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private readinessTier(score: number) {
    if (score >= 75) return 'ready';
    if (score >= 45) return 'partial';
    return 'weak';
  }

  private readinessReasons(input: {
    readinessScore: number;
    primaryDifferentialIds: string[];
    supportingTeachingRelationshipIds: string[];
    supportingEvidenceRelationshipIds: string[];
    discriminatorEvidenceNodeIds: string[];
    requiredTeachingPoints: string[];
  }) {
    return [
      `${input.supportingEvidenceRelationshipIds.length} active evidence relationships`,
      `${input.discriminatorEvidenceNodeIds.length} discriminator evidence nodes`,
      `${input.supportingTeachingRelationshipIds.length} active teaching relationships`,
      `${input.primaryDifferentialIds.length} primary differentials`,
      `${input.requiredTeachingPoints.length} required teaching points`,
      `readiness score ${input.readinessScore}`,
    ];
  }

  private async validateActivation(
    row: Prisma.ReasoningPathGetPayload<{ include: typeof PATH_INCLUDE }>,
  ) {
    const reasons: string[] = [];
    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: row.diagnosisRegistryId },
      select: { id: true, active: true, status: true, isGeneratable: true },
    });
    if (
      !registry ||
      !registry.active ||
      registry.status !== DiagnosisRegistryStatus.ACTIVE ||
      !registry.isGeneratable
    ) {
      reasons.push('Diagnosis must be active and generatable.');
    }
    if (this.stringArray(row.primaryDifferentialIds).includes(row.diagnosisRegistryId)) {
      reasons.push('Reasoning path cannot reference its own diagnosis as a differential.');
    }
    if (!this.stringArray(row.supportingEvidenceRelationshipIds).length) {
      reasons.push('At least one active evidence relationship is required.');
    }
    if (!this.stringArray(row.requiredTeachingPoints).length) {
      reasons.push('At least one required teaching point is required.');
    }

    const dependencyContext = await this.buildGenerationContext(row.id).catch(
      (error) => ({
        dependencyWarnings:
          error instanceof BadRequestException
            ? ['Reasoning path has stale dependencies.']
            : [String(error)],
      }),
    );
    if (
      'dependencyWarnings' in dependencyContext &&
      dependencyContext.dependencyWarnings.length
    ) {
      reasons.push(...dependencyContext.dependencyWarnings);
    }

    return { ready: reasons.length === 0, reasons };
  }

  private dependencyWarnings(input: {
    requestedEvidenceRelationshipIds: string[];
    requestedTeachingRelationshipIds: string[];
    evidenceRelationships: Array<{ id: string }>;
    teachingRelationships: Array<{ id: string }>;
  }) {
    const foundEvidence = new Set(
      input.evidenceRelationships.map((relationship) => relationship.id),
    );
    const foundTeaching = new Set(
      input.teachingRelationships.map((relationship) => relationship.id),
    );
    return [
      ...input.requestedEvidenceRelationshipIds
        .filter((id) => !foundEvidence.has(id))
        .map((id) => `Evidence relationship is inactive or missing: ${id}`),
      ...input.requestedTeachingRelationshipIds
        .filter((id) => !foundTeaching.has(id))
        .map((id) => `Teaching relationship is inactive or missing: ${id}`),
    ];
  }

  private log(event: string, payload: Record<string, unknown>) {
    this.logger.log(JSON.stringify({ event, ...payload }));
  }

  private stringArray(value: Prisma.JsonValue | string[] | null | undefined): string[] {
    if (!Array.isArray(value)) return [];
    return (value as unknown[]).filter(
      (item): item is string => typeof item === 'string',
    );
  }

  private isDifferentialTeachingRelationship(
    value: DiagnosisTeachingRelationshipType,
  ) {
    return (
      value === DiagnosisTeachingRelationshipType.DIFFERENTIAL_DISCRIMINATOR ||
      value === DiagnosisTeachingRelationshipType.MIMIC_CONFUSION ||
      value === DiagnosisTeachingRelationshipType.SHARED_PRESENTATION ||
      value === DiagnosisTeachingRelationshipType.INVESTIGATION_CONTRAST
    );
  }

  private asRecord(value: Prisma.JsonValue | null | undefined): Record<string, number> {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return Object.entries(value).reduce<Record<string, number>>((acc, [key, item]) => {
      if (typeof item === 'number') acc[key] = item;
      return acc;
    }, {});
  }

  private unique<T>(values: T[]) {
    return [...new Set(values)];
  }

  private normalize(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-');
  }
}
