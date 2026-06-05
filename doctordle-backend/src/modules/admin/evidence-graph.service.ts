import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalCategory,
  DiagnosisEvidenceRelationshipStatus,
  DiagnosisEvidenceRelationshipType,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  DiagnosisRegistryStatus,
  DiagnosisTeachingRelationshipStatus,
  EvidenceNodeStatus,
  EvidenceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { normalizeDiagnosisTerm } from '../diagnosis-registry/diagnosis-term-normalizer';

export type EvidenceGraphReviewAction = 'activate' | 'reject' | 'deprecate';

export type EvidenceGraphListQuery = {
  diagnosisRegistryId?: string;
  evidenceNodeId?: string;
  evidenceType?: EvidenceType | string;
  relationshipType?: DiagnosisEvidenceRelationshipType | string;
  status?: DiagnosisEvidenceRelationshipStatus | string;
  minDiscriminatorWeight?: number;
};

type EvidenceSeed = {
  diagnosisRegistryId: string;
  displayLabel: string;
  evidenceType: EvidenceType;
  clinicalCategory: ClinicalCategory;
  relationshipType: DiagnosisEvidenceRelationshipType;
  strength: number;
  discriminatorWeight: number;
  reasoningSummary: string;
  contradictoryDiagnosisIds?: string[] | null;
  supportingTeachingRelationshipId?: string | null;
  supportingTeachingRuleId?: string | null;
  supportingCaseId?: string | null;
};

type RelationshipRow = Prisma.DiagnosisEvidenceRelationshipGetPayload<{
  include: typeof RELATIONSHIP_INCLUDE;
}>;

const RELATIONSHIP_INCLUDE = {
  diagnosisRegistry: {
    select: {
      id: true,
      displayLabel: true,
      canonicalName: true,
      status: true,
      active: true,
    },
  },
  evidenceNode: true,
  supportingTeachingRelationship: {
    select: {
      id: true,
      relationshipType: true,
      teachingPurpose: true,
      status: true,
      targetDiagnosisRegistry: {
        select: { id: true, displayLabel: true, canonicalName: true },
      },
    },
  },
  supportingTeachingRule: {
    select: { id: true, stableKey: true, title: true, status: true },
  },
  supportingCase: {
    select: { id: true, title: true, editorialStatus: true },
  },
  reviewedByUser: {
    select: { id: true, email: true, username: true },
  },
} satisfies Prisma.DiagnosisEvidenceRelationshipInclude;

@Injectable()
export class EvidenceGraphService {
  constructor(private readonly prisma: PrismaService) {}

  async listNodes(query: { q?: string; evidenceType?: string; status?: string } = {}) {
    return this.prisma.evidenceNode.findMany({
      where: {
        ...(query.q
          ? {
              OR: [
                { displayLabel: { contains: query.q, mode: 'insensitive' } },
                { normalizedKey: { contains: normalizeEvidenceKey(query.q) } },
              ],
            }
          : {}),
        ...(query.evidenceType
          ? { evidenceType: query.evidenceType as EvidenceType }
          : {}),
        ...(query.status ? { status: query.status as EvidenceNodeStatus } : {}),
      },
      orderBy: [{ evidenceType: 'asc' }, { displayLabel: 'asc' }],
      take: 250,
    });
  }

