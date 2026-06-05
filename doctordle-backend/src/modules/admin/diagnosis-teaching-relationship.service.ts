import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  DiagnosisRegistryStatus,
  DiagnosisTeachingRelationshipPurpose,
  DiagnosisTeachingRelationshipStatus,
  DiagnosisTeachingRelationshipType,
  DifferentialLinkRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { normalizeDiagnosisTerm } from '../diagnosis-registry/diagnosis-term-normalizer';

export type TeachingRelationshipReviewAction =
  | 'activate'
  | 'reject'
  | 'deprecate'
  | 'needs_review';

export type TeachingRelationshipListQuery = {
  diagnosisRegistryId?: string;
  sourceDiagnosisRegistryId?: string;
  targetDiagnosisRegistryId?: string;
  status?: DiagnosisTeachingRelationshipStatus | string;
  purpose?: DiagnosisTeachingRelationshipPurpose | string;
  relationshipType?: DiagnosisTeachingRelationshipType | string;
};

type RelationshipSeed = {
  sourceDiagnosisRegistryId: string;
  targetDiagnosisRegistryId: string;
  relationshipType: DiagnosisTeachingRelationshipType;
  teachingPurpose: DiagnosisTeachingRelationshipPurpose;
  discriminatorSummary?: string | null;
  commonConfusionReason?: string | null;
  learnerPitfall?: string | null;
  suggestedTeachingRuleStableKey?: string | null;
  supportingGraphFactId?: string | null;
  supportingDifferentialLinkId?: string | null;
  supportingTeachingRuleId?: string | null;
  strength: number;
};

type RelationshipRow = Prisma.DiagnosisTeachingRelationshipGetPayload<{
  include: typeof RELATIONSHIP_INCLUDE;
}>;

const RELATIONSHIP_INCLUDE = {
  sourceDiagnosisRegistry: {
    select: {
      id: true,
      displayLabel: true,
      canonicalName: true,
      status: true,
      active: true,
    },
  },
  targetDiagnosisRegistry: {
    select: {
      id: true,
      displayLabel: true,
      canonicalName: true,
      status: true,
      active: true,
    },
  },
  supportingGraphFact: {
    select: { id: true, type: true, label: true, status: true },
  },
  supportingTeachingRule: {
    select: { id: true, stableKey: true, title: true, status: true },
  },
  reviewedByUser: {
    select: { id: true, email: true, username: true },
  },
} satisfies Prisma.DiagnosisTeachingRelationshipInclude;

@Injectable()
export class DiagnosisTeachingRelationshipService {
  constructor(private readonly prisma: PrismaService) {}

  async listRelationships(query: TeachingRelationshipListQuery = {}) {
    const where: Prisma.DiagnosisTeachingRelationshipWhereInput = {
      ...(query.diagnosisRegistryId
        ? {
            OR: [
              { sourceDiagnosisRegistryId: query.diagnosisRegistryId },
              { targetDiagnosisRegistryId: query.diagnosisRegistryId },
            ],
          }
        : {}),
      ...(query.sourceDiagnosisRegistryId
        ? { sourceDiagnosisRegistryId: query.sourceDiagnosisRegistryId }
        : {}),
      ...(query.targetDiagnosisRegistryId
        ? { targetDiagnosisRegistryId: query.targetDiagnosisRegistryId }
        : {}),
      ...(query.status ? { status: query.status as DiagnosisTeachingRelationshipStatus } : {}),
      ...(query.purpose
        ? { teachingPurpose: query.purpose as DiagnosisTeachingRelationshipPurpose }
        : {}),
      ...(query.relationshipType
        ? {
            relationshipType:
              query.relationshipType as DiagnosisTeachingRelationshipType,
          }
        : {}),
    };

    const rows = await this.prisma.diagnosisTeachingRelationship.findMany({
      where,
      include: RELATIONSHIP_INCLUDE,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 250,
    });
    return rows.map((row) => this.toDto(row));
  }

