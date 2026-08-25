import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AiDraftReviewStatus,
  DiagnosisGraphFactStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { getEnv } from '../../core/config/env.validation';
import { PrismaService } from '../../core/db/prisma.service';
import {
  EditorialBriefDraftQualityValidator,
  type EditorialBriefDraftForValidation,
  type EditorialBriefDraftValidationResult,
} from './editorial-brief-draft-quality-validator.service';

const OPENAI_BRIEF_MODEL = 'gpt-4o-mini';
const OPENAI_BRIEF_TIMEOUT_MS = 45_000;
const BRIEF_GENERATOR_VERSION = 'DiagnosisEditorialBriefGenerationService.v1';
const BRIEF_PROMPT_VERSION = 'diagnosis_editorial_brief_bootstrap.v1';
const PROVIDER_FAILURE_CODE = 'BOOTSTRAP_GENERATION_FAILED';

type EditorialBriefOpenAiClient = Pick<OpenAI, 'chat'>;

export type GeneratedEditorialBriefBootstrap = {
  payload: Omit<
    Prisma.DiagnosisEditorialBriefCreateInput,
    'diagnosisRegistry' | 'status'
  >;
  generatedDraft: EditorialBriefDraftForValidation;
  validation: EditorialBriefDraftValidationResult;
  provenance: {
    provider: 'openai';
    model: string;
    generatorVersion: string;
    promptVersion: string;
    generatedAt: string;
    diagnosisRegistryId: string;
    contextHash: string;
    resolvedMimics: Array<{
      name: string;
      diagnosisRegistryId: string;
      displayLabel: string;
    }>;
    unresolvedMimics: string[];
  };
};

