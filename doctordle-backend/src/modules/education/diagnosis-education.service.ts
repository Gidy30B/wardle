import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  Prisma,
  type DiagnosisEducation,
  type DiagnosisRegistry,
} from '@prisma/client';
import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from 'openai/resources/chat/completions';
import { getEnv } from '../../core/config/env.validation';
import { PrismaService } from '../../core/db/prisma.service';
import { GenerationContextBuilder } from '../editorial/generation-context-builder.service';
import { EditorialIntentProjectionService } from '../editorial/editorial-intent-projection.service';
import { DiagnosisGraphExtractionService } from '../diagnosis-graph/diagnosis-graph-extraction.service';
import { DifferentialMappingService } from '../diagnosis-graph/differential-mapping.service';
import type { ReviewDiagnosisEducationDto } from './dto/review-diagnosis-education.dto';
import type { UpsertDiagnosisEducationDto } from './dto/upsert-diagnosis-education.dto';
import {
  EducationDraftQualityValidator,
} from './education-draft-quality-validator.service';
import { EducationEditorialPatternsService } from './education-editorial-patterns.service';
import { EducationKnowledgeRulesService } from './education-knowledge-rules.service';
import { EducationSchemaContractService } from './education-schema-contract.service';
import { DiagnosisCurriculumProviderService } from './diagnosis-curriculum-provider.service';

type EducationJsonField =
  | 'summary'
  | 'clinicalPattern'
  | 'keySymptoms'
  | 'keySigns'
  | 'examPearls'
  | 'scoringSystems'
  | 'investigations'
  | 'differentials'
  | 'management'
  | 'complications'
  | 'pitfalls'
  | 'recallPrompts'
  | 'references';

const EDUCATION_JSON_FIELDS: EducationJsonField[] = [
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
];

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

const TYPED_PEARL_DRAFT_SCHEMA = {
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
} as const;

const DIAGNOSIS_EDUCATION_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: EDUCATION_JSON_FIELDS,
  properties: {
    summary: {
      type: 'object',
      additionalProperties: false,
      required: ['definition', 'highYieldTakeaway'],
      properties: {
        definition: { type: 'string' },
        highYieldTakeaway: { type: 'string' },
      },
    },
    clinicalPattern: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: TYPED_PEARL_DRAFT_SCHEMA,
    },
    keySymptoms: {
      type: 'array',
      minItems: 3,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'finding',
          'whyItMatters',
          'diagnosticImpact',
          'discriminator',
        ],
        properties: {
          finding: { type: 'string' },
          whyItMatters: { type: 'string' },
          diagnosticImpact: { type: 'string' },
          discriminator: { type: 'string' },
        },
      },
    },
    keySigns: {
      type: 'array',
      minItems: 3,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'finding',
          'whyItMatters',
          'diagnosticImpact',
          'discriminator',
        ],
        properties: {
          finding: { type: 'string' },
          whyItMatters: { type: 'string' },
          diagnosticImpact: { type: 'string' },
          discriminator: { type: 'string' },
        },
      },
    },
    examPearls: {
      type: 'array',
      minItems: 3,
      maxItems: 4,
      items: TYPED_PEARL_DRAFT_SCHEMA,
    },
    scoringSystems: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'use', 'components', 'caution'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          use: { type: 'string' },
          components: { type: 'array', items: { type: 'string' } },
          caution: { type: 'string' },
        },
      },
    },
    investigations: {
      type: 'array',
      minItems: 3,
      maxItems: 4,
      items: TYPED_PEARL_DRAFT_SCHEMA,
    },
    differentials: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: TYPED_PEARL_DRAFT_SCHEMA,
    },
    management: {
      type: 'array',
      minItems: 3,
      maxItems: 4,
      items: TYPED_PEARL_DRAFT_SCHEMA,
    },
    complications: { type: 'array', items: { type: 'string' } },
    pitfalls: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: TYPED_PEARL_DRAFT_SCHEMA,
    },
    recallPrompts: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'type',
          'prompt',
          'answer',
          'explanation',
          'linkedConcept',
          'sourceSection',
          'difficulty',
        ],
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'CLOZE',
              'SHORT_ANSWER',
              'DISTINGUISH',
              'PEARL_RECALL',
              'WHY_IT_MATTERS',
            ],
          },
          prompt: { type: 'string' },
          answer: { type: 'string' },
          explanation: { type: 'string' },
          linkedConcept: { type: 'string' },
          sourceSection: { type: 'string' },
          difficulty: {
            type: 'string',
            enum: ['BASIC', 'INTERMEDIATE', 'ADVANCED'],
          },
        },
      },
    },
    references: { type: 'array', items: { type: 'string' } },
  },
} as const;

type EducationWriteData = {
  title: string;
  editorialStatus: DiagnosisEducationStatus;
  source: DiagnosisEducationSource;
  version: number;
} & Partial<Record<EducationJsonField, Prisma.InputJsonValue>>;

type ValidatedEducationDraft = Record<
  EducationJsonField,
  Prisma.InputJsonValue
>;

type PearlType = (typeof PEARL_TYPE_VALUES)[number];

type PearlCritique = {
  genericityScore?: number;
  discriminatorStrength?: number;
  operationalReasoningScore?: number;
  memorabilityScore?: number;
  managementImpactScore?: number;
  warnings: string[];
};

type TypedEducationPearl = {
  id: string;
  type: PearlType;
  title?: string;
  content: string;
  whyItMatters?: string;
  discriminator?: string;
  managementImplication?: string;
  escalationImplication?: string;
  trapAvoided?: string;
  critique?: PearlCritique;
};

const PUBLISHABLE_REVIEW_STATUSES = new Set<DiagnosisEducationStatus>([
  DiagnosisEducationStatus.NEEDS_EDIT,
  DiagnosisEducationStatus.APPROVED,
  DiagnosisEducationStatus.PUBLISHED,
  DiagnosisEducationStatus.REJECTED,
  DiagnosisEducationStatus.ARCHIVED,
]);

const GENERIC_EDUCATION_PHRASES = [
  'may present with',
  'can present with',
  'can include',
  'often associated with',
  'important to note',
  'patients may',
  'a variety of symptoms',
  'management depends',
  'should be considered',
];

const DIAGNOSTIC_REASONING_TERMS = [
  'supports',
  'favors',
  'suggests',
  'distinguishes',
  'raises suspicion',
  'argues against',
  'points toward',
  'implies',
  'indicates',
  'helps differentiate',
  'lowers suspicion',
  'increases suspicion',
  'more likely',
  'less likely',
];

const GENERIC_WHY_LAYER_PHRASES = [
  'important for early diagnosis',
  'important for management',
  'critical for management',
  'guides treatment',
  'guides therapeutic',
  'guides management',
  'prevents deterioration',
  'preventing deterioration',
  'avoids deterioration',
  'urgent evaluation',
  'critical intervention',
  'management decisions',
  'clinically important',
  'severe complications',
  'early diagnosis',
  'therapeutic interventions',
  'prioritizes urgent evaluation',
  'early diagnosis is important',
  'prompt treatment is necessary',
  'can be life-threatening',
  'requires urgent management',
  'clinical correlation is advised',
  'timely intervention is crucial',
];

const WHY_LAYER_REASONING_MARKERS = [
  'supports',
  'favors',
  'suggests',
  'distinguish',
  'differentiate',
  'argues against',
  'raises concern',
  'increases concern',
  'lowers suspicion',
  'increases suspicion',
  'points toward',
  'indicates',
  'implies',
  'over',
  'rather than',
  'unlike',
  'because',
  'reflects',
  'due to',
  'consistent with',
  'changes',
  'should prompt',
  'should slow',
  'requires',
  'need for',
  'monitoring',
  'escalation',
  'timing',
  'risk of',
  'risk for',
  'severity',
  'hemodynamic',
  'icu',
];

const OPENAI_EDUCATION_MODEL = 'gpt-4o-mini';
const OPENAI_EDUCATION_TIMEOUT_MS = 60_000;
const OPENAI_EDUCATION_SYNC_ATTEMPT_TIMEOUT_MS = 45_000;
const OPENAI_CONNECTION_RETRY_DELAYS_MS = [500] as const;
const OPENAI_CONNECTION_ERROR_MESSAGE =
  'AI education generation is temporarily unavailable. Please retry.';
const EDUCATION_GENERATION_CONFLICT_MESSAGE =
  'Education generation is already in progress for this diagnosis.';

type DiagnosisEducationWithRegistry = DiagnosisEducation & {
  diagnosisRegistry: Pick<
    DiagnosisRegistry,
    | 'id'
    | 'displayLabel'
    | 'canonicalName'
    | 'specialty'
    | 'category'
    | 'bodySystem'
    | 'clinicalSetting'
    | 'difficultyBand'
  >;
};

