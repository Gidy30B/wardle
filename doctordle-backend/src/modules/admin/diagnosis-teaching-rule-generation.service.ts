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
import type { EditorialBriefContext } from '../education/diagnosis-editorial-brief.service';
import type { EducationalReasoningGenerationContext } from './reasoning-path.service';
import {
  TEACHING_RULE_CATEGORIES,
  TEACHING_RULE_IMPORTANCE,
  TeachingRuleDraftQualityValidator,
  type TeachingRuleDraft,
  type TeachingRuleSetValidationResult,
} from './teaching-rule-draft-quality-validator.service';

const OPENAI_RULE_MODEL = 'gpt-4o-mini';
const OPENAI_RULE_TIMEOUT_MS = 45_000;
const RULE_GENERATOR_VERSION = 'DiagnosisTeachingRuleGenerationService.v1';
const RULE_PROMPT_VERSION = 'diagnosis_teaching_rule_generation.v1';
const PROVIDER_FAILURE_CODE = 'TEACHING_RULE_GENERATION_FAILED';

type TeachingRuleOpenAiClient = Pick<OpenAI, 'chat'>;

export type GeneratedTeachingRuleCandidates = {
  candidates: Array<
    Omit<Prisma.DiagnosisTeachingRuleCreateInput, 'diagnosisRegistry'>
  >;
  generatedDrafts: TeachingRuleDraft[];
  validation: TeachingRuleSetValidationResult;
  provenance: {
    provider: 'openai';
    model: string;
    generatorVersion: string;
    promptVersion: string;
    generatedAt: string;
    diagnosisRegistryId: string;
    editorialBriefId: string;
    editorialBriefVersion: number;
    editorialBriefStatus: string;
    contextHash: string;
    resolvedBriefMimics: Array<{
      name: string;
      diagnosisRegistryId: string;
      displayLabel: string;
    }>;
    unresolvedBriefMimics: string[];
  };
};