  async listForDiagnosis(diagnosisRegistryId: string) {
    return this.listRelationships({ diagnosisRegistryId });
  }

  async generateCandidates(input: { diagnosisRegistryId?: string } = {}) {
    const seeds = await this.collectSeeds(input.diagnosisRegistryId);
    const registryIds = [
      ...new Set(
        seeds.flatMap((seed) => [
          seed.sourceDiagnosisRegistryId,
          seed.targetDiagnosisRegistryId,
        ]),
      ),
    ];
    const registryRows = await this.prisma.diagnosisRegistry.findMany({
      where: { id: { in: registryIds } },
      select: { id: true, status: true, active: true },
    });
    const registries = new Map(registryRows.map((row) => [row.id, row]));
    const created: RelationshipRow[] = [];
    let existingCount = 0;
    let skippedCount = 0;

    for (const seed of seeds) {
      if (
        seed.sourceDiagnosisRegistryId === seed.targetDiagnosisRegistryId ||
        !this.isUsableRegistry(registries.get(seed.sourceDiagnosisRegistryId)) ||
        !this.isUsableRegistry(registries.get(seed.targetDiagnosisRegistryId))
      ) {
        skippedCount += 1;
        continue;
      }

      const where = {
        sourceDiagnosisRegistryId_targetDiagnosisRegistryId_relationshipType_teachingPurpose:
          {
            sourceDiagnosisRegistryId: seed.sourceDiagnosisRegistryId,
            targetDiagnosisRegistryId: seed.targetDiagnosisRegistryId,
            relationshipType: seed.relationshipType,
            teachingPurpose: seed.teachingPurpose,
          },
      };
      const existing =
        await this.prisma.diagnosisTeachingRelationship.findUnique({
          where,
          include: RELATIONSHIP_INCLUDE,
        });
      if (existing) {
        existingCount += 1;
        continue;
      }

      const row = await this.prisma.diagnosisTeachingRelationship.create({
        data: {
          ...seed,
          status: DiagnosisTeachingRelationshipStatus.CANDIDATE,
        },
        include: RELATIONSHIP_INCLUDE,
      });
      created.push(row);
    }

    return {
      createdCount: created.length,
      existingCount,
      skippedCount,
      relationships: created.map((row) => this.toDto(row)),
    };
  }