@Injectable()
export class DiagnosisEducationService {
  private readonly logger = new Logger(DiagnosisEducationService.name);
  private readonly openaiClient?: OpenAI;
  // TODO: replace with a Redis-backed lock before running multiple API replicas.
  private readonly educationGenerationLocks = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosisGraphExtractionService?: DiagnosisGraphExtractionService,
    private readonly educationKnowledgeRulesService: EducationKnowledgeRulesService = new EducationKnowledgeRulesService(),
    private readonly diagnosisCurriculumProviderService: DiagnosisCurriculumProviderService = new DiagnosisCurriculumProviderService(),
    private readonly educationDraftQualityValidator: EducationDraftQualityValidator = new EducationDraftQualityValidator(),
    private readonly generationContextBuilder: GenerationContextBuilder = new GenerationContextBuilder(
      new EditorialIntentProjectionService(prisma),
    ),
    private readonly educationEditorialPatternsService: EducationEditorialPatternsService = new EducationEditorialPatternsService(),
    private readonly educationSchemaContractService: EducationSchemaContractService = new EducationSchemaContractService(),
    private readonly differentialMappingService?: DifferentialMappingService,
  ) {
    const env = getEnv();
    if (env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        timeout: OPENAI_EDUCATION_TIMEOUT_MS,
        maxRetries: 3,
      });
    }
  }

  async getPublishedForUser(input: {
    userId: string;
    diagnosisRegistryId: string;
  }) {
    if (!getEnv().DIAGNOSIS_EDUCATION_API_ENABLED) {
      throw new NotFoundException('Diagnosis education is not available');
    }

    if (!input.diagnosisRegistryId.trim()) {
      this.logger.warn(
        JSON.stringify({
          event: 'diagnosis_education.player.miss',
          reason: 'missing_registry_id',
          userId: input.userId,
        }),
      );
      throw new NotFoundException('Diagnosis education not found');
    }

    const unlocked = await this.prisma.gameSession.findFirst({
      where: {
        userId: input.userId,
        status: 'completed',
        completedAt: {
          not: null,
        },
        case: {
          diagnosisRegistryId: input.diagnosisRegistryId,
        },
      },
      select: { id: true },
    });

    if (!unlocked) {
      await this.logPlayerEducationMiss({
        reason: 'missing_completed_unlock',
        userId: input.userId,
        diagnosisRegistryId: input.diagnosisRegistryId,
        selectedRowId: null,
      });
      throw new NotFoundException('Diagnosis education not found');
    }

    const education = await this.prisma.diagnosisEducation.findFirst({
      where: {
        diagnosisRegistryId: input.diagnosisRegistryId,
        editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      include: { diagnosisRegistry: { select: this.registrySelect() } },
    });

    if (!education) {
      const currentEducation =
        await this.prisma.diagnosisEducation.findUnique({
          where: { diagnosisRegistryId: input.diagnosisRegistryId },
          include: {
            diagnosisRegistry: { select: this.registrySelect() },
            revisions: {
              where: { editorialStatus: DiagnosisEducationStatus.PUBLISHED },
              orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
              take: 1,
            },
          },
        });
      const publishedRevision = currentEducation?.revisions[0];

      if (currentEducation && publishedRevision) {
        return this.toPlayerDtoFromPublishedRevision(
          currentEducation,
          publishedRevision,
        );
      }

      await this.logPlayerEducationMiss({
        reason: 'missing_published_education',
        userId: input.userId,
        diagnosisRegistryId: input.diagnosisRegistryId,
        selectedRowId: null,
      });
      throw new NotFoundException('Diagnosis education not found');
    }

    return this.toPlayerDto(education);
  }

  async getAdminByDiagnosisRegistryId(diagnosisRegistryId: string) {
    this.assertAdminEnabled();
    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: this.registrySelect(),
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const education = await this.prisma.diagnosisEducation.findUnique({
      where: { diagnosisRegistryId },
      include: {
        revisions: { orderBy: { createdAt: 'desc' }, take: 10 },
        differentialLinks: {
          orderBy: [{ role: 'asc' }, { sourceText: 'asc' }],
          select: {
            id: true,
            role: true,
            confidence: true,
            sourceText: true,
            diagnosisRegistryId: true,
            diagnosisRegistry: {
              select: {
                id: true,
                displayLabel: true,
                canonicalName: true,
              },
            },
          },
        },
      },
    });

    return {
      diagnosisRegistry: registry,
      education: education
        ? {
            ...education,
            linkedDifferentials: this.toStructuredDifferentialLinks(
              education.differentialLinks,
            ),
          }
        : null,
      qualityWarnings: education
        ? this.collectEducationQualityWarnings(education)
        : [],
      publishBlockers: education ? this.getPublishBlockers(education) : [],
    };
  }

  private toStructuredDifferentialLinks(
    links: Array<{
      id: string;
      role: unknown;
      confidence: number | null;
      sourceText: string;
      diagnosisRegistryId: string;
      diagnosisRegistry: {
        id: string;
        displayLabel: string;
        canonicalName: string;
      };
    }> = [],
  ) {
    return links.map((link) => ({
      id: link.id,
      diagnosisRegistryId: link.diagnosisRegistryId,
      displayLabel: link.diagnosisRegistry.displayLabel,
      canonicalName: link.diagnosisRegistry.canonicalName,
      role: link.role,
      confidence: link.confidence,
      sourceText: link.sourceText,
    }));
  }

  async upsertForDiagnosisRegistry(
    diagnosisRegistryId: string,
    input: UpsertDiagnosisEducationDto,
    userId: string,
  ) {
    this.assertAdminEnabled();
    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: this.registrySelect(),
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const existing = await this.prisma.diagnosisEducation.findUnique({
      where: { diagnosisRegistryId },
    });
    const now = new Date();
    const data = this.buildWriteData(this.toInputRecord(input), {
      title: input.title ?? registry.displayLabel,
      status: existing?.editorialStatus ?? DiagnosisEducationStatus.DRAFT,
      source: existing?.source ?? DiagnosisEducationSource.MANUAL,
      version: (existing?.version ?? 0) + 1,
    });

    const education = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.diagnosisEducation.update({
            where: { id: existing.id },
            data,
          })
        : await tx.diagnosisEducation.create({
            data: {
              ...data,
              diagnosisRegistryId,
              title: data.title,
              summary: data.summary ?? this.emptySummary(registry.displayLabel),
              createdAt: now,
            },
          });

      await this.createRevision(tx, saved, userId);
      return saved;
    });

    await this.refreshDifferentialMappings(education.id);
    return education;
  }

  async updateByEducationId(
    educationId: string,
    input: UpsertDiagnosisEducationDto,
    userId: string,
  ) {
    this.assertAdminEnabled();
    const existing = await this.prisma.diagnosisEducation.findUnique({
      where: { id: educationId },
    });

    if (!existing) {
      throw new NotFoundException('Diagnosis education not found');
    }

    const data = this.buildWriteData(this.toInputRecord(input), {
      title: input.title ?? existing.title,
      status:
        existing.editorialStatus === DiagnosisEducationStatus.PUBLISHED
          ? DiagnosisEducationStatus.NEEDS_REVIEW
          : existing.editorialStatus,
      source: existing.source,
      version: existing.version + 1,
    });

    const education = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.diagnosisEducation.update({
        where: { id: educationId },
        data: {
          ...data,
          publishedAt:
            existing.editorialStatus === DiagnosisEducationStatus.PUBLISHED
              ? null
              : existing.publishedAt,
        },
      });
      await this.createRevision(tx, saved, userId);
      return saved;
    });

    await this.refreshDifferentialMappings(education.id);
    return education;
  }

  async reviewEducation(
    educationId: string,
    input: ReviewDiagnosisEducationDto,
    userId: string,
  ) {
    this.assertAdminEnabled();
    if (!PUBLISHABLE_REVIEW_STATUSES.has(input.status)) {
      throw new BadRequestException('Unsupported education review status');
    }

    const existing = await this.prisma.diagnosisEducation.findUnique({
      where: { id: educationId },
    });

    if (!existing) {
      throw new NotFoundException('Diagnosis education not found');
    }

    if (input.status === DiagnosisEducationStatus.PUBLISHED) {
      const blockers = this.getPublishBlockers(existing);
      if (blockers.length) {
        throw new BadRequestException({
          message: 'Diagnosis education is not publishable',
          blockers,
        });
      }
    }

    const now = new Date();
    const education = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.diagnosisEducation.update({
        where: { id: educationId },
        data: {
          editorialStatus: input.status,
          reviewedAt:
            input.status === DiagnosisEducationStatus.APPROVED ||
            input.status === DiagnosisEducationStatus.PUBLISHED
              ? now
              : existing.reviewedAt,
          reviewedByUserId:
            input.status === DiagnosisEducationStatus.APPROVED ||
            input.status === DiagnosisEducationStatus.PUBLISHED
              ? userId
              : existing.reviewedByUserId,
          publishedAt:
            input.status === DiagnosisEducationStatus.PUBLISHED
              ? now
              : existing.publishedAt,
          version: { increment: 1 },
        },
      });

      await this.createRevision(tx, saved, userId);
      return saved;
    });

    await this.refreshDifferentialMappings(education.id);

    if (input.status === DiagnosisEducationStatus.PUBLISHED) {
      await this.diagnosisGraphExtractionService
        ?.extractFromPublishedEducation(educationId)
        .catch((error) => {
          this.logger.error(
            JSON.stringify({
              event: 'diagnosis_graph.education_extraction.failed',
              educationId,
              error: error instanceof Error ? error.message : String(error),
            }),
            error instanceof Error ? error.stack : undefined,
          );
        });
    }

    return education;
  }

  private async logPlayerEducationMiss(input: {
    reason:
      | 'missing_completed_unlock'
      | 'missing_published_education'
      | 'missing_registry_id';
    userId: string;
    diagnosisRegistryId?: string;
    selectedRowId?: string | null;
  }) {
    if (!input.diagnosisRegistryId) {
      this.logger.warn(
        JSON.stringify({
          event: 'diagnosis_education.player.miss',
          reason: input.reason,
          userId: input.userId,
        }),
      );
      return;
    }

    const [educationRows, sessionRows] = await Promise.all([
      this.prisma.diagnosisEducation.findMany({
        where: { diagnosisRegistryId: input.diagnosisRegistryId },
        select: {
          id: true,
          editorialStatus: true,
          publishedAt: true,
          reviewedAt: true,
          updatedAt: true,
          version: true,
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 5,
      }),
      this.prisma.gameSession.findMany({
        where: {
          userId: input.userId,
          case: {
            diagnosisRegistryId: input.diagnosisRegistryId,
          },
        },
        select: {
          id: true,
          status: true,
          completedAt: true,
          startedAt: true,
          caseId: true,
        },
        orderBy: [{ startedAt: 'desc' }],
        take: 5,
      }),
    ]);

    this.logger.warn(
      JSON.stringify({
        event: 'diagnosis_education.player.miss',
        reason: input.reason,
        userId: input.userId,
        diagnosisRegistryId: input.diagnosisRegistryId,
        selectedRowId: input.selectedRowId ?? null,
        educationRowsFoundCount: educationRows.length,
        educationRows: educationRows.map((row) => ({
          id: row.id,
          editorialStatus: row.editorialStatus,
          publishedAt: row.publishedAt?.toISOString() ?? null,
          reviewedAt: row.reviewedAt?.toISOString() ?? null,
          updatedAt: row.updatedAt.toISOString(),
          version: row.version,
        })),
        unlockSessionRowsFoundCount: sessionRows.length,
        unlockSatisfied: sessionRows.some(
          (row) => row.status === 'completed' && row.completedAt !== null,
        ),
        unlockSessions: sessionRows.map((row) => ({
          id: row.id,
          caseId: row.caseId,
          status: row.status,
          completedAt: row.completedAt?.toISOString() ?? null,
          startedAt: row.startedAt.toISOString(),
        })),
      }),
    );
  }

  async generateDraft(diagnosisRegistryId: string, userId: string) {
    this.assertAdminEnabled();
    const env = getEnv();
    if (!env.AI_EDUCATION_GENERATION_ENABLED) {
      throw new BadRequestException('AI education generation is disabled');
    }

    if (!this.openaiClient) {
      throw new BadRequestException(
        'OPENAI_API_KEY is required for generation',
      );
    }

    if (this.educationGenerationLocks.has(diagnosisRegistryId)) {
      throw new ConflictException(EDUCATION_GENERATION_CONFLICT_MESSAGE);
    }

    this.educationGenerationLocks.add(diagnosisRegistryId);
    try {
      const registry = await this.prisma.diagnosisRegistry.findUnique({
        where: { id: diagnosisRegistryId },
        include: {
          aliases: {
            where: { active: true },
            select: { term: true, acceptedForMatch: true },
            orderBy: [{ acceptedForMatch: 'desc' }, { rank: 'asc' }],
            take: 20,
          },
          cases: {
            select: {
              title: true,
              clues: true,
              explanation: true,
              differentials: true,
            },
            orderBy: { date: 'desc' },
            take: 3,
          },
        },
      });

      if (!registry) {
        throw new NotFoundException('Diagnosis registry entry not found');
      }

      const existing = await this.prisma.diagnosisEducation.findUnique({
        where: { diagnosisRegistryId },
      });

      const knowledgeGuidance =
        this.educationKnowledgeRulesService.getGuidance(registry);
      const teachingRules =
        await this.diagnosisCurriculumProviderService.getRules(registry);
      const generationContext = await this.generationContextBuilder.build({
        diagnosisRegistryId,
        purpose: 'education',
      });
      const compactGenerationContext =
        this.educationSchemaContractService.compactGenerationContext(
          generationContext as unknown as Record<string, unknown>,
        );
      const contextChars = JSON.stringify(generationContext).length;
      this.logger.log(
        JSON.stringify({
          event: 'diagnosis_education.generate.context_built',
          diagnosisRegistryId,
          purpose: 'education',
          contextChars,
          learningGoalCount: generationContext.learningGoals.length,
          mimicCount: generationContext.mimics.length,
          discriminatorCount: generationContext.discriminators.length,
          sourceSummary: generationContext.sourceSummary,
        }),
      );
      const request: ChatCompletionCreateParamsNonStreaming = {
        model: OPENAI_EDUCATION_MODEL,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'diagnosis_education_draft',
            strict: true,
            schema: DIAGNOSIS_EDUCATION_DRAFT_SCHEMA,
          },
        },
        messages: [
          {
            role: 'system',
            content: [
              'You draft reviewed medical education JSON for a medical learning game.',
              'Generate diagnosis education like a senior clinician teaching diagnostic reasoning.',
              'Every major point must explain why it matters diagnostically, what it distinguishes, what probability it shifts, or what clinical trap it avoids.',
              'Return a JSON object only. Do not wrap it in markdown. Do not include prose outside JSON.',
              'Use the exact keys from the schema. Do not use alternative keys.',
              'Use clinicalPattern, not recognitionPattern.',
              'Use differentials, not differentialDistinguishers.',
              'summary must be an object, not a string.',
              'All ids must be stable kebab-case strings.',
              'Use typed clinical cognition pearls for clinicalPattern, examPearls, investigations, differentials, management, and pitfalls.',
              'Each typed pearl must include id, type, title, content, and whyItMatters.',
              'Typed pearl content must be 18-45 words and no more than 2 sentences.',
              'Every whyItMatters line must name the probability shift, discriminator, management change, risk, or trap avoided.',
              'Follow schemaContract/editorialPatterns exactly: they use only schema-allowed fields.',
              'Before returning JSON, mentally assign each teaching concept to exactly one primary section; write a compact clinical handbook page, not a repeated essay.',
              'Do not repeat concepts; if repeated, add label, mechanism, action, trap, or separator. Avoid synonym duplicates such as RLQ tenderness/right lower quadrant tenderness.',
              'Use compactGenerationContext for expected signs, scores, investigations, mimics, pitfalls, management anchors, and critical teaching units unless clinically irrelevant.',
              'Cover every critical requiredTeachingUnit for education. Explain its rationale, discriminator, and operational implication; do not merely mention the term.',
              'Differentials must compare explicitly using language such as unlike, rather than, favors, argues against, or distinguishes, with title as diagnosis, content as whyConfused, discriminator as keySeparator, and trapAvoided as classicTrap.',
              'Recall prompts must test reasoning or discrimination, not trivia.',
              'Do not include drug doses, patient-specific advice, or unsupported guideline claims.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'Draft diagnosis-level high-yield education for editorial review.',
              typedPearlContract: {
                requiredFields: [
                  'id',
                  'type',
                  'title',
                  'content',
                  'whyItMatters',
                ],
                optionalFields: [
                  'discriminator',
                  'managementImplication',
                  'escalationImplication',
                  'trapAvoided',
                ],
                allowedTypes: PEARL_TYPE_VALUES,
                constraints: [
                  '18-45 words, max 2 sentences.',
                  'Must prevent a mistake, change management, distinguish mimics, or explain diagnostic significance.',
                  'Avoid textbook introductions and generic urgency statements.',
                ],
              },
              sectionOwnership:
                'summary=definition/takeaway only; clinicalPattern=flow; keySigns=named signs; examPearls=mechanism; investigations=interpretation/trap; scoringSystems=scores; management=actions; pitfalls=traps; differentials title=diagnosis content=whyConfused discriminator=keySeparator trapAvoided=classicTrap.',
              appendicitisAllocationExample:
                'summary=appendix inflammation/takeaway; clinicalPattern=Periumbilical pain -> RLQ pain -> movement sensitivity -> focal peritonism; keySigns=McBurney/Rovsing/psoas/obturator; examPearls=mechanisms; investigations=WBC/CRP/USS/CT interpretation traps; scoringSystems=Alvarado/MANTRELS; management=action principles; pitfalls=normal early WBC/retrocecal anatomy/perforation reassurance.',
              compactGenerationContext,
              exampleCases: this.toEducationExampleCaseSummaries(
                this.asArray((registry as Record<string, unknown>).cases),
                registry.displayLabel,
              ),
              schemaContract:
                this.educationSchemaContractService.getPromptContract(),
              editorialPatterns:
                this.educationEditorialPatternsService.getPromptGuidance(),
              diagnosis: generationContext.diagnosis,
              diagnosisSpecificGuidance: {
                forbiddenGenericPatterns:
                  knowledgeGuidance?.forbiddenGenericPatterns.slice(0, 5) ??
                  [],
                atomicityGuidance:
                  knowledgeGuidance?.atomicityGuidance.slice(0, 3) ?? [],
                discriminatorStyle:
                  'Use unlike/rather than/favors/argues against/distinguishes.',
              },
              constraints: [
                'Return JSON object only.',
                'Do not use markdown.',
                'Do not use recognitionPattern; use clinicalPattern.',
                'Do not use differentialDistinguishers; use differentials.',
                'summary must be an object with definition and highYieldTakeaway.',
                'clinicalPattern, examPearls, investigations, differentials, management, and pitfalls must use typed pearl objects with id, type, title, content, whyItMatters.',
                'Length limits: clinicalPattern max 3, keySigns max 4, examPearls max 4, investigations max 4, management max 4, pitfalls max 3, differentials max 5, scoringSystems max 2.',
                'Do not repeat the same clinical concept across sections; each major concept has one primary section, and any repeat must add label, mechanism, action, trap, or separator.',
                'Prefer named concepts such as McBurney, Rovsing, and Alvarado/MANTRELS over repeated generic synonyms.',
                'summary is definition plus one high-yield takeaway only; no exam signs, investigations, management, or full clinical pattern.',
                'scoringSystems must be objects with id, name, use, components, and caution.',
                'Keep scoring systems and mnemonics in scoringSystems, not examPearls.',
                'recallPrompts must be objects with id, type, prompt, answer, sourceSection, and difficulty.',
                'Recall prompts must include at least one WHY_IT_MATTERS prompt.',
                'Recall prompts should include at least one DISTINGUISH prompt when meaningful differentials exist.',
                'Clinical pattern must include illness script, context, tempo, and relevant atypical presentations without detailed signs, labs, or management.',
                'Key signs must be named/high-value bedside signs only.',
                'Exam pearls must prioritize why exam findings matter, not validated scores or repeated signs.',
                'Exam pearls should be 1-2 dense reasoning sentences, not paragraph prose.',
                'Differentials must include diagnosis, whyConfused, keySeparator, and classicTrap via typed fields.',
                'Investigations must include interpretation or trap, not generic test usefulness prose.',
                'Management must state action principles and must not repeat the diagnostic pattern.',
                'References must include at least two source labels when scoring systems, investigations, or management are populated.',
                'No drug doses.',
                'No patient-specific advice.',
                'Management must be broad and educational.',
                'Scoring systems and management require references before publication.',
                'Use concise bullets suitable for mobile.',
              ],
            }),
          },
        ],
      };
      const completion = await this.createEducationDraftCompletion({
        diagnosisRegistryId,
        request,
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new BadRequestException('AI returned an empty education draft');
      }

      const validationStartedAt = Date.now();
      const parsed = this.parseGeneratedDraft(content, diagnosisRegistryId);
      const normalized = this.normalizeGeneratedDraft(parsed);
      const validatedDraft = this.validateGeneratedDraft(
        normalized,
        diagnosisRegistryId,
      );
      this.logger.log(
        JSON.stringify({
          event: 'diagnosis_education.generate.validation_completed',
          diagnosisRegistryId,
          elapsedMs: Date.now() - validationStartedAt,
        }),
      );

      const qualityStartedAt = Date.now();
      const draftQuality = this.educationDraftQualityValidator.validate({
        draft: validatedDraft,
        guidance: knowledgeGuidance,
        teachingRules,
      });
      this.logger.log(
        JSON.stringify({
          event: 'diagnosis_education.generate.quality_validation_completed',
          diagnosisRegistryId,
          elapsedMs: Date.now() - qualityStartedAt,
          scores: draftQuality.scores,
        }),
      );
      const qualityWarnings = [
        ...new Set([
          ...this.collectEducationQualityWarnings(validatedDraft),
          ...draftQuality.warnings,
        ]),
      ].sort();
      if (qualityWarnings.length) {
        this.logger.warn(
          JSON.stringify({
            event: 'diagnosis_education.generate.quality_warnings',
            diagnosisRegistryId,
            warnings: qualityWarnings,
            blockers: draftQuality.blockers,
            scores: draftQuality.scores,
          }),
        );
      }

      const education = await this.prisma.$transaction(async (tx) => {
        if (existing?.editorialStatus === DiagnosisEducationStatus.PUBLISHED) {
          await this.createRevisionIfMissing(tx, existing, userId);
        }

        const saved = existing
          ? await tx.diagnosisEducation.update({
              where: { id: existing.id },
              data: {
                ...this.buildWriteData(validatedDraft, {
                  title: registry.displayLabel,
                  status: DiagnosisEducationStatus.NEEDS_REVIEW,
                  source: DiagnosisEducationSource.AI_ASSISTED,
                  version: existing.version + 1,
                }),
                generatedAt: new Date(),
                reviewedAt: null,
                reviewedByUserId: null,
                publishedAt: null,
              },
            })
          : await tx.diagnosisEducation.create({
              data: {
                ...this.buildWriteData(validatedDraft, {
                  title: registry.displayLabel,
                  status: DiagnosisEducationStatus.NEEDS_REVIEW,
                  source: DiagnosisEducationSource.AI_ASSISTED,
                  version: 1,
                }),
                diagnosisRegistryId,
                summary: validatedDraft.summary,
                generatedAt: new Date(),
                reviewedAt: null,
                reviewedByUserId: null,
                publishedAt: null,
              },
            });

        await this.createRevision(tx, saved, userId);
        return saved;
      });

      await this.refreshDifferentialMappings(education.id);
      return education;
    } finally {
      this.educationGenerationLocks.delete(diagnosisRegistryId);
    }
  }

  private parseGeneratedDraft(
    content: string,
    diagnosisRegistryId: string,
  ): Record<string, unknown> {
    try {
      const parsed = JSON.parse(content) as unknown;
      if (!this.isPlainObject(parsed)) {
        throw new Error('Root value is not an object');
      }

      return parsed;
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'diagnosis_education.generate.invalid_json',
          diagnosisRegistryId,
          contentLength: content.length,
          error: error instanceof Error ? error.message : 'Unknown parse error',
        }),
      );
      throw new BadRequestException('AI returned invalid education JSON');
    }
  }

  private validateGeneratedDraft(
    draft: Record<string, unknown>,
    diagnosisRegistryId: string,
  ): ValidatedEducationDraft {
    const errors: string[] = [];
    const validated: Partial<ValidatedEducationDraft> = {};

    const summary = this.validateSummary(draft.summary);
    if (summary) {
      validated.summary = summary;
    } else {
      errors.push('summary.definition is required');
    }

    for (const field of [
      'complications',
      'references',
    ] satisfies EducationJsonField[]) {
      if (field in draft && draft[field] !== null) {
        const value = this.validateStringArray(draft[field]);
        if (value) {
          validated[field] = value;
        } else {
          errors.push(`${field} must be an array of strings`);
        }
      }
    }

    if ('clinicalPattern' in draft && draft.clinicalPattern !== null) {
      const value = this.validateEducationPearlArray(
        draft.clinicalPattern,
        'PATTERN_RECOGNITION',
        ['pattern', 'whyItMatters'],
        ['progression', 'commonTrap'],
      );
      if (value) {
        validated.clinicalPattern = value;
      } else {
        errors.push('clinicalPattern must include pattern and whyItMatters');
      }
    }

    for (const field of [
      'keySymptoms',
      'keySigns',
    ] satisfies EducationJsonField[]) {
      if (field in draft && draft[field] !== null) {
        const value = this.validateObjectOrStringArray(
          draft[field],
          ['finding', 'whyItMatters'],
          ['diagnosticImpact', 'discriminator'],
        );
        if (value) {
          validated[field] = value;
        } else {
          errors.push(`${field} must include finding and whyItMatters`);
        }
      }
    }

    if ('examPearls' in draft && draft.examPearls !== null) {
      const value = this.validateEducationPearlArray(
        draft.examPearls,
        'EXAM',
        ['label', 'explanation'],
        ['id', 'whyItMatters'],
      );
      if (value) {
        validated.examPearls = value;
      } else {
        errors.push('examPearls must include label and explanation');
      }
    }

    if ('investigations' in draft && draft.investigations !== null) {
      const value = this.validateEducationPearlArray(
        draft.investigations,
        'INVESTIGATION',
        ['test', 'significance'],
        ['interpretation', 'discriminator'],
      );
      if (value) {
        validated.investigations = value;
      } else {
        errors.push('investigations must include test and significance');
      }
    }

    if ('differentials' in draft && draft.differentials !== null) {
      const value = this.validateEducationPearlArray(
        draft.differentials,
        'HIGH_YIELD_DISCRIMINATOR',
        ['diagnosis', 'distinguishingPoint'],
        ['id', 'whyConfused', 'keySeparator', 'classicTrap'],
      );
      if (value) {
        validated.differentials = value;
      } else {
        errors.push(
          'differentials must include diagnosis and distinguishingPoint',
        );
      }
    }

    if ('management' in draft && draft.management !== null) {
      const value = this.validateEducationPearlArray(
        draft.management,
        'MANAGEMENT',
        ['step'],
        ['rationale', 'urgency'],
      );
      if (value) {
        validated.management = value;
      } else {
        errors.push('management must include step');
      }
    }

    if ('pitfalls' in draft && draft.pitfalls !== null) {
      const value = this.validateEducationPearlArray(
        draft.pitfalls,
        'PITFALL',
        ['pitfall'],
        ['whyItHappens', 'consequence', 'saferHeuristic'],
      );
      if (value) {
        validated.pitfalls = value;
      } else {
        errors.push('pitfalls must include pitfall');
      }
    }

    if ('scoringSystems' in draft && draft.scoringSystems !== null) {
      const value = this.validateScoringSystems(draft.scoringSystems);
      if (value) {
        validated.scoringSystems = value;
      } else {
        errors.push(
          'scoringSystems must include id, name, use, components, and caution',
        );
      }
    }

    if ('recallPrompts' in draft && draft.recallPrompts !== null) {
      const value = this.validateRecallPrompts(draft.recallPrompts);
      if (value) {
        validated.recallPrompts = value;
      } else {
        errors.push(
          'recallPrompts must include id, type, prompt, answer, sourceSection, and difficulty',
        );
      }
    }

    if (errors.length) {
      this.logger.warn(
        JSON.stringify({
          event: 'diagnosis_education.generate.invalid_shape',
          diagnosisRegistryId,
          errors,
        }),
      );
      throw new BadRequestException({
        message: 'AI returned invalid education draft shape',
        errors,
      });
    }

    return validated as ValidatedEducationDraft;
  }

  private normalizeGeneratedDraft(
    draft: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized = { ...draft };

    if (!('clinicalPattern' in normalized) && 'recognitionPattern' in draft) {
      normalized.clinicalPattern = draft.recognitionPattern;
    }

    if (
      !('differentials' in normalized) &&
      'differentialDistinguishers' in draft
    ) {
      normalized.differentials = draft.differentialDistinguishers;
    }

    if (typeof normalized.summary === 'string') {
      normalized.summary = {
        definition: normalized.summary,
      };
    }

    return normalized;
  }

  private collectEducationQualityWarnings(
    draft: Partial<Record<EducationJsonField, unknown>>,
  ): string[] {
    const text = EDUCATION_JSON_FIELDS.map((field) =>
      JSON.stringify(draft[field] ?? ''),
    )
      .join('\n')
      .toLowerCase();

    const genericPhraseCount = GENERIC_EDUCATION_PHRASES.reduce(
      (count, phrase) => count + (text.includes(phrase) ? 1 : 0),
      0,
    );
    const diagnosticVerbCount = DIAGNOSTIC_REASONING_TERMS.reduce(
      (count, term) => count + (text.includes(term) ? 1 : 0),
      0,
    );
    const warnings: string[] = [];

    if (genericPhraseCount >= 2) {
      warnings.push('generic_filler_phrases_detected');
    }

    if (diagnosticVerbCount < 4) {
      warnings.push('low_diagnostic_reasoning_density');
    }

    if (!this.hasStructuredWhyLayer(draft)) {
      warnings.push('missing_structured_why_layer');
    }

    if (!this.hasDifferentialReasoning(draft)) {
      warnings.push('missing_comparative_differential_reasoning');
    }

    if (!this.hasRecallType(draft, 'WHY_IT_MATTERS')) {
      warnings.push('missing_why_it_matters_recall_prompt');
    }

    if (this.hasGenericExamPearlWhyLayer(draft)) {
      warnings.push('generic_exam_pearl_why_layer');
    }

    for (const warning of this.collectTypedPearlWarningCodes(draft)) {
      warnings.push(`typed_pearl_${warning}`);
    }

    return warnings;
  }

  private hasStructuredWhyLayer(
    draft: Partial<Record<EducationJsonField, unknown>>,
  ): boolean {
    return [
      draft.clinicalPattern,
      draft.keySymptoms,
      draft.keySigns,
      draft.examPearls,
      draft.investigations,
      draft.management,
      draft.pitfalls,
    ].some((value) =>
      Array.isArray(value)
        ? value.some(
            (item) =>
              this.isPlainObject(item) &&
              ('whyItMatters' in item ||
                'significance' in item ||
                'rationale' in item ||
                'consequence' in item),
          )
        : false,
    );
  }

  private hasDifferentialReasoning(
    draft: Partial<Record<EducationJsonField, unknown>>,
  ): boolean {
    return Array.isArray(draft.differentials)
      ? draft.differentials.some((item) => {
          if (!this.isPlainObject(item)) {
            return false;
          }

          const distinguishingPoint = this.cleanString(
            item.distinguishingPoint,
          );
          const hasStructuredContrast = Boolean(
            this.cleanString(item.whyConfused) ||
            this.cleanString(item.keySeparator) ||
            this.cleanString(item.classicTrap),
          );
          const pointIncludesContrast = distinguishingPoint
            ? /\b(?:unlike|whereas|compared with|rather than|instead of|distinguish|differentiate|favors|argues against)\b/i.test(
                distinguishingPoint,
              )
            : false;

          return Boolean(
            distinguishingPoint &&
            (hasStructuredContrast || pointIncludesContrast),
          );
        })
      : false;
  }

  private hasRecallType(
    draft: Partial<Record<EducationJsonField, unknown>>,
    recallType: string,
  ): boolean {
    return Array.isArray(draft.recallPrompts)
      ? draft.recallPrompts.some(
          (item) =>
            this.isPlainObject(item) &&
            this.cleanString(item.type) === recallType,
        )
      : false;
  }

  private hasGenericExamPearlWhyLayer(
    draft: Partial<Record<EducationJsonField, unknown>>,
  ): boolean {
    if (!Array.isArray(draft.examPearls)) {
      return false;
    }

    return draft.examPearls.some((item) => {
      if (!this.isPlainObject(item)) {
        return false;
      }

      const whyItMatters = this.cleanString(item.whyItMatters);
      return Boolean(whyItMatters && this.isGenericWhyLayer(whyItMatters));
    });
  }

  private isGenericWhyLayer(text: string): boolean {
    const normalized = text.toLowerCase();
    const hasGenericPhrase = GENERIC_WHY_LAYER_PHRASES.some((phrase) =>
      normalized.includes(phrase),
    );

    if (!hasGenericPhrase) {
      return false;
    }

    return !WHY_LAYER_REASONING_MARKERS.some((marker) =>
      normalized.includes(marker),
    );
  }

  private collectTypedPearlWarningCodes(
    draft: Partial<Record<EducationJsonField, unknown>>,
  ): string[] {
    const warnings = new Set<string>();

    for (const field of [
      'clinicalPattern',
      'examPearls',
      'investigations',
      'differentials',
      'management',
      'pitfalls',
    ] satisfies EducationJsonField[]) {
      const value = draft[field];
      if (!Array.isArray(value)) {
        continue;
      }

      for (const item of value) {
        if (!this.isPlainObject(item) || !this.isTypedEducationPearl(item)) {
          continue;
        }

        const critique = this.extractPearlCritique(item);
        for (const warning of critique.warnings) {
          warnings.add(warning);
        }
      }
    }

    return [...warnings].sort();
  }

  private collectTypedPearlPublishBlockers(
    draft: Partial<Record<EducationJsonField, unknown>>,
  ): string[] {
    const blockers = new Set<string>();

    for (const field of [
      'clinicalPattern',
      'examPearls',
      'investigations',
      'differentials',
      'management',
      'pitfalls',
    ] satisfies EducationJsonField[]) {
      const value = draft[field];
      if (!Array.isArray(value)) {
        continue;
      }

      const typedPearls = value.filter(
        (item): item is Record<string, unknown> =>
          this.isPlainObject(item) &&
          ('type' in item || 'content' in item || 'critique' in item),
      );
      if (!typedPearls.length) {
        continue;
      }

      const malformed = typedPearls.some(
        (item) =>
          !this.cleanString(item.id) ||
          !this.cleanPearlType(item.type) ||
          !this.cleanString(item.content),
      );
      if (malformed) {
        blockers.add('typed_pearl_missing_required_content');
      }

      const allLackOperationalReasoning = typedPearls.every((item) => {
        const critique = this.extractPearlCritique(item);
        return critique.warnings.includes('missing_operational_reasoning');
      });
      if (allLackOperationalReasoning) {
        blockers.add(`typed_pearl_${field}_missing_operational_reasoning`);
      }

      const severeGeneric = typedPearls.some((item) => {
        const critique = this.extractPearlCritique(item);
        return (
          critique.warnings.includes('generic_phrase') &&
          critique.warnings.includes('missing_why_layer')
        );
      });
      if (severeGeneric) {
        blockers.add(`typed_pearl_${field}_generic_without_why_layer`);
      }
    }

    return [...blockers];
  }

  private extractPearlCritique(value: Record<string, unknown>): PearlCritique {
    const critique = value.critique;
    if (
      this.isPlainObject(critique) &&
      Array.isArray(critique.warnings) &&
      critique.warnings.every((warning) => typeof warning === 'string')
    ) {
      return {
        genericityScore:
          typeof critique.genericityScore === 'number'
            ? critique.genericityScore
            : undefined,
        discriminatorStrength:
          typeof critique.discriminatorStrength === 'number'
            ? critique.discriminatorStrength
            : undefined,
        operationalReasoningScore:
          typeof critique.operationalReasoningScore === 'number'
            ? critique.operationalReasoningScore
            : undefined,
        memorabilityScore:
          typeof critique.memorabilityScore === 'number'
            ? critique.memorabilityScore
            : undefined,
        managementImpactScore:
          typeof critique.managementImpactScore === 'number'
            ? critique.managementImpactScore
            : undefined,
        warnings: critique.warnings,
      };
    }

    if (this.isTypedEducationPearl(value)) {
      return this.validateTypedPearl(value);
    }

    return { warnings: ['missing_type'] };
  }

  private validateSummary(value: unknown): Prisma.InputJsonObject | null {
    if (!this.isPlainObject(value)) {
      return null;
    }

    const definition = this.cleanString(value.definition);
    if (!definition) {
      return null;
    }

    const summary: Record<string, string> = { definition };
    const highYieldTakeaway = this.cleanString(value.highYieldTakeaway);
    if (highYieldTakeaway) {
      summary.highYieldTakeaway = highYieldTakeaway;
    }

    return summary as Prisma.InputJsonObject;
  }

  private validateStringArray(value: unknown): Prisma.InputJsonArray | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const items = value.map((item) => this.cleanString(item));
    if (items.some((item) => !item)) {
      return null;
    }

    return items;
  }

  private validateObjectArray(
    value: unknown,
    requiredKeys: string[],
    optionalKeys: string[] = [],
  ): Prisma.InputJsonArray | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const items = value.map((item) => {
      if (!this.isPlainObject(item)) {
        return null;
      }

      const output: Record<string, string> = {};
      for (const key of requiredKeys) {
        const stringValue = this.cleanString(item[key]);
        if (!stringValue) {
          return null;
        }
        output[key] = stringValue;
      }

      for (const key of optionalKeys) {
        const stringValue = this.cleanString(item[key]);
        if (stringValue) {
          output[key] = stringValue;
        }
      }

      return output as Prisma.InputJsonObject;
    });

    if (items.some((item) => item === null)) {
      return null;
    }

    return items as Prisma.InputJsonArray;
  }

  private validateObjectOrStringArray(
    value: unknown,
    requiredKeys: string[],
    optionalKeys: string[] = [],
  ): Prisma.InputJsonArray | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const items = value.map((item) => {
      if (typeof item === 'string') {
        return this.cleanString(item);
      }

      if (!this.isPlainObject(item)) {
        return null;
      }

      const output: Record<string, string> = {};
      for (const key of requiredKeys) {
        const stringValue = this.cleanString(item[key]);
        if (!stringValue) {
          return null;
        }
        output[key] = stringValue;
      }

      for (const key of optionalKeys) {
        const stringValue = this.cleanString(item[key]);
        if (stringValue) {
          output[key] = stringValue;
        }
      }

      return output as Prisma.InputJsonObject;
    });

    if (items.some((item) => item === null)) {
      return null;
    }

    return items as Prisma.InputJsonArray;
  }

  private validateEducationPearlArray(
    value: unknown,
    fallbackType: PearlType,
    legacyRequiredKeys: string[],
    legacyOptionalKeys: string[] = [],
  ): Prisma.InputJsonArray | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const fingerprints = new Map<string, number>();
    const normalizedItems = value.map((item) => {
      const normalized = this.normalizeEducationPearl(
        item,
        fallbackType,
        legacyRequiredKeys,
        legacyOptionalKeys,
      );

      if (!normalized || !this.isPlainObject(normalized)) {
        return normalized;
      }

      if (!this.isTypedEducationPearl(normalized)) {
        return normalized;
      }

      const fingerprint = this.fingerprintTeachingPoint(normalized.content);
      if (fingerprint) {
        fingerprints.set(fingerprint, (fingerprints.get(fingerprint) ?? 0) + 1);
      }

      return normalized;
    });

    if (normalizedItems.some((item) => item === null)) {
      return null;
    }

    const itemsWithDuplicateWarnings = normalizedItems.map((item) => {
      if (!this.isPlainObject(item) || !this.isTypedEducationPearl(item)) {
        return item;
      }

      const fingerprint = this.fingerprintTeachingPoint(item.content);
      const critique = this.validateTypedPearl(
        item,
        Boolean(fingerprint && (fingerprints.get(fingerprint) ?? 0) > 1),
      );

      return {
        ...item,
        critique,
      } satisfies TypedEducationPearl;
    });

    return itemsWithDuplicateWarnings as Prisma.InputJsonArray;
  }

  private normalizeEducationPearl(
    value: unknown,
    fallbackType: PearlType,
    legacyRequiredKeys: string[],
    legacyOptionalKeys: string[] = [],
  ): Prisma.InputJsonValue | null {
    if (typeof value === 'string') {
      return this.cleanString(value);
    }

    if (!this.isPlainObject(value)) {
      return null;
    }

    if ('type' in value || 'content' in value) {
      const id = this.cleanString(value.id);
      const type = this.cleanPearlType(value.type) ?? fallbackType;
      const content = this.cleanString(value.content);

      if (!id || !content) {
        return null;
      }

      const pearl: TypedEducationPearl = {
        id,
        type,
        content,
      };

      const title = this.cleanString(value.title);
      const whyItMatters = this.cleanString(value.whyItMatters);
      const discriminator = this.cleanString(value.discriminator);
      const managementImplication = this.cleanString(
        value.managementImplication,
      );
      const escalationImplication = this.cleanString(
        value.escalationImplication,
      );
      const trapAvoided = this.cleanString(value.trapAvoided);

      if (title) {
        pearl.title = title;
      }
      if (whyItMatters) {
        pearl.whyItMatters = whyItMatters;
      }
      if (discriminator) {
        pearl.discriminator = discriminator;
      }
      if (managementImplication) {
        pearl.managementImplication = managementImplication;
      }
      if (escalationImplication) {
        pearl.escalationImplication = escalationImplication;
      }
      if (trapAvoided) {
        pearl.trapAvoided = trapAvoided;
      }

      pearl.critique = this.validateTypedPearl(pearl);
      return pearl as Prisma.InputJsonObject;
    }

    const output: Record<string, string> = {};
    for (const key of legacyRequiredKeys) {
      const stringValue = this.cleanString(value[key]);
      if (!stringValue) {
        return null;
      }
      output[key] = stringValue;
    }

    for (const key of legacyOptionalKeys) {
      const stringValue = this.cleanString(value[key]);
      if (stringValue) {
        output[key] = stringValue;
      }
    }

    return output as Prisma.InputJsonObject;
  }

  private validateTypedPearl(
    pearl: TypedEducationPearl,
    duplicateTeachingPoint = false,
  ): PearlCritique {
    const warnings: string[] = [];
    const content = pearl.content.trim();
    const combinedText = [
      pearl.content,
      pearl.whyItMatters,
      pearl.discriminator,
      pearl.managementImplication,
      pearl.escalationImplication,
      pearl.trapAvoided,
    ]
      .filter(Boolean)
      .join(' ');
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const sentenceCount = (content.match(/[.!?]+/g) ?? []).length || 1;
    const hasGenericPhrase = this.hasGenericPearlPhrase(combinedText);
    const hasWhyLayer = Boolean(
      this.cleanString(pearl.whyItMatters) ||
      this.cleanString(pearl.discriminator) ||
      this.cleanString(pearl.managementImplication) ||
      this.cleanString(pearl.escalationImplication) ||
      this.cleanString(pearl.trapAvoided),
    );
    const hasOperationalReasoning =
      hasWhyLayer &&
      WHY_LAYER_REASONING_MARKERS.some((marker) =>
        combinedText.toLowerCase().includes(marker),
      );
    const hasStrongDiscriminator = Boolean(
      this.cleanString(pearl.discriminator) ||
      /\b(?:over|rather than|unlike|distinguish|differentiate|favors|argues against)\b/i.test(
        combinedText,
      ),
    );

    if (!PEARL_TYPE_VALUES.includes(pearl.type)) {
      warnings.push('missing_type');
    }
    if (wordCount < 18) {
      warnings.push('too_short');
    }
    if (wordCount > 45) {
      warnings.push('too_long');
    }
    if (sentenceCount > 2) {
      warnings.push('too_many_sentences');
    }
    if (hasGenericPhrase) {
      warnings.push('generic_phrase');
    }
    if (!hasWhyLayer) {
      warnings.push('missing_why_layer');
    }
    if (!hasOperationalReasoning) {
      warnings.push('missing_operational_reasoning');
    }
    if (pearl.type === 'HIGH_YIELD_DISCRIMINATOR' && !hasStrongDiscriminator) {
      warnings.push('weak_discriminator');
    }
    if (duplicateTeachingPoint) {
      warnings.push('duplicate_teaching_point');
    }

    return {
      genericityScore: hasGenericPhrase ? 0.85 : 0.1,
      discriminatorStrength: hasStrongDiscriminator ? 0.85 : 0.25,
      operationalReasoningScore: hasOperationalReasoning ? 0.85 : 0.2,
      memorabilityScore: wordCount >= 18 && wordCount <= 45 ? 0.75 : 0.35,
      managementImpactScore:
        pearl.managementImplication || pearl.escalationImplication ? 0.8 : 0.3,
      warnings,
    };
  }

  private isTypedEducationPearl(
    value: Record<string, unknown>,
  ): value is TypedEducationPearl {
    return Boolean(
      this.cleanString(value.id) &&
      this.cleanPearlType(value.type) &&
      this.cleanString(value.content),
    );
  }

  private cleanPearlType(value: unknown): PearlType | null {
    return typeof value === 'string' &&
      PEARL_TYPE_VALUES.includes(value as PearlType)
      ? (value as PearlType)
      : null;
  }

  private hasGenericPearlPhrase(text: string): boolean {
    const normalized = text.toLowerCase();
    return GENERIC_WHY_LAYER_PHRASES.some((phrase) =>
      normalized.includes(phrase),
    );
  }

  private fingerprintTeachingPoint(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\b(?:the|a|an|and|or|of|to|in|with|for|is|are|can|may)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private validateScoringSystems(value: unknown): Prisma.InputJsonArray | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const items = value.map((item) => {
      if (!this.isPlainObject(item)) {
        return null;
      }

      const name = this.cleanString(item.name);
      const use = this.cleanString(item.use);
      const components = this.validateStringArray(item.components);
      const id = this.cleanString(item.id);
      const caution = this.cleanString(item.caution);
      if (!id || !name || !use || !components || !caution) {
        return null;
      }

      return { id, name, use, components, caution };
    });

    if (items.some((item) => item === null)) {
      return null;
    }

    return items as Prisma.InputJsonArray;
  }

  private validateRecallPrompts(value: unknown): Prisma.InputJsonArray | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const items = value.map((item) => {
      if (!this.isPlainObject(item)) {
        return null;
      }

      const id = this.cleanString(item.id);
      const type = this.cleanString(item.type);
      const prompt = this.cleanString(item.prompt);
      const answer = this.cleanString(item.answer);
      const sourceSection = this.cleanString(item.sourceSection);
      const difficulty = this.cleanString(item.difficulty);
      if (!id || !type || !prompt || !answer || !sourceSection || !difficulty) {
        return null;
      }

      if (
        ![
          'CLOZE',
          'SHORT_ANSWER',
          'DISTINGUISH',
          'PEARL_RECALL',
          'WHY_IT_MATTERS',
        ].includes(type)
      ) {
        return null;
      }

      const explanation = this.cleanString(item.explanation);
      const linkedConcept = this.cleanString(item.linkedConcept);

      return {
        id,
        type,
        prompt,
        answer,
        ...(explanation ? { explanation } : {}),
        ...(linkedConcept ? { linkedConcept } : {}),
        sourceSection,
        difficulty,
      };
    });

    if (items.some((item) => item === null)) {
      return null;
    }

    return items as Prisma.InputJsonArray;
  }

  private cleanString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toEducationExampleCaseSummaries(
    cases: unknown[],
    diagnosisLabel: string,
  ): Prisma.InputJsonArray {
    return cases.slice(0, 3).map((caseRecord) => {
      const record = this.isPlainObject(caseRecord) ? caseRecord : {};
      const explanation = this.isPlainObject(record.explanation)
        ? record.explanation
        : {};

      return {
        title: this.cleanString(record.title) ?? diagnosisLabel,
        diagnosis: diagnosisLabel,
        clues: this.asArray(record.clues)
          .slice(0, 3)
          .map((clue) => {
            const clueRecord = this.isPlainObject(clue) ? clue : {};
            return {
              type: this.cleanString(clueRecord.type) ?? 'clue',
              value: this.compactEducationPromptText(clueRecord.value, 180),
            };
          })
          .filter((clue) => clue.value),
        differentials: this.asArray(record.differentials)
          .map((differential) =>
            this.compactEducationPromptText(differential, 120),
          )
          .filter((differential) => differential),
        differentialAnalysis: this.asArray(explanation.differentialAnalysis)
          .slice(0, 3)
          .map((item) => {
            const itemRecord = this.isPlainObject(item) ? item : {};
            return {
              diagnosis: this.compactEducationPromptText(
                itemRecord.diagnosis,
                80,
              ),
              whyPlausibleEarly: this.compactEducationPromptText(
                itemRecord.whyPlausibleEarly,
                160,
              ),
              finalReasonLessLikely: this.compactEducationPromptText(
                itemRecord.finalReasonLessLikely,
                160,
              ),
            };
          })
          .filter((item) =>
            Boolean(
              item.diagnosis ||
                item.whyPlausibleEarly ||
                item.finalReasonLessLikely,
            ),
          ),
      };
    }) as Prisma.InputJsonArray;
  }

  private compactEducationPromptText(
    value: unknown,
    maxLength: number,
  ): string {
    const text =
      typeof value === 'string'
        ? value
        : value === null || value === undefined
          ? ''
          : JSON.stringify(value);
    const compacted = text.replace(/\s+/g, ' ').trim();

    return compacted.length > maxLength
      ? `${compacted.slice(0, maxLength - 1).trim()}...`
      : compacted;
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private getEducationPromptMetrics(
    request: ChatCompletionCreateParamsNonStreaming,
  ) {
    const systemMessage = request.messages.find(
      (message) => message.role === 'system',
    );
    const userMessage = request.messages.find(
      (message) => message.role === 'user',
    );
    const systemMessageLength = this.messageContentLength(
      systemMessage?.content,
    );
    const userMessageLength = this.messageContentLength(userMessage?.content);
    const promptCharacterCount = request.messages.reduce(
      (sum, message) => sum + this.messageContentLength(message.content),
      0,
    );

    return {
      promptCharacterCount,
      approximatePromptTokenCount: Math.ceil(promptCharacterCount / 4),
      systemMessageLength,
      userMessageLength,
    };
  }

  private messageContentLength(
    content: ChatCompletionCreateParamsNonStreaming['messages'][number]['content'],
  ): number {
    if (typeof content === 'string') {
      return content.length;
    }

    if (!Array.isArray(content)) {
      return 0;
    }

    return JSON.stringify(content).length;
  }

  private assertAdminEnabled() {
    if (!getEnv().ADMIN_DIAGNOSIS_EDUCATION_ENABLED) {
      throw new NotFoundException('Admin diagnosis education is not available');
    }
  }

  private registrySelect() {
    return {
      id: true,
      displayLabel: true,
      canonicalName: true,
      specialty: true,
      category: true,
      bodySystem: true,
      clinicalSetting: true,
      difficultyBand: true,
    } satisfies Prisma.DiagnosisRegistrySelect;
  }

  private async createEducationDraftCompletion(input: {
    diagnosisRegistryId: string;
    request: ChatCompletionCreateParamsNonStreaming;
  }): Promise<ChatCompletion> {
    const promptMetrics = this.getEducationPromptMetrics(input.request);
    for (
      let attemptIndex = 0;
      attemptIndex <= OPENAI_CONNECTION_RETRY_DELAYS_MS.length;
      attemptIndex += 1
    ) {
      const attempt = attemptIndex + 1;
      const startedAt = Date.now();
      this.logger.log(
        JSON.stringify({
          event: 'diagnosis_education.generate.prompt_metrics',
          diagnosisRegistryId: input.diagnosisRegistryId,
          model: OPENAI_EDUCATION_MODEL,
          timeoutMs: OPENAI_EDUCATION_SYNC_ATTEMPT_TIMEOUT_MS,
          attempt,
          ...promptMetrics,
        }),
      );
      try {
        const completion = await this.openaiClient!.chat.completions.create(input.request, {
          timeout: OPENAI_EDUCATION_SYNC_ATTEMPT_TIMEOUT_MS,
          maxRetries: 0,
        });
        this.logger.log(
          JSON.stringify({
            event: 'diagnosis_education.generate.openai_success',
            diagnosisRegistryId: input.diagnosisRegistryId,
            model: OPENAI_EDUCATION_MODEL,
            attempt,
            elapsedMs: Date.now() - startedAt,
          }),
        );

        return completion;
      } catch (error) {
        const shouldRetry = this.isRetryableOpenAiConnectionError(error);
        this.logOpenAiGenerationFailure({
          diagnosisRegistryId: input.diagnosisRegistryId,
          attempt,
          error,
          elapsedMs: Date.now() - startedAt,
          retrying:
            shouldRetry &&
            attemptIndex < OPENAI_CONNECTION_RETRY_DELAYS_MS.length,
        });

        if (
          !shouldRetry ||
          attemptIndex >= OPENAI_CONNECTION_RETRY_DELAYS_MS.length
        ) {
          if (shouldRetry) {
            throw new ServiceUnavailableException(
              OPENAI_CONNECTION_ERROR_MESSAGE,
            );
          }

          throw error;
        }

        await this.waitForOpenAiRetry(
          OPENAI_CONNECTION_RETRY_DELAYS_MS[attemptIndex],
        );
      }
    }

    throw new ServiceUnavailableException(OPENAI_CONNECTION_ERROR_MESSAGE);
  }

  private isRetryableOpenAiConnectionError(error: unknown): boolean {
    const record = this.toErrorRecord(error);
    const status = typeof record.status === 'number' ? record.status : null;
    if (status !== null && status >= 400 && status < 500) {
      return false;
    }

    const cause = this.toErrorRecord(record.cause);
    const combined = [
      record.name,
      record.message,
      record.code,
      cause.name,
      cause.message,
      cause.code,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase();

    return (
      combined.includes('apiconnectionerror') ||
      combined.includes('fetch failed') ||
      combined.includes('und_err_socket') ||
      combined.includes('other side closed') ||
      combined.includes('timeout') ||
      combined.includes('timed out') ||
      combined.includes('econnreset') ||
      combined.includes('econnrefused') ||
      combined.includes('etimedout') ||
      combined.includes('enotfound') ||
      combined.includes('eai_again') ||
      combined.includes('network') ||
      combined.includes('connection error')
    );
  }

  private logOpenAiGenerationFailure(input: {
    diagnosisRegistryId: string;
    attempt: number;
    error: unknown;
    elapsedMs: number;
    retrying: boolean;
  }) {
    const error = this.toErrorRecord(input.error);
    const cause = this.toErrorRecord(error.cause);
    this.logger.warn(
      JSON.stringify({
        event: 'diagnosis_education.generate.openai_failure',
        diagnosisRegistryId: input.diagnosisRegistryId,
        model: OPENAI_EDUCATION_MODEL,
        attempt: input.attempt,
        elapsedMs: input.elapsedMs,
        retrying: input.retrying,
        errorName: typeof error.name === 'string' ? error.name : null,
        errorMessage: typeof error.message === 'string' ? error.message : null,
        causeMessage: typeof cause.message === 'string' ? cause.message : null,
        requestID:
          typeof error.requestID === 'string'
            ? error.requestID
            : typeof error.request_id === 'string'
              ? error.request_id
              : null,
      }),
    );
  }

  private waitForOpenAiRetry(delayMs: number) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private toErrorRecord(value: unknown): Record<string, unknown> {
    return this.isPlainObject(value) || value instanceof Error
      ? (value as Record<string, unknown>)
      : {};
  }

  private toInputRecord(
    input: UpsertDiagnosisEducationDto,
  ): Record<string, unknown> {
    return { ...input };
  }

  private buildWriteData(
    input: Record<string, unknown>,
    metadata: {
      title: string;
      status: DiagnosisEducationStatus;
      source: DiagnosisEducationSource;
      version: number;
    },
  ): EducationWriteData {
    const data: EducationWriteData = {
      title: metadata.title,
      editorialStatus: metadata.status,
      source: metadata.source,
      version: metadata.version,
    };

    for (const field of EDUCATION_JSON_FIELDS) {
      if (field in input) {
        const value = this.toJsonInput(input[field]);
        if (value !== undefined) {
          data[field] = value;
        }
      }
    }

    return data;
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
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
          event: 'differential_mapping.education_refresh.failed',
          educationId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
    });
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

  private emptySummary(title: string): Prisma.InputJsonObject {
    return {
      definition: '',
      highYieldTakeaway: `Education draft for ${title}.`,
    };
  }

  private getPublishBlockers(education: DiagnosisEducation): string[] {
    const blockers: string[] = [];
    const summary = education.summary;
    const summaryText =
      typeof summary === 'object' && summary !== null && 'definition' in summary
        ? String((summary as { definition?: unknown }).definition ?? '').trim()
        : JSON.stringify(summary ?? '').trim();

    if (!summaryText) {
      blockers.push('missing_summary');
    }

    const fullText = EDUCATION_JSON_FIELDS.map((field) =>
      JSON.stringify(education[field] ?? ''),
    ).join('\n');

    if (/\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|units|iu|ml|mL)\b/i.test(fullText)) {
      blockers.push('contains_drug_dosing');
    }

    if (
      /\b(?:you should|your doctor|go to the emergency room)\b/i.test(fullText)
    ) {
      blockers.push('contains_patient_specific_advice');
    }

    const hasHighRiskContent = Boolean(
      education.management ||
      education.scoringSystems ||
      education.investigations,
    );
    const hasReferences =
      Array.isArray(education.references) && education.references.length > 0;

    if (hasHighRiskContent && !hasReferences) {
      blockers.push('high_risk_sections_need_references');
    }

    blockers.push(...this.collectTypedPearlPublishBlockers(education));
    blockers.push(
      ...this.educationDraftQualityValidator.validate({
        draft: {
          examPearls: education.examPearls,
          investigations: education.investigations,
          differentials: education.differentials,
          management: education.management,
          pitfalls: education.pitfalls,
          recallPrompts: education.recallPrompts,
        },
      }).blockers,
    );

    return blockers;
  }

  private toPlayerDto(education: DiagnosisEducationWithRegistry) {
    return {
      diagnosisRegistryId: education.diagnosisRegistryId,
      title: education.title,
      diagnosis: education.diagnosisRegistry,
      summary: education.summary,
      recognitionPattern: education.clinicalPattern,
      keySymptoms: education.keySymptoms,
      keySigns: education.keySigns,
      examPearls: education.examPearls,
      scoringSystems: education.scoringSystems,
      investigations: education.investigations,
      differentialDistinguishers: education.differentials,
      pitfalls: education.pitfalls,
      managementOverview: education.management,
      complications: education.complications,
      recallPrompts: education.recallPrompts,
      references: education.references,
      reviewedAt: education.reviewedAt?.toISOString() ?? null,
      version: education.version,
    };
  }

  private toPlayerDtoFromPublishedRevision(
    education: DiagnosisEducationWithRegistry,
    revision: {
      version: number;
      snapshot: Prisma.JsonValue;
    },
  ) {
    const snapshot = this.isPlainObject(revision.snapshot)
      ? revision.snapshot
      : {};

    return {
      diagnosisRegistryId: education.diagnosisRegistryId,
      title:
        typeof snapshot.title === 'string' && snapshot.title.trim()
          ? snapshot.title
          : education.title,
      diagnosis: education.diagnosisRegistry,
      summary: this.snapshotValue(snapshot.summary, education.summary),
      recognitionPattern: this.snapshotValue(
        snapshot.clinicalPattern,
        education.clinicalPattern,
      ),
      keySymptoms: this.snapshotValue(snapshot.keySymptoms, education.keySymptoms),
      keySigns: this.snapshotValue(snapshot.keySigns, education.keySigns),
      examPearls: this.snapshotValue(snapshot.examPearls, education.examPearls),
      scoringSystems: this.snapshotValue(
        snapshot.scoringSystems,
        education.scoringSystems,
      ),
      investigations: this.snapshotValue(
        snapshot.investigations,
        education.investigations,
      ),
      differentialDistinguishers: this.snapshotValue(
        snapshot.differentials,
        education.differentials,
      ),
      pitfalls: this.snapshotValue(snapshot.pitfalls, education.pitfalls),
      managementOverview: this.snapshotValue(
        snapshot.management,
        education.management,
      ),
      complications: this.snapshotValue(
        snapshot.complications,
        education.complications,
      ),
      recallPrompts: this.snapshotValue(
        snapshot.recallPrompts,
        education.recallPrompts,
      ),
      references: this.snapshotValue(snapshot.references, education.references),
      reviewedAt:
        typeof snapshot.reviewedAt === 'string' ? snapshot.reviewedAt : null,
      version: revision.version,
    };
  }

  private snapshotValue<T>(value: unknown, fallback: T): Prisma.JsonValue | T {
    return value === undefined ? fallback : (value as Prisma.JsonValue);
  }
}
