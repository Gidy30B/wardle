import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type DiagnosisEditorialBrief } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

const VALID_STATUSES = [
  'DRAFT',
  'NEEDS_REVIEW',
  'APPROVED',
  'ACTIVE',
  'DEPRECATED',
] as const;

const REVIEW_ACTION_TO_STATUS = {
  approve: 'APPROVED',
  activate: 'ACTIVE',
  deprecate: 'DEPRECATED',
  needs_review: 'NEEDS_REVIEW',
  draft: 'DRAFT',
} as const;

type EditorialBriefWritePayload = {
  summary?: unknown;
  learningGoals?: unknown;
  requiredTeachingRuleIds?: unknown;
  requiredMimicIds?: unknown;
  requiredPitfalls?: unknown;
  keyInvestigations?: unknown;
  managementAnchors?: unknown;
  difficultyGuidance?: unknown;
  caseGenerationGuidance?: unknown;
  educationGuidance?: unknown;
  graphGuidance?: unknown;
  status?: unknown;
};

export type EditorialBriefContext = {
  id: string;
  status: string;
  version: number;
  summary: string;
  learningGoals: string[];
  requiredTeachingRuleIds: string[];
  requiredMimicIds: string[];
  requiredPitfalls: string[];
  keyInvestigations: string[];
  managementAnchors: string[];
  difficultyGuidance: string[];
  caseGenerationGuidance: string[];
  educationGuidance: string[];
  graphGuidance: string[];
};

@Injectable()
export class DiagnosisEditorialBriefService {
  constructor(private readonly prisma: PrismaService) {}

  async getBrief(diagnosisRegistryId: string) {
    const diagnosis = await this.requireDiagnosis(diagnosisRegistryId);
    const brief = await this.prisma.diagnosisEditorialBrief.findUnique({
      where: { diagnosisRegistryId },
    });

    return {
      diagnosisRegistryId,
      diagnosisName: diagnosis.displayLabel || diagnosis.canonicalName,
      brief: brief ? this.toDto(brief) : null,
    };
  }

  async getApprovedBriefContext(
    diagnosisRegistryId: string,
  ): Promise<EditorialBriefContext | null> {
    const brief = await this.prisma.diagnosisEditorialBrief.findFirst({
      where: {
        diagnosisRegistryId,
        status: { in: ['APPROVED', 'ACTIVE'] },
      },
    });

    return brief ? this.toContext(brief) : null;
  }