  async reviewRelationship(
    id: string,
    reviewerUserId: string,
    body: { action?: TeachingRelationshipReviewAction; note?: string },
  ) {
    const action = body.action;
    if (!action) {
      throw new BadRequestException('Review action is required');
    }
    const row = await this.prisma.diagnosisTeachingRelationship.findUnique({
      where: { id },
      include: RELATIONSHIP_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Teaching relationship not found');
    }
    const nextStatus = this.statusForAction(action);
    if (nextStatus === DiagnosisTeachingRelationshipStatus.ACTIVE) {
      const readiness = this.evaluateReadiness(row);
      if (!readiness.ready) {
        throw new BadRequestException({
          message: 'Teaching relationship is not ready to activate',
          reasons: readiness.reasons,
        });
      }
    }

    const updated = await this.prisma.diagnosisTeachingRelationship.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
      include: RELATIONSHIP_INCLUDE,
    });
    return this.toDto(updated);
  }

  async getCoverageSummary(diagnosisRegistryId?: string) {
    const [graphFacts, caseLinks, educationLinks, activeRelationships] =
      await Promise.all([
        this.prisma.diagnosisGraphFact.findMany({
          where: {
            status: DiagnosisGraphFactStatus.ACTIVE,
            targetDiagnosisRegistryId: { not: null },
            ...(diagnosisRegistryId
              ? {
                  OR: [
                    { diagnosisRegistryId },
                    { targetDiagnosisRegistryId: diagnosisRegistryId },
                  ],
                }
              : {}),
          },
          select: { diagnosisRegistryId: true, targetDiagnosisRegistryId: true },
        }),
        this.prisma.caseDifferentialLink.findMany({
          where: diagnosisRegistryId
            ? {
                OR: [
                  { diagnosisRegistryId },
                  { case: { diagnosisRegistryId } },
                ],
              }
            : {},
          select: {
            diagnosisRegistryId: true,
            case: { select: { diagnosisRegistryId: true } },
          },
        }),
        this.prisma.educationDifferentialLink.findMany({
          where: diagnosisRegistryId
            ? {
                OR: [
                  { diagnosisRegistryId },
                  { education: { diagnosisRegistryId } },
                ],
              }
            : {},
          select: {
            diagnosisRegistryId: true,
            education: { select: { diagnosisRegistryId: true } },
          },
        }),
        this.prisma.diagnosisTeachingRelationship.findMany({
          where: {
            status: DiagnosisTeachingRelationshipStatus.ACTIVE,
            ...(diagnosisRegistryId
              ? {
                  OR: [
                    { sourceDiagnosisRegistryId: diagnosisRegistryId },
                    { targetDiagnosisRegistryId: diagnosisRegistryId },
                  ],
                }
              : {}),
          },
          select: {
            sourceDiagnosisRegistryId: true,
            targetDiagnosisRegistryId: true,
          },
        }),
      ]);
    const relationshipPairs = new Set(
      activeRelationships.map((row) =>
        this.pairKey(row.sourceDiagnosisRegistryId, row.targetDiagnosisRegistryId),
      ),
    );
    const graphPairs = graphFacts
      .filter((fact) => fact.targetDiagnosisRegistryId)
      .map((fact) =>
        this.pairKey(fact.diagnosisRegistryId, fact.targetDiagnosisRegistryId!),
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

    const sourceIdsWithGraph = new Set(graphFacts.map((fact) => fact.diagnosisRegistryId));
    const sourceIdsWithRelationships = new Set(
      activeRelationships.map((row) => row.sourceDiagnosisRegistryId),
    );

    return {
      activeTeachingRelationships: activeRelationships.length,
      graphFactsWithoutTeachingRelationships: graphPairs.filter(
        (pair) => !relationshipPairs.has(pair),
      ).length,
      differentialLinksWithoutTeachingRelationships: differentialPairs.filter(
        (link) => !relationshipPairs.has(this.pairKey(link.source!, link.target)),
      ).length,
      diagnosesWithWeakTeachingGraphCoverage: [...sourceIdsWithGraph].filter(
        (id) => !sourceIdsWithRelationships.has(id),
      ).length,
    };
  }

  private async collectSeeds(diagnosisRegistryId?: string) {
    const [graphSeeds, caseSeeds, educationSeeds, ruleSeeds] =
      await Promise.all([
        this.collectGraphSeeds(diagnosisRegistryId),
        this.collectCaseDifferentialSeeds(diagnosisRegistryId),
        this.collectEducationDifferentialSeeds(diagnosisRegistryId),
        this.collectTeachingRuleSeeds(diagnosisRegistryId),
      ]);
    return this.dedupeSeeds([
      ...graphSeeds,
      ...caseSeeds,
      ...educationSeeds,
      ...ruleSeeds,
    ]);
  }

  private async collectGraphSeeds(diagnosisRegistryId?: string) {
    const facts = await this.prisma.diagnosisGraphFact.findMany({
      where: {
        status: DiagnosisGraphFactStatus.ACTIVE,
        targetDiagnosisRegistryId: { not: null },
        ...(diagnosisRegistryId
          ? {
              OR: [
                { diagnosisRegistryId },
                { targetDiagnosisRegistryId: diagnosisRegistryId },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        diagnosisRegistryId: true,
        targetDiagnosisRegistryId: true,
        type: true,
        label: true,
      },
    });
    return facts.flatMap((fact): RelationshipSeed[] => {
      if (!fact.targetDiagnosisRegistryId) return [];
      const mapped = this.mapGraphFactType(fact.type);
      return [
        {
          sourceDiagnosisRegistryId: fact.diagnosisRegistryId,
          targetDiagnosisRegistryId: fact.targetDiagnosisRegistryId,
          relationshipType: mapped.type,
          teachingPurpose: mapped.purpose,
          discriminatorSummary: mapped.discriminator ? fact.label : null,
          commonConfusionReason: mapped.confusion ? fact.label : null,
          learnerPitfall:
            fact.type === DiagnosisGraphCandidateType.PITFALL
              ? fact.label
              : null,
          supportingGraphFactId: fact.id,
          strength: mapped.strength,
        },
      ];
    });
  }

  private async collectCaseDifferentialSeeds(diagnosisRegistryId?: string) {
    const links = await this.prisma.caseDifferentialLink.findMany({
      where: diagnosisRegistryId
        ? { OR: [{ diagnosisRegistryId }, { case: { diagnosisRegistryId } }] }
        : {},
      select: {
        id: true,
        diagnosisRegistryId: true,
        role: true,
        sourceText: true,
        case: { select: { diagnosisRegistryId: true, title: true } },
      },
    });
    return links.flatMap((link): RelationshipSeed[] => {
      const sourceId = link.case.diagnosisRegistryId;
      if (!sourceId || sourceId === link.diagnosisRegistryId) return [];
      return [
        {
          sourceDiagnosisRegistryId: sourceId,
          targetDiagnosisRegistryId: link.diagnosisRegistryId,
          relationshipType:
            link.role === DifferentialLinkRole.PRIMARY_MIMIC
              ? DiagnosisTeachingRelationshipType.MIMIC_CONFUSION
              : DiagnosisTeachingRelationshipType.DIFFERENTIAL_DISCRIMINATOR,
          teachingPurpose:
            link.role === DifferentialLinkRole.PRIMARY_MIMIC
              ? DiagnosisTeachingRelationshipPurpose.PREVENT_COMMON_ERROR
              : DiagnosisTeachingRelationshipPurpose.TEACH_DISCRIMINATOR,
          discriminatorSummary: link.sourceText,
          commonConfusionReason: link.case.title,
          supportingDifferentialLinkId: `case:${link.id}`,
          strength: link.role === DifferentialLinkRole.PRIMARY_MIMIC ? 3 : 2,
        },
      ];
    });
  }

  private async collectEducationDifferentialSeeds(diagnosisRegistryId?: string) {
    const links = await this.prisma.educationDifferentialLink.findMany({
      where: diagnosisRegistryId
        ? {
            OR: [
              { diagnosisRegistryId },
              { education: { diagnosisRegistryId } },
            ],
          }
        : {},
      select: {
        id: true,
        diagnosisRegistryId: true,
        role: true,
        sourceText: true,
        education: { select: { diagnosisRegistryId: true, title: true } },
      },
    });
    return links.flatMap((link): RelationshipSeed[] => {
      const sourceId = link.education.diagnosisRegistryId;
      if (!sourceId || sourceId === link.diagnosisRegistryId) return [];
      return [
        {
          sourceDiagnosisRegistryId: sourceId,
          targetDiagnosisRegistryId: link.diagnosisRegistryId,
          relationshipType: DiagnosisTeachingRelationshipType.DIFFERENTIAL_DISCRIMINATOR,
          teachingPurpose: DiagnosisTeachingRelationshipPurpose.SUPPORT_EDUCATION,
          discriminatorSummary: link.sourceText,
          commonConfusionReason: link.education.title,
          supportingDifferentialLinkId: `education:${link.id}`,
          strength:
            link.role === DifferentialLinkRole.PRIMARY_MIMIC ? 3 : 2,
        },
      ];
    });
  }

  private async collectTeachingRuleSeeds(diagnosisRegistryId?: string) {
    const rules = await this.prisma.diagnosisTeachingRule.findMany({
      where: {
        ...(diagnosisRegistryId ? { diagnosisRegistryId } : {}),
        requiredDifferentials: { not: Prisma.JsonNull },
      },
      select: {
        id: true,
        diagnosisRegistryId: true,
        stableKey: true,
        title: true,
        requiredDifferentials: true,
        appliesToGraph: true,
      },
    });
    const terms = [
      ...new Set(
        rules.flatMap((rule) => this.jsonStringArray(rule.requiredDifferentials)),
      ),
    ];
    const normalizedTerms = [...new Set(terms.map((term) => normalizeDiagnosisTerm(term)))];
    const [registries, aliases] = await Promise.all([
      this.prisma.diagnosisRegistry.findMany({
        where: { canonicalNormalized: { in: normalizedTerms } },
        select: { id: true, canonicalNormalized: true },
      }),
      this.prisma.diagnosisAlias.findMany({
        where: { normalizedTerm: { in: normalizedTerms }, active: true },
        select: { diagnosisRegistryId: true, normalizedTerm: true },
      }),
    ]);
    const byTerm = new Map<string, string>();
    for (const registry of registries) {
      byTerm.set(registry.canonicalNormalized, registry.id);
    }
    for (const alias of aliases) {
      byTerm.set(alias.normalizedTerm, alias.diagnosisRegistryId);
    }

    return rules.flatMap((rule): RelationshipSeed[] =>
      this.jsonStringArray(rule.requiredDifferentials).flatMap((term) => {
        const targetId = byTerm.get(normalizeDiagnosisTerm(term));
        if (!targetId || targetId === rule.diagnosisRegistryId) return [];
        return [
          {
            sourceDiagnosisRegistryId: rule.diagnosisRegistryId,
            targetDiagnosisRegistryId: targetId,
            relationshipType:
              DiagnosisTeachingRelationshipType.DIFFERENTIAL_DISCRIMINATOR,
            teachingPurpose:
              DiagnosisTeachingRelationshipPurpose.TEACH_DISCRIMINATOR,
            discriminatorSummary: rule.title,
            suggestedTeachingRuleStableKey: rule.stableKey,
            supportingTeachingRuleId: rule.id,
            strength: rule.appliesToGraph ? 3 : 2,
          },
        ];
      }),
    );
  }

  private mapGraphFactType(type: DiagnosisGraphCandidateType) {
    switch (type) {
      case DiagnosisGraphCandidateType.MIMIC:
        return {
          type: DiagnosisTeachingRelationshipType.MIMIC_CONFUSION,
          purpose: DiagnosisTeachingRelationshipPurpose.PREVENT_COMMON_ERROR,
          confusion: true,
          discriminator: false,
          strength: 3,
        };
      case DiagnosisGraphCandidateType.INVESTIGATION:
        return {
          type: DiagnosisTeachingRelationshipType.INVESTIGATION_CONTRAST,
          purpose: DiagnosisTeachingRelationshipPurpose.TEACH_DISCRIMINATOR,
          confusion: false,
          discriminator: true,
          strength: 2,
        };
      case DiagnosisGraphCandidateType.MANAGEMENT:
        return {
          type: DiagnosisTeachingRelationshipType.MANAGEMENT_CONTRAST,
          purpose: DiagnosisTeachingRelationshipPurpose.SUPPORT_EDUCATION,
          confusion: false,
          discriminator: true,
          strength: 2,
        };
      case DiagnosisGraphCandidateType.COMPLICATION:
        return {
          type: DiagnosisTeachingRelationshipType.COMPLICATION_RELATIONSHIP,
          purpose: DiagnosisTeachingRelationshipPurpose.SUPPORT_EDUCATION,
          confusion: false,
          discriminator: true,
          strength: 2,
        };
      case DiagnosisGraphCandidateType.PITFALL:
        return {
          type: DiagnosisTeachingRelationshipType.DIFFERENTIAL_DISCRIMINATOR,
          purpose: DiagnosisTeachingRelationshipPurpose.PREVENT_COMMON_ERROR,
          confusion: true,
          discriminator: true,
          strength: 2,
        };
      default:
        return {
          type: DiagnosisTeachingRelationshipType.SHARED_PRESENTATION,
          purpose: DiagnosisTeachingRelationshipPurpose.BUILD_DDX_CLUSTER,
          confusion: false,
          discriminator: true,
          strength: 1,
        };
    }
  }

  private evaluateReadiness(row: RelationshipRow) {
    const reasons: string[] = [];
    if (row.sourceDiagnosisRegistryId === row.targetDiagnosisRegistryId) {
      reasons.push('source_and_target_must_differ');
    }
    if (!this.isUsableRegistry(row.sourceDiagnosisRegistry)) {
      reasons.push('source_diagnosis_not_active');
    }
    if (!this.isUsableRegistry(row.targetDiagnosisRegistry)) {
      reasons.push('target_diagnosis_not_active');
    }
    if (
      !row.supportingGraphFactId &&
      !row.supportingDifferentialLinkId &&
      !row.supportingTeachingRuleId
    ) {
      reasons.push('missing_supporting_evidence');
    }
    if (
      !row.discriminatorSummary &&
      !row.commonConfusionReason &&
      !row.learnerPitfall
    ) {
      reasons.push('missing_teaching_summary');
    }
    return { ready: reasons.length === 0, reasons };
  }

  private statusForAction(action: TeachingRelationshipReviewAction) {
    switch (action) {
      case 'activate':
        return DiagnosisTeachingRelationshipStatus.ACTIVE;
      case 'reject':
        return DiagnosisTeachingRelationshipStatus.REJECTED;
      case 'deprecate':
        return DiagnosisTeachingRelationshipStatus.DEPRECATED;
      case 'needs_review':
        return DiagnosisTeachingRelationshipStatus.NEEDS_REVIEW;
      default:
        throw new BadRequestException('Unsupported teaching relationship action');
    }
  }

  private toDto(row: RelationshipRow) {
    const readiness = this.evaluateReadiness(row);
    return {
      ...row,
      readiness,
      suggestedTeachingRuleFromRelationship: {
        available: row.status === DiagnosisTeachingRelationshipStatus.ACTIVE,
        stableKey: row.suggestedTeachingRuleStableKey,
      },
      suggestedCaseFromRelationship: {
        available: row.status === DiagnosisTeachingRelationshipStatus.ACTIVE,
      },
      suggestedEducationContrastFromRelationship: {
        available: row.status === DiagnosisTeachingRelationshipStatus.ACTIVE,
      },
      suggestedRecallPromptFromRelationship: {
        available:
          row.status === DiagnosisTeachingRelationshipStatus.ACTIVE &&
          row.teachingPurpose ===
            DiagnosisTeachingRelationshipPurpose.SUPPORT_RECALL,
      },
    };
  }

  private isUsableRegistry(
    registry?: { status: DiagnosisRegistryStatus; active: boolean } | null,
  ) {
    return (
      Boolean(registry) &&
      registry?.active === true &&
      registry.status === DiagnosisRegistryStatus.ACTIVE
    );
  }

  private jsonStringArray(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private dedupeSeeds(seeds: RelationshipSeed[]) {
    const byKey = new Map<string, RelationshipSeed>();
    for (const seed of seeds) {
      const key = [
        seed.sourceDiagnosisRegistryId,
        seed.targetDiagnosisRegistryId,
        seed.relationshipType,
        seed.teachingPurpose,
      ].join(':');
      const existing = byKey.get(key);
      if (!existing || seed.strength > existing.strength) {
        byKey.set(key, seed);
      }
    }
    return [...byKey.values()];
  }

  private pairKey(sourceId: string, targetId: string) {
    return `${sourceId}:${targetId}`;
  }
}
