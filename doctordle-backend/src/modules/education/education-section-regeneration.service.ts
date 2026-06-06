import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  GenerationPurpose,
  Prisma,
  type DiagnosisEducation,
} from '@prisma/client';
import OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import { getEnv } from '../../core/config/env.validation';
import { PrismaService } from '../../core/db/prisma.service';
import { DifferentialMappingService } from '../diagnosis-graph/differential-mapping.service';
import { GenerationContextBuilder } from '../editorial/generation-context-builder.service';
import {
  ReasoningPathService,
  type EducationalReasoningGenerationContext,
} from '../admin/reasoning-path.service';
import { ReasoningDraftValidationService } from '../admin/reasoning-draft-validation.service';
import {
  EducationDraftQualityValidator,
} from './education-draft-quality-validator.service';
import { EducationEditorialPatternsService } from './education-editorial-patterns.service';
import { EducationKnowledgeRulesService } from './education-knowledge-rules.service';
import { EducationSchemaContractService } from './education-schema-contract.service';
import type { EducationRegenerableSection } from './education-section-quality-classifier.service';
import { DiagnosisCurriculumProviderService } from './diagnosis-curriculum-provider.service';

const OPENAI_SECTION_MODEL = 'gpt-4o-mini';
const OPENAI_SECTION_TIMEOUT_MS = 45_000;

const PEARL_TYPE_VALUES = [
  'PATTERN_RECOGNITION',
  'HIGH_YIELD_DISCRIMINATOR',
  'PITFALL',
  'ESCALATION_RED_FLAG',
  'MANAGEMENT',
  'MNEMONIC',
  'EXAM',
  'INVESTIGATION',
] as const;

const SECTION_TYPE: Record<EducationRegenerableSection, string> = {
  differentials: 'HIGH_YIELD_DISCRIMINATOR',
  investigations: 'INVESTIGATION',
  examPearls: 'EXAM',
  management: 'MANAGEMENT',
};

const SECTION_INSTRUCTION: Record<EducationRegenerableSection, string> = {
  differentials:
    'For each mimic, use title for diagnosis, content for whyConfused overlap/comparison, discriminator for keySeparator, and trapAvoided for classicTrap.',
  investigations:
    'For each test, use content for test plus expected finding, whyItMatters for interpretation or trap, and managementImplication only for direct use or limit of the result.',
  examPearls:
    'For each exam pearl, use content for named bedside finding plus mechanism, whyItMatters for diagnostic impact, and discriminator for the mimic separator; do not place scoring systems here.',
  management:
    'For each management anchor, use content for action and indication, whyItMatters for rationale, managementImplication for next step, and escalationImplication for consequence; do not repeat diagnostic pattern prose.',
};

const SECTION_MAX_ITEMS: Record<EducationRegenerableSection, number> = {
  differentials: 5,
  investigations: 4,
  examPearls: 4,
  management: 4,
};

type SectionRegenerationResult = DiagnosisEducation & {
  qualityReport: ReturnType<EducationDraftQualityValidator['validate']>;
};

