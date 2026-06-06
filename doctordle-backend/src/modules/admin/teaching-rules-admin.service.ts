import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GenerationPurpose, Prisma, type DiagnosisTeachingRule } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { DiagnosisCurriculumProviderService } from '../education/diagnosis-curriculum-provider.service';
import { DiagnosisTeachingRuleSeedService } from '../education/diagnosis-teaching-rule-seed.service';
import {
  ReasoningPathService,
  type EducationalReasoningGenerationContext,
} from './reasoning-path.service';
import { ReasoningDraftValidationService } from './reasoning-draft-validation.service';

const VALID_CATEGORIES = [
  'differential_concept',
  'finding_concept',
  'exam_mechanism',
  'investigation_concept',
  'pitfall_concept',
  'management_concept',
  'recall_concept',
] as const;

const VALID_IMPORTANCE = ['critical', 'high', 'supporting'] as const;
const VALID_STATUSES = [
  'CANDIDATE',
  'NEEDS_REVIEW',
  'APPROVED',
  'ACTIVE',
  'DEPRECATED',
  'REJECTED',
] as const;
const VALID_SOURCES = [
  'LEGACY_SEED',
  'EDITOR_CREATED',
  'LEARNED_FROM_REVISION',
  'GENERATED',
  'GRAPH_DERIVED',
] as const;
const REVIEW_ACTION_TO_STATUS = {
  approve: 'APPROVED',
  activate: 'ACTIVE',
  reject: 'REJECTED',
  deprecate: 'DEPRECATED',
  needs_review: 'NEEDS_REVIEW',
} as const;

type TeachingRuleWritePayload = {
  stableKey?: unknown;
  title?: unknown;
  category?: unknown;
  importance?: unknown;
  rationale?: unknown;
  acceptableManifestations?: unknown;
  requiredDifferentials?: unknown;
  expectedEvidence?: unknown;
  difficultyHints?: unknown;
  avoidTooEarly?: unknown;
  appliesToEducation?: unknown;
  appliesToCaseGeneration?: unknown;
  appliesToGraph?: unknown;
  status?: unknown;
  source?: unknown;
};

@Injectable()
export class TeachingRulesAdminService {
  private readonly logger = new Logger(TeachingRulesAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumProvider: DiagnosisCurriculumProviderService,
    private readonly teachingRuleSeedService: DiagnosisTeachingRuleSeedService,
    private readonly reasoningPathService?: ReasoningPathService,
    private readonly reasoningDraftValidationService?: ReasoningDraftValidationService,
  ) {}

  async listRules(diagnosisRegistryId: string) {
    const diagnosis = await this.requireDiagnosis(diagnosisRegistryId);
    const rules = await this.prisma.diagnosisTeachingRule.findMany({
      where: { diagnosisRegistryId },
      orderBy: [{ status: 'asc' }, { category: 'asc' }, { stableKey: 'asc' }],
    });

    return {
      diagnosisRegistryId,
      diagnosisName: diagnosis.displayLabel || diagnosis.canonicalName,
      rules: rules.map((rule) => this.toDto(rule)),
    };
  }