  async listRelationships(query: EvidenceGraphListQuery = {}) {
    const rows = await this.prisma.diagnosisEvidenceRelationship.findMany({
      where: {
        ...(query.diagnosisRegistryId
          ? { diagnosisRegistryId: query.diagnosisRegistryId }
          : {}),
        ...(query.evidenceNodeId ? { evidenceNodeId: query.evidenceNodeId } : {}),
        ...(query.relationshipType
          ? {
              relationshipType:
                query.relationshipType as DiagnosisEvidenceRelationshipType,
            }
          : {}),
        ...(query.status
          ? { status: query.status as DiagnosisEvidenceRelationshipStatus }
          : {}),
        ...(query.evidenceType
          ? { evidenceNode: { evidenceType: query.evidenceType as EvidenceType } }
          : {}),
        ...(typeof query.minDiscriminatorWeight === 'number'
          ? { discriminatorWeight: { gte: query.minDiscriminatorWeight } }
          : {}),
      },
      include: RELATIONSHIP_INCLUDE,
      orderBy: [
        { status: 'asc' },
        { discriminatorWeight: 'desc' },
        { strength: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: 300,
    });
    return rows.map((row) => this.toDto(row));
  }

  async getForDiagnosis(diagnosisRegistryId: string) {
    const relationships = await this.listRelationships({ diagnosisRegistryId });
    return {
      diagnosisRegistryId,
      relationships,
      summary: {
        total: relationships.length,
        active: relationships.filter((row) => row.status === 'ACTIVE').length,
        discriminatorEvidence: relationships.filter(
          (row) =>
            row.relationshipType === 'DISCRIMINATES' ||
            row.discriminatorWeight >= 3,
        ).length,
        weakEvidenceCoverage: relationships.filter(
          (row) => row.status === 'ACTIVE' && row.strength <= 1,
        ).length,
        byType: this.countBy(relationships, (row) => row.evidenceNode.evidenceType),
      },
      suggestedEvidenceForCaseGeneration: relationships
        .filter((row) => row.status === 'ACTIVE')
        .slice(0, 12),
      suggestedDiscriminatorEvidence: relationships
        .filter((row) => row.discriminatorWeight >= 3)
        .slice(0, 12),
      suggestedMissingEvidenceCoverage:
        relationships.length === 0 || relationships.every((row) => row.status !== 'ACTIVE'),
      suggestedReasoningPath: relationships
        .filter((row) => row.status === 'ACTIVE')
        .sort(
          (left, right) =>
            right.discriminatorWeight - left.discriminatorWeight ||
            right.strength - left.strength,
        )
        .slice(0, 6),
    };
  }

  async generateCandidates(input: { diagnosisRegistryId?: string } = {}) {
    const seeds = this.dedupeSeeds([
      ...(await this.collectCaseSeeds(input.diagnosisRegistryId)),
      ...(await this.collectTeachingRuleSeeds(input.diagnosisRegistryId)),
      ...(await this.collectEducationSeeds(input.diagnosisRegistryId)),
      ...(await this.collectTeachingRelationshipSeeds(input.diagnosisRegistryId)),
      ...(await this.collectGraphFactSeeds(input.diagnosisRegistryId)),
    ]);
    const registryIds = [...new Set(seeds.map((seed) => seed.diagnosisRegistryId))];
    const registries = new Map(
      (
        await this.prisma.diagnosisRegistry.findMany({
          where: { id: { in: registryIds } },
          select: { id: true, status: true, active: true },
        })
      ).map((row) => [row.id, row]),
    );
    const created: RelationshipRow[] = [];
    let existingCount = 0;
    let skippedCount = 0;

    for (const seed of seeds) {
      if (!this.isActiveRegistry(registries.get(seed.diagnosisRegistryId))) {
        skippedCount += 1;
        continue;
      }
      const node = await this.upsertEvidenceNode(seed);
      const existing =
        await this.prisma.diagnosisEvidenceRelationship.findUnique({
          where: {
            diagnosisRegistryId_evidenceNodeId_relationshipType: {
              diagnosisRegistryId: seed.diagnosisRegistryId,
              evidenceNodeId: node.id,
              relationshipType: seed.relationshipType,
            },
          },
          include: RELATIONSHIP_INCLUDE,
        });
      if (existing) {
        existingCount += 1;
        continue;
      }
      const row = await this.prisma.diagnosisEvidenceRelationship.create({
        data: {
          diagnosisRegistryId: seed.diagnosisRegistryId,
          evidenceNodeId: node.id,
          relationshipType: seed.relationshipType,
          strength: seed.strength,
          discriminatorWeight: seed.discriminatorWeight,
          reasoningSummary: seed.reasoningSummary,
          contradictoryDiagnosisIds: seed.contradictoryDiagnosisIds?.length
            ? seed.contradictoryDiagnosisIds
            : Prisma.JsonNull,
          supportingTeachingRelationshipId:
            seed.supportingTeachingRelationshipId ?? null,
          supportingTeachingRuleId: seed.supportingTeachingRuleId ?? null,
          supportingCaseId: seed.supportingCaseId ?? null,
          status: DiagnosisEvidenceRelationshipStatus.CANDIDATE,
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
    body: { action?: EvidenceGraphReviewAction },
  ) {
    if (!body.action) {
      throw new BadRequestException('Evidence graph review action is required');
    }
    const row = await this.prisma.diagnosisEvidenceRelationship.findUnique({
      where: { id },
      include: RELATIONSHIP_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Evidence relationship not found');
    }
    const nextStatus = this.statusForAction(body.action);
    if (nextStatus === DiagnosisEvidenceRelationshipStatus.ACTIVE) {
      const readiness = this.evaluateReadiness(row);
      if (!readiness.ready) {
        throw new BadRequestException({
          message: 'Evidence relationship is not ready to activate',
          reasons: readiness.reasons,
        });
      }
      const duplicate = await this.prisma.diagnosisEvidenceRelationship.findFirst({
        where: {
          id: { not: id },
          diagnosisRegistryId: row.diagnosisRegistryId,
          evidenceNodeId: row.evidenceNodeId,
          relationshipType: row.relationshipType,
          status: DiagnosisEvidenceRelationshipStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new BadRequestException('Duplicate active evidence relationship');
      }
    }

    const updated = await this.prisma.diagnosisEvidenceRelationship.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
      include: RELATIONSHIP_INCLUDE,
    });
    if (nextStatus === DiagnosisEvidenceRelationshipStatus.ACTIVE) {
      await this.prisma.evidenceNode.update({
        where: { id: row.evidenceNodeId },
        data: { status: EvidenceNodeStatus.ACTIVE },
      });
    }
    return this.toDto(updated);
  }

  async getCoverageSummary() {
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
            discriminatorWeight: true,
            evidenceNode: { select: { normalizedKey: true } },
          },
        }),
        this.prisma.diagnosisEvidenceRelationship.groupBy({
          by: ['diagnosisRegistryId'],
          where: {
            status: DiagnosisEvidenceRelationshipStatus.ACTIVE,
            OR: [
              { relationshipType: DiagnosisEvidenceRelationshipType.DISCRIMINATES },
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
      evidenceCoverageGaps: Math.max(
        0,
        activeRegistries - evidenceByDiagnosis.size,
      ),
    };
  }

  private async upsertEvidenceNode(seed: EvidenceSeed) {
    const normalizedKey = normalizeEvidenceKey(seed.displayLabel);
    return this.prisma.evidenceNode.upsert({
      where: { normalizedKey },
      update: {
        displayLabel: seed.displayLabel,
        evidenceType: seed.evidenceType,
        clinicalCategory: seed.clinicalCategory,
      },
      create: {
        normalizedKey,
        displayLabel: seed.displayLabel,
        evidenceType: seed.evidenceType,
        clinicalCategory: seed.clinicalCategory,
        synonyms: [],
        status: EvidenceNodeStatus.CANDIDATE,
      },
    });
  }

  private async collectCaseSeeds(diagnosisRegistryId?: string) {
    const cases = await this.prisma.case.findMany({
      where: {
        diagnosisRegistryId: { not: null },
        ...(diagnosisRegistryId ? { diagnosisRegistryId } : {}),
      },
      select: {
        id: true,
        diagnosisRegistryId: true,
        clues: true,
        symptoms: true,
        labs: true,
      },
      take: 1000,
    });
    const seeds: EvidenceSeed[] = [];
    for (const caseRow of cases) {
      if (!caseRow.diagnosisRegistryId) continue;
      for (const clue of this.parseClues(caseRow.clues)) {
        seeds.push(
          this.seedFromText({
            diagnosisRegistryId: caseRow.diagnosisRegistryId,
            text: clue.value,
            clueType: clue.type,
            source: 'case clue',
            supportingCaseId: caseRow.id,
          }),
        );
      }
      for (const symptom of caseRow.symptoms ?? []) {
        seeds.push(
          this.seedFromText({
            diagnosisRegistryId: caseRow.diagnosisRegistryId,
            text: symptom,
            clueType: 'symptom',
            source: 'case symptom',
            supportingCaseId: caseRow.id,
          }),
        );
      }
      for (const lab of this.extractStrings(caseRow.labs)) {
        seeds.push(
          this.seedFromText({
            diagnosisRegistryId: caseRow.diagnosisRegistryId,
            text: lab,
            clueType: 'lab',
            source: 'case lab',
            supportingCaseId: caseRow.id,
          }),
        );
      }
    }
    return seeds;
  }

  private async collectTeachingRuleSeeds(diagnosisRegistryId?: string) {
    const rules = await this.prisma.diagnosisTeachingRule.findMany({
      where: diagnosisRegistryId ? { diagnosisRegistryId } : {},
      select: {
        id: true,
        diagnosisRegistryId: true,
        title: true,
        category: true,
        rationale: true,
        acceptableManifestations: true,
        expectedEvidence: true,
      },
      take: 1000,
    });
    return rules.flatMap((rule) =>
      [
        ...this.extractStrings(rule.expectedEvidence),
        ...this.extractStrings(rule.acceptableManifestations),
      ].map((text) =>
        this.seedFromText({
          diagnosisRegistryId: rule.diagnosisRegistryId,
          text,
          clueType: this.clueTypeFromTeachingCategory(rule.category),
          source: rule.title || 'teaching rule',
          supportingTeachingRuleId: rule.id,
          forceDiscriminator: /differential|pitfall|discrimin/i.test(rule.category),
        }),
      ),
    );
  }

  private async collectEducationSeeds(diagnosisRegistryId?: string) {
    const educationRows = await this.prisma.diagnosisEducation.findMany({
      where: diagnosisRegistryId ? { diagnosisRegistryId } : {},
      select: {
        diagnosisRegistryId: true,
        examPearls: true,
        investigations: true,
        management: true,
        keySymptoms: true,
        keySigns: true,
      },
      take: 1000,
    });
    return educationRows.flatMap((row) => [
      ...this.extractStrings(row.keySymptoms).map((text) =>
        this.seedFromText({
          diagnosisRegistryId: row.diagnosisRegistryId,
          text,
          clueType: 'symptom',
          source: 'education symptoms',
        }),
      ),
      ...this.extractStrings(row.keySigns).map((text) =>
        this.seedFromText({
          diagnosisRegistryId: row.diagnosisRegistryId,
          text,
          clueType: 'exam',
          source: 'education signs',
          forceDiscriminator: true,
        }),
      ),
      ...this.extractStrings(row.examPearls).map((text) =>
        this.seedFromText({
          diagnosisRegistryId: row.diagnosisRegistryId,
          text,
          clueType: 'exam',
          source: 'education exam',
          forceDiscriminator: true,
        }),
      ),
      ...this.extractStrings(row.investigations).map((text) =>
        this.seedFromText({
          diagnosisRegistryId: row.diagnosisRegistryId,
          text,
          clueType: this.isImagingText(text) ? 'imaging' : 'lab',
          source: 'education investigations',
          forceDiscriminator: true,
        }),
      ),
      ...this.extractStrings(row.management).map((text) =>
        this.seedFromText({
          diagnosisRegistryId: row.diagnosisRegistryId,
          text,
          clueType: 'management',
          source: 'education management',
        }),
      ),
    ]);
  }

  private async collectTeachingRelationshipSeeds(diagnosisRegistryId?: string) {
    const relationships =
      await this.prisma.diagnosisTeachingRelationship.findMany({
        where: {
          status: { in: [DiagnosisTeachingRelationshipStatus.ACTIVE, DiagnosisTeachingRelationshipStatus.CANDIDATE] },
          ...(diagnosisRegistryId
            ? { sourceDiagnosisRegistryId: diagnosisRegistryId }
            : {}),
        },
        select: {
          id: true,
          sourceDiagnosisRegistryId: true,
          targetDiagnosisRegistryId: true,
          discriminatorSummary: true,
          commonConfusionReason: true,
          learnerPitfall: true,
        },
        take: 1000,
      });
    return relationships.flatMap((relationship) =>
      [
        relationship.discriminatorSummary,
        relationship.commonConfusionReason,
        relationship.learnerPitfall,
      ]
        .filter((text): text is string => Boolean(text))
        .map((text) =>
          this.seedFromText({
            diagnosisRegistryId: relationship.sourceDiagnosisRegistryId,
            text,
            clueType: this.inferClueType(text),
            source: 'teaching relationship',
            supportingTeachingRelationshipId: relationship.id,
            contradictoryDiagnosisIds: [relationship.targetDiagnosisRegistryId],
            forceDiscriminator: true,
          }),
        ),
    );
  }

  private async collectGraphFactSeeds(diagnosisRegistryId?: string) {
    const facts = await this.prisma.diagnosisGraphFact.findMany({
      where: {
        status: DiagnosisGraphFactStatus.ACTIVE,
        ...(diagnosisRegistryId ? { diagnosisRegistryId } : {}),
      },
      select: {
        diagnosisRegistryId: true,
        type: true,
        label: true,
        targetDiagnosisRegistryId: true,
      },
      take: 1000,
    });
    return facts
      .filter((fact) =>
        ([
          DiagnosisGraphCandidateType.FINDING,
          DiagnosisGraphCandidateType.INVESTIGATION,
          DiagnosisGraphCandidateType.PITFALL,
          DiagnosisGraphCandidateType.MANAGEMENT,
          DiagnosisGraphCandidateType.COMPLICATION,
        ] as DiagnosisGraphCandidateType[]).includes(fact.type),
      )
      .map((fact) =>
        this.seedFromText({
          diagnosisRegistryId: fact.diagnosisRegistryId,
          text: fact.label,
          clueType: this.clueTypeFromGraphType(fact.type, fact.label),
          source: `graph ${fact.type.toLowerCase()}`,
          contradictoryDiagnosisIds: fact.targetDiagnosisRegistryId
            ? [fact.targetDiagnosisRegistryId]
            : null,
          forceDiscriminator:
            fact.type === DiagnosisGraphCandidateType.INVESTIGATION ||
            fact.type === DiagnosisGraphCandidateType.PITFALL,
        }),
      );
  }

  private seedFromText(input: {
    diagnosisRegistryId: string;
    text: string;
    clueType: string;
    source: string;
    forceDiscriminator?: boolean;
    contradictoryDiagnosisIds?: string[] | null;
    supportingTeachingRelationshipId?: string | null;
    supportingTeachingRuleId?: string | null;
    supportingCaseId?: string | null;
  }): EvidenceSeed {
    const displayLabel = normalizeDisplayLabel(input.text);
    const evidenceType = this.evidenceTypeFor(input.clueType, displayLabel);
    const relationshipType = this.relationshipTypeFor(
      evidenceType,
      displayLabel,
      input.forceDiscriminator,
    );
    return {
      diagnosisRegistryId: input.diagnosisRegistryId,
      displayLabel,
      evidenceType,
      clinicalCategory: this.clinicalCategoryFor(displayLabel),
      relationshipType,
      strength: this.strengthFor(evidenceType, displayLabel),
      discriminatorWeight: this.discriminatorWeightFor(
        relationshipType,
        evidenceType,
        displayLabel,
      ),
      reasoningSummary: `${displayLabel} from ${input.source}`,
      contradictoryDiagnosisIds: input.contradictoryDiagnosisIds ?? null,
      supportingTeachingRelationshipId:
        input.supportingTeachingRelationshipId ?? null,
      supportingTeachingRuleId: input.supportingTeachingRuleId ?? null,
      supportingCaseId: input.supportingCaseId ?? null,
    };
  }

  private parseClues(value: Prisma.JsonValue | null) {
    const parsed = typeof value === 'string' ? safeJson(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const record = entry as Record<string, unknown>;
      if (typeof record.value !== 'string') return [];
      return [
        {
          type: typeof record.type === 'string' ? record.type : 'history',
          value: record.value,
        },
      ];
    });
  }

  private extractStrings(value: unknown): string[] {
    if (!value) return [];
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap((item) => this.extractStrings(item));
    if (typeof value !== 'object') return [];
    const record = value as Record<string, unknown>;
    const preferred = [
      record.title,
      record.label,
      record.content,
      record.expectedFinding,
      record.finding,
      record.discriminator,
      record.whyItMatters,
      record.managementImplication,
      record.escalationImplication,
    ].filter((item): item is string => typeof item === 'string');
    return preferred.length ? preferred : [];
  }

  private evidenceTypeFor(type: string, text: string): EvidenceType {
    const normalized = type.toLowerCase();
    if (normalized === 'symptom') return EvidenceType.SYMPTOM;
    if (normalized === 'exam' || normalized === 'vital') return EvidenceType.EXAM;
    if (normalized === 'lab') return EvidenceType.LAB;
    if (normalized === 'imaging') return EvidenceType.IMAGING;
    if (normalized === 'management') return EvidenceType.MANAGEMENT;
    if (/\b(risk|smoker|pregnan|travel|exposure|family history)\b/i.test(text)) {
      return EvidenceType.RISK_FACTOR;
    }
    return EvidenceType.HISTORY;
  }

  private relationshipTypeFor(
    evidenceType: EvidenceType,
    text: string,
    forceDiscriminator?: boolean,
  ) {
    if (/\b(free air|shock|hypotension|peritonitis|sepsis|rupture|perforat)\b/i.test(text)) {
      return DiagnosisEvidenceRelationshipType.ESCALATES;
    }
    if (evidenceType === EvidenceType.MANAGEMENT) {
      return DiagnosisEvidenceRelationshipType.MANAGEMENT_SIGNAL;
    }
    if (/\b(complication|signal|consequence)\b/i.test(text)) {
      return DiagnosisEvidenceRelationshipType.COMPLICATION_SIGNAL;
    }
    if (
      forceDiscriminator ||
      ([EvidenceType.LAB, EvidenceType.IMAGING, EvidenceType.EXAM] as EvidenceType[]).includes(evidenceType)
    ) {
      return DiagnosisEvidenceRelationshipType.DISCRIMINATES;
    }
    return DiagnosisEvidenceRelationshipType.SUPPORTS;
  }

  private discriminatorWeightFor(
    relationshipType: DiagnosisEvidenceRelationshipType,
    evidenceType: EvidenceType,
    text: string,
  ) {
    if (relationshipType === DiagnosisEvidenceRelationshipType.ESCALATES) return 5;
    if (relationshipType === DiagnosisEvidenceRelationshipType.DISCRIMINATES) {
      return ([EvidenceType.LAB, EvidenceType.IMAGING] as EvidenceType[]).includes(evidenceType)
        ? 4
        : 3;
    }
    if (/\b(classic|specific|pathognomonic|rules out|distinguish)\b/i.test(text)) {
      return 3;
    }
    return 1;
  }

  private strengthFor(evidenceType: EvidenceType, text: string) {
    if (/\b(pathognomonic|specific|diagnostic|free air|troponin|ct|mri|ultrasound)\b/i.test(text)) {
      return 4;
    }
    if (([EvidenceType.LAB, EvidenceType.IMAGING, EvidenceType.EXAM] as EvidenceType[]).includes(evidenceType)) {
      return 3;
    }
    return 2;
  }

  private clinicalCategoryFor(text: string): ClinicalCategory {
    if (/\bpain|tender|colic|ache\b/i.test(text)) return ClinicalCategory.PAIN;
    if (/\bbleed|blood|hemorrhag|melena|hematemesis\b/i.test(text)) return ClinicalCategory.BLEEDING;
    if (/\bfever|infect|sepsis|purulent|wbc|leukocyt/i.test(text)) return ClinicalCategory.INFECTION;
    if (/\bweakness|seizure|confusion|neuro|headache|focal\b/i.test(text)) return ClinicalCategory.NEUROLOGIC;
    if (/\bdyspnea|cough|wheeze|hypoxia|respir/i.test(text)) return ClinicalCategory.RESPIRATORY;
    if (/\bchest|troponin|ecg|hypotension|tachy|cardio\b/i.test(text)) return ClinicalCategory.CARDIOVASCULAR;
    if (/\babdom|epigastr|vomit|diarrhea|gi|bowel|peritone/i.test(text)) return ClinicalCategory.GI;
    if (/\bglucose|thyroid|ketone|endocr/i.test(text)) return ClinicalCategory.ENDOCRINE;
    if (/\bcreatinine|urine|renal|kidney|hematur/i.test(text)) return ClinicalCategory.RENAL;
    if (/\btrauma|fracture|injury|fall\b/i.test(text)) return ClinicalCategory.TRAUMA;
    return ClinicalCategory.OTHER;
  }

  private clueTypeFromTeachingCategory(category: string) {
    if (/management/i.test(category)) return 'management';
    if (/exam/i.test(category)) return 'exam';
    if (/investigation|lab/i.test(category)) return 'lab';
    return 'history';
  }

  private clueTypeFromGraphType(type: DiagnosisGraphCandidateType, text: string) {
    if (type === DiagnosisGraphCandidateType.INVESTIGATION) {
      return this.isImagingText(text) ? 'imaging' : 'lab';
    }
    if (type === DiagnosisGraphCandidateType.MANAGEMENT) return 'management';
    if (type === DiagnosisGraphCandidateType.COMPLICATION) return 'history';
    return this.inferClueType(text);
  }

  private inferClueType(text: string) {
    if (this.isImagingText(text)) return 'imaging';
    if (/\b(lab|serum|urine|troponin|cbc|wbc|creatinine|glucose|ketone)\b/i.test(text)) return 'lab';
    if (/\b(sign|tenderness|guarding|rigidity|exam|murphy|rovsing)\b/i.test(text)) return 'exam';
    if (/\b(management|treat|surgery|antibiotic|consult)\b/i.test(text)) return 'management';
    if (/\b(pain|cough|nausea|vomit|dyspnea|fever)\b/i.test(text)) return 'symptom';
    return 'history';
  }

  private isImagingText(text: string) {
    return /\b(ct|mri|ultrasound|x[- ]?ray|radiograph|imaging|scan|free air)\b/i.test(text);
  }

  private evaluateReadiness(row: RelationshipRow) {
    const reasons: string[] = [];
    if (!this.isActiveRegistry(row.diagnosisRegistry)) {
      reasons.push('diagnosis_not_active');
    }
    if (!row.reasoningSummary?.trim()) {
      reasons.push('missing_reasoning_summary');
    }
    if (row.evidenceNode.status === EvidenceNodeStatus.REJECTED) {
      reasons.push('evidence_node_rejected');
    }
    return { ready: reasons.length === 0, reasons };
  }

  private statusForAction(action: EvidenceGraphReviewAction) {
    switch (action) {
      case 'activate':
        return DiagnosisEvidenceRelationshipStatus.ACTIVE;
      case 'reject':
        return DiagnosisEvidenceRelationshipStatus.REJECTED;
      case 'deprecate':
        return DiagnosisEvidenceRelationshipStatus.DEPRECATED;
      default:
        throw new BadRequestException('Unsupported evidence graph action');
    }
  }

  private toDto(row: RelationshipRow) {
    return {
      ...row,
      readiness: this.evaluateReadiness(row),
      suggestedEvidenceForCaseGeneration: row.status === 'ACTIVE',
      suggestedDiscriminatorEvidence:
        row.status === 'ACTIVE' && row.discriminatorWeight >= 3,
      suggestedMissingEvidenceCoverage: false,
      suggestedReasoningPath:
        row.status === 'ACTIVE' ? row.reasoningSummary : null,
    };
  }

  private isActiveRegistry(
    registry?: { status: DiagnosisRegistryStatus; active: boolean } | null,
  ) {
    return (
      Boolean(registry) &&
      registry?.status === DiagnosisRegistryStatus.ACTIVE &&
      registry.active === true
    );
  }

  private dedupeSeeds(seeds: EvidenceSeed[]) {
    const byKey = new Map<string, EvidenceSeed>();
    for (const seed of seeds.filter((item) => item.displayLabel.length >= 3)) {
      const key = [
        seed.diagnosisRegistryId,
        normalizeEvidenceKey(seed.displayLabel),
        seed.relationshipType,
      ].join(':');
      const existing = byKey.get(key);
      if (
        !existing ||
        seed.discriminatorWeight > existing.discriminatorWeight ||
        seed.strength > existing.strength
      ) {
        byKey.set(key, seed);
      }
    }
    return [...byKey.values()];
  }

  private countBy<T>(items: T[], keyFn: (item: T) => string) {
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = keyFn(item);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }
}

function normalizeEvidenceKey(value: string) {
  return normalizeDiagnosisTerm(value)
    .replace(/\b(the|a|an|with|and|or|of|to|by|for)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDisplayLabel(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