@Injectable()
export class EducationSectionRegenerationService {
  private readonly logger = new Logger(EducationSectionRegenerationService.name);
  private readonly openaiClient?: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly generationContextBuilder: GenerationContextBuilder,
    private readonly educationDraftQualityValidator: EducationDraftQualityValidator = new EducationDraftQualityValidator(),
    private readonly educationKnowledgeRulesService: EducationKnowledgeRulesService = new EducationKnowledgeRulesService(),
    private readonly diagnosisCurriculumProviderService: DiagnosisCurriculumProviderService = new DiagnosisCurriculumProviderService(),
    private readonly educationEditorialPatternsService: EducationEditorialPatternsService = new EducationEditorialPatternsService(),
    private readonly educationSchemaContractService: EducationSchemaContractService = new EducationSchemaContractService(),
    private readonly differentialMappingService?: DifferentialMappingService,
    private readonly reasoningPathService?: ReasoningPathService,
    private readonly reasoningDraftValidationService?: ReasoningDraftValidationService,
  ) {
    const env = getEnv();
    if (env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        timeout: OPENAI_SECTION_TIMEOUT_MS,
        maxRetries: 0,
      });
    }
  }

  async regenerateSection(input: {
    diagnosisRegistryId: string;
    section: EducationRegenerableSection;
    userId: string;
  }): Promise<SectionRegenerationResult> {
    if (!this.openaiClient) {
      throw new BadRequestException(
        'OPENAI_API_KEY is required for section regeneration',
      );
    }

    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: input.diagnosisRegistryId },
      include: {
        aliases: {
          where: { active: true },
          orderBy: [{ acceptedForMatch: 'desc' }, { rank: 'asc' }],
          select: { term: true },
        },
        education: true,
      },
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }
    if (!registry.education) {
      throw new BadRequestException(
        'Generate a full education draft before regenerating a section',
      );
    }

    const generationContext = await this.generationContextBuilder.build({
      diagnosisRegistryId: input.diagnosisRegistryId,
      purpose: 'education',
    });
    const compactGenerationContext =
      this.educationSchemaContractService.compactGenerationContext(
        generationContext as unknown as Record<string, unknown>,
      );
    const reasoningContext =
      await this.reasoningPathService?.buildEducationSectionGenerationContext({
        diagnosisRegistryId: input.diagnosisRegistryId,
        section: input.section,
      });
    const request = this.buildRequest({
      section: input.section,
      diagnosis: {
        id: registry.id,
        displayLabel: registry.displayLabel,
        canonicalName: registry.canonicalName,
        specialty: registry.specialty,
        bodySystem: registry.bodySystem,
        category: registry.category,
        aliases: registry.aliases.map((alias) => alias.term),
      },
      compactGenerationContext,
      constrainedReasoningContext:
        this.promptReasoningContext(reasoningContext),
      currentEducation: registry.education,
    });

    const startedAt = Date.now();
    const completion = await this.openaiClient.chat.completions.create(request, {
      timeout: OPENAI_SECTION_TIMEOUT_MS,
      maxRetries: 0,
    });
    this.logger.log(
      JSON.stringify({
        event: 'diagnosis_education.section_regeneration.openai_success',
        diagnosisRegistryId: input.diagnosisRegistryId,
        section: input.section,
        model: OPENAI_SECTION_MODEL,
        elapsedMs: Date.now() - startedAt,
      }),
    );

    const content = completion.choices[0]?.message?.content;
    const replacement = this.parseSectionResponse(content, input.section);
    const mergedDraft = this.buildMergedDraft(registry.education, {
      section: input.section,
      replacement,
    });
    const metadata = {
      id: registry.id,
      canonicalName: registry.canonicalName,
      displayLabel: registry.displayLabel,
      specialty: registry.specialty,
      difficultyBand:
        typeof registry.difficultyBand === 'string'
          ? registry.difficultyBand
          : null,
      aliases: registry.aliases,
    };
    const teachingRules =
      await this.diagnosisCurriculumProviderService.getRules(metadata);
    const qualityReport = this.educationDraftQualityValidator.validate({
      draft: mergedDraft,
      guidance: this.educationKnowledgeRulesService.getGuidance(metadata),
      teachingRules,
    });
    const now = new Date();
    const referencesWithMetadata = this.attachSectionGenerationMetadata(
      registry.education.references,
      reasoningContext,
      input.section,
    );
    this.logger.log(
      JSON.stringify({
        event: reasoningContext?.constrained
          ? 'diagnosis_education.section_regeneration.constrained'
          : 'diagnosis_education.section_regeneration.unconstrained_fallback',
        diagnosisRegistryId: input.diagnosisRegistryId,
        section: input.section,
        reasoningPathId: reasoningContext?.reasoningPathId ?? null,
        hallucinationRisk: reasoningContext?.hallucinationRisk ?? 'high',
        warnings:
          reasoningContext?.warnings ?? [
            'No reasoning path service was available.',
          ],
      }),
    );

    const education = await this.prisma.$transaction(async (tx) => {
      await this.createRevisionIfMissing(
        tx,
        registry.education!,
        input.userId,
      );

      const saved = await tx.diagnosisEducation.update({
        where: { id: registry.education!.id },
        data: {
          [input.section]: replacement as Prisma.InputJsonValue,
          references: referencesWithMetadata,
          editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
          source: DiagnosisEducationSource.AI_ASSISTED,
          version: { increment: 1 },
          generatedAt: now,
          reviewedAt: null,
          reviewedByUserId: null,
          publishedAt:
            registry.education!.editorialStatus ===
            DiagnosisEducationStatus.PUBLISHED
              ? null
              : registry.education!.publishedAt,
        },
      });

      await this.createRevision(tx, saved, input.userId);
      return saved;
    });

    await this.refreshDifferentialMappings(education.id);
    await this.reasoningDraftValidationService?.runAfterGeneration({
      artifactType: 'EDUCATION_SECTION',
      artifactId: education.id,
    });
    return { ...education, qualityReport };
  }

  private buildRequest(input: {
    section: EducationRegenerableSection;
    diagnosis: Record<string, unknown>;
    compactGenerationContext: unknown;
    constrainedReasoningContext: unknown;
    currentEducation: DiagnosisEducation;
  }): ChatCompletionCreateParamsNonStreaming {
    const preserve = [
      'summary',
      'clinicalPattern',
      'keySymptoms',
      'keySigns',
      'examPearls',
      'scoringSystems',
      'investigations',
      'differentials',
      'management',
      'complications',
      'pitfalls',
      'recallPrompts',
      'references',
    ].filter((section) => section !== input.section);

    return {
      model: OPENAI_SECTION_MODEL,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'diagnosis_education_section_regeneration',
          strict: true,
          schema: this.sectionResponseSchema(input.section),
        },
      },
      messages: [
        {
          role: 'system',
          content: [
            'Regenerate one diagnosis education section for editorial review.',
            'Return JSON only with the requested section key.',
            'Use only schema-allowed typed pearl keys.',
            'Do not rewrite preserved sections.',
            'Avoid repeating concepts already owned by preserved sections unless you add a new mechanism, action, trap, or separator layer.',
            'Avoid synonym duplicates such as RLQ tenderness, focal RLQ tenderness, and right lower quadrant tenderness across cards.',
            'Do not include drug doses or patient-specific advice.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: `Regenerate only ${input.section}.`,
            outputOnly: input.section,
            preserve,
            diagnosis: input.diagnosis,
            compactGenerationContext: input.compactGenerationContext,
            constrainedReasoningContext: input.constrainedReasoningContext,
            schemaContract:
              this.educationSchemaContractService.getPromptContract(),
            editorialPatterns:
              this.educationEditorialPatternsService.getPromptGuidance(),
            sectionInstruction: SECTION_INSTRUCTION[input.section],
            requiredType: SECTION_TYPE[input.section],
            currentSection: input.currentEducation[input.section],
            constraints: [
              'Return an object with exactly the requested section key.',
              `Use 3-${SECTION_MAX_ITEMS[input.section]} typed pearl objects.`,
              'Each item must include id, type, title, content, whyItMatters, discriminator, managementImplication, escalationImplication, trapAvoided.',
              'Use null for unused optional canonical fields.',
              'Content must be 18-45 words and no more than 2 sentences.',
              'Prefer specific named signs, tests, mimics, mechanisms, and management anchors from compactGenerationContext.',
              'Use constrainedReasoningContext to anchor discriminators, escalation signals, evidence contrasts, and forbidden overlap. If unconstrained, mark unsupported reasoning for editor review instead of inventing it.',
              'Keep scoring systems and clinically established mnemonics in scoringSystems, not examPearls.',
              'Differentials must include diagnosis/title, whyConfused/content, keySeparator/discriminator, and classicTrap/trapAvoided.',
              'Investigations must include interpretation or trap, not generic test usefulness prose.',
              'Management must state action principles without repeating diagnostic pattern, exam signs, or investigation interpretation.',
            ],
          }),
        },
      ],
    };
  }

  private promptReasoningContext(
    reasoningContext?: EducationalReasoningGenerationContext,
  ) {
    if (!reasoningContext) {
      return {
        constrained: false,
        confidence: 'lower',
        hallucinationRisk: 'high',
        warnings: ['No reasoning path service was available.'],
      };
    }
    return {
      constrained: reasoningContext.constrained,
      confidence: reasoningContext.confidence,
      hallucinationRisk: reasoningContext.hallucinationRisk,
      reasoningPathId: reasoningContext.reasoningPathId,
      reasoningGoal: reasoningContext.reasoningGoal,
      section: reasoningContext.section,
      requiredTeachingPoints: reasoningContext.requiredTeachingPoints,
      discriminatorEvidenceUsed: reasoningContext.discriminatorEvidenceUsed,
      coverageGapsAddressed: reasoningContext.coverageGapsAddressed,
      plannerRecommendations: reasoningContext.plannerRecommendations,
      warnings: reasoningContext.warnings,
      promptConstraints: reasoningContext.promptConstraints,
    };
  }

  private attachSectionGenerationMetadata(
    references: unknown,
    reasoningContext: EducationalReasoningGenerationContext | undefined,
    section: EducationRegenerableSection,
  ): Prisma.InputJsonValue {
    const existing = Array.isArray(references) ? references : [];
    return [
      ...existing,
      {
        generatedBecause: {
          section,
          constrained: reasoningContext?.constrained ?? false,
          confidence: reasoningContext?.confidence ?? 'lower',
          hallucinationRisk: reasoningContext?.hallucinationRisk ?? 'high',
          reasoningPathId: reasoningContext?.reasoningPathId ?? null,
          reasoningGoal: reasoningContext?.reasoningGoal ?? null,
          sourceTeachingRelationshipIds:
            reasoningContext?.sourceTeachingRelationshipIds ?? [],
          sourceEvidenceRelationshipIds:
            reasoningContext?.sourceEvidenceRelationshipIds ?? [],
          coverageGapsAddressed:
            reasoningContext?.coverageGapsAddressed ?? [
              'missing_active_reasoning_path',
            ],
          discriminatorEvidenceUsed:
            reasoningContext?.discriminatorEvidenceUsed ?? [],
          generationCoverageSnapshot:
            reasoningContext?.generationCoverageSnapshot ?? {
              readinessScore: null,
              readinessTier: 'unconstrained',
            },
          warnings:
            reasoningContext?.warnings ?? [
              'No active reasoning path constrained this educational section.',
            ],
          reasoningQualityWarnings:
            reasoningContext?.reasoningQualityWarnings ?? [
              'unconstrained_educational_generation',
            ],
        },
      },
    ] as Prisma.InputJsonValue;
  }

  private sectionResponseSchema(section: EducationRegenerableSection) {
    const typedPearlSchema = {
      type: 'object',
      additionalProperties: false,
      required: [
        'id',
        'type',
        'title',
        'content',
        'whyItMatters',
        'discriminator',
        'managementImplication',
        'escalationImplication',
        'trapAvoided',
      ],
      properties: {
        id: { type: 'string' },
        type: { type: 'string', enum: PEARL_TYPE_VALUES },
        title: { type: ['string', 'null'] },
        content: { type: 'string' },
        whyItMatters: { type: ['string', 'null'] },
        discriminator: { type: ['string', 'null'] },
        managementImplication: { type: ['string', 'null'] },
        escalationImplication: { type: ['string', 'null'] },
        trapAvoided: { type: ['string', 'null'] },
      },
    };

    return {
      type: 'object',
      additionalProperties: false,
      required: [section],
      properties: {
        [section]: {
          type: 'array',
          minItems: 3,
          maxItems: SECTION_MAX_ITEMS[section],
          items: typedPearlSchema,
        },
      },
    };
  }

  private parseSectionResponse(
    content: string | null | undefined,
    section: EducationRegenerableSection,
  ): Prisma.InputJsonArray {
    if (!content) {
      throw new BadRequestException('AI returned an empty section draft');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadRequestException('AI returned invalid JSON');
    }

    const record = this.asObject(parsed);
    const items = record ? record[section] : null;
    if (
      !Array.isArray(items) ||
      items.length < 3 ||
      items.length > SECTION_MAX_ITEMS[section]
    ) {
      throw new BadRequestException(
        `AI returned invalid ${section} section shape`,
      );
    }

    return items.map((item) => this.validateTypedPearl(item, section));
  }

  private validateTypedPearl(
    value: unknown,
    section: EducationRegenerableSection,
  ): Prisma.InputJsonObject {
    const object = this.asObject(value);
    if (!object) {
      throw new BadRequestException(`Invalid ${section} item`);
    }

    const output: Record<string, unknown> = {};
    for (const key of [
      'id',
      'type',
      'title',
      'content',
      'whyItMatters',
      'discriminator',
      'managementImplication',
      'escalationImplication',
      'trapAvoided',
    ]) {
      const valueForKey = object[key];
      if (valueForKey === null) {
        output[key] = null;
      } else if (typeof valueForKey === 'string') {
        output[key] = valueForKey.trim();
      } else {
        throw new BadRequestException(`Invalid ${section} item field: ${key}`);
      }
    }

    if (!output.id || !output.type || !output.content) {
      throw new BadRequestException(`Invalid ${section} item content`);
    }

    return output as Prisma.InputJsonObject;
  }

  private buildMergedDraft(
    education: DiagnosisEducation,
    input: {
      section: EducationRegenerableSection;
      replacement: Prisma.InputJsonArray;
    },
  ): Partial<Record<string, unknown>> {
    return {
      summary: education.summary,
      clinicalPattern: education.clinicalPattern,
      keySymptoms: education.keySymptoms,
      keySigns: education.keySigns,
      examPearls:
        input.section === 'examPearls'
          ? input.replacement
          : education.examPearls,
      scoringSystems: education.scoringSystems,
      investigations:
        input.section === 'investigations'
          ? input.replacement
          : education.investigations,
      differentials:
        input.section === 'differentials'
          ? input.replacement
          : education.differentials,
      management:
        input.section === 'management'
          ? input.replacement
          : education.management,
      complications: education.complications,
      pitfalls: education.pitfalls,
      recallPrompts: education.recallPrompts,
      references: education.references,
    };
  }

  private async createRevisionIfMissing(
    tx: Prisma.TransactionClient,
    education: DiagnosisEducation,
    userId: string,
  ) {
    const existingRevision = await tx.diagnosisEducationRevision.findUnique({
      where: {
        educationId_version: {
          educationId: education.id,
          version: education.version,
        },
      },
    });

    if (!existingRevision) {
      await this.createRevision(tx, education, userId);
    }
  }

  private async createRevision(
    tx: Prisma.TransactionClient,
    education: DiagnosisEducation,
    userId: string,
  ) {
    await tx.diagnosisEducationRevision.create({
      data: {
        educationId: education.id,
        version: education.version,
        editorialStatus: education.editorialStatus,
        source: education.source,
        createdByUserId: userId,
        snapshot: this.toRevisionSnapshot(education),
      },
    });
  }

  private async refreshDifferentialMappings(educationId: string) {
    await this.differentialMappingService?.mapEducation(educationId).catch((error) => {
      this.logger.error(
        JSON.stringify({
          event: 'differential_mapping.education_section_refresh.failed',
          educationId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  private toRevisionSnapshot(
    education: DiagnosisEducation,
  ): Prisma.InputJsonObject {
    return {
      title: education.title,
      summary: education.summary,
      clinicalPattern: this.toSnapshotJson(education.clinicalPattern),
      keySymptoms: this.toSnapshotJson(education.keySymptoms),
      keySigns: this.toSnapshotJson(education.keySigns),
      examPearls: this.toSnapshotJson(education.examPearls),
      scoringSystems: this.toSnapshotJson(education.scoringSystems),
      investigations: this.toSnapshotJson(education.investigations),
      differentials: this.toSnapshotJson(education.differentials),
      management: this.toSnapshotJson(education.management),
      complications: this.toSnapshotJson(education.complications),
      pitfalls: this.toSnapshotJson(education.pitfalls),
      recallPrompts: this.toSnapshotJson(education.recallPrompts),
      references: this.toSnapshotJson(education.references),
      editorialStatus: education.editorialStatus,
      source: education.source,
      reviewedAt: education.reviewedAt?.toISOString() ?? null,
      reviewedByUserId: education.reviewedByUserId,
      publishedAt: education.publishedAt?.toISOString() ?? null,
    };
  }

  private toSnapshotJson(
    value: Prisma.JsonValue | null,
  ): Prisma.InputJsonValue | null {
    return value === null ? null : (value as Prisma.InputJsonValue);
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