  async createRule(diagnosisRegistryId: string, payload: TeachingRuleWritePayload) {
    await this.requireDiagnosis(diagnosisRegistryId);
    const data = this.toCreateInput(diagnosisRegistryId, payload);

    try {
      const rule = await this.prisma.diagnosisTeachingRule.create({ data });
      return this.toDto(rule);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A teaching rule with this stableKey already exists for this diagnosis',
        );
      }
      throw error;
    }
  }

  async updateRule(ruleId: string, payload: TeachingRuleWritePayload) {
    await this.requireRule(ruleId);
    const data = this.toUpdateInput(payload);
    if (!Object.keys(data).length) {
      throw new BadRequestException('No supported teaching rule fields provided');
    }

    try {
      const rule = await this.prisma.diagnosisTeachingRule.update({
        where: { id: ruleId },
        data,
      });
      return this.toDto(rule);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A teaching rule with this stableKey already exists for this diagnosis',
        );
      }
      throw error;
    }
  }

  async reviewRule(ruleId: string, action: unknown) {
    await this.requireRule(ruleId);
    if (
      typeof action !== 'string' ||
      !(action in REVIEW_ACTION_TO_STATUS)
    ) {
      throw new BadRequestException('Invalid teaching rule review action');
    }

    const rule = await this.prisma.diagnosisTeachingRule.update({
      where: { id: ruleId },
      data: {
        status:
          REVIEW_ACTION_TO_STATUS[action as keyof typeof REVIEW_ACTION_TO_STATUS],
      },
    });
    return this.toDto(rule);
  }

  async generateCandidateRules(diagnosisRegistryId: string) {
    const registry = await this.loadGenerationContext(diagnosisRegistryId);
    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const reasoningContext =
      await this.reasoningPathService?.buildEducationalGenerationContext({
        diagnosisRegistryId,
        purpose: GenerationPurpose.TEACHING_RULE_GENERATION,
      });
    const candidates = this.buildCandidates(registry, reasoningContext);
    const created: DiagnosisTeachingRule[] = [];

    for (const candidate of candidates) {
      const duplicate = await this.prisma.diagnosisTeachingRule.findFirst({
        where: {
          diagnosisRegistryId,
          OR: [
            { stableKey: candidate.stableKey },
            {
              title: {
                equals: candidate.title,
                mode: 'insensitive',
              },
            },
          ],
        },
      });
      if (duplicate) {
        continue;
      }

      const rule = await this.prisma.diagnosisTeachingRule.create({
          data: {
            diagnosisRegistry: { connect: { id: diagnosisRegistryId } },
            ...candidate,
          },
        });
      created.push(rule);
      await this.reasoningDraftValidationService?.runAfterGeneration({
        artifactType: 'TEACHING_RULE',
        artifactId: rule.id,
      });
    }

    return {
      diagnosisRegistryId,
      generatedCount: created.length,
      generationMetadata: this.generationMetadata(reasoningContext),
      rules: created.map((rule) => this.toDto(rule)),
    };
  }

  async seedLegacyRulesForDiagnosis(diagnosisRegistryId: string) {
    return this.teachingRuleSeedService.seedLegacyTeachingRulesForDiagnosis(
      diagnosisRegistryId,
    );
  }

  async validateTeachingUnitIds(
    diagnosisRegistryId: string,
    teachingUnitIds: string[],
  ) {
    if (!teachingUnitIds.length) {
      return;
    }

    const registry = await this.requireDiagnosis(diagnosisRegistryId);
    const rules = await this.curriculumProvider.getRules({
      id: registry.id,
      canonicalName: registry.canonicalName,
      displayLabel: registry.displayLabel,
      aliases: registry.aliases,
      specialty: registry.specialty,
      category: registry.category,
      bodySystem: registry.bodySystem,
      clinicalSetting: registry.clinicalSetting,
      difficultyBand: registry.difficultyBand,
    });
    const allowed = new Set(rules?.teachingUnits.map((unit) => unit.id) ?? []);
    const invalid = teachingUnitIds.filter((id) => !allowed.has(id));
    if (invalid.length) {
      throw new BadRequestException(
        `Invalid teachingUnitIds for diagnosis: ${invalid.join(', ')}`,
      );
    }
  }

  private async requireDiagnosis(diagnosisRegistryId: string) {
    const diagnosis = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        displayLabel: true,
        specialty: true,
        category: true,
        bodySystem: true,
        clinicalSetting: true,
        difficultyBand: true,
        aliases: {
          where: { active: true },
          select: { term: true },
        },
      },
    });

    if (!diagnosis) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    return diagnosis;
  }

  private async requireRule(ruleId: string) {
    const rule = await this.prisma.diagnosisTeachingRule.findUnique({
      where: { id: ruleId },
    });
    if (!rule) {
      throw new NotFoundException('Teaching rule not found');
    }
    return rule;
  }

  private toCreateInput(
    diagnosisRegistryId: string,
    payload: TeachingRuleWritePayload,
  ): Prisma.DiagnosisTeachingRuleCreateInput {
    return {
      diagnosisRegistry: { connect: { id: diagnosisRegistryId } },
      stableKey: this.stableKey(payload.stableKey),
      title: this.requiredString(payload.title, 'title'),
      category: this.enumValue(payload.category, VALID_CATEGORIES, 'category'),
      importance: this.enumValue(
        payload.importance,
        VALID_IMPORTANCE,
        'importance',
      ),
      rationale: this.optionalString(payload.rationale),
      acceptableManifestations: this.jsonArray(payload.acceptableManifestations),
      requiredDifferentials: this.jsonArray(payload.requiredDifferentials),
      expectedEvidence: this.jsonObject(payload.expectedEvidence),
      difficultyHints: this.jsonObject(payload.difficultyHints),
      avoidTooEarly: this.optionalBoolean(payload.avoidTooEarly, false),
      appliesToEducation: this.optionalBoolean(
        payload.appliesToEducation,
        true,
      ),
      appliesToCaseGeneration: this.optionalBoolean(
        payload.appliesToCaseGeneration,
        true,
      ),
      appliesToGraph: this.optionalBoolean(payload.appliesToGraph, false),
      status: payload.status
        ? this.enumValue(payload.status, VALID_STATUSES, 'status')
        : 'NEEDS_REVIEW',
      source: payload.source
        ? this.enumValue(payload.source, VALID_SOURCES, 'source')
        : 'EDITOR_CREATED',
    };
  }

  private toUpdateInput(
    payload: TeachingRuleWritePayload,
  ): Prisma.DiagnosisTeachingRuleUpdateInput {
    const data: Prisma.DiagnosisTeachingRuleUpdateInput = {};
    if (payload.stableKey !== undefined) data.stableKey = this.stableKey(payload.stableKey);
    if (payload.title !== undefined) data.title = this.requiredString(payload.title, 'title');
    if (payload.category !== undefined) data.category = this.enumValue(payload.category, VALID_CATEGORIES, 'category');
    if (payload.importance !== undefined) data.importance = this.enumValue(payload.importance, VALID_IMPORTANCE, 'importance');
    if (payload.rationale !== undefined) data.rationale = this.optionalString(payload.rationale);
    if (payload.acceptableManifestations !== undefined) data.acceptableManifestations = this.jsonArray(payload.acceptableManifestations);
    if (payload.requiredDifferentials !== undefined) data.requiredDifferentials = this.jsonArray(payload.requiredDifferentials);
    if (payload.expectedEvidence !== undefined) data.expectedEvidence = this.jsonObject(payload.expectedEvidence);
    if (payload.difficultyHints !== undefined) data.difficultyHints = this.jsonObject(payload.difficultyHints);
    if (payload.avoidTooEarly !== undefined) data.avoidTooEarly = this.optionalBoolean(payload.avoidTooEarly, false);
    if (payload.appliesToEducation !== undefined) data.appliesToEducation = this.optionalBoolean(payload.appliesToEducation, true);
    if (payload.appliesToCaseGeneration !== undefined) data.appliesToCaseGeneration = this.optionalBoolean(payload.appliesToCaseGeneration, true);
    if (payload.appliesToGraph !== undefined) data.appliesToGraph = this.optionalBoolean(payload.appliesToGraph, false);
    if (payload.status !== undefined) data.status = this.enumValue(payload.status, VALID_STATUSES, 'status');
    if (payload.source !== undefined) data.source = this.enumValue(payload.source, VALID_SOURCES, 'source');
    return data;
  }

  private async loadGenerationContext(diagnosisRegistryId: string) {
    return this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        displayLabel: true,
        education: {
          select: {
            examPearls: true,
            investigations: true,
            differentials: true,
            management: true,
            pitfalls: true,
          },
        },
        graphFacts: {
          select: { label: true, payload: true },
        },
        graphCandidates: {
          select: { rawText: true, payload: true },
          take: 20,
        },
        cases: {
          select: { explanation: true },
          take: 20,
        },
      },
    });
  }

  private buildCandidates(
    registry: NonNullable<Awaited<ReturnType<TeachingRulesAdminService['loadGenerationContext']>>>,
    reasoningContext?: EducationalReasoningGenerationContext,
  ) {
    const textItems = [
      ...this.reasoningTeachingItems(reasoningContext),
      ...this.sectionItems(registry.education?.differentials, 'differential_concept'),
      ...this.sectionItems(registry.education?.investigations, 'investigation_concept'),
      ...this.sectionItems(registry.education?.examPearls, 'exam_mechanism'),
      ...this.sectionItems(registry.education?.management, 'management_concept'),
      ...this.sectionItems(registry.education?.pitfalls, 'pitfall_concept'),
      ...registry.graphFacts.map((fact) => ({
        title: fact.label,
        category: 'finding_concept',
        manifestation: fact.label,
      })),
      ...registry.graphCandidates.map((candidate) => ({
        title: candidate.rawText,
        category: 'finding_concept',
        manifestation: candidate.rawText,
      })),
      ...this.caseTeachingUnits(registry.cases),
    ];
    const seen = new Set<string>();
    const candidates = [];

    for (const item of textItems) {
      const title = this.compactTitle(item.title);
      const stableKey = this.normalizeKey(title);
      if (!title || !stableKey || seen.has(stableKey)) {
        continue;
      }
      seen.add(stableKey);
      candidates.push({
        stableKey,
        title,
        category: this.enumValue(item.category, VALID_CATEGORIES, 'category'),
        importance: 'supporting',
        rationale: reasoningContext?.constrained
          ? `Candidate constrained by reasoning path ${reasoningContext.reasoningPathId} for ${registry.displayLabel || registry.canonicalName}.`
          : `Candidate inferred from existing editorial material for ${registry.displayLabel || registry.canonicalName}.`,
        acceptableManifestations: [item.manifestation || title],
        requiredDifferentials:
          reasoningContext?.contradictoryDiagnosisIds?.slice(0, 6) ?? [],
        expectedEvidence: this.expectedEvidenceMetadata(reasoningContext, item),
        difficultyHints: this.generationMetadata(reasoningContext),
        avoidTooEarly: false,
        appliesToEducation: true,
        appliesToCaseGeneration: true,
        appliesToGraph: false,
        status: 'CANDIDATE',
        source: 'GENERATED',
      } satisfies Omit<Prisma.DiagnosisTeachingRuleCreateInput, 'diagnosisRegistry'>);
      if (candidates.length >= 8) break;
    }

    this.logger.log(
      JSON.stringify({
        event: reasoningContext?.constrained
          ? 'teaching_rule.generate.constrained'
          : 'teaching_rule.generate.unconstrained_fallback',
        diagnosisRegistryId: registry.id,
        reasoningPathId: reasoningContext?.reasoningPathId ?? null,
        generatedCandidateCount: candidates.length,
        warnings: reasoningContext?.warnings ?? [],
      }),
    );

    return candidates;
  }

  private sectionItems(value: unknown, category: string) {
    const items = Array.isArray(value) ? value : [];
    return items
      .map((item) => this.asObject(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        title:
          this.firstString(item.title, item.content, item.finding, item.action) ??
          '',
        manifestation:
          this.firstString(item.content, item.discriminator, item.whyItMatters) ??
          '',
        category,
      }));
  }

  private reasoningTeachingItems(
    reasoningContext?: EducationalReasoningGenerationContext,
  ) {
    if (!reasoningContext) return [];
    return [
      ...reasoningContext.requiredTeachingPoints.map((point) => ({
        title: point,
        category: 'differential_concept',
        manifestation: point,
      })),
      ...reasoningContext.discriminatorEvidenceUsed.map((evidence) => ({
        title: evidence,
        category: 'finding_concept',
        manifestation: evidence,
      })),
      ...reasoningContext.plannerRecommendations.map((recommendation) => ({
        title: recommendation,
        category: 'recall_concept',
        manifestation: recommendation,
      })),
    ];
  }

  private expectedEvidenceMetadata(
    reasoningContext: EducationalReasoningGenerationContext | undefined,
    item: { title: string; category: string; manifestation?: string },
  ): Prisma.InputJsonValue {
    return {
      generation: 'teaching_rule',
      item,
      sourceEvidenceRelationshipIds:
        reasoningContext?.sourceEvidenceRelationshipIds ?? [],
      discriminatorEvidenceUsed:
        reasoningContext?.discriminatorEvidenceUsed ?? [],
      reasoningQualityWarnings:
        reasoningContext?.reasoningQualityWarnings ?? [],
    };
  }

  private generationMetadata(
    reasoningContext?: EducationalReasoningGenerationContext,
  ): Prisma.InputJsonValue {
    if (!reasoningContext) {
      return {
        generatedBecause: {
          constrained: false,
          confidence: 'lower',
          hallucinationRisk: 'high',
          warnings: ['No reasoning path service was available.'],
        },
      };
    }
    return {
      generatedBecause: {
        constrained: reasoningContext.constrained,
        confidence: reasoningContext.confidence,
        hallucinationRisk: reasoningContext.hallucinationRisk,
        reasoningPathId: reasoningContext.reasoningPathId,
        reasoningGoal: reasoningContext.reasoningGoal,
        sourceTeachingRelationshipIds:
          reasoningContext.sourceTeachingRelationshipIds,
        sourceEvidenceRelationshipIds:
          reasoningContext.sourceEvidenceRelationshipIds,
        coverageGapsAddressed: reasoningContext.coverageGapsAddressed,
        discriminatorEvidenceUsed: reasoningContext.discriminatorEvidenceUsed,
        generationCoverageSnapshot:
          reasoningContext.generationCoverageSnapshot,
        warnings: reasoningContext.warnings,
        reasoningQualityWarnings:
          reasoningContext.reasoningQualityWarnings,
      },
    };
  }

  private caseTeachingUnits(cases: Array<{ explanation: unknown }>) {
    return cases.flatMap((caseRecord) => {
      const quality = this.asObject(this.asObject(caseRecord.explanation)?.generationQuality);
      const alignment = this.asObject(quality?.teachingAlignment);
      const units = Array.isArray(alignment?.selectedUnits)
        ? alignment.selectedUnits
        : [];
      return units
        .map((unit) => this.asObject(unit))
        .filter((unit): unit is Record<string, unknown> => Boolean(unit))
        .map((unit) => ({
          title: this.firstString(unit.label, unit.id) ?? '',
          manifestation: this.firstString(unit.label, unit.id) ?? '',
          category: 'recall_concept',
        }));
    });
  }

  private toDto(rule: DiagnosisTeachingRule) {
    return {
      id: rule.id,
      diagnosisRegistryId: rule.diagnosisRegistryId,
      stableKey: rule.stableKey,
      title: rule.title,
      category: rule.category,
      importance: rule.importance,
      rationale: rule.rationale,
      acceptableManifestations: rule.acceptableManifestations,
      requiredDifferentials: rule.requiredDifferentials,
      expectedEvidence: rule.expectedEvidence,
      difficultyHints: rule.difficultyHints,
      generationMetadata:
        this.asObject(rule.difficultyHints)?.generatedBecause ?? null,
      reasoningQualityWarnings: this.stringArray(
        this.asObject(
          this.asObject(rule.difficultyHints)?.generatedBecause,
        )?.reasoningQualityWarnings,
      ),
      avoidTooEarly: rule.avoidTooEarly,
      appliesToEducation: rule.appliesToEducation,
      appliesToCaseGeneration: rule.appliesToCaseGeneration,
      appliesToGraph: rule.appliesToGraph,
      status: rule.status,
      source: rule.source,
      version: rule.version,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }

  private stableKey(value: unknown): string {
    const key = this.requiredString(value, 'stableKey');
    if (!/^[a-z0-9][a-z0-9_:-]{1,80}$/i.test(key)) {
      throw new BadRequestException(
        'stableKey must be 2-80 characters using letters, numbers, underscore, colon, or hyphen',
      );
    }
    return key;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private optionalString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') throw new BadRequestException('Expected string');
    return value.trim() || null;
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

  private jsonArray(value: unknown): Prisma.InputJsonValue {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new BadRequestException('Expected array JSON');
    return value as Prisma.InputJsonValue;
  }

  private jsonObject(value: unknown): Prisma.InputJsonValue {
    if (value === undefined || value === null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Expected object JSON');
    }
    return value as Prisma.InputJsonValue;
  }

  private optionalBoolean(value: unknown, fallback: boolean): boolean {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'boolean') throw new BadRequestException('Expected boolean');
    return value;
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private firstString(...values: unknown[]): string | null {
    const value = values.find(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
    return value?.trim() ?? null;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private compactTitle(value: string): string {
    return value.replace(/\s+/g, ' ').trim().slice(0, 90);
  }

  private normalizeKey(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
  }
}
