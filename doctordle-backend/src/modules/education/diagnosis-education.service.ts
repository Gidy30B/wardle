import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  Prisma,
  type DiagnosisEducation,
  type DiagnosisRegistry,
} from '@prisma/client';
import OpenAI from 'openai';
import { getEnv } from '../../core/config/env.validation';
import { PrismaService } from '../../core/db/prisma.service';
import type { ReviewDiagnosisEducationDto } from './dto/review-diagnosis-education.dto';
import type { UpsertDiagnosisEducationDto } from './dto/upsert-diagnosis-education.dto';

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
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['pattern', 'whyItMatters', 'progression', 'commonTrap'],
        properties: {
          pattern: { type: 'string' },
          whyItMatters: { type: 'string' },
          progression: { type: 'string' },
          commonTrap: { type: 'string' },
        },
      },
    },
    keySymptoms: {
      type: 'array',
      minItems: 3,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['finding', 'whyItMatters', 'diagnosticImpact', 'discriminator'],
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
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['finding', 'whyItMatters', 'diagnosticImpact', 'discriminator'],
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
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'explanation', 'whyItMatters'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          explanation: { type: 'string' },
          whyItMatters: { type: 'string' },
        },
      },
    },
    scoringSystems: {
      type: 'array',
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
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['test', 'significance', 'interpretation', 'discriminator'],
        properties: {
          test: { type: 'string' },
          significance: { type: 'string' },
          interpretation: { type: 'string' },
          discriminator: { type: 'string' },
        },
      },
    },
    differentials: {
      type: 'array',
      minItems: 3,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'diagnosis',
          'whyConfused',
          'distinguishingPoint',
          'keySeparator',
          'classicTrap',
        ],
        properties: {
          id: { type: 'string' },
          diagnosis: { type: 'string' },
          whyConfused: { type: 'string' },
          distinguishingPoint: { type: 'string' },
          keySeparator: { type: 'string' },
          classicTrap: { type: 'string' },
        },
      },
    },
    management: {
      type: 'array',
      minItems: 3,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['step', 'rationale', 'urgency'],
        properties: {
          step: { type: 'string' },
          rationale: { type: 'string' },
          urgency: { type: 'string' },
        },
      },
    },
    complications: { type: 'array', items: { type: 'string' } },
    pitfalls: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['pitfall', 'whyItHappens', 'consequence', 'saferHeuristic'],
        properties: {
          pitfall: { type: 'string' },
          whyItHappens: { type: 'string' },
          consequence: { type: 'string' },
          saferHeuristic: { type: 'string' },
        },
      },
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