@Injectable()
export class DiagnosisTeachingRuleGenerationService {
  private readonly logger = new Logger(
    DiagnosisTeachingRuleGenerationService.name,
  );
  private readonly openaiClient?: TeachingRuleOpenAiClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TeachingRuleDraftQualityValidator = new TeachingRuleDraftQualityValidator(),
  ) {
    const env = getEnv();
    if (env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        timeout: OPENAI_RULE_TIMEOUT_MS,
        maxRetries: 1,
      });
    }
  }

  async generate(input: {
    diagnosisRegistryId: string;
    approvedBrief: EditorialBriefContext;
    reasoningContext?: EducationalReasoningGenerationContext;
  }): Promise<GeneratedTeachingRuleCandidates> {
    if (!['APPROVED', 'ACTIVE'].includes(input.approvedBrief.status)) {
      throw new BadRequestException({
        code: 'BRIEF_NOT_APPROVED',
        message:
          'Teaching Rule provider generation requires an approved or active Editorial Brief.',
        currentStatus: input.approvedBrief.status,
      });
    }
    if (!this.openaiClient) {
      throw new BadRequestException({
        code: PROVIDER_FAILURE_CODE,
        message: 'OPENAI_API_KEY is required for Teaching Rule generation',
      });
    }

    const context = await this.buildGenerationContext(input);
    const contextHash = this.hashJson(context);
    const generatedAt = new Date().toISOString();
    const request = this.buildPrompt(context);
    let raw: string;

    try {
      const completion = await this.openaiClient.chat.completions.create({
        model: OPENAI_RULE_MODEL,
        temperature: 0.1,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'diagnosis_teaching_rule_candidates',
            strict: true,
            schema: TEACHING_RULE_GENERATION_SCHEMA as Record<string, unknown>,
          },
        },
        messages: [
          {
            role: 'system',
            content: [
              'You generate Diagnosis Teaching Rule candidates for a medical learning game.',
              'Return JSON only. Do not include markdown.',
              'Rules are candidate operational constraints, not editorial approval, graph authority, or verified evidence.',
              'Derive each rule from the exact approved Editorial Brief and diagnosis identity supplied.',
              'Reject generic pedagogy and workflow recommendations.',
              'Avoid exact doses, durations, guideline-edition claims, unsupported thresholds, or diagnostic performance statistics unless supplied in trusted context.',
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
        message: 'Teaching Rule provider request failed',
        detail:
          error instanceof Error ? error.message : 'Unknown provider error',
      });
    }

    if (!raw.trim()) {
      throw new BadRequestException({
        code: PROVIDER_FAILURE_CODE,
        message: 'OpenAI returned an empty Teaching Rule payload',
      });
    }

    const parsed = this.parseJson(raw);
    const generatedDrafts = this.sanitizeRules(parsed);
    const validation = this.validator.validate({
      rules: generatedDrafts,
      context: {
        diagnosisName:
          context.registry.displayLabel || context.registry.canonicalName,
        canonicalName: context.registry.canonicalName,
        aliases: context.registry.aliases.map((alias) => alias.term),
        brief: {
          learningGoals: context.editorialBrief.learningGoals,
          requiredMimicNames: [
            ...context.editorialBrief.resolvedRequiredMimics.map(
              (mimic) => mimic.displayLabel,
            ),
            ...context.editorialBrief.unresolvedRequiredMimics,
          ],
          requiredPitfalls: context.editorialBrief.requiredPitfalls,
          keyInvestigations: context.editorialBrief.keyInvestigations,
          managementAnchors: context.editorialBrief.managementAnchors,
          difficultyGuidance: context.editorialBrief.difficultyGuidance,
        },
      },
    });
    const provenance = {
      provider: 'openai' as const,
      model: OPENAI_RULE_MODEL,
      generatorVersion: RULE_GENERATOR_VERSION,
      promptVersion: RULE_PROMPT_VERSION,
      generatedAt,
      diagnosisRegistryId: input.diagnosisRegistryId,
      editorialBriefId: input.approvedBrief.id,
      editorialBriefVersion: input.approvedBrief.version,
      editorialBriefStatus: input.approvedBrief.status,
      contextHash,
      resolvedBriefMimics: context.editorialBrief.resolvedRequiredMimics,
      unresolvedBriefMimics: context.editorialBrief.unresolvedRequiredMimics,
    };

    if (validation.status === 'BLOCKED') {
      await this.recordAudit({
        diagnosisRegistryId: input.diagnosisRegistryId,
        actionType: 'generate_teaching_rules',
        sourceIssue: {
          code: 'TEACHING_RULE_GENERATION',
          purpose: 'provider_backed_teaching_rule_generation',
          editorialBriefId: input.approvedBrief.id,
          editorialBriefVersion: input.approvedBrief.version,
          editorialBriefStatus: input.approvedBrief.status,
        },
        inputContext: {
          context,
          contextHash,
          promptVersion: RULE_PROMPT_VERSION,
        },
        generatedOutput: {
          generatedDrafts,
          validation,
          provenance,
        },
        affectedArtifactType: 'DIAGNOSIS_TEACHING_RULE_GENERATION',
        affectedArtifactId: input.diagnosisRegistryId,
        reviewStatus: AiDraftReviewStatus.REJECTED,
        bestEffort: true,
      });
      throw new BadRequestException({
        code: 'TEACHING_RULE_VALIDATION_FAILED',
        message:
          'Teaching Rule generation output did not meet diagnosis-specific operational quality requirements.',
        blockers: validation.blockers,
        warnings: validation.warnings,
        coverage: validation.coverage,
      });
    }

    return {
      candidates: generatedDrafts.map((draft) =>
        this.toCandidatePayload(draft, {
          validation,
          provenance,
        }),
      ),
      generatedDrafts,
      validation,
      provenance,
    };
  }

  async recordSuccessfulAudit(input: {
    diagnosisRegistryId: string;
    candidateIds: string[];
    result: GeneratedTeachingRuleCandidates;
  }) {
    await this.recordAudit({
      diagnosisRegistryId: input.diagnosisRegistryId,
      actionType: 'generate_teaching_rules',
      sourceIssue: {
        code: 'TEACHING_RULE_GENERATION',
        purpose: 'provider_backed_teaching_rule_generation',
        editorialBriefId: input.result.provenance.editorialBriefId,
        editorialBriefVersion: input.result.provenance.editorialBriefVersion,
        editorialBriefStatus: input.result.provenance.editorialBriefStatus,
      },
      inputContext: {
        contextHash: input.result.provenance.contextHash,
        promptVersion: input.result.provenance.promptVersion,
        generatorVersion: input.result.provenance.generatorVersion,
        editorialBriefId: input.result.provenance.editorialBriefId,
        editorialBriefVersion: input.result.provenance.editorialBriefVersion,
        editorialBriefStatus: input.result.provenance.editorialBriefStatus,
      },
      generatedOutput: {
        proposedRules: input.result.generatedDrafts,
        validation: input.result.validation,
        provenance: input.result.provenance,
        candidateIds: input.candidateIds,
      },
      affectedArtifactType: 'DIAGNOSIS_TEACHING_RULE',
      affectedArtifactId: input.candidateIds.join(','),
      reviewStatus: AiDraftReviewStatus.PENDING_REVIEW,
    });
  }

  private async buildGenerationContext(input: {
    diagnosisRegistryId: string;
    approvedBrief: EditorialBriefContext;
    reasoningContext?: EducationalReasoningGenerationContext;
  }) {
    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: input.diagnosisRegistryId },
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
        teachingRules: {
          where: { status: { in: ['APPROVED', 'ACTIVE'] } },
          select: {
            id: true,
            stableKey: true,
            title: true,
            category: true,
            importance: true,
          },
          take: 20,
        },
      },
    });
    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }
    const resolvedBriefMimics = await this.resolveBriefMimics(
      input.approvedBrief.requiredMimicIds,
    );
    return {
      registry,
      editorialBrief: {
        id: input.approvedBrief.id,
        version: input.approvedBrief.version,
        status: input.approvedBrief.status,
        summary: input.approvedBrief.summary,
        learningGoals: input.approvedBrief.learningGoals,
        requiredPitfalls: input.approvedBrief.requiredPitfalls,
        keyInvestigations: input.approvedBrief.keyInvestigations,
        managementAnchors: input.approvedBrief.managementAnchors,
        difficultyGuidance: input.approvedBrief.difficultyGuidance,
        caseGenerationGuidance: input.approvedBrief.caseGenerationGuidance,
        educationGuidance: input.approvedBrief.educationGuidance,
        resolvedRequiredMimics: resolvedBriefMimics.resolvedMimics,
        unresolvedRequiredMimics: resolvedBriefMimics.unresolvedMimics,
      },
      approvedReasoningContext: input.reasoningContext?.constrained
        ? {
            constrained: input.reasoningContext.constrained,
            reasoningPathId: input.reasoningContext.reasoningPathId,
            confidence: input.reasoningContext.confidence,
            hallucinationRisk: input.reasoningContext.hallucinationRisk,
            requiredTeachingPoints:
              input.reasoningContext.requiredTeachingPoints,
            discriminatorEvidenceUsed:
              input.reasoningContext.discriminatorEvidenceUsed,
            warnings: input.reasoningContext.warnings,
          }
        : null,
      providerBoundary: {
        requiredSource: 'Approved or active DiagnosisEditorialBrief',
        allowedProviderEgress: [
          'diagnosis identity',
          'diagnosis aliases',
          'taxonomy metadata',
          'approved Editorial Brief content',
          'active diagnosis-level graph facts',
          'approved reasoning context when available',
          'approved or active Teaching Rule summaries',
        ],
        excludedProviderEgress: [
          'patient data',
          'learner data',
          'user data',
          'game-session data',
          'unapproved Education content',
          'Education candidates',
          'Case content',
          'ClinicalCaseDraft content',
          'unapproved Graph Candidates',
          'unrelated application data',
        ],
        trustBoundary:
          'AI proposes Teaching Rule candidates; human review remains mandatory.',
      },
    };
  }

  private buildPrompt(
    context: Awaited<
      ReturnType<
        DiagnosisTeachingRuleGenerationService['buildGenerationContext']
      >
    >,
  ) {
    return JSON.stringify({
      task: 'Generate diagnosis-specific Teaching Rule candidates from the exact approved Editorial Brief.',
      ruleDesignRequirements: [
        'Each rule is one reusable operational constraint.',
        'Rules must preserve approved Brief educational priorities.',
        'Rules must be diagnosis-specific and usable by Education or Case generation.',
        'Encode important mimics, why-confused reasoning and key separators.',
        'Describe investigation roles such as screening, supportive, confirmatory, exclusion, monitoring, severity or staging.',
        'Describe management principles only where educationally relevant.',
        'Preserve difficulty and reveal guidance as operational constraints.',
        'Mark expected evidence for management, confirmatory investigations, criteria, scoring or high-consequence claims.',
      ],
      prohibitedOutputs: [
        'Activate a reasoning path.',
        'Improve discriminator education.',
        'Expand investigation coverage.',
        'Teach important clinical features.',
        'Consider relevant differentials.',
        'Add more graph facts.',
        'Improve case diversity.',
        'Generate more cases.',
      ],
      allowedCategories: TEACHING_RULE_CATEGORIES,
      allowedImportance: TEACHING_RULE_IMPORTANCE,
      expectedShape: TEACHING_RULE_RESPONSE_SHAPE,
      context,
    });
  }

  private toCandidatePayload(
    draft: TeachingRuleDraft,
    metadata: {
      validation: TeachingRuleSetValidationResult;
      provenance: GeneratedTeachingRuleCandidates['provenance'];
    },
  ): Omit<Prisma.DiagnosisTeachingRuleCreateInput, 'diagnosisRegistry'> {
    return {
      stableKey: this.stableKey(draft),
      title: this.compact(draft.title, 180),
      category: draft.category,
      importance: draft.importance,
      rationale: draft.rationale,
      acceptableManifestations: draft.acceptableManifestations,
      requiredDifferentials: draft.requiredDifferentials.map(
        (differential) => ({
          diagnosisRegistryId: differential.registryId,
          diagnosis: differential.diagnosis,
          whyConfused: differential.whyConfused,
          keySeparator: differential.keySeparator,
        }),
      ),
      expectedEvidence: {
        ...draft.expectedEvidence,
        evidenceVerified: false,
        generatedBy: 'provider_backed_teaching_rule_generation',
        promptVersion: metadata.provenance.promptVersion,
      },
      difficultyHints: {
        ...draft.difficultyHints,
        generationMetadata: {
          provider: metadata.provenance.provider,
          model: metadata.provenance.model,
          generatorVersion: metadata.provenance.generatorVersion,
          promptVersion: metadata.provenance.promptVersion,
          contextHash: metadata.provenance.contextHash,
          editorialBriefId: metadata.provenance.editorialBriefId,
          editorialBriefVersion: metadata.provenance.editorialBriefVersion,
          editorialBriefStatus: metadata.provenance.editorialBriefStatus,
          validationStatus: metadata.validation.status,
          validationWarnings: metadata.validation.warnings,
          coverage: metadata.validation.coverage,
        },
      },
      avoidTooEarly: draft.avoidTooEarly,
      appliesToEducation: draft.appliesToEducation,
      appliesToCaseGeneration: draft.appliesToCaseGeneration,
      appliesToGraph: draft.appliesToGraph,
      status: 'CANDIDATE',
      source: 'GENERATED',
    };
  }

  private async resolveBriefMimics(values: string[]) {
    const namesOrIds = [...new Set(values.map((value) => value.trim()))].filter(
      Boolean,
    );
    if (!namesOrIds.length) {
      return { resolvedMimics: [], unresolvedMimics: [] };
    }
    const rows = await this.prisma.diagnosisRegistry.findMany({
      where: {
        OR: [
          { id: { in: namesOrIds } },
          { displayLabel: { in: namesOrIds } },
          { canonicalName: { in: namesOrIds } },
          { aliases: { some: { term: { in: namesOrIds }, active: true } } },
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
        row.id,
        row.displayLabel,
        row.canonicalName,
        ...row.aliases.map((alias) => alias.term),
      ].forEach((name) => normalizedToRow.set(this.normalize(name), row));
    }
    const resolvedMimics = [];
    const unresolvedMimics = [];
    for (const value of namesOrIds) {
      const row = normalizedToRow.get(this.normalize(value));
      if (row) {
        resolvedMimics.push({
          name: value,
          diagnosisRegistryId: row.id,
          displayLabel: row.displayLabel || row.canonicalName,
        });
      } else {
        unresolvedMimics.push(value);
      }
    }
    return { resolvedMimics, unresolvedMimics };
  }

  private sanitizeRules(value: unknown): TeachingRuleDraft[] {
    const record = this.asRecord(value);
    return this.objectArray(record.rules)
      .map((rule) => ({
        stableKeyHint: this.stringValue(rule.stableKeyHint),
        title: this.requiredString(rule.title),
        category: this.requiredString(rule.category),
        importance: this.requiredString(rule.importance) || 'supporting',
        rationale: this.stringValue(rule.rationale),
        acceptableManifestations: this.stringArray(
          rule.acceptableManifestations,
        ).slice(0, 8),
        requiredDifferentials: this.objectArray(rule.requiredDifferentials)
          .map((differential) => ({
            registryId: this.stringValue(differential.registryId),
            diagnosis: this.requiredString(differential.diagnosis),
            whyConfused: this.requiredString(differential.whyConfused),
            keySeparator: this.requiredString(differential.keySeparator),
          }))
          .filter((differential) => differential.diagnosis)
          .slice(0, 6),
        expectedEvidence: {
          evidenceExpected: this.booleanValue(
            this.asRecord(rule.expectedEvidence).evidenceExpected,
            false,
          ),
          evidenceClass: this.stringValue(
            this.asRecord(rule.expectedEvidence).evidenceClass ??
              this.asRecord(rule.expectedEvidence).class,
          ),
          reason: this.stringValue(this.asRecord(rule.expectedEvidence).reason),
        },
        difficultyHints: {
          relevance: this.stringValue(
            this.asRecord(rule.difficultyHints).relevance,
          ),
          clueTiming: this.stringValue(
            this.asRecord(rule.difficultyHints).clueTiming,
          ),
          revealConstraints: this.stringArray(
            this.asRecord(rule.difficultyHints).revealConstraints,
          ).slice(0, 6),
        },
        avoidTooEarly: this.booleanValue(rule.avoidTooEarly, false),
        appliesToEducation: this.booleanValue(rule.appliesToEducation, true),
        appliesToCaseGeneration: this.booleanValue(
          rule.appliesToCaseGeneration,
          true,
        ),
        appliesToGraph: this.booleanValue(rule.appliesToGraph, false),
        sourceBriefGoalIndexes: this.numberArray(
          rule.sourceBriefGoalIndexes,
        ).slice(0, 8),
        sourceConcepts: this.stringArray(
          rule.sourceConcepts ?? rule.sourceBriefConcepts,
        ).slice(0, 10),
      }))
      .filter((rule) => rule.title)
      .slice(0, 12);
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new BadRequestException({
        code: PROVIDER_FAILURE_CODE,
        message: 'OpenAI returned invalid Teaching Rule JSON',
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
        event: 'diagnosis_teaching_rule.audit_failed',
        diagnosisRegistryId: input.diagnosisRegistryId,
        error: error instanceof Error ? error.message : 'Unknown audit error',
      });
    }
  }

  private stableKey(rule: TeachingRuleDraft) {
    const source = rule.stableKeyHint || rule.title;
    return this.normalize(source)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
  }

  private hashJson(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
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

  private numberArray(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is number => typeof item === 'number' && item >= 0,
    );
  }

  private booleanValue(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
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

const stringSchema = { type: 'string' };
const nullableStringSchema = { anyOf: [stringSchema, { type: 'null' }] };
const stringArraySchema = { type: 'array', items: stringSchema };

const TEACHING_RULE_RESPONSE_SHAPE = {
  rules: [
    {
      stableKeyHint: 'string|null',
      title: 'string',
      category: TEACHING_RULE_CATEGORIES,
      importance: TEACHING_RULE_IMPORTANCE,
      rationale: 'string|null',
      acceptableManifestations: ['string'],
      requiredDifferentials: [
        {
          registryId: 'string|null',
          diagnosis: 'string',
          whyConfused: 'string',
          keySeparator: 'string',
        },
      ],
      expectedEvidence: {
        evidenceExpected: 'boolean',
        evidenceClass: 'string|null',
        reason: 'string|null',
      },
      difficultyHints: {
        relevance: 'string|null',
        clueTiming: 'string|null',
        revealConstraints: ['string'],
      },
      avoidTooEarly: 'boolean',
      appliesToEducation: 'boolean',
      appliesToCaseGeneration: 'boolean',
      appliesToGraph: 'boolean',
      sourceBriefGoalIndexes: ['number'],
      sourceConcepts: ['string'],
    },
  ],
};

const TEACHING_RULE_GENERATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rules'],
  properties: {
    rules: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(TEACHING_RULE_RESPONSE_SHAPE.rules[0]),
        properties: {
          stableKeyHint: nullableStringSchema,
          title: stringSchema,
          category: { type: 'string', enum: TEACHING_RULE_CATEGORIES },
          importance: { type: 'string', enum: TEACHING_RULE_IMPORTANCE },
          rationale: nullableStringSchema,
          acceptableManifestations: stringArraySchema,
          requiredDifferentials: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'registryId',
                'diagnosis',
                'whyConfused',
                'keySeparator',
              ],
              properties: {
                registryId: nullableStringSchema,
                diagnosis: stringSchema,
                whyConfused: stringSchema,
                keySeparator: stringSchema,
              },
            },
          },
          expectedEvidence: {
            type: 'object',
            additionalProperties: false,
            required: ['evidenceExpected', 'evidenceClass', 'reason'],
            properties: {
              evidenceExpected: { type: 'boolean' },
              evidenceClass: nullableStringSchema,
              reason: nullableStringSchema,
            },
          },
          difficultyHints: {
            type: 'object',
            additionalProperties: false,
            required: ['relevance', 'clueTiming', 'revealConstraints'],
            properties: {
              relevance: nullableStringSchema,
              clueTiming: nullableStringSchema,
              revealConstraints: stringArraySchema,
            },
          },
          avoidTooEarly: { type: 'boolean' },
          appliesToEducation: { type: 'boolean' },
          appliesToCaseGeneration: { type: 'boolean' },
          appliesToGraph: { type: 'boolean' },
          sourceBriefGoalIndexes: {
            type: 'array',
            items: { type: 'number' },
          },
          sourceConcepts: stringArraySchema,
        },
      },
    },
  },
};