  async createBrief(
    diagnosisRegistryId: string,
    payload: EditorialBriefWritePayload,
  ) {
    await this.requireDiagnosis(diagnosisRegistryId);
    const data = this.toCreateInput(diagnosisRegistryId, payload);

    try {
      const brief = await this.prisma.diagnosisEditorialBrief.create({ data });
      return this.toDto(brief);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'An editorial brief already exists for this diagnosis',
        );
      }
      throw error;
    }
  }

  async updateBrief(
    diagnosisRegistryId: string,
    payload: EditorialBriefWritePayload,
  ) {
    await this.requireDiagnosis(diagnosisRegistryId);
    await this.requireBrief(diagnosisRegistryId);
    const data = this.toUpdateInput(payload);
    if (!Object.keys(data).length) {
      throw new BadRequestException('No supported editorial brief fields provided');
    }

    const brief = await this.prisma.diagnosisEditorialBrief.update({
      where: { diagnosisRegistryId },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
    return this.toDto(brief);
  }

  async reviewBrief(diagnosisRegistryId: string, action: unknown) {
    await this.requireDiagnosis(diagnosisRegistryId);
    await this.requireBrief(diagnosisRegistryId);
    if (
      typeof action !== 'string' ||
      !(action in REVIEW_ACTION_TO_STATUS)
    ) {
      throw new BadRequestException('Invalid editorial brief review action');
    }

    const brief = await this.prisma.diagnosisEditorialBrief.update({
      where: { diagnosisRegistryId },
      data: {
        status:
          REVIEW_ACTION_TO_STATUS[action as keyof typeof REVIEW_ACTION_TO_STATUS],
        version: { increment: 1 },
      },
    });
    return this.toDto(brief);
  }

  async generateBrief(diagnosisRegistryId: string) {
    const context = await this.loadGenerationContext(diagnosisRegistryId);
    if (!context) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const payload = this.buildGeneratedPayload(context);
    const existing = await this.prisma.diagnosisEditorialBrief.findUnique({
      where: { diagnosisRegistryId },
    });

    const brief = existing
      ? await this.prisma.diagnosisEditorialBrief.update({
          where: { diagnosisRegistryId },
          data: {
            ...payload,
            status: 'NEEDS_REVIEW',
            version: { increment: 1 },
          },
        })
      : await this.prisma.diagnosisEditorialBrief.create({
          data: {
            diagnosisRegistry: { connect: { id: diagnosisRegistryId } },
            ...payload,
            status: 'NEEDS_REVIEW',
          },
        });

    return this.toDto(brief);
  }

  private async requireDiagnosis(diagnosisRegistryId: string) {
    const diagnosis = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        displayLabel: true,
      },
    });

    if (!diagnosis) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    return diagnosis;
  }

  private async requireBrief(diagnosisRegistryId: string) {
    const brief = await this.prisma.diagnosisEditorialBrief.findUnique({
      where: { diagnosisRegistryId },
    });
    if (!brief) {
      throw new NotFoundException('Editorial brief not found');
    }
    return brief;
  }

  private async loadGenerationContext(diagnosisRegistryId: string) {
    return this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        displayLabel: true,
        category: true,
        specialty: true,
        bodySystem: true,
        difficultyBand: true,
        teachingRules: {
          where: {
            status: { in: ['ACTIVE', 'APPROVED'] },
          },
          orderBy: [{ importance: 'asc' }, { category: 'asc' }],
          select: {
            id: true,
            stableKey: true,
            title: true,
            category: true,
            importance: true,
            rationale: true,
            requiredDifferentials: true,
            acceptableManifestations: true,
            difficultyHints: true,
            appliesToEducation: true,
            appliesToCaseGeneration: true,
            appliesToGraph: true,
          },
        },
        graphFacts: {
          where: { status: 'ACTIVE' },
          take: 20,
          select: {
            id: true,
            label: true,
            type: true,
            targetDiagnosisRegistryId: true,
            targetDiagnosisRegistry: {
              select: { displayLabel: true, canonicalName: true },
            },
          },
        },
        graphCandidates: {
          where: { status: { in: ['CANDIDATE', 'APPROVED'] } },
          take: 20,
          select: {
            id: true,
            type: true,
            rawText: true,
            targetDiagnosisRegistryId: true,
            targetDiagnosisRegistry: {
              select: { displayLabel: true, canonicalName: true },
            },
          },
        },
        education: {
          select: {
            editorialStatus: true,
            summary: true,
            investigations: true,
            management: true,
            pitfalls: true,
          },
        },
        cases: {
          take: 20,
          select: {
            explanation: true,
          },
        },
      },
    });
  }

  private buildGeneratedPayload(
    context: NonNullable<
      Awaited<ReturnType<DiagnosisEditorialBriefService['loadGenerationContext']>>
    >,
  ): Omit<Prisma.DiagnosisEditorialBriefCreateInput, 'diagnosisRegistry' | 'status'> {
    const diagnosisName = context.displayLabel || context.canonicalName;
    const criticalRules = context.teachingRules.filter(
      (rule) => rule.importance === 'critical',
    );
    const highRules = context.teachingRules.filter(
      (rule) => rule.importance === 'high',
    );
    const educationRules = context.teachingRules.filter(
      (rule) => rule.appliesToEducation,
    );
    const caseRules = context.teachingRules.filter(
      (rule) => rule.appliesToCaseGeneration,
    );
    const graphRules = context.teachingRules.filter((rule) => rule.appliesToGraph);
    const education =
      context.education &&
      ['PUBLISHED', 'APPROVED'].includes(context.education.editorialStatus)
        ? context.education
        : null;
    const mimicIds = this.unique([
      ...context.graphFacts
        .filter((fact) => fact.type === 'MIMIC')
        .map((fact) => fact.targetDiagnosisRegistryId)
        .filter((id): id is string => Boolean(id)),
      ...context.graphCandidates
        .filter((candidate) => candidate.type === 'MIMIC')
        .map((candidate) => candidate.targetDiagnosisRegistryId)
        .filter((id): id is string => Boolean(id)),
    ]);
    const mimicNames = this.unique([
      ...context.graphFacts
        .filter((fact) => fact.type === 'MIMIC')
        .map((fact) => this.targetName(fact)),
      ...context.graphCandidates
        .filter((candidate) => candidate.type === 'MIMIC')
        .map((candidate) => this.targetName(candidate) ?? candidate.rawText),
    ].filter((item): item is string => Boolean(item)));

    const ruleTitles = context.teachingRules.map((rule) => rule.title);
    const learningGoals = this.limit(
      [
        ...criticalRules.map((rule) => `Master ${rule.title}.`),
        ...highRules.map((rule) => `Use ${rule.title} in diagnosis reasoning.`),
        ...ruleTitles.map((title) => `Recognize ${title}.`),
      ],
      6,
    );

    return {
      summary: this.compact(
        [
          `${diagnosisName} should be taught as a reasoning pattern, not a fact list.`,
          criticalRules.length
            ? `Prioritize ${criticalRules.map((rule) => rule.title).join(', ')}.`
            : null,
          mimicNames.length
            ? `Keep mimics plausible: ${mimicNames.slice(0, 4).join(', ')}.`
            : null,
        ]
          .filter(Boolean)
          .join(' '),
        900,
      ),
      learningGoals,
      requiredTeachingRuleIds: context.teachingRules.map((rule) => rule.id),
      requiredMimicIds: mimicIds,
      requiredPitfalls: this.limit(
        [
          ...context.teachingRules
            .filter((rule) => rule.category === 'pitfall_concept')
            .map((rule) => rule.title),
          ...this.jsonStrings(education?.pitfalls),
        ],
        8,
      ),
      keyInvestigations: this.limit(
        [
          ...context.teachingRules
            .filter((rule) => rule.category === 'investigation_concept')
            .map((rule) => rule.title),
          ...this.jsonStrings(education?.investigations),
        ],
        8,
      ),
      managementAnchors: this.limit(
        [
          ...context.teachingRules
            .filter((rule) => rule.category === 'management_concept')
            .map((rule) => rule.title),
          ...this.jsonStrings(education?.management),
        ],
        8,
      ),
      difficultyGuidance: [
        context.difficultyBand
          ? `Base difficulty: ${context.difficultyBand}.`
          : 'Use progressive clue reveal.',
        criticalRules.length
          ? 'Do not reveal all critical units in the first clue.'
          : 'Escalate from pattern recognition to discriminator reasoning.',
      ],
      caseGenerationGuidance: this.limit(
        [
          caseRules.length
            ? `Select from ${caseRules.length} case-applicable teaching rules.`
            : null,
          mimicNames.length
            ? `Preserve mimics through early and mid clues: ${mimicNames
                .slice(0, 5)
                .join(', ')}.`
            : null,
          'Avoid clue sequences that collapse the differential immediately.',
        ].filter((item): item is string => Boolean(item)),
        6,
      ),
      educationGuidance: this.limit(
        [
          educationRules.length
            ? `Make education explicitly cover ${educationRules.length} approved teaching rules.`
            : null,
          'Use discriminators, management implications, and trap-avoidance language.',
        ].filter((item): item is string => Boolean(item)),
        6,
      ),
      graphGuidance: this.limit(
        [
          graphRules.length
            ? `Promote graph facts for ${graphRules.length} graph-applicable teaching rules.`
            : null,
          'Prefer discriminator and mechanism facts over generic labels.',
        ].filter((item): item is string => Boolean(item)),
        6,
      ),
      version: 1,
    };
  }

  private toCreateInput(
    diagnosisRegistryId: string,
    payload: EditorialBriefWritePayload,
  ): Prisma.DiagnosisEditorialBriefCreateInput {
    return {
      diagnosisRegistry: { connect: { id: diagnosisRegistryId } },
      summary: this.requiredString(payload.summary, 'summary'),
      learningGoals: this.jsonArray(payload.learningGoals, 'learningGoals'),
      requiredTeachingRuleIds: this.jsonArray(
        payload.requiredTeachingRuleIds,
        'requiredTeachingRuleIds',
      ),
      requiredMimicIds: this.optionalJsonArray(payload.requiredMimicIds),
      requiredPitfalls: this.optionalJsonArray(payload.requiredPitfalls),
      keyInvestigations: this.optionalJsonArray(payload.keyInvestigations),
      managementAnchors: this.optionalJsonArray(payload.managementAnchors),
      difficultyGuidance: this.optionalJsonArray(payload.difficultyGuidance),
      caseGenerationGuidance: this.optionalJsonArray(
        payload.caseGenerationGuidance,
      ),
      educationGuidance: this.optionalJsonArray(payload.educationGuidance),
      graphGuidance: this.optionalJsonArray(payload.graphGuidance),
      status: payload.status
        ? this.enumValue(payload.status, VALID_STATUSES, 'status')
        : 'DRAFT',
    };
  }

  private toUpdateInput(
    payload: EditorialBriefWritePayload,
  ): Prisma.DiagnosisEditorialBriefUpdateInput {
    const data: Prisma.DiagnosisEditorialBriefUpdateInput = {};
    if (payload.summary !== undefined) {
      data.summary = this.requiredString(payload.summary, 'summary');
    }
    if (payload.learningGoals !== undefined) {
      data.learningGoals = this.jsonArray(payload.learningGoals, 'learningGoals');
    }
    if (payload.requiredTeachingRuleIds !== undefined) {
      data.requiredTeachingRuleIds = this.jsonArray(
        payload.requiredTeachingRuleIds,
        'requiredTeachingRuleIds',
      );
    }
    if (payload.requiredMimicIds !== undefined) {
      data.requiredMimicIds = this.optionalJsonArray(payload.requiredMimicIds);
    }
    if (payload.requiredPitfalls !== undefined) {
      data.requiredPitfalls = this.optionalJsonArray(payload.requiredPitfalls);
    }
    if (payload.keyInvestigations !== undefined) {
      data.keyInvestigations = this.optionalJsonArray(payload.keyInvestigations);
    }
    if (payload.managementAnchors !== undefined) {
      data.managementAnchors = this.optionalJsonArray(payload.managementAnchors);
    }
    if (payload.difficultyGuidance !== undefined) {
      data.difficultyGuidance = this.optionalJsonArray(payload.difficultyGuidance);
    }
    if (payload.caseGenerationGuidance !== undefined) {
      data.caseGenerationGuidance = this.optionalJsonArray(
        payload.caseGenerationGuidance,
      );
    }
    if (payload.educationGuidance !== undefined) {
      data.educationGuidance = this.optionalJsonArray(payload.educationGuidance);
    }
    if (payload.graphGuidance !== undefined) {
      data.graphGuidance = this.optionalJsonArray(payload.graphGuidance);
    }
    if (payload.status !== undefined) {
      data.status = this.enumValue(payload.status, VALID_STATUSES, 'status');
    }
    return data;
  }

  private toDto(brief: DiagnosisEditorialBrief) {
    return {
      id: brief.id,
      diagnosisRegistryId: brief.diagnosisRegistryId,
      summary: brief.summary,
      learningGoals: brief.learningGoals,
      requiredTeachingRuleIds: brief.requiredTeachingRuleIds,
      requiredMimicIds: brief.requiredMimicIds,
      requiredPitfalls: brief.requiredPitfalls,
      keyInvestigations: brief.keyInvestigations,
      managementAnchors: brief.managementAnchors,
      difficultyGuidance: brief.difficultyGuidance,
      caseGenerationGuidance: brief.caseGenerationGuidance,
      educationGuidance: brief.educationGuidance,
      graphGuidance: brief.graphGuidance,
      status: brief.status,
      version: brief.version,
      createdAt: brief.createdAt.toISOString(),
      updatedAt: brief.updatedAt.toISOString(),
    };
  }

  private toContext(brief: DiagnosisEditorialBrief): EditorialBriefContext {
    return {
      id: brief.id,
      status: brief.status,
      version: brief.version,
      summary: brief.summary,
      learningGoals: this.jsonStrings(brief.learningGoals),
      requiredTeachingRuleIds: this.jsonStrings(brief.requiredTeachingRuleIds),
      requiredMimicIds: this.jsonStrings(brief.requiredMimicIds),
      requiredPitfalls: this.jsonStrings(brief.requiredPitfalls),
      keyInvestigations: this.jsonStrings(brief.keyInvestigations),
      managementAnchors: this.jsonStrings(brief.managementAnchors),
      difficultyGuidance: this.jsonStrings(brief.difficultyGuidance),
      caseGenerationGuidance: this.jsonStrings(brief.caseGenerationGuidance),
      educationGuidance: this.jsonStrings(brief.educationGuidance),
      graphGuidance: this.jsonStrings(brief.graphGuidance),
    };
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private jsonArray(value: unknown, field: string): Prisma.InputJsonValue {
    if (!Array.isArray(value)) {
      throw new BadRequestException(`${field} must be an array`);
    }
    return value as Prisma.InputJsonValue;
  }

  private optionalJsonArray(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.JsonNull;
    if (!Array.isArray(value)) {
      throw new BadRequestException('Expected array JSON');
    }
    return value as Prisma.InputJsonValue;
  }

  private enumValue<T extends readonly string[]>(
    value: unknown,
    allowed: T,
    field: string,
  ): T[number] {
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return value;
  }

  private jsonStrings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return this.firstString(
            record.title,
            record.label,
            record.content,
            record.name,
            record.diagnosis,
          );
        }
        return null;
      })
      .filter((item): item is string => Boolean(item?.trim()));
  }

  private firstString(...values: unknown[]) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  private targetName(value: {
    targetDiagnosisRegistry?: { displayLabel: string; canonicalName: string } | null;
  }) {
    return (
      value.targetDiagnosisRegistry?.displayLabel ||
      value.targetDiagnosisRegistry?.canonicalName ||
      null
    );
  }

  private unique(values: string[]) {
    return [...new Set(values.filter(Boolean))];
  }

  private limit(values: string[], count: number) {
    return this.unique(values).slice(0, count);
  }

  private compact(value: string, maxLength: number): string {
    const compacted = value.replace(/\s+/g, ' ').trim();
    return compacted.length > maxLength
      ? `${compacted.slice(0, maxLength - 1).trim()}...`
      : compacted;
  }
}