type ValidatedEducationDraft = Record<EducationJsonField, Prisma.InputJsonValue>;

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

  constructor(private readonly prisma: PrismaService) {
    const env = getEnv();
    if (env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
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
      include: { revisions: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    return {
      diagnosisRegistry: registry,
      education,
      qualityWarnings: education
        ? this.collectEducationQualityWarnings(education)
        : [],
      publishBlockers: education ? this.getPublishBlockers(education) : [],
    };
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
      throw new BadRequestException('OPENAI_API_KEY is required for generation');
    }

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
          take: 3,
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const existing = await this.prisma.diagnosisEducation.findUnique({
      where: { diagnosisRegistryId },
    });

    if (existing?.editorialStatus === DiagnosisEducationStatus.PUBLISHED) {
      throw new BadRequestException(
        'Cannot generate over published education. Archive or create draft manually first.',
      );
    }

    const completion = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
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
          content:
            [
              'You draft reviewed medical education JSON for a medical learning game.',
              'Generate diagnosis education like a senior clinician teaching diagnostic reasoning.',
              'Every major point must explain why it matters diagnostically, what it distinguishes, what probability it shifts, or what clinical trap it avoids.',
              'Return a JSON object only. Do not wrap it in markdown. Do not include prose outside JSON.',
              'Use the exact keys from the schema. Do not use alternative keys.',
              'Use clinicalPattern, not recognitionPattern.',
              'Use differentials, not differentialDistinguishers.',
              'summary must be an object, not a string.',
              'All ids must be stable kebab-case strings.',
              'Write clinically specific, high-yield teaching pearls rather than generic textbook summaries.',
              'Prefer compressed, high-yield statements. Avoid isolated symptom lists and generic textbook phrasing.',
              'Explain diagnostic significance, discriminating features, temporal progression, and common confusions when relevant.',
              'Generate recall prompts that test reasoning and discrimination, not trivia.',
              'Prioritize named signs, bedside maneuvers, validated scoring systems, comparative differential reasoning, and specific pitfalls when relevant to the diagnosis.',
              'Reject generic output internally and revise it before final JSON if exam pearls are merely symptoms, if common named signs are missing, if differentials are not comparative, if pitfalls are vague, or if recall prompts are too broad.',
              'Do not include drug doses, patient-specific advice, or unsupported guideline claims.',
            ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Draft diagnosis-level high-yield education for editorial review.',
            exactOutputShape: {
              summary: {
                definition: 'string',
                highYieldTakeaway: 'string',
              },
              clinicalPattern: [
                {
                  pattern: 'string',
                  whyItMatters: 'string',
                  progression: 'string',
                  commonTrap: 'string',
                },
              ],
              keySymptoms: [
                {
                  finding: 'string',
                  whyItMatters: 'string',
                  diagnosticImpact: 'string',
                  discriminator: 'string',
                },
              ],
              keySigns: [
                {
                  finding: 'string',
                  whyItMatters: 'string',
                  diagnosticImpact: 'string',
                  discriminator: 'string',
                },
              ],
              examPearls: [
                {
                  id: 'stable-kebab-case-string',
                  label: 'string',
                  explanation: 'string',
                  whyItMatters: 'string',
                },
              ],
              scoringSystems: [
                {
                  id: 'stable-kebab-case-string',
                  name: 'string',
                  use: 'string',
                  components: ['string'],
                  caution: 'string',
                },
              ],
              investigations: [
                {
                  test: 'string',
                  significance: 'string',
                  interpretation: 'string',
                  discriminator: 'string',
                },
              ],
              differentials: [
                {
                  id: 'stable-kebab-case-string',
                  diagnosis: 'string',
                  whyConfused: 'string',
                  distinguishingPoint: 'string',
                  keySeparator: 'string',
                  classicTrap: 'string',
                },
              ],
              management: [
                {
                  step: 'string',
                  rationale: 'string',
                  urgency: 'string',
                },
              ],
              complications: ['string'],
              pitfalls: [
                {
                  pitfall: 'string',
                  whyItHappens: 'string',
                  consequence: 'string',
                  saferHeuristic: 'string',
                },
              ],
              recallPrompts: [
                {
                  id: 'stable-kebab-case-string',
                  type: 'WHY_IT_MATTERS',
                  prompt: 'string',
                  answer: 'string',
                  explanation: 'string',
                  linkedConcept: 'string',
                  sourceSection: 'string',
                  difficulty: 'BASIC',
                },
              ],
              references: ['string'],
            },
            teachingRubric: {
              clinicalPattern: [
                'Include the classic illness script.',
                'Name the typical patient or clinical context when relevant.',
                'Describe symptom sequence or tempo.',
                'Include important atypical presentations when clinically relevant.',
              ],
              examPearls: [
                'Prioritize named signs, bedside findings, validated scores, and clinical maneuvers.',
                'Each pearl should explain what the finding means.',
                'Do not list symptoms as exam pearls.',
              ],
              differentialDistinguishers: [
                'Each differential must be comparative.',
                'Explain how the mimic differs from the target diagnosis.',
                'Avoid non-comparative phrasing such as "may present with".',
              ],
              pitfalls: [
                'Use specific clinical traps, not generic warnings.',
                'Mention false reassurance patterns, atypical anatomy or populations, and dangerous misses when relevant.',
              ],
              references: [
                'Include at least two source labels when scoringSystems, investigations, or management are populated.',
                'Source labels can be guideline/topic labels in v1; URLs are not required.',
              ],
            },
            qualitySelfCheck: [
              'If named signs are common for this diagnosis, include them.',
              'If a validated scoring system is commonly taught for this diagnosis, include it.',
              'If exam pearls are just symptoms, revise them into bedside findings or maneuvers.',
              'If differentials are not comparative, revise them.',
              'If pitfalls are generic, make them clinically specific.',
              'If recall prompts are vague, make them test a concrete pearl.',
              'At least one recall prompt should use WHY_IT_MATTERS.',
              'At least one recall prompt should use DISTINGUISH when meaningful mimics exist.',
            ],
            badExamples: [
              'Fever may occur.',
              'Patients can present with abdominal pain.',
              'Diagnosis includes history, exam, and investigations.',
              'Management depends on severity.',
            ],
            goodExamples: [
              'Migratory periumbilical to right lower quadrant pain favors appendicitis because it reflects progression from visceral to parietal peritoneal irritation.',
              'Lipase more than three times the upper limit of normal supports pancreatitis over uncomplicated biliary colic.',
              'Hypoxia out of proportion to auscultatory findings favors pulmonary embolism over pneumonia.',
              'Steroids before antibiotics can worsen unrecognized infection.',
            ],
            styleExampleDoNotCopyDiagnosisGlobally: {
              diagnosis: 'Appendicitis',
              clinicalPattern: [
                'Classically begins as vague periumbilical pain from visceral inflammation, then localizes to the right lower quadrant as parietal peritoneum becomes irritated.',
                'Anorexia, nausea, low-grade fever, and neutrophilic leukocytosis support the pattern.',
                'Retrocecal appendicitis may produce flank/back discomfort or psoas irritation; pelvic appendicitis may cause suprapubic pain or urinary symptoms.',
                'Pregnancy, children, and older adults may have less typical localization or muted systemic findings.',
              ],
              examPearls: [
                {
                  id: 'appendicitis-mcburney-point',
                  label: 'McBurney point tenderness',
                  explanation:
                    'Maximal tenderness one-third of the way from the ASIS to the umbilicus supports appendiceal irritation.',
                },
                {
                  id: 'appendicitis-rovsing-sign',
                  label: 'Rovsing sign',
                  explanation:
                    'Left lower quadrant palpation causing right lower quadrant pain suggests peritoneal irritation.',
                },
                {
                  id: 'appendicitis-psoas-sign',
                  label: 'Psoas sign',
                  explanation:
                    'Pain with hip extension suggests irritation from a retrocecal appendix.',
                },
                {
                  id: 'appendicitis-obturator-sign',
                  label: 'Obturator sign',
                  explanation:
                    'Pain with internal rotation of the flexed hip can suggest pelvic appendiceal irritation.',
                },
                {
                  id: 'appendicitis-rebound-guarding',
                  label: 'Rebound tenderness or guarding',
                  explanation:
                    'Peritoneal irritation increases concern for advanced inflammation or perforation.',
                },
                {
                  id: 'appendicitis-alvarado-score',
                  label: 'MANTRELS / Alvarado score',
                  explanation:
                    'Migration, anorexia, nausea/vomiting, tenderness, rebound, elevated temperature, leukocytosis, and left shift structure clinical probability.',
                },
              ],
              differentials: [
                {
                  id: 'appendicitis-vs-gastroenteritis',
                  diagnosis: 'Gastroenteritis',
                  distinguishingPoint:
                    'Gastroenteritis usually has prominent diarrhea/vomiting and diffuse crampy pain, unlike progressive localized right lower quadrant tenderness in appendicitis.',
                },
              ],
              pitfalls: [
                'A normal white blood cell count does not exclude appendicitis early in the course.',
                'Transient pain improvement can occur after perforation and should not be falsely reassuring.',
                'Retrocecal or pelvic appendix location can shift tenderness away from classic McBurney point localization.',
              ],
              references: [
                'Alvarado score / MANTRELS',
                'BMJ Best Practice',
                'Merck Manual',
              ],
            },
            diagnosis: {
              id: registry.id,
              displayLabel: registry.displayLabel,
              canonicalName: registry.canonicalName,
              specialty: registry.specialty,
              category: registry.category,
              bodySystem: registry.bodySystem,
              clinicalSetting: registry.clinicalSetting,
              difficultyBand: registry.difficultyBand,
              aliases: registry.aliases.map((alias) => alias.term),
            },
            exampleCases: registry.cases,
            constraints: [
              'Return JSON object only.',
              'Do not use markdown.',
              'Do not use recognitionPattern; use clinicalPattern.',
              'Do not use differentialDistinguishers; use differentials.',
              'summary must be an object with definition and highYieldTakeaway.',
              'examPearls must be objects with id, label, and explanation.',
              'differentials must be objects with id, diagnosis, and distinguishingPoint.',
              'scoringSystems must be objects with id, name, use, components, and caution.',
              'recallPrompts must be objects with id, type, prompt, answer, sourceSection, and difficulty.',
              'recallPrompts may include explanation and linkedConcept.',
              'Recall prompts must include at least one WHY_IT_MATTERS prompt.',
              'Recall prompts should include at least one DISTINGUISH prompt when meaningful differentials exist.',
              'Recognition pattern must include classic illness script, typical context, symptom sequence, and relevant atypical presentations.',
              'Exam pearls must prioritize named signs, bedside findings, validated scores, clinical maneuvers, and what each means.',
              'Differential distinguishers must be comparative, not generic mimic summaries.',
              'Pitfalls must be specific clinical traps.',
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
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new BadRequestException('AI returned an empty education draft');
    }

    const parsed = this.parseGeneratedDraft(content, diagnosisRegistryId);
    const normalized = this.normalizeGeneratedDraft(parsed);
    const validatedDraft = this.validateGeneratedDraft(
      normalized,
      diagnosisRegistryId,
    );
    const qualityWarnings = this.collectEducationQualityWarnings(validatedDraft);
    if (qualityWarnings.length) {
      this.logger.warn(
        JSON.stringify({
          event: 'diagnosis_education.generate.quality_warnings',
          diagnosisRegistryId,
          warnings: qualityWarnings,
        }),
      );
    }

    const education = await this.prisma.$transaction(async (tx) => {
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

    return education;
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

    for (const field of ['complications', 'references'] satisfies EducationJsonField[]) {
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
      const value = this.validateObjectOrStringArray(
        draft.clinicalPattern,
        ['pattern', 'whyItMatters'],
        ['progression', 'commonTrap'],
      );
      if (value) {
        validated.clinicalPattern = value;
      } else {
        errors.push('clinicalPattern must include pattern and whyItMatters');
      }
    }

    for (const field of ['keySymptoms', 'keySigns'] satisfies EducationJsonField[]) {
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
      const value = this.validateObjectOrStringArray(
        draft.examPearls,
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
      const value = this.validateObjectOrStringArray(
        draft.investigations,
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
      const value = this.validateObjectOrStringArray(
        draft.differentials,
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
      const value = this.validateObjectOrStringArray(
        draft.management,
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
      const value = this.validateObjectOrStringArray(
        draft.pitfalls,
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

    if (!('differentials' in normalized) && 'differentialDistinguishers' in draft) {
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
    ).join('\n').toLowerCase();

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
      ? draft.differentials.some(
          (item) => {
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
          },
        )
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
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
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

  private toInputRecord(input: UpsertDiagnosisEducationDto): Record<string, unknown> {
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

  private toSnapshotJson(value: Prisma.JsonValue | null): Prisma.InputJsonValue | null {
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

    if (/\b(?:you should|your doctor|go to the emergency room)\b/i.test(fullText)) {
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
      investigations: education.investigations,
      differentialDistinguishers: education.differentials,
      pitfalls: education.pitfalls,
      managementOverview: education.management,
      complications: education.complications,
      recallPrompts: education.recallPrompts,
      reviewedAt: education.reviewedAt?.toISOString() ?? null,
      version: education.version,
    };
  }
}