@Injectable()
export class DiagnosisEditorialBriefGenerationService {
  private readonly logger = new Logger(
    DiagnosisEditorialBriefGenerationService.name,
  );
  private readonly openaiClient?: EditorialBriefOpenAiClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: EditorialBriefDraftQualityValidator = new EditorialBriefDraftQualityValidator(),
  ) {
    const env = getEnv();
    if (env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        timeout: OPENAI_BRIEF_TIMEOUT_MS,
        maxRetries: 1,
      });
    }
  }

  async generate(
    diagnosisRegistryId: string,
  ): Promise<GeneratedEditorialBriefBootstrap> {
    if (!this.openaiClient) {
      throw new BadRequestException({
        code: PROVIDER_FAILURE_CODE,
        message: 'OPENAI_API_KEY is required for Editorial Brief bootstrap',
      });
    }

    const context = await this.buildBootstrapContext(diagnosisRegistryId);
    const contextHash = this.hashJson(context);
    const generatedAt = new Date().toISOString();
    const request = this.buildPrompt(context);
    let raw: string;
    try {
      const completion = await this.openaiClient.chat.completions.create({
        model: OPENAI_BRIEF_MODEL,
        temperature: 0.1,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'diagnosis_editorial_brief_bootstrap',
            strict: true,
            schema: EDITORIAL_BRIEF_BOOTSTRAP_SCHEMA as Record<string, unknown>,
          },
        },
        messages: [
          {
            role: 'system',
            content: [
              'You propose Editorial Brief drafts for a medical learning game.',
              'Return JSON only. Do not include markdown.',
              'Generated content is candidate educational intent, not evidence authority and not editorial approval.',
              'Be diagnosis-specific and reason clinically from the supplied registry identity and taxonomy.',
              'Do not invent exact medication doses, treatment durations, guideline editions, diagnostic performance statistics, or uncommon numerical thresholds.',
            ].join(' '),
          },
          {
            role: 'user',
            content: request,
          },
        ],
      });
      raw = completion.choices[0]?.message?.content ?? '';
    } catch (error) {
      throw new ServiceUnavailableException({
        code: PROVIDER_FAILURE_CODE,
        message: 'Editorial Brief bootstrap provider request failed',
        detail:
          error instanceof Error ? error.message : 'Unknown provider error',
      });
    }

    if (!raw.trim()) {
      throw new BadRequestException({
        code: PROVIDER_FAILURE_CODE,
        message: 'OpenAI returned an empty Editorial Brief payload',
      });
    }

    const parsed = this.parseJson(raw);
    const generatedDraft = this.sanitizeDraft(parsed);
    const resolved = await this.resolveMimics(generatedDraft.importantMimics);
    const validation = this.validator.validate({
      draft: generatedDraft,
      context: {
        diagnosisName:
          context.registry.displayLabel || context.registry.canonicalName,
        canonicalName: context.registry.canonicalName,
        aliases: context.registry.aliases.map((alias) => alias.term),
      },
    });
    const provenance = {
      provider: 'openai' as const,
      model: OPENAI_BRIEF_MODEL,
      generatorVersion: BRIEF_GENERATOR_VERSION,
      promptVersion: BRIEF_PROMPT_VERSION,
      generatedAt,
      diagnosisRegistryId,
      contextHash,
      resolvedMimics: resolved.resolvedMimics,
      unresolvedMimics: resolved.unresolvedMimics,
    };

    if (validation.status === 'BLOCKED') {
      await this.recordAudit({
        diagnosisRegistryId,
        actionType: 'generate_editorial_brief',
        sourceIssue: {
          code: 'EDITORIAL_BRIEF_BOOTSTRAP',
          purpose: 'provider_backed_editorial_brief_bootstrap',
        },
        inputContext: {
          context,
          contextHash,
          promptVersion: BRIEF_PROMPT_VERSION,
        },
        generatedOutput: {
          generatedDraft,
          validation,
          provenance,
        },
        affectedArtifactType: 'DIAGNOSIS_EDITORIAL_BRIEF_BOOTSTRAP',
        affectedArtifactId: diagnosisRegistryId,
        reviewStatus: AiDraftReviewStatus.REJECTED,
        bestEffort: true,
      });
      throw new BadRequestException({
        code: 'BOOTSTRAP_VALIDATION_FAILED',
        message:
          'Editorial Brief bootstrap output did not meet diagnosis-specific quality requirements.',
        blockers: validation.blockers,
        warnings: validation.warnings,
      });
    }

    return {
      payload: this.toBriefPayload({
        draft: generatedDraft,
        resolvedMimicIds: resolved.resolvedMimics.map(
          (mimic) => mimic.diagnosisRegistryId,
        ),
        unresolvedMimics: resolved.unresolvedMimics,
      }),
      generatedDraft,
      validation,
      provenance,
    };
  }

  async recordSuccessfulAudit(input: {
    diagnosisRegistryId: string;
    briefId: string;
    result: GeneratedEditorialBriefBootstrap;
  }) {
    await this.recordAudit({
      diagnosisRegistryId: input.diagnosisRegistryId,
      actionType: 'generate_editorial_brief',
      sourceIssue: {
        code: 'EDITORIAL_BRIEF_BOOTSTRAP',
        purpose: 'provider_backed_editorial_brief_bootstrap',
      },
      inputContext: {
        contextHash: input.result.provenance.contextHash,
        promptVersion: input.result.provenance.promptVersion,
        generatorVersion: input.result.provenance.generatorVersion,
      },
      generatedOutput: {
        proposedBrief: input.result.generatedDraft,
        validation: input.result.validation,
        provenance: input.result.provenance,
      },
      affectedArtifactType: 'DIAGNOSIS_EDITORIAL_BRIEF',
      affectedArtifactId: input.briefId,
      reviewStatus: AiDraftReviewStatus.PENDING_REVIEW,
    });
  }

  private async buildBootstrapContext(diagnosisRegistryId: string) {
    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        canonicalNormalized: true,
        displayLabel: true,
        specialty: true,
        subspecialty: true,
        category: true,
        bodySystem: true,
        organSystem: true,
        clinicalSetting: true,
        ageGroup: true,
        urgencyLevel: true,
        difficultyBand: true,
        rarityBand: true,
        preferredClueTypes: true,
        excludedClueTypes: true,
        notes: true,
        aliases: {
          where: { active: true },
          select: { term: true, kind: true, acceptedForMatch: true },
          orderBy: [{ acceptedForMatch: 'desc' }, { rank: 'asc' }],
          take: 20,
        },
        graphFacts: {
          where: { status: DiagnosisGraphFactStatus.ACTIVE },
          select: {
            id: true,
            type: true,
            label: true,
            targetDiagnosisRegistryId: true,
            targetDiagnosisRegistry: {
              select: { displayLabel: true, canonicalName: true },
            },
          },
          take: 20,
        },
      },
    });
    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }
    return {
      registry,
      bootstrapBoundary: {
        requiredSource: 'DiagnosisRegistry',
        allowedProviderEgress: [
          'diagnosis identity',
          'diagnosis aliases',
          'taxonomy metadata',
          'non-patient registry notes',
          'active diagnosis-level graph facts',
        ],
        excludedProviderEgress: [
          'patient data',
          'learner data',
          'user data',
          'identifiable clinical records',
          'unrelated application data',
        ],
        trustBoundary:
          'AI proposes educational intent; human review remains mandatory.',
      },
    };
  }

  private buildPrompt(
    context: Awaited<
      ReturnType<
        DiagnosisEditorialBriefGenerationService['buildBootstrapContext']
      >
    >,
  ) {
    return JSON.stringify({
      task: 'Generate a clinically specific Editorial Brief draft for scaffold bootstrap.',
      qualityRequirements: [
        'Prioritize diagnostic reasoning over textbook completeness.',
        'Identify important mimics and discriminators.',
        'Distinguish pattern recognition from confirmatory evidence.',
        'Describe investigation roles, not merely test names.',
        'Describe management principles, not treatment lists.',
        'Identify common reasoning traps.',
        'Adapt to clinical setting and difficulty when provided.',
        'State uncertainty when appropriate.',
      ],
      rejectGenericFiller: [
        'recognize common clinical features',
        'consider relevant differentials',
        'use appropriate investigations',
        'manage according to severity',
        'provide supportive care',
        'avoid premature diagnosis',
      ],
      expectedShape: EDITORIAL_BRIEF_BOOTSTRAP_RESPONSE_SHAPE,
      context,
    });
  }

  private toBriefPayload(input: {
    draft: EditorialBriefDraftForValidation;
    resolvedMimicIds: string[];
    unresolvedMimics: string[];
  }): Omit<
    Prisma.DiagnosisEditorialBriefCreateInput,
    'diagnosisRegistry' | 'status'
  > {
    const draft = input.draft;
    return {
      summary: this.compact(
        [
          draft.educationalScope,
          draft.coreClinicalPattern
            ? `Core pattern: ${draft.coreClinicalPattern}`
            : null,
          draft.importantMimics.length
            ? `Key mimics: ${draft.importantMimics
                .map(
                  (mimic) => `${mimic.diagnosis} (${mimic.keyDiscriminator})`,
                )
                .join('; ')}`
            : null,
        ]
          .filter((item): item is string => Boolean(item))
          .join(' '),
        1200,
      ),
      learningGoals: draft.learningGoals,
      requiredTeachingRuleIds: [],
      requiredMimicIds: input.resolvedMimicIds,
      requiredPitfalls: draft.pitfalls.map(
        (pitfall) =>
          `${pitfall.mistakenReasoning} -> ${pitfall.correctivePrinciple}`,
      ),
      keyInvestigations: draft.keyInvestigations.map((investigation) =>
        [
          investigation.investigation,
          investigation.role,
          investigation.expectedInterpretation,
          investigation.caution,
        ]
          .filter(Boolean)
          .join(': '),
      ),
      managementAnchors: draft.managementAnchors.map((anchor) =>
        [anchor.principle, anchor.reason, anchor.scope]
          .filter(Boolean)
          .join(': '),
      ),
      difficultyGuidance: draft.difficultyGuidance,
      caseGenerationGuidance: [
        ...draft.caseGenerationGuidance,
        ...draft.importantMimics.map(
          (mimic) =>
            `Keep ${mimic.diagnosis} plausible until ${mimic.keyDiscriminator}.`,
        ),
      ],
      educationGuidance: [
        ...draft.educationGuidance,
        ...draft.highValueFindings.map(
          (finding) =>
            `Teach ${finding.finding} as ${finding.diagnosticRole}: ${finding.whyItMatters}.`,
        ),
      ],
      graphGuidance: [
        ...input.unresolvedMimics.map(
          (mimic) => `Unresolved proposed mimic for review: ${mimic}.`,
        ),
        ...draft.uncertainties.map(
          (uncertainty) => `Uncertainty requiring review: ${uncertainty}.`,
        ),
      ],
      version: 1,
    };
  }

  private async resolveMimics(
    mimics: EditorialBriefDraftForValidation['importantMimics'],
  ) {
    const names = [
      ...new Set(mimics.map((mimic) => mimic.diagnosis.trim()).filter(Boolean)),
    ];
    if (!names.length) {
      return { resolvedMimics: [], unresolvedMimics: [] };
    }
    const rows = await this.prisma.diagnosisRegistry.findMany({
      where: {
        OR: [
          { displayLabel: { in: names } },
          { canonicalName: { in: names } },
          { aliases: { some: { term: { in: names }, active: true } } },
        ],
      },
      select: {
        id: true,
        displayLabel: true,
        canonicalName: true,
        aliases: {
          where: { active: true },
          select: { term: true },
        },
      },
    });
    const normalizedToRow = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      [
        row.displayLabel,
        row.canonicalName,
        ...row.aliases.map((alias) => alias.term),
      ].forEach((name) => normalizedToRow.set(this.normalize(name), row));
    }
    const resolvedMimics = [];
    const unresolvedMimics = [];
    for (const name of names) {
      const row = normalizedToRow.get(this.normalize(name));
      if (row) {
        resolvedMimics.push({
          name,
          diagnosisRegistryId: row.id,
          displayLabel: row.displayLabel || row.canonicalName,
        });
      } else {
        unresolvedMimics.push(name);
      }
    }
    return { resolvedMimics, unresolvedMimics };
  }

  private sanitizeDraft(value: unknown): EditorialBriefDraftForValidation {
    const record = this.asRecord(value);
    return {
      targetDiagnosis: this.stringValue(record.targetDiagnosis),
      educationalScope: this.stringValue(record.educationalScope),
      learningGoals: this.stringArray(record.learningGoals).slice(0, 8),
      coreClinicalPattern: this.stringValue(record.coreClinicalPattern),
      importantMimics: this.objectArray(record.importantMimics)
        .map((mimic) => ({
          diagnosis: this.requiredString(mimic.diagnosis),
          whyConfused: this.requiredString(mimic.whyConfused),
          keyDiscriminator: this.requiredString(mimic.keyDiscriminator),
        }))
        .filter((mimic) => mimic.diagnosis)
        .slice(0, 8),
      highValueFindings: this.objectArray(record.highValueFindings)
        .map((finding) => ({
          finding: this.requiredString(finding.finding),
          diagnosticRole: this.requiredString(finding.diagnosticRole),
          whyItMatters: this.requiredString(finding.whyItMatters),
        }))
        .filter((finding) => finding.finding)
        .slice(0, 8),
      keyInvestigations: this.objectArray(record.keyInvestigations)
        .map((investigation) => ({
          investigation: this.requiredString(investigation.investigation),
          role: this.requiredString(investigation.role),
          expectedInterpretation: this.requiredString(
            investigation.expectedInterpretation,
          ),
          caution: this.requiredString(investigation.caution),
        }))
        .filter((investigation) => investigation.investigation)
        .slice(0, 8),
      managementAnchors: this.objectArray(record.managementAnchors)
        .map((anchor) => ({
          principle: this.requiredString(anchor.principle),
          reason: this.requiredString(anchor.reason),
          scope: this.requiredString(anchor.scope),
        }))
        .filter((anchor) => anchor.principle)
        .slice(0, 6),
      pitfalls: this.objectArray(record.pitfalls)
        .map((pitfall) => ({
          mistakenReasoning: this.requiredString(pitfall.mistakenReasoning),
          correctivePrinciple: this.requiredString(pitfall.correctivePrinciple),
        }))
        .filter((pitfall) => pitfall.mistakenReasoning)
        .slice(0, 8),
      difficultyGuidance: this.stringArray(record.difficultyGuidance).slice(
        0,
        6,
      ),
      caseGenerationGuidance: this.stringArray(
        record.caseGenerationGuidance,
      ).slice(0, 6),
      educationGuidance: this.stringArray(record.educationGuidance).slice(0, 6),
      uncertainties: this.stringArray(record.uncertainties).slice(0, 8),
    };
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new BadRequestException({
        code: PROVIDER_FAILURE_CODE,
        message: 'OpenAI returned invalid Editorial Brief JSON',
      });
    }
  }

  private async recordAudit(input: {
    diagnosisRegistryId: string;
    actionType: string;
    sourceIssue: Prisma.InputJsonValue;
    inputContext: Prisma.InputJsonValue;
    generatedOutput: Prisma.InputJsonValue;
    affectedArtifactType: string;
    affectedArtifactId: string;
    reviewStatus: AiDraftReviewStatus;
    bestEffort?: boolean;
  }) {
    try {
      await this.prisma.aiDraftRevisionAudit.create({
        data: {
          diagnosisRegistry: { connect: { id: input.diagnosisRegistryId } },
          actionType: input.actionType,
          sourceIssue: input.sourceIssue,
          inputContext: input.inputContext,
          generatedOutput: input.generatedOutput,
          affectedArtifactType: input.affectedArtifactType,
          affectedArtifactId: input.affectedArtifactId,
          reviewStatus: input.reviewStatus,
        },
      });
    } catch (error) {
      if (!input.bestEffort) {
        throw error;
      }
      this.logger.warn({
        event: 'diagnosis_editorial_brief.audit_failed',
        diagnosisRegistryId: input.diagnosisRegistryId,
        error: error instanceof Error ? error.message : 'Unknown audit error',
      });
    }
  }

  private hashJson(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private objectArray(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value) ? value.map((item) => this.asRecord(item)) : [];
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private requiredString(value: unknown): string {
    return this.stringValue(value) ?? '';
  }

  private stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return [
      ...new Set(
        value
          .map((item) => this.stringValue(item))
          .filter((item): item is string => Boolean(item)),
      ),
    ];
  }

  private compact(value: string, maxLength: number) {
    const compacted = value.replace(/\s+/g, ' ').trim();
    return compacted.length > maxLength
      ? `${compacted.slice(0, maxLength - 1).trim()}...`
      : compacted;
  }

  private normalize(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[''`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }
}

const EDITORIAL_BRIEF_BOOTSTRAP_RESPONSE_SHAPE = {
  targetDiagnosis: 'string',
  educationalScope: 'string',
  learningGoals: ['string'],
  coreClinicalPattern: 'string',
  importantMimics: [
    {
      diagnosis: 'string',
      whyConfused: 'string',
      keyDiscriminator: 'string',
    },
  ],
  highValueFindings: [
    {
      finding: 'string',
      diagnosticRole: 'string',
      whyItMatters: 'string',
    },
  ],
  keyInvestigations: [
    {
      investigation: 'string',
      role: 'string',
      expectedInterpretation: 'string',
      caution: 'string',
    },
  ],
  managementAnchors: [
    {
      principle: 'string',
      reason: 'string',
      scope: 'string',
    },
  ],
  pitfalls: [
    {
      mistakenReasoning: 'string',
      correctivePrinciple: 'string',
    },
  ],
  difficultyGuidance: ['string'],
  caseGenerationGuidance: ['string'],
  educationGuidance: ['string'],
  uncertainties: ['string'],
};

const stringSchema = { type: 'string' };
const stringArraySchema = {
  type: 'array',
  items: stringSchema,
};
const EDITORIAL_BRIEF_BOOTSTRAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: Object.keys(EDITORIAL_BRIEF_BOOTSTRAP_RESPONSE_SHAPE),
  properties: {
    targetDiagnosis: stringSchema,
    educationalScope: stringSchema,
    learningGoals: stringArraySchema,
    coreClinicalPattern: stringSchema,
    importantMimics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['diagnosis', 'whyConfused', 'keyDiscriminator'],
        properties: {
          diagnosis: stringSchema,
          whyConfused: stringSchema,
          keyDiscriminator: stringSchema,
        },
      },
    },
    highValueFindings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['finding', 'diagnosticRole', 'whyItMatters'],
        properties: {
          finding: stringSchema,
          diagnosticRole: stringSchema,
          whyItMatters: stringSchema,
        },
      },
    },
    keyInvestigations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'investigation',
          'role',
          'expectedInterpretation',
          'caution',
        ],
        properties: {
          investigation: stringSchema,
          role: stringSchema,
          expectedInterpretation: stringSchema,
          caution: stringSchema,
        },
      },
    },
    managementAnchors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['principle', 'reason', 'scope'],
        properties: {
          principle: stringSchema,
          reason: stringSchema,
          scope: stringSchema,
        },
      },
    },
    pitfalls: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['mistakenReasoning', 'correctivePrinciple'],
        properties: {
          mistakenReasoning: stringSchema,
          correctivePrinciple: stringSchema,
        },
      },
    },
    difficultyGuidance: stringArraySchema,
    caseGenerationGuidance: stringArraySchema,
    educationGuidance: stringArraySchema,
    uncertainties: stringArraySchema,
  },
};
