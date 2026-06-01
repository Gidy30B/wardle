import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DiagnosisRegistryStatus, Prisma } from '@prisma/client';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { getEnv } from '../../core/config/env.validation.js';
import { PrismaService } from '../../core/db/prisma.service.js';
import { CaseValidationOrchestrator } from '../case-validation/case-validation.orchestrator.js';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service.js';
import { buildMatchedDiagnosisMappingFields } from '../diagnosis-registry/diagnosis-mapping-fields.js';
import { GenerationContextBuilder } from '../editorial/generation-context-builder.service.js';
import type {
  CaseGenerationCritique,
  CaseGenerationFailureCategory,
  CaseGenerationFailureSample,
  ClinicalClue,
  DifferentialPreflightCritique,
  GenerateBatchOptions,
  GenerateBatchResult,
  GenerateCaseInput,
  GeneratedCase,
  PlannedGenerationSlot,
  SaveGeneratedCaseOptions,
  SavedGeneratedCase,
} from './case-generator.types.js';
import {
  CaseTeachingAlignmentService,
  type CaseTeachingAlignmentReport,
} from './case-teaching-alignment.service.js';
import { GenerationPlannerService } from './generation-planner.service.js';

const clueTypeSchema = z.enum([
  'history',
  'symptom',
  'vital',
  'lab',
  'exam',
  'imaging',
]);

const clinicalClueSchema = z.object({
  type: clueTypeSchema,
  value: z.string(),
  order: z.number().int(),
});

const differentialRuleOutSchema = z.object({
  clueOrder: z.number().int(),
  evidence: z.string(),
  reason: z.string(),
});

const differentialAnalysisSchema = z.object({
  diagnosis: z.string(),
  whyPlausibleEarly: z.string(),
  ruledOutByClues: z.array(differentialRuleOutSchema),
  finalReasonLessLikely: z.string(),
});

const generatedCaseSchema = z.object({
  clues: z.array(clinicalClueSchema),
  answer: z.string(),
  differentials: z.array(z.string()),
  explanation: z.object({
    diagnosis: z.string(),
    summary: z.string(),
    reasoning: z.array(z.string()),
    keyFindings: z.array(z.string()),
    differentialAnalysis: z.array(differentialAnalysisSchema),
  }),
});

const registryTargetGeneratedCaseResponseSchema = generatedCaseSchema.extend({
  answer: z.string().nullable(),
});

const registryTargetGeneratedCaseParseSchema = generatedCaseSchema.extend({
  answer: z.string().nullable().optional(),
});

const invalidReasoningEdgeSchema = z.object({
  differential: z.string(),
  clueOrder: z.number().int(),
  evidence: z.string(),
  claimedEffect: z.enum(['weakens', 'rules_out']),
  verdict: z.enum(['valid', 'weak_or_neutral', 'backwards', 'unsupported']),
  issue: z.string(),
});

const caseGenerationCritiqueSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  clinicalAccuracyScore: z.number().min(0).max(100),
  clueProgressionScore: z.number().min(0).max(100),
  differentialQualityScore: z.number().min(0).max(100),
  differentialRuleOutScore: z.number().min(0).max(100),
  differentialPlausibilityScore: z.number().min(0).max(100),
  differentialDiscriminationScore: z.number().min(0).max(100),
  clinicalEdgeValidityScore: z.number().min(0).max(100),
  invalidReasoningEdges: z.array(invalidReasoningEdgeSchema),
  educationalValueScore: z.number().min(0).max(100),
  graphConsistencyScore: z.number().min(0).max(100),
  ambiguitySuitabilityScore: z.number().min(0).max(100),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
});

const differentialPreflightCategorySchema = z.enum([
  'competing_diagnosis',
  'subtype',
  'cause_mechanism',
  'complication',
  'severity_label',
  'synonym_or_alias',
  'broadly_related_only',
]);

const differentialPreflightVerdictSchema = z.enum([
  'valid',
  'weak',
  'invalid',
]);

const differentialPreflightAssessmentSchema = z.object({
  diagnosis: z.string(),
  category: differentialPreflightCategorySchema,
  plausibleFromClues0To2: z.boolean(),
  fitsDemographics: z.boolean(),
  fitsTimelineAcuitySetting: z.boolean(),
  sharesEarlyFeatures: z.boolean(),
  separableByLaterClues: z.boolean(),
  verdict: differentialPreflightVerdictSchema,
  issue: z.string().nullable(),
});

const differentialPreflightCritiqueSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
  assessments: z.array(differentialPreflightAssessmentSchema),
});

const REQUIRED_CLUE_COUNT = 6;
const MIN_DIFFERENTIAL_COUNT = 3;
const MAX_DIFFERENTIAL_COUNT = 5;
const MAX_GENERATION_ATTEMPTS = 3;
const MAX_BATCH_SLOT_ATTEMPTS = 3;
const MIN_CRITIQUE_SCORE = 85;
const MIN_DIFFERENTIAL_PREFLIGHT_SCORE = 85;
const MAX_WEAK_DIFFERENTIAL_PREFLIGHT_ASSESSMENTS = 1;
const MIN_BATCH_QUALITY_SCORE = 80;
const MIN_CLINICAL_ACCURACY_SCORE = 85;
const MIN_CLUE_PROGRESSION_SCORE = 80;
const MIN_DIFFERENTIAL_PLAUSIBILITY_SCORE = 80;
const MIN_DIFFERENTIAL_DISCRIMINATION_SCORE = 80;
const MIN_CLINICAL_EDGE_VALIDITY_SCORE = 85;
const MIN_EDUCATIONAL_VALUE_SCORE = 75;
const MIN_GRAPH_CONSISTENCY_SCORE = 75;
const MIN_ANY_CRITIQUE_COMPONENT_SCORE = 70;
const FAILURE_SAMPLE_LIMIT = 20;
const CASE_GENERATION_FAILURE_CATEGORIES: CaseGenerationFailureCategory[] = [
  'objective_detail',
  'demographic_incompatible_differential',
  'answer_leakage',
  'differential_preflight',
  'differential_grounding',
  'full_critique',
  'registry_target_mismatch',
  'duplicate_answer',
  'duplicate_scenario',
  'low_quality',
  'specialty_cluster',
  'difficulty_balance',
  'connection_error',
  'openai_empty_response',
  'json_parse',
  'schema_invalid',
  'unknown',
];
const BATCH_DIFFICULTY_ROTATION = ['easy', 'medium', 'hard'] as const;
const HIGH_ACUITY_PATTERN =
  /\b(shock|hypotension|hypoxic|hypoxia|respiratory distress|altered mental status|syncope|sepsis|unstable|crushing chest pain|acute abdomen|peritonitis)\b/i;
const LOW_ACUITY_PATTERN =
  /\b(chronic|intermittent|mild|stable|routine|gradual|months|years|well appearing)\b/i;
const OBJECTIVE_DETAIL_PATTERN =
  /\b(\d+(\.\d+)?|positive|negative|elevated|low|high|increased|decreased|reduced|normal|abnormal|opacity|consolidation|effusion|lesion|mass|fracture|ischemia|infiltrate|dilated|enlarged)\b/i;
const NUMERIC_OBJECTIVE_PATTERN = /\b\d+(\.\d+)?\b/;
const VITAL_OBJECTIVE_PATTERN =
  /\b(bp|blood pressure|hr|heart rate|rr|respiratory rate|temperature|temp|spo2|oxygen saturation|o2 sat|pulse|bpm|\/min|mmhg|°f|°c|fahrenheit|celsius)\b/i;
const LAB_OBJECTIVE_RESULT_PATTERN =
  /\b(positive|negative)\b.+\b(culture|test|assay|troponin|d-dimer|ketones|nitrite|leukocyte esterase|antibody|antigen|pcr)\b|\b(grows|grew|isolates|detected|undetectable)\b/i;
const IMAGING_OBJECTIVE_FINDING_PATTERN =
  /\b(shows|demonstrates|reveals|identifies|notable for)\b.+\b(opac\w*|consolidation|effusion|edema|fracture|mass|lesion|infiltrate|ischemia|hemorrhage|dilation|dilated|enlarged|cavitary|obstruction|stone|appendix|wall thickening|stranding|abscess)\b/i;
const FEMALE_PATIENT_PATTERN =
  /\b(female|woman|girl|pregnant|postpartum|mother|she|her)\b/i;
const MALE_PATIENT_PATTERN =
  /\b(male|man|boy|father|he|his|him)\b/i;
const FEMALE_SPECIFIC_DIFFERENTIAL_PATTERN =
  /\b(ovarian|uterine|endometrial|fallopian|adnexal|ectopic pregnancy|pregnancy|pregnant|gynecologic|gynaecologic|pelvic inflammatory disease|pid)\b/i;
const MALE_SPECIFIC_DIFFERENTIAL_PATTERN =
  /\b(prostate|prostatic|prostatitis|bph|benign prostatic hyperplasia|testicular|epididymitis|orchitis|torsion of the testis)\b/i;
const GENERIC_DIFFERENTIAL_REASON_PATTERNS = [
  /\bless consistent with the presentation\b/i,
  /\bdoes not fit the case\b/i,
  /\bless likely clinically\b/i,
  /\bnot supported by findings\b/i,
];
const DIAGNOSIS_ACRONYM_STOPWORDS = new Set([
  'acute',
  'chronic',
  'primary',
  'secondary',
  'type',
  'with',
  'without',
  'and',
  'or',
  'of',
  'the',
  'a',
  'an',
]);

type PersistedGeneratedExplanation = GeneratedCase['explanation'] & {
  differentials: string[];
  generationQuality?: {
    version: 'case-generator:v2';
    critiqueScore: number;
    critiquePassed: boolean;
    critiqueIssues: string[];
    critiqueRecommendations: string[];
    differentialRuleOutScore: number;
    differentialPlausibilityScore?: number;
    differentialDiscriminationScore?: number;
    clinicalEdgeValidityScore?: number;
    invalidReasoningEdges?: CaseGenerationCritique['invalidReasoningEdges'];
    educationalValueScore?: number;
    graphConsistencyScore?: number;
    estimatedDifficulty: 'easy' | 'medium' | 'hard';
    estimatedSolveClue: number;
    specialty: string | null;
    acuity: 'low' | 'medium' | 'high' | null;
    hasLabs: boolean;
    hasImaging: boolean;
    hasVitals: boolean;
    differentialCount: number;
    qualityScore: number;
    teachingAlignment?: CaseTeachingAlignmentReport;
    targetedGeneration?: {
      teachingUnitIds: string[];
      teachingUnits: Array<{
        id: string;
        label: string;
        category: string;
        importance: string;
      }>;
      mimicDiagnosisIds: string[];
      mimics: string[];
      clueRevealStrategy: NonNullable<GenerateCaseInput['clueRevealStrategy']> | null;
    };
  };
};

type GeneratedCaseExplanationWithQuality = GeneratedCase['explanation'] & {
  generationQuality?: PersistedGeneratedExplanation['generationQuality'];
};

type BatchRejectionReason =
  | 'duplicate_answer'
  | 'duplicate_scenario'
  | 'low_quality'
  | 'specialty_cluster'
  | 'difficulty_balance';

type BatchQualityState = {
  generated: number;
  accepted: number;
  rejected: number;
  qualityScoreTotal: number;
  qualityScoreCount: number;
  acceptedAnswers: Set<string>;
  acceptedScenarioKeys: Set<string>;
  acceptedSpecialties: Map<string, number>;
  acceptedDifficulties: Map<'easy' | 'medium' | 'hard', number>;
};

type BatchFailureTracker = {
  byCategory: Record<CaseGenerationFailureCategory, number>;
  samples: CaseGenerationFailureSample[];
};

type GenerationFailureReportingContext = {
  tracker: BatchFailureTracker;
  index: number;
  plannerDiagnosis?: string | null;
};

@Injectable()
export class CaseGeneratorService {
  private readonly logger = new Logger(CaseGeneratorService.name);
  private readonly env = getEnv();
  private readonly openaiClient?: OpenAI;
  private readonly model =
    this.normalizeOptionalString(process.env.OPENAI_CASE_GENERATOR_MODEL) ??
    'gpt-4o-mini';
  private caseDateCursor = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly caseValidationOrchestrator: CaseValidationOrchestrator,
    private readonly diagnosisRegistryLinkService: DiagnosisRegistryLinkService,
    private readonly generationPlannerService: GenerationPlannerService,
    private readonly generationContextBuilder?: GenerationContextBuilder,
    private readonly caseTeachingAlignmentService: CaseTeachingAlignmentService = new CaseTeachingAlignmentService(),
  ) {
    if (this.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: this.env.OPENAI_API_KEY,
      });
    }
  }

  async generateCase(
    input: GenerateCaseInput = {},
    failureReporting?: GenerationFailureReportingContext,
  ): Promise<GeneratedCase> {
    if (!this.openaiClient) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not configured for case generation',
      );
    }

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        const generatedCase = await this.requestGeneratedCase(input, attempt);
        const normalizedCase = this.normalizeCase(generatedCase);
        await this.validateCaseWithRegistry(normalizedCase);

        const differentialPreflight = await this.critiqueDifferentials(
          normalizedCase,
          null,
        );
        try {
          this.assertPassingDifferentialPreflight(differentialPreflight);
        } catch (error) {
          this.logDifferentialPreflightFailed(
            normalizedCase,
            differentialPreflight,
          );
          throw error;
        }

        const critique = await this.critiqueGeneratedCase(normalizedCase);
        if (!this.isPassingCritique(critique)) {
          throw new BadRequestException(
            `Generated case failed critique: ${critique.issues.join('; ')}`,
          );
        }

        return this.attachGenerationQuality(normalizedCase, critique, input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const failureCategory = this.classifyGenerationFailure(lastError);
        if (failureReporting) {
          this.recordBatchFailure(failureReporting.tracker, {
            index: failureReporting.index,
            answer: null,
            plannerDiagnosis: failureReporting.plannerDiagnosis ?? null,
            category: failureCategory,
            message: lastError.message,
            attempt,
          });
        }
        this.logger.warn(
          JSON.stringify({
            event: 'case.generate.retry',
            attempt,
            maxAttempts: MAX_GENERATION_ATTEMPTS,
            failureCategory,
            failureMessage: lastError.message,
            error: lastError.message,
          }),
        );
      }
    }

    throw new BadRequestException(
      `Failed to generate a valid case after ${MAX_GENERATION_ATTEMPTS} attempts: ${
        lastError?.message ?? 'unknown generation error'
      }`,
    );
  }

  async generateCaseForRegistryTarget(
    input: {
      target: PlannedGenerationSlot['diagnosis'];
      generation: GenerateCaseInput;
    },
    failureReporting?: GenerationFailureReportingContext,
  ): Promise<GeneratedCase> {
    if (!input.target) {
      throw new BadRequestException(
        'Registry-first generation requires a planned diagnosis target',
      );
    }

    if (!this.openaiClient) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not configured for case generation',
      );
    }

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        const generatedCase =
          await this.requestGeneratedCaseForRegistryTarget({
            input: input.generation,
            target: input.target,
            attempt,
          });
        const normalizedCase = this.normalizeCase(generatedCase);
        this.validateCaseForRegistryTarget(normalizedCase, input.target);

        const differentialPreflight = await this.critiqueDifferentials(
          normalizedCase,
          input.target,
        );
        try {
          this.assertPassingDifferentialPreflight(differentialPreflight);
        } catch (error) {
          this.logDifferentialPreflightFailed(
            normalizedCase,
            differentialPreflight,
          );
          throw error;
        }

        const critique = await this.critiqueGeneratedCase(normalizedCase);
        if (!this.isPassingCritique(critique)) {
          throw new BadRequestException(
            `Generated case failed critique: ${critique.issues.join('; ')}`,
          );
        }

        return this.attachGenerationQuality(
          normalizedCase,
          critique,
          input.generation,
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const failureCategory = this.classifyGenerationFailure(lastError);
        if (failureReporting) {
          this.recordBatchFailure(failureReporting.tracker, {
            index: failureReporting.index,
            answer: null,
            plannerDiagnosis:
              failureReporting.plannerDiagnosis ?? input.target.displayLabel,
            category: failureCategory,
            message: lastError.message,
            attempt,
          });
        }
        this.logger.warn(
          JSON.stringify({
            event: 'case.generate.registry_first.retry',
            attempt,
            maxAttempts: MAX_GENERATION_ATTEMPTS,
            diagnosisRegistryId: input.target.diagnosisRegistryId,
            plannerDiagnosis: input.target.displayLabel,
            registryFirst: true,
            failureCategory,
            failureMessage: lastError.message,
            error: lastError.message,
          }),
        );
      }
    }

    throw new BadRequestException(
      `Failed to generate a registry-first case after ${MAX_GENERATION_ATTEMPTS} attempts: ${
        lastError?.message ?? 'unknown generation error'
      }`,
    );
  }

  async critiqueGeneratedCase(
    generatedCase: GeneratedCase,
  ): Promise<CaseGenerationCritique> {
    if (!this.openaiClient) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not configured for case generation critique',
      );
    }

    const completion = await this.openaiClient.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: this.buildCritiqueSystemPrompt(),
        },
        {
          role: 'user',
          content: JSON.stringify(generatedCase),
        },
      ],
      response_format: zodResponseFormat(
        caseGenerationCritiqueSchema,
        'case_generation_critique',
      ),
    });

    const content = completion.choices[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new BadRequestException(
        'OpenAI returned an empty critique payload',
      );
    }

    return this.parseCritique(content);
  }

  private async critiqueDifferentials(
    generatedCase: GeneratedCase,
    target?: PlannedGenerationSlot['diagnosis'] | null,
  ): Promise<DifferentialPreflightCritique> {
    if (!this.openaiClient) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not configured for differential preflight critique',
      );
    }

    const orderedClues = [...generatedCase.clues].sort(
      (left, right) => left.order - right.order,
    );
    const differentialAnalysisSummaries =
      generatedCase.explanation.differentialAnalysis.map((analysis) => ({
        diagnosis: analysis.diagnosis,
        whyPlausibleEarly: analysis.whyPlausibleEarly,
        ruledOutByClues: analysis.ruledOutByClues.map((ruleOut) => ({
          clueOrder: ruleOut.clueOrder,
          evidence: ruleOut.evidence,
          reason: ruleOut.reason,
        })),
        finalReasonLessLikely: analysis.finalReasonLessLikely,
      }));

    const preflightPayload = {
      answer: generatedCase.answer,
      registryTarget: target
        ? {
            diagnosisRegistryId: target.diagnosisRegistryId,
            displayLabel: target.displayLabel,
            canonicalName: target.canonicalName,
            acceptedAliases: target.acceptedAliases,
            specialty: target.specialty,
            category: target.category,
            bodySystem: target.bodySystem,
            difficultyBand: target.difficultyBand,
          }
        : null,
      earlyClues: orderedClues
        .filter((clue) => clue.order >= 0 && clue.order <= 2)
        .map((clue) => ({
          order: clue.order,
          type: clue.type,
          value: clue.value,
        })),
      laterClues: orderedClues
        .filter((clue) => clue.order >= 3 && clue.order <= 5)
        .map((clue) => ({
          order: clue.order,
          type: clue.type,
          value: clue.value,
        })),
      differentials: generatedCase.differentials,
      differentialAnalysisSummaries,
    };

    const completion = await this.openaiClient.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: this.buildDifferentialPreflightSystemPrompt(),
        },
        {
          role: 'user',
          content: JSON.stringify(preflightPayload),
        },
      ],
      response_format: zodResponseFormat(
        differentialPreflightCritiqueSchema,
        'differential_preflight_critique',
      ),
    });

    const content = completion.choices[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new BadRequestException(
        'OpenAI returned an empty differential preflight payload',
      );
    }

    return this.parseDifferentialPreflight(content);
  }

  validateCase(generatedCase: GeneratedCase): void {
    this.validateCaseAgainstLeakTerms(generatedCase, [generatedCase.answer]);
  }

  private async validateCaseWithRegistry(
    generatedCase: GeneratedCase,
  ): Promise<void> {
    const leakTerms = await this.getRegistryLeakTerms(generatedCase.answer);
    this.validateCaseAgainstLeakTerms(generatedCase, leakTerms);
  }

  private validateCaseForRegistryTarget(
    generatedCase: GeneratedCase,
    target: NonNullable<PlannedGenerationSlot['diagnosis']>,
  ): void {
    const targetTerms = this.getRegistryTargetTerms(target);
    this.validateCaseAgainstLeakTerms(generatedCase, targetTerms);

    if (!this.matchesRegistryTargetTerm(generatedCase.answer, target)) {
      throw new BadRequestException(
        `Generated case answer "${generatedCase.answer}" does not match fixed diagnosis "${target.displayLabel}"`,
      );
    }

    if (
      !this.matchesRegistryTargetTerm(generatedCase.explanation.diagnosis, target)
    ) {
      throw new BadRequestException(
        `Generated case explanation diagnosis "${generatedCase.explanation.diagnosis}" does not match fixed diagnosis "${target.displayLabel}"`,
      );
    }

    const normalizedTargetTerms = new Set(
      targetTerms.map((term) => this.normalizeClinicalText(term)),
    );
    for (const differential of generatedCase.differentials) {
      if (normalizedTargetTerms.has(this.normalizeClinicalText(differential))) {
        throw new BadRequestException(
          'Differentials must not include the fixed diagnosis or accepted aliases',
        );
      }
    }
  }

  private validateCaseAgainstLeakTerms(
    generatedCase: GeneratedCase,
    diagnosisLeakTerms: string[],
  ): void {
    const parsed = generatedCaseSchema.safeParse(generatedCase);
    if (!parsed.success) {
      throw new BadRequestException(
        `Generated case schema is invalid: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'} ${issue.message}`)
          .join('; ')}`,
      );
    }

    if (generatedCase.clues.length !== REQUIRED_CLUE_COUNT) {
      throw new BadRequestException(
        `Generated case must include exactly ${REQUIRED_CLUE_COUNT} clues`,
      );
    }

    const seenClueValues = new Set<string>();
    const seenClueOrders = new Set<number>();
    const normalizedAnswer = this.normalizeClinicalText(generatedCase.answer);
    for (const [index, clue] of generatedCase.clues.entries()) {
      if (!clue.type || !clue.value || !Number.isInteger(clue.order)) {
        throw new BadRequestException(
          `Clue at index ${index} must include type, value, and integer order`,
        );
      }

      const normalizedValue = clue.value.trim().toLowerCase();
      if (!normalizedValue) {
        throw new BadRequestException(
          `Clue at index ${index} must include a non-empty value`,
        );
      }

      const normalizedClinicalValue = this.normalizeClinicalText(clue.value);
      if (seenClueValues.has(normalizedClinicalValue)) {
        throw new BadRequestException(
          `Duplicate clue value detected: ${clue.value}`,
        );
      }

      if (seenClueOrders.has(clue.order)) {
        throw new BadRequestException(
          `Duplicate clue order detected: ${clue.order}`,
        );
      }

      if (clue.order < 0 || clue.order >= REQUIRED_CLUE_COUNT) {
        throw new BadRequestException(
          `Clue order must be sequential from 0 to ${REQUIRED_CLUE_COUNT - 1}`,
        );
      }

      if (
        clue.order < REQUIRED_CLUE_COUNT - 1 &&
        this.containsAnyDiagnosisLeak(clue.value, diagnosisLeakTerms)
      ) {
        throw new BadRequestException(
          `Clue at order ${clue.order} leaks the final diagnosis before the confirmatory clue`,
        );
      }

      if (
        this.requiresObjectiveDetail(clue.type) &&
        !this.hasPlausibleObjectiveDetail(clue.value, clue.type)
      ) {
        throw new BadRequestException(
          `Lab, imaging, or vital clue at order ${clue.order} must include a realistic objective finding`,
        );
      }

      seenClueValues.add(normalizedClinicalValue);
      seenClueOrders.add(clue.order);
    }

    for (let order = 0; order < REQUIRED_CLUE_COUNT; order += 1) {
      if (!seenClueOrders.has(order)) {
        throw new BadRequestException(
          `Generated case is missing clue order ${order}`,
        );
      }
    }

    if (!normalizedAnswer) {
      throw new BadRequestException('Generated case answer is required');
    }

    const normalizedDifferentials = generatedCase.differentials
      .map((differential) => this.normalizeClinicalText(differential))
      .filter((differential) => differential.length > 0);
    if (
      normalizedDifferentials.length < MIN_DIFFERENTIAL_COUNT ||
      normalizedDifferentials.length > MAX_DIFFERENTIAL_COUNT
    ) {
      throw new BadRequestException(
        `Generated case must include ${MIN_DIFFERENTIAL_COUNT}-${MAX_DIFFERENTIAL_COUNT} plausible differentials`,
      );
    }

    this.validateDemographicCompatibleDifferentials(generatedCase);

    const seenDifferentials = new Set<string>();
    for (const differential of normalizedDifferentials) {
      if (differential === normalizedAnswer) {
        throw new BadRequestException(
          'Differentials must not include the final diagnosis',
        );
      }

      if (seenDifferentials.has(differential)) {
        throw new BadRequestException(
          'Generated case differentials must not contain duplicates',
        );
      }

      seenDifferentials.add(differential);
    }

    if (!generatedCase.explanation) {
      throw new BadRequestException('Generated case explanation is required');
    }

    const explanationDiagnosis = this.normalizeClinicalText(
      generatedCase.explanation.diagnosis,
    );
    if (
      !explanationDiagnosis ||
      (explanationDiagnosis !== normalizedAnswer &&
        !explanationDiagnosis.includes(normalizedAnswer) &&
        !normalizedAnswer.includes(explanationDiagnosis))
    ) {
      throw new BadRequestException(
        'Generated case explanation diagnosis must match the final answer',
      );
    }

    if (!generatedCase.explanation.summary.trim()) {
      throw new BadRequestException(
        'Generated case explanation summary is required',
      );
    }

    if (
      generatedCase.explanation.reasoning.filter((reason) => reason.trim())
        .length === 0
    ) {
      throw new BadRequestException(
        'Generated case explanation must include reasoning',
      );
    }

    if (
      generatedCase.explanation.keyFindings.filter((finding) => finding.trim())
        .length === 0
    ) {
      throw new BadRequestException(
        'Generated case explanation must include key findings',
      );
    }

    this.validateDifferentialAnalysis(generatedCase);
  }

  private validateDifferentialAnalysis(generatedCase: GeneratedCase): void {
    const analysis = generatedCase.explanation.differentialAnalysis;
    if (!Array.isArray(analysis)) {
      throw new BadRequestException(
        'Generated case explanation must include differentialAnalysis',
      );
    }

    if (analysis.length !== generatedCase.differentials.length) {
      throw new BadRequestException(
        'Generated case differentialAnalysis must include exactly one item per differential',
      );
    }

    const normalizedAnswer = this.normalizeClinicalText(generatedCase.answer);
    const normalizedDifferentials = new Map(
      generatedCase.differentials.map((differential) => [
        this.normalizeClinicalText(differential),
        differential,
      ]),
    );
    const seenAnalysisDiagnoses = new Set<string>();
    const clueByOrder = new Map(
      generatedCase.clues.map((clue) => [clue.order, clue.value]),
    );

    for (const item of analysis) {
      const normalizedDiagnosis = this.normalizeClinicalText(item.diagnosis);
      if (!normalizedDiagnosis) {
        throw new BadRequestException(
          'Generated case differentialAnalysis diagnosis is required',
        );
      }

      if (normalizedDiagnosis === normalizedAnswer) {
        throw new BadRequestException(
          'Generated case differentialAnalysis must not include the final diagnosis',
        );
      }

      if (!normalizedDifferentials.has(normalizedDiagnosis)) {
        throw new BadRequestException(
          `Generated case differentialAnalysis contains extra diagnosis: ${item.diagnosis}`,
        );
      }

      if (seenAnalysisDiagnoses.has(normalizedDiagnosis)) {
        throw new BadRequestException(
          `Generated case differentialAnalysis contains duplicate diagnosis: ${item.diagnosis}`,
        );
      }
      seenAnalysisDiagnoses.add(normalizedDiagnosis);

      this.assertSpecificText(
        item.whyPlausibleEarly,
        'whyPlausibleEarly must be non-empty and case-specific',
      );
      this.assertSpecificText(
        item.finalReasonLessLikely,
        'finalReasonLessLikely must be non-empty and case-specific',
      );

      if (!Array.isArray(item.ruledOutByClues) || item.ruledOutByClues.length === 0) {
        throw new BadRequestException(
          `Differential "${item.diagnosis}" must include at least one ruledOutByClues entry`,
        );
      }

      for (const ruleOut of item.ruledOutByClues) {
        const clueText = clueByOrder.get(ruleOut.clueOrder);
        if (!clueText) {
          throw new BadRequestException(
            `Differential "${item.diagnosis}" references invalid clueOrder ${ruleOut.clueOrder}`,
          );
        }

        this.assertSpecificText(
          ruleOut.evidence,
          `Differential "${item.diagnosis}" rule-out evidence must be non-empty and case-specific`,
        );
        this.assertSpecificText(
          ruleOut.reason,
          `Differential "${item.diagnosis}" rule-out reason must be non-empty and case-specific`,
        );

        if (!this.isGroundedInClue(ruleOut.evidence, clueText)) {
          throw new BadRequestException(
            `Differential "${item.diagnosis}" rule-out evidence must be copied or tightly paraphrased from clue ${ruleOut.clueOrder}`,
          );
        }
      }
    }

    if (seenAnalysisDiagnoses.size !== normalizedDifferentials.size) {
      throw new BadRequestException(
        'Generated case differentialAnalysis is missing one or more listed differentials',
      );
    }
  }

  private validateDemographicCompatibleDifferentials(
    generatedCase: GeneratedCase,
  ): void {
    const patientSex = this.inferPatientSex(generatedCase);

    for (const differential of generatedCase.differentials) {
      const isFemaleSpecific =
        FEMALE_SPECIFIC_DIFFERENTIAL_PATTERN.test(differential);
      const isMaleSpecific =
        MALE_SPECIFIC_DIFFERENTIAL_PATTERN.test(differential);

      if (!isFemaleSpecific && !isMaleSpecific) {
        continue;
      }

      if (patientSex === 'male' && isFemaleSpecific) {
        throw new BadRequestException(
          `Demographic-incompatible differential: "${differential}" is not compatible with male patient sex`,
        );
      }

      if (patientSex === 'female' && isMaleSpecific) {
        throw new BadRequestException(
          `Demographic-incompatible differential: "${differential}" is not compatible with female patient sex`,
        );
      }

      if (patientSex === null) {
        throw new BadRequestException(
          `Demographic-incompatible differential: "${differential}" requires explicit compatible patient sex or anatomy`,
        );
      }
    }
  }

  private inferPatientSex(
    generatedCase: GeneratedCase,
  ): 'male' | 'female' | null {
    const earlyCaseText = generatedCase.clues
      .filter((clue) => clue.order <= 2)
      .map((clue) => clue.value)
      .join(' ');
    const hasFemaleSignal = FEMALE_PATIENT_PATTERN.test(earlyCaseText);
    const hasMaleSignal = MALE_PATIENT_PATTERN.test(earlyCaseText);

    if (hasFemaleSignal && !hasMaleSignal) {
      return 'female';
    }

    if (hasMaleSignal && !hasFemaleSignal) {
      return 'male';
    }

    return null;
  }

  private inferPatientAge(generatedCase: GeneratedCase): number | null {
    const caseText = generatedCase.clues
      .map((clue) => clue.value)
      .join(' ');
    const match = caseText.match(/\b(\d{1,3})[- ]year[- ]old\b/i);
    if (!match) {
      return null;
    }

    const age = Number(match[1]);
    return Number.isFinite(age) ? age : null;
  }

  private assertSpecificText(value: string, message: string): void {
    const normalized = this.normalizeClinicalText(value);
    if (!normalized || normalized.length < 8) {
      throw new BadRequestException(message);
    }

    if (
      GENERIC_DIFFERENTIAL_REASON_PATTERNS.some((pattern) =>
        pattern.test(value),
      ) &&
      normalized.split(' ').length < 10
    ) {
      throw new BadRequestException(message);
    }
  }

  private isGroundedInClue(evidence: string, clueText: string): boolean {
    const normalizedEvidence = this.normalizeClinicalText(evidence);
    const normalizedClue = this.normalizeClinicalText(clueText);
    if (!normalizedEvidence || !normalizedClue) {
      return false;
    }

    if (
      normalizedClue.includes(normalizedEvidence) ||
      normalizedEvidence.includes(normalizedClue)
    ) {
      return true;
    }

    const evidenceTokens = this.extractMeaningfulTokens(normalizedEvidence);
    if (evidenceTokens.length === 0) {
      return false;
    }

    const clueTokens = new Set(this.extractMeaningfulTokens(normalizedClue));
    const overlap = evidenceTokens.filter((token) => clueTokens.has(token)).length;
    return overlap / evidenceTokens.length >= 0.6;
  }

  private extractMeaningfulTokens(value: string): string[] {
    return value
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !DIAGNOSIS_ACRONYM_STOPWORDS.has(token));
  }

  normalizeCase(generatedCase: GeneratedCase): GeneratedCase {
    const generationQuality = this.getGenerationQuality(generatedCase);

    return {
      clues: [...generatedCase.clues]
        .map((clue) => ({
          type: clue.type,
          value: clue.value.trim(),
          order: clue.order,
        }))
        .sort((left, right) => left.order - right.order),
      answer: generatedCase.answer.trim().toLowerCase(),
      differentials: generatedCase.differentials
        .map((differential) => differential.trim())
        .filter((differential) => differential.length > 0),
      explanation: {
        diagnosis: generatedCase.explanation.diagnosis.trim(),
        summary: generatedCase.explanation.summary.trim(),
        reasoning: generatedCase.explanation.reasoning
          .map((reason) => reason.trim())
          .filter((reason) => reason.length > 0),
        keyFindings: generatedCase.explanation.keyFindings
          .map((finding) => finding.trim())
          .filter((finding) => finding.length > 0),
        differentialAnalysis: generatedCase.explanation.differentialAnalysis.map(
          (item) => ({
            diagnosis: item.diagnosis.trim(),
            whyPlausibleEarly: item.whyPlausibleEarly.trim(),
            ruledOutByClues: item.ruledOutByClues.map((ruleOut) => ({
              clueOrder: ruleOut.clueOrder,
              evidence: ruleOut.evidence.trim(),
              reason: ruleOut.reason.trim(),
            })),
            finalReasonLessLikely: item.finalReasonLessLikely.trim(),
          }),
        ),
        ...(generationQuality ? { generationQuality } : {}),
      } as GeneratedCase['explanation'],
    };
  }

  async saveCase(
    generatedCase: GeneratedCase,
    options: SaveGeneratedCaseOptions = {},
  ): Promise<SavedGeneratedCase | null> {
    const normalizedCase = this.normalizeCase(generatedCase);
    await this.validateCaseWithRegistry(normalizedCase);
    const target = await this.findRegistryTargetByGeneratedAnswer(
      normalizedCase.answer,
    );
    if (!target) {
      throw new BadRequestException(
        `Generated answer "${normalizedCase.answer}" does not match an active diagnosis registry entry`,
      );
    }

    return this.saveCaseForRegistryTarget(normalizedCase, target, options);
  }

  async saveCaseForRegistryTarget(
    generatedCase: GeneratedCase,
    target: NonNullable<PlannedGenerationSlot['diagnosis']>,
    options: SaveGeneratedCaseOptions = {},
  ): Promise<SavedGeneratedCase | null> {
    const sourceCase = this.normalizeCase(generatedCase);
    this.validateCaseForRegistryTarget(sourceCase, target);

    const normalizedCase = this.normalizeCase({
      ...sourceCase,
      answer: target.displayLabel,
      explanation: {
        ...sourceCase.explanation,
        diagnosis: target.displayLabel,
      },
    });

    const scenarioKey = this.getCaseScenarioKey(normalizedCase, target);
    const seenAnswers = options.seenAnswers;
    if (seenAnswers?.has(scenarioKey)) {
      return null;
    }

    seenAnswers?.add(scenarioKey);

    try {
      if (!options.skipExistingAnswerCheck) {
        const duplicateCheck = await this.findExistingCaseIdByRegistryScenario(
          target.diagnosisRegistryId,
          scenarioKey,
        );
        if (duplicateCheck) {
          return null;
        }
      }

      const history =
        normalizedCase.clues.find((clue) => clue.type === 'history')?.value ??
        normalizedCase.clues[0]?.value ??
        target.displayLabel;
      const symptoms = normalizedCase.clues
        .filter((clue) => clue.type === 'symptom')
        .map((clue) => clue.value);

      const createdCase = await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            if (!options.skipExistingAnswerCheck) {
              const existing = await this.findExistingCaseIdByRegistryScenario(
                target.diagnosisRegistryId,
                scenarioKey,
                tx,
              );
              if (existing) {
                return null;
              }
            }

            const diagnosisMappingFields = buildMatchedDiagnosisMappingFields({
              diagnosisName: target.displayLabel,
              proposedDiagnosisText: target.displayLabel,
              method: 'EDITOR_SELECTED',
            });

            const persistedCase = await tx.case.create({
              data: {
                publicNumber: await this.getNextCasePublicNumber(tx),
                title: target.displayLabel,
                date: this.nextCaseDate(),
                difficulty: this.normalizeDifficulty(options.difficulty),
                history,
                symptoms,
                clues: normalizedCase.clues as Prisma.InputJsonValue,
                explanation: this.toPersistedExplanation(
                  normalizedCase,
                ) as Prisma.InputJsonValue,
                differentials: normalizedCase.differentials,
                diagnosisId: target.legacyDiagnosisId,
                diagnosisRegistryId: target.diagnosisRegistryId,
                ...diagnosisMappingFields,
              },
              select: {
                id: true,
                title: true,
                difficulty: true,
                date: true,
              },
            });

            await this.caseValidationOrchestrator.runShadowForGeneratedCaseInTransaction(
              tx,
              {
                caseId: persistedCase.id,
                startedAt: new Date(),
              },
            );

            return persistedCase;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        ),
      );

      if (!createdCase) {
        return null;
      }

      this.logger.log(
        JSON.stringify({
          event: 'case.generate.persisted_and_validated',
          caseId: createdCase.id,
          answer: target.displayLabel,
          diagnosisRegistryId: target.diagnosisRegistryId,
          saveDiagnosisSource: 'registry',
        }),
      );

      return createdCase;
    } catch (error) {
      if (!this.isDuplicatePrismaError(error)) {
        seenAnswers?.delete(scenarioKey);
      }

      throw error;
    }
  }

  async generateBatch(
    options: GenerateBatchOptions,
  ): Promise<GenerateBatchResult> {
    const count = Math.trunc(options.count);
    if (!Number.isFinite(count) || count < 1) {
      throw new BadRequestException('Batch count must be a positive integer');
    }

    const batchId = randomUUID();
    const seenAnswers = new Set<string>();
    const requestedDiagnosisRegistryIds = this.uniqueStrings(
      options.diagnosisRegistryIds ?? [],
    );
    const targetedGeneration = requestedDiagnosisRegistryIds.length > 0;
    const registryFirst = targetedGeneration || options.registryFirst !== false;
    const qualityState: BatchQualityState = {
      generated: 0,
      accepted: 0,
      rejected: 0,
      qualityScoreTotal: 0,
      qualityScoreCount: 0,
      acceptedAnswers: seenAnswers,
      acceptedScenarioKeys: new Set(),
      acceptedSpecialties: new Map(),
      acceptedDifficulties: new Map(),
    };
    const failureTracker = this.createBatchFailureTracker();
    const concurrency = Math.max(
      1,
      Math.min(5, Math.trunc(options.concurrency ?? 5)),
    );
    const results = new Array<GenerateBatchResult['results'][number]>(count);
    const plannerDiagnostics = await this.createPlannerDiagnostics({
      batchId,
      options,
      requestedDiagnosisRegistryIds,
    });
    const selectedDiagnosisRegistryIds = plannerDiagnostics
      .map((slot) => slot.diagnosis?.diagnosisRegistryId)
      .filter((id): id is string => Boolean(id));
    let nextIndex = 0;

    this.logger.log(
      JSON.stringify({
        event: 'case.generate.started',
        batchId,
        count,
        track: this.normalizeOptionalString(options.track),
        difficulty: this.normalizeDifficulty(options.difficulty),
        concurrency,
        registryFirst,
        targetedGeneration,
        requestedDiagnosisRegistryIds,
        selectedDiagnosisRegistryIds,
      }),
    );

    const workers = Array.from(
      { length: Math.min(concurrency, count) },
      async () => {
        for (;;) {
          const currentIndex = nextIndex;
          nextIndex += 1;

          if (currentIndex >= count) {
            return;
          }

          results[currentIndex] = await this.generateBalancedBatchSlot({
            batchId,
            index: currentIndex,
            requestedCount: count,
            options,
            registryFirst,
            seenAnswers,
            qualityState,
            failureTracker,
            plannerSlot: plannerDiagnostics[currentIndex],
            onPlannerSlotUpdated: (slot) => {
              plannerDiagnostics[currentIndex] = slot;
            },
          });
        }
      },
    );

    await Promise.all(workers);

    const created = results.filter(
      (result) => result.status === 'created',
    ).length;
    const skipped = results.filter(
      (result) => result.status === 'skipped',
    ).length;
    const failed = results.filter(
      (result) => result.status === 'failed',
    ).length;
    const rejected = qualityState.rejected;
    const averageQualityScore =
      qualityState.qualityScoreCount > 0
        ? Math.round(
            qualityState.qualityScoreTotal / qualityState.qualityScoreCount,
          )
        : null;

    const summary: GenerateBatchResult = {
      batchId,
      requested: count,
      generated: qualityState.generated,
      accepted: created,
      rejected,
      created,
      skipped,
      failed,
      averageQualityScore,
      plannerDiagnostics,
      results,
      failureSummary: this.toFailureSummary(failureTracker),
    };

    this.logger.log(
      JSON.stringify({
        event: 'case.generate.batch.completed',
        batchId,
        requested: summary.requested,
        generated: summary.generated,
        accepted: summary.accepted,
        rejected: summary.rejected,
        created: summary.created,
        skipped: summary.skipped,
        failed: summary.failed,
        averageQualityScore: summary.averageQualityScore,
        targetedGeneration,
        requestedDiagnosisRegistryIds,
        selectedDiagnosisRegistryIds,
        failureSummary: summary.failureSummary,
      }),
    );

    return summary;
  }

  private async generateBalancedBatchSlot(input: {
    batchId: string;
    index: number;
    requestedCount: number;
    options: GenerateBatchOptions;
    registryFirst: boolean;
    seenAnswers: Set<string>;
    qualityState: BatchQualityState;
    failureTracker: BatchFailureTracker;
    plannerSlot?: PlannedGenerationSlot;
    onPlannerSlotUpdated?: (slot: PlannedGenerationSlot) => void;
  }): Promise<GenerateBatchResult['results'][number]> {
    let lastError: Error | null = null;
    let lastRejected: {
      answer: string;
      reason: BatchRejectionReason;
      failureCategory: CaseGenerationFailureCategory;
    } | null = null;

    for (let attempt = 1; attempt <= MAX_BATCH_SLOT_ATTEMPTS; attempt += 1) {
      let generationContextBuilt = false;
      try {
        const difficulty =
          this.normalizeOptionalString(input.options.difficulty) ??
          this.getBalancedBatchDifficulty(input.index, attempt);
        const generationContext = await this.buildGenerationContextForSlot({
          diagnosisRegistryId:
            input.plannerSlot?.diagnosis?.diagnosisRegistryId ?? null,
          registryFirst: input.registryFirst,
        });
        generationContextBuilt = Boolean(generationContext);
        const generationInput = {
          track: input.options.track,
          difficulty,
          batchId: input.batchId,
          sequence: input.index + 1,
          generationContext,
          targetedTeachingUnitIds:
            input.options.targetedCase?.teachingUnitIds,
          targetedMimics: input.options.targetedCase?.mimics,
          clueRevealStrategy: input.options.targetedCase?.clueRevealStrategy,
        };
        const generatedCase =
          input.registryFirst
            ? await this.generateCaseForRegistryTarget({
                target: input.plannerSlot?.diagnosis ?? null,
                generation: generationInput,
              }, {
                tracker: input.failureTracker,
                index: input.index,
                plannerDiagnosis:
                  input.plannerSlot?.diagnosis?.displayLabel ?? null,
              })
            : await this.generateCase(generationInput, {
                tracker: input.failureTracker,
                index: input.index,
                plannerDiagnosis:
                  input.plannerSlot?.diagnosis?.displayLabel ?? null,
              });
        input.qualityState.generated += 1;

        if (input.plannerSlot) {
          const updatedPlannerSlot =
            this.generationPlannerService.compareAnswerToPlannedDiagnosis({
              slot: input.plannerSlot,
              aiAnswer: generatedCase.answer,
            });
          input.plannerSlot = updatedPlannerSlot;
          input.onPlannerSlotUpdated?.(updatedPlannerSlot);
        }

        await this.validateCaseWithRegistry(generatedCase);
        const normalizedCase = this.normalizeCase(generatedCase);
        const quality = this.getGenerationQuality(normalizedCase);
        const qualityScore =
          quality?.qualityScore ?? quality?.critiqueScore ?? null;
        const rejectionReason = this.getBatchRejectionReason({
          generatedCase: normalizedCase,
          quality,
          requestedCount: input.requestedCount,
          options: input.options,
          registryFirst: input.registryFirst,
          qualityState: input.qualityState,
          plannerTarget: input.plannerSlot?.diagnosis ?? null,
        });

        if (rejectionReason) {
          const failureCategory = this.categoryFromBatchRejectionReason(
            rejectionReason,
          );
          input.qualityState.rejected += 1;
          lastRejected = {
            answer: normalizedCase.answer,
            reason: rejectionReason,
            failureCategory,
          };
          this.recordBatchFailure(input.failureTracker, {
            index: input.index,
            answer: normalizedCase.answer,
            plannerDiagnosis: input.plannerSlot?.diagnosis?.displayLabel ?? null,
            category: failureCategory,
            message: rejectionReason,
            attempt,
          });
          this.logBatchRejectedAttempt({
            batchId: input.batchId,
            index: input.index,
            attempt,
            answer: normalizedCase.answer,
            reason: rejectionReason,
            failureCategory,
            failureMessage: rejectionReason,
            qualityScore,
            specialty: quality?.specialty ?? null,
            estimatedDifficulty: quality?.estimatedDifficulty ?? null,
            registryFirst: input.registryFirst,
            plannerDiagnosis: input.plannerSlot?.diagnosis?.displayLabel ?? null,
            generationContextBuilt,
          });
          continue;
        }

        const acceptedKey = this.getBatchAcceptedKey({
          generatedCase: normalizedCase,
          registryFirst: input.registryFirst,
          plannerTarget: input.plannerSlot?.diagnosis ?? null,
        });
        this.recordAcceptedBatchKey({
          state: input.qualityState,
          registryFirst: input.registryFirst,
          key: acceptedKey,
        });
        const savedCase =
          input.registryFirst
            ? await this.saveCaseForRegistryTarget(
                normalizedCase,
                this.getRequiredPlannerTarget(input.plannerSlot),
                {
                  track: input.options.track,
                  difficulty,
                  seenAnswers: undefined,
                },
              )
            : await this.saveCase(normalizedCase, {
                track: input.options.track,
                difficulty,
                seenAnswers: undefined,
              });

        if (!savedCase) {
          const failureCategory: CaseGenerationFailureCategory =
            input.registryFirst ? 'duplicate_scenario' : 'duplicate_answer';
          input.qualityState.rejected += 1;
          this.deleteAcceptedBatchKey({
            state: input.qualityState,
            registryFirst: input.registryFirst,
            key: acceptedKey,
          });
          lastRejected = {
            answer: normalizedCase.answer,
            reason: input.registryFirst
              ? 'duplicate_scenario'
              : 'duplicate_answer',
            failureCategory,
          };
          this.recordBatchFailure(input.failureTracker, {
            index: input.index,
            answer: normalizedCase.answer,
            plannerDiagnosis: input.plannerSlot?.diagnosis?.displayLabel ?? null,
            category: failureCategory,
            message: failureCategory,
            attempt,
          });
          this.logBatchRejectedAttempt({
            batchId: input.batchId,
            index: input.index,
            attempt,
            answer: normalizedCase.answer,
            reason: input.registryFirst
              ? 'duplicate_scenario'
              : 'duplicate_answer',
            failureCategory,
            failureMessage: failureCategory,
            qualityScore,
            specialty: quality?.specialty ?? null,
            estimatedDifficulty: quality?.estimatedDifficulty ?? null,
            registryFirst: input.registryFirst,
            plannerDiagnosis: input.plannerSlot?.diagnosis?.displayLabel ?? null,
            generationContextBuilt,
          });
          continue;
        }

        this.recordAcceptedBatchCase(
          input.qualityState,
          normalizedCase,
          quality,
        );

        this.logger.log(
          JSON.stringify({
            event: 'case.generate.success',
            batchId: input.batchId,
            index: input.index,
            caseId: savedCase.id,
            answer: normalizedCase.answer,
            outcome: 'created',
            qualityScore,
            specialty: quality?.specialty ?? null,
            estimatedDifficulty: quality?.estimatedDifficulty ?? null,
            registryFirst: input.registryFirst,
            plannerDiagnosis: input.plannerSlot?.diagnosis?.displayLabel ?? null,
            generationContextBuilt,
            saveDiagnosisSource:
              input.registryFirst ? 'registry' : 'legacy',
          }),
        );

        return {
          index: input.index,
          status: 'created',
          caseId: savedCase.id,
          answer: normalizedCase.answer,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const failureCategory = this.classifyGenerationFailure(lastError);
        if (!lastError.message.startsWith('Failed to generate')) {
          this.recordBatchFailure(input.failureTracker, {
            index: input.index,
            answer: null,
            plannerDiagnosis:
              input.plannerSlot?.diagnosis?.displayLabel ?? null,
            category: failureCategory,
            message: lastError.message,
            attempt,
          });
        }
        this.logger.error(
          JSON.stringify({
            event: 'case.generate.failed_attempt',
            batchId: input.batchId,
            index: input.index,
            attempt,
            error: lastError.message,
            failureCategory,
            failureMessage: lastError.message,
            registryFirst: input.registryFirst,
            plannerDiagnosis: input.plannerSlot?.diagnosis?.displayLabel ?? null,
            generationContextBuilt,
            rejectionReason: lastError.message,
            saveDiagnosisSource: input.registryFirst ? 'registry' : 'legacy',
          }),
          lastError.stack,
        );
      }
    }

    if (lastRejected) {
      return {
        index: input.index,
        status: 'skipped',
        reason: lastRejected.reason,
        answer: lastRejected.answer,
        failureCategory: lastRejected.failureCategory,
      };
    }

    return {
      index: input.index,
      status: 'failed',
      error: lastError?.message ?? 'Unknown generation error',
      failureCategory: lastError
        ? this.classifyGenerationFailure(lastError)
        : 'unknown',
    };
  }

  private createBatchFailureTracker(): BatchFailureTracker {
    return {
      byCategory: Object.fromEntries(
        CASE_GENERATION_FAILURE_CATEGORIES.map((category) => [category, 0]),
      ) as Record<CaseGenerationFailureCategory, number>,
      samples: [],
    };
  }

  private async buildGenerationContextForSlot(input: {
    diagnosisRegistryId: string | null;
    registryFirst: boolean;
  }): Promise<GenerateCaseInput['generationContext'] | undefined> {
    if (
      !input.registryFirst ||
      !input.diagnosisRegistryId ||
      !this.generationContextBuilder
    ) {
      return undefined;
    }

    try {
      return await this.generationContextBuilder.build({
        diagnosisRegistryId: input.diagnosisRegistryId,
        purpose: 'case',
      });
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'case.generate.generation_context_failed',
          diagnosisRegistryId: input.diagnosisRegistryId,
          generationContextBuilt: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return undefined;
    }
  }

  private recordBatchFailure(
    tracker: BatchFailureTracker,
    sample: CaseGenerationFailureSample,
  ): void {
    tracker.byCategory[sample.category] += 1;

    if (tracker.samples.length >= FAILURE_SAMPLE_LIMIT) {
      return;
    }

    tracker.samples.push({
      ...sample,
      message: sample.message.slice(0, 500),
    });
  }

  private toFailureSummary(
    tracker: BatchFailureTracker,
  ): GenerateBatchResult['failureSummary'] {
    return {
      byCategory: tracker.byCategory,
      samples: tracker.samples,
    };
  }

  private async createPlannerDiagnostics(input: {
    batchId: string;
    options: GenerateBatchOptions;
    requestedDiagnosisRegistryIds: string[];
  }): Promise<PlannedGenerationSlot[]> {
    if (input.requestedDiagnosisRegistryIds.length) {
      return await this.createTargetedPlannerDiagnostics(input);
    }

    try {
      return await this.generationPlannerService.createShadowPlan(input);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'case.generate.planner_unavailable',
          batchId: input.batchId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );

      return Array.from({ length: input.options.count }, (_, index) => ({
        batchId: input.batchId,
        index,
        diagnosis: null,
        duplicatePrevented: false,
        selectionStatus: 'unavailable' as const,
        repeatReason: null,
        existingCaseCount: null,
        recentUsePenaltyApplied: false,
        diagnostics: {
          candidateCount: 0,
          unusedCandidateCount: 0,
          repeatedCandidateCount: 0,
          selectedUnusedCount: 0,
          selectedRepeatCount: 0,
          repeatReason: null,
          existingCaseCountByDiagnosis: {},
          recentUsePenaltyApplied: false,
        },
      }));
    }
  }

  private async createTargetedPlannerDiagnostics(input: {
    batchId: string;
    options: GenerateBatchOptions;
    requestedDiagnosisRegistryIds: string[];
  }): Promise<PlannedGenerationSlot[]> {
    const targets = await this.resolveTargetedDiagnoses(
      input.requestedDiagnosisRegistryIds,
    );
    const count = Math.max(0, Math.trunc(input.options.count));
    const existingCaseCountByDiagnosis = Object.fromEntries(
      targets.map((target) => [
        target.diagnosisRegistryId,
        target.existingCaseCount,
      ]),
    );

    return Array.from({ length: count }, (_value, index) => {
      const diagnosis = targets[index % targets.length] ?? null;

      return {
        batchId: input.batchId,
        index,
        diagnosis,
        duplicatePrevented: false,
        selectionStatus: diagnosis ? ('selected' as const) : ('unavailable' as const),
        repeatReason:
          index >= targets.length ? 'targeted_diagnoses_reused' : null,
        existingCaseCount: diagnosis?.existingCaseCount ?? null,
        recentUsePenaltyApplied: diagnosis?.recentUsePenaltyApplied ?? false,
        diagnostics: {
          candidateCount: targets.length,
          unusedCandidateCount: targets.filter(
            (target) => target.existingCaseCount === 0,
          ).length,
          repeatedCandidateCount: targets.filter(
            (target) => target.existingCaseCount > 0,
          ).length,
          selectedUnusedCount: targets.filter(
            (target) => target.existingCaseCount === 0,
          ).length,
          selectedRepeatCount: targets.filter(
            (target) => target.existingCaseCount > 0,
          ).length,
          repeatReason:
            count > targets.length ? 'targeted_diagnoses_reused' : null,
          existingCaseCountByDiagnosis,
          recentUsePenaltyApplied: targets.some(
            (target) => target.recentUsePenaltyApplied,
          ),
        },
      };
    });
  }

  private async resolveTargetedDiagnoses(
    diagnosisRegistryIds: string[],
  ): Promise<NonNullable<PlannedGenerationSlot['diagnosis']>[]> {
    if (!diagnosisRegistryIds.length) {
      return [];
    }

    const rows = await this.prisma.diagnosisRegistry.findMany({
      where: {
        id: { in: diagnosisRegistryIds },
        active: true,
        status: DiagnosisRegistryStatus.ACTIVE,
      },
      select: {
        id: true,
        legacyDiagnosisId: true,
        displayLabel: true,
        canonicalName: true,
        specialty: true,
        category: true,
        bodySystem: true,
        difficultyBand: true,
        _count: {
          select: {
            cases: true,
          },
        },
        cases: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { date: true },
        },
        aliases: {
          where: {
            active: true,
            acceptedForMatch: true,
          },
          select: { term: true },
          orderBy: [{ rank: 'asc' }, { term: 'asc' }],
        },
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const missingIds = diagnosisRegistryIds.filter((id) => !byId.has(id));
    if (missingIds.length) {
      throw new BadRequestException(
        `Diagnosis registry IDs are not active or do not exist: ${missingIds.join(', ')}`,
      );
    }

    const now = Date.now();
    return diagnosisRegistryIds.map((id) => {
      const row = byId.get(id)!;
      const lastGeneratedAt = row.cases[0]?.date ?? null;

      return {
        diagnosisRegistryId: row.id,
        legacyDiagnosisId: row.legacyDiagnosisId,
        displayLabel: row.displayLabel,
        canonicalName: row.canonicalName,
        acceptedAliases: row.aliases.map((alias) => alias.term),
        specialty: row.specialty,
        category: row.category,
        bodySystem: row.bodySystem,
        difficultyBand: row.difficultyBand,
        existingCaseCount: row._count.cases,
        lastGeneratedAt,
        recentUsePenaltyApplied: lastGeneratedAt
          ? now - lastGeneratedAt.getTime() <= 30 * 24 * 60 * 60 * 1000
          : false,
      };
    });
  }

  private async requestGeneratedCase(
    input: GenerateCaseInput,
    attempt: number,
  ): Promise<GeneratedCase> {
    const prompt = this.buildPrompt(input, attempt);
    const completion = await this.openaiClient!.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: zodResponseFormat(generatedCaseSchema, 'generated_case'),
    });

    const content = completion.choices[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new BadRequestException('OpenAI returned an empty case payload');
    }

    return this.parseGeneratedCase(content);
  }

  private async requestGeneratedCaseForRegistryTarget(input: {
    input: GenerateCaseInput;
    target: NonNullable<PlannedGenerationSlot['diagnosis']>;
    attempt: number;
  }): Promise<GeneratedCase> {
    const prompt = this.buildRegistryTargetPrompt(
      input.input,
      input.target,
      input.attempt,
    );
    const completion = await this.openaiClient!.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: this.buildRegistryTargetSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: zodResponseFormat(
        registryTargetGeneratedCaseResponseSchema,
        'registry_target_generated_case',
      ),
    });

    const content = completion.choices[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new BadRequestException('OpenAI returned an empty case payload');
    }

    return this.parseGeneratedCaseForRegistryTarget(content, input.target);
  }

  private buildPrompt(input: GenerateCaseInput, attempt = 1): string {
    const track = this.normalizeOptionalString(input.track);
    const difficulty = this.normalizeDifficulty(input.difficulty);
    const sequenceLabel =
      typeof input.sequence === 'number'
        ? `Case ${input.sequence}.`
        : undefined;
    const teachingSection = this.buildConceptGuidedCaseSection(input);

    return [
      sequenceLabel,
      attempt > 1
        ? `Regeneration attempt ${attempt}: correct prior quality failures by producing a fresh case. Previous attempt likely failed because differentials were not true competing diagnoses; replace mechanisms/subtypes with realistic competing diagnoses.`
        : undefined,
      'Generate one clinically consistent USMLE-style diagnostic case using differential-first reasoning.',
      '',
      'Required reasoning plan before writing JSON:',
      'Step 1: define the correct diagnosis.',
      'Step 2: define 3-5 plausible differentials that are true competing diagnoses from clues 0-2.',
      'Step 3: generate exactly 6 clues that progressively eliminate differentials.',
      'Step 4: generate an explanation that includes why the correct diagnosis fits and why the differentials are less likely.',
      '',
      'Clue ladder:',
      '0 = broad presentation',
      '1 = directional clue',
      '2 = discriminator',
      '3 = narrowing clue',
      '4 = near-diagnostic clue',
      '5 = confirmatory clue',
      teachingSection,
      '',
      'Return JSON ONLY with this exact shape:',
      '{',
      '"clues": [',
      '{"type": "history|symptom|vital|lab|exam|imaging", "value": "...", "order": 0}',
      '],',
      '"answer": "...",',
      '"differentials": [...],',
      '"explanation": {',
      '"diagnosis": "...",',
      '"summary": "...",',
      '"reasoning": [...],',
      '"keyFindings": [...],',
      '"differentialAnalysis": [',
      '{"diagnosis": "...", "whyPlausibleEarly": "...", "ruledOutByClues": [{"clueOrder": 2, "evidence": "...", "reason": "..."}], "finalReasonLessLikely": "..."}',
      ']',
      '}',
      '}',
      '',
      'Constraints:',
      '',
      '* clinically accurate',
      `* ${difficulty} difficulty`,
      '* exactly 6 clues with orders 0 through 5',
      '* 3-5 plausible differentials',
      '* a valid differential is a true competing diagnosis a clinician would consider from clues 0-2',
      '* each differential must fit age, sex, timeline, acuity, and setting',
      '* do not include sex-specific differentials unless compatible with the patient sex and anatomy',
      '* do not include ovarian, uterine, pregnancy-related, or gynecologic diagnoses for male patients',
      '* do not include prostate or testicular diagnoses for female patients',
      '* if sex is unspecified or relevant anatomy is unclear, avoid sex-specific differentials unless the case explicitly supports them',
      '* age-specific differentials must be plausible for the stated age group',
      '* each differential must share early features with the final diagnosis and be separable by later clues',
      '* differentials must not be a subtype, cause/mechanism, complication, severity label, synonym, accepted alias, or broad semantic neighbor',
      '* differentials must not be ruled out immediately by demographics or by clue 0 unless intentionally used as a weak distractor',
      '* differentials must teach a useful distinction and remain meaningful until later clues',
      '* invalid differential example: Acute Kidney Injury with Prerenal Azotemia as a competing differential',
      '* invalid differential example: Asthma with Asthma Exacerbation',
      '* invalid differential example: pediatric asthma with COPD unless strong rare-context evidence exists',
      '* invalid differential example: male appendicitis with ovarian torsion or ectopic pregnancy',
      '* valid differential example: pneumonia with pulmonary embolism when early dyspnea/hypoxia/tachycardia exists and later consolidation separates them',
      '* valid differential example: asthma with vocal cord dysfunction when early exercise-related dyspnea/wheeze exists and spirometry/bronchodilator response separates them',
      '* appendicitis competitors: gastroenteritis, renal colic, mesenteric adenitis, right-sided diverticulitis, Crohn disease; ovarian torsion only if female; ectopic pregnancy only if reproductive-age female; testicular torsion only if male with scrotal/groin symptoms',
      '* heart failure competitors: pneumonia, COPD exacerbation, pulmonary embolism, acute coronary syndrome, renal failure/fluid overload',
      '* type 2 diabetes mellitus competitors: type 1 diabetes mellitus, Cushing syndrome, steroid-induced hyperglycemia, metabolic syndrome; hyperthyroidism only if weight loss/tachycardia prominent; diabetes insipidus only if polyuria/polydipsia dominate without hyperglycemia',
      '* pneumonia competitors: acute bronchitis, pulmonary embolism, heart failure, COPD exacerbation; tuberculosis only when chronicity supports it; lung abscess only if cavitation, foul sputum, or aspiration risk supports it',
      '* for broad syndrome diagnoses, choose competing diagnoses that mimic the syndrome, not etiologic subtypes of that syndrome',
      '* if etiologic discrimination is desired, the final answer should be the etiologic subtype, e.g. Prerenal AKI, not generic Acute Kidney Injury',
      '* each clue introduces new information',
      '* clues become stronger from broad to confirmatory',
      '* clues 0-4 must not name or abbreviate the final diagnosis or its common aliases',
      '* every lab clue must include at least one realistic numeric value with units or a clearly interpretable objective result; write BNP is 1,250 pg/mL, not BNP is elevated',
      '* every vital clue must include realistic vital sign values; write BP is 88/54 mmHg, HR 124/min, RR 28/min, not vitals are unstable',
      '* every imaging clue must include a specific objective finding; write chest X-ray shows bilateral perihilar opacities and small pleural effusions, not chest X-ray is abnormal',
      '* maintain age, sex, timeline, vitals, labs, and imaging consistency',
      '* no duplicate clues',
      '* no fluff',
      '* differentialAnalysis is for Wardle future clinical knowledge graph',
      '* differentialAnalysis must encode differential-vs-evidence relationships',
      '* for each differential, explain why it was plausible from early clues, which exact clue evidence weakened or ruled it out, and why the final diagnosis fits better',
      '* every rule-out must be grounded in a specific clue and quote or tightly paraphrase that clue evidence',
      track ? `* specialty focus: ${track}` : undefined,
      '',
      'Use concise, concrete clinical details. Do not include extra JSON keys.',
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n');
  }

  private buildRegistryTargetPrompt(
    input: GenerateCaseInput,
    target: NonNullable<PlannedGenerationSlot['diagnosis']>,
    attempt = 1,
  ): string {
    const difficulty = this.normalizeDifficulty(input.difficulty);
    const sequenceLabel =
      typeof input.sequence === 'number'
        ? `Case ${input.sequence}.`
        : undefined;
    const aliases =
      target.acceptedAliases.length > 0
        ? target.acceptedAliases.join(', ')
        : 'none';
    const teachingSection = this.buildConceptGuidedCaseSection(input);

    return [
      sequenceLabel,
      attempt > 1
        ? `Regeneration attempt ${attempt}: correct prior fidelity or quality failures while keeping the same fixed diagnosis. Previous attempt likely failed because differentials were not true competing diagnoses; replace mechanisms/subtypes with realistic competing diagnoses.`
        : undefined,
      'Generate one clinically consistent USMLE-style diagnostic case for a fixed final diagnosis.',
      '',
      'The final diagnosis is fixed:',
      `* diagnosisRegistryId: ${target.diagnosisRegistryId}`,
      `* displayLabel: ${target.displayLabel}`,
      `* canonicalName: ${target.canonicalName}`,
      `* accepted aliases: ${aliases}`,
      `* specialty: ${target.specialty ?? 'unspecified'}`,
      `* bodySystem: ${target.bodySystem ?? 'unspecified'}`,
      `* category: ${target.category ?? 'unspecified'}`,
      '',
      'Rules:',
      '* Do not replace the diagnosis.',
      '* Do not broaden or narrow the diagnosis.',
      '* Do not invent a more descriptive final answer.',
      '* Do not include the final diagnosis, canonical name, or accepted aliases in differentials.',
      '* Differentials must be true competing diagnoses, not subtypes, causes/mechanisms, complications, severity labels, synonyms, aliases, or broad semantic neighbors.',
      '* Do not name or abbreviate the final diagnosis or aliases in clues 0 through 4.',
      '* If lab, imaging, or vitals clues are used, include concrete objective values or findings.',
      '* Return clinical content for the fixed diagnosis only.',
      '',
      'Required reasoning plan before writing JSON:',
      'Step 1: use the fixed diagnosis as the answer.',
      'Step 2: define 3-5 plausible differentials that are true competing diagnoses from clues 0-2 and are not the fixed diagnosis or aliases.',
      'Step 3: generate exactly 6 clues that progressively eliminate differentials.',
      'Step 4: generate an explanation that names the fixed diagnosis and distinguishes it from the differentials.',
      '',
      'Clue ladder:',
      '0 = broad presentation',
      '1 = directional clue',
      '2 = discriminator',
      '3 = narrowing clue',
      '4 = near-diagnostic clue',
      '5 = confirmatory clue',
      teachingSection,
      '',
      'Return JSON ONLY with this exact shape. The answer field may be null for compatibility; if set, it must match the fixed diagnosis or an accepted alias:',
      '{',
      '"clues": [',
      '{"type": "history|symptom|vital|lab|exam|imaging", "value": "...", "order": 0}',
      '],',
      '"answer": "...",',
      '"differentials": [...],',
      '"explanation": {',
      '"diagnosis": "...",',
      '"summary": "...",',
      '"reasoning": [...],',
      '"keyFindings": [...],',
      '"differentialAnalysis": [',
      '{"diagnosis": "...", "whyPlausibleEarly": "...", "ruledOutByClues": [{"clueOrder": 2, "evidence": "...", "reason": "..."}], "finalReasonLessLikely": "..."}',
      ']',
      '}',
      '}',
      '',
      'Constraints:',
      '',
      '* clinically accurate',
      `* ${difficulty} difficulty`,
      '* exactly 6 clues with orders 0 through 5',
      '* 3-5 plausible differentials',
      '* a valid differential is a true competing diagnosis a clinician would consider from clues 0-2',
      '* each differential must fit age, sex, timeline, acuity, and setting',
      '* do not include sex-specific differentials unless compatible with the patient sex and anatomy',
      '* do not include ovarian, uterine, pregnancy-related, or gynecologic diagnoses for male patients',
      '* do not include prostate or testicular diagnoses for female patients',
      '* if sex is unspecified or relevant anatomy is unclear, avoid sex-specific differentials unless the case explicitly supports them',
      '* age-specific differentials must be plausible for the stated age group',
      '* each differential must share early features with the fixed final diagnosis and be separable by later clues',
      '* differentials must not be a subtype, cause/mechanism, complication, severity label, synonym, accepted alias, or broad semantic neighbor',
      '* differentials must not be ruled out immediately by demographics or by clue 0 unless intentionally used as a weak distractor',
      '* differentials must teach a useful distinction and remain meaningful until later clues',
      '* invalid differential example: Acute Kidney Injury with Prerenal Azotemia as a competing differential',
      '* invalid differential example: Asthma with Asthma Exacerbation',
      '* invalid differential example: pediatric asthma with COPD unless strong rare-context evidence exists',
      '* invalid differential example: male appendicitis with ovarian torsion or ectopic pregnancy',
      '* valid differential example: pneumonia with pulmonary embolism when early dyspnea/hypoxia/tachycardia exists and later consolidation separates them',
      '* valid differential example: asthma with vocal cord dysfunction when early exercise-related dyspnea/wheeze exists and spirometry/bronchodilator response separates them',
      '* appendicitis competitors: gastroenteritis, renal colic, mesenteric adenitis, right-sided diverticulitis, Crohn disease; ovarian torsion only if female; ectopic pregnancy only if reproductive-age female; testicular torsion only if male with scrotal/groin symptoms',
      '* heart failure competitors: pneumonia, COPD exacerbation, pulmonary embolism, acute coronary syndrome, renal failure/fluid overload',
      '* type 2 diabetes mellitus competitors: type 1 diabetes mellitus, Cushing syndrome, steroid-induced hyperglycemia, metabolic syndrome; hyperthyroidism only if weight loss/tachycardia prominent; diabetes insipidus only if polyuria/polydipsia dominate without hyperglycemia',
      '* pneumonia competitors: acute bronchitis, pulmonary embolism, heart failure, COPD exacerbation; tuberculosis only when chronicity supports it; lung abscess only if cavitation, foul sputum, or aspiration risk supports it',
      '* for broad syndrome diagnoses, choose competing diagnoses that mimic the syndrome, not etiologic subtypes of that syndrome',
      '* if etiologic discrimination is desired, the final answer should be the etiologic subtype, e.g. Prerenal AKI, not generic Acute Kidney Injury',
      '* each clue introduces new information',
      '* clues become stronger from broad to confirmatory',
      '* every lab clue must include at least one realistic numeric value with units or a clearly interpretable objective result; write BNP is 1,250 pg/mL, not BNP is elevated',
      '* every vital clue must include realistic vital sign values; write BP is 88/54 mmHg, HR 124/min, RR 28/min, not vitals are unstable',
      '* every imaging clue must include a specific objective finding; write chest X-ray shows bilateral perihilar opacities and small pleural effusions, not chest X-ray is abnormal',
      '* maintain age, sex, timeline, vitals, labs, and imaging consistency',
      '* no duplicate clues',
      '* no fluff',
      '* differentialAnalysis is for Wardle future clinical knowledge graph',
      '* differentialAnalysis must encode differential-vs-evidence relationships',
      '* for each differential, explain why it was plausible from early clues, which exact clue evidence weakened or ruled it out, and why the fixed final diagnosis fits better',
      '* every rule-out must be grounded in a specific clue and quote or tightly paraphrase that clue evidence',
      '',
      'Use concise, concrete clinical details. Do not include extra JSON keys.',
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n');
  }

  private buildConceptGuidedCaseSection(input: GenerateCaseInput): string | undefined {
    const context = input.generationContext;
    if (!context?.requiredTeachingUnits?.length) {
      return undefined;
    }

    const difficulty =
      context.difficultyStrategy?.targetDifficulty ??
      this.normalizeDifficulty(input.difficulty);
    const selectedUnits = this.selectCaseTeachingUnits({
      units: context.requiredTeachingUnits,
      difficulty,
      requestedTeachingUnitIds: input.targetedTeachingUnitIds,
    });
    const revealCoreUnitByClue =
      context.difficultyStrategy?.revealCoreUnitByClue ??
      (difficulty === 'hard' ? 4 : difficulty === 'easy' ? 2 : 3);
    const unitLines = selectedUnits.map((unit) => {
      const manifestations = unit.acceptableManifestations.slice(0, 4).join(' | ');
      return `* ${unit.id}: ${unit.label}. Choose one manifestation, such as: ${manifestations}. Rationale: ${unit.rationale}`;
    });
    const avoidTooEarly = context.difficultyStrategy?.avoidTooEarly ?? [];
    const keepAlive = input.targetedMimics?.length
      ? input.targetedMimics.map((mimic) => mimic.diagnosis)
      : context.difficultyGuidance?.keepAliveDifferentials ?? [];
    const revealStrategy = this.clueRevealStrategyInstruction(
      input.clueRevealStrategy,
    );

    return [
      '',
      'Concept-guided generation:',
      '* Use teaching units as concepts, not fixed clue text.',
      input.targetedTeachingUnitIds?.length
        ? '* Use the editor-selected teaching units below as required concepts for this case.'
        : '* Select 2-4 teaching units for this case; do not include every diagnosis-level teaching unit.',
      '* For each selected unit, use one clinically valid manifestation or an equivalent alternative.',
      '* Convert teaching units into constraints: required manifestations, discriminators, mimic persistence, investigations, exam findings, or management anchors as clinically appropriate.',
      `* For ${difficulty} difficulty, avoid giveaway manifestations until clue ${revealCoreUnitByClue} or later.`,
      '* Keep 1-2 plausible mimics alive until the middle clues when possible.',
      revealStrategy ? `* Reveal strategy: ${revealStrategy}` : undefined,
      keepAlive.length
        ? `* Preferred mimics to keep plausible early: ${keepAlive.slice(0, 4).join(', ')}.`
        : undefined,
      avoidTooEarly.length
        ? `* Avoid too early: ${avoidTooEarly.slice(0, 6).join('; ')}.`
        : undefined,
      'Selected teaching units for this case:',
      ...unitLines,
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n');
  }

  private selectCaseTeachingUnits(input: {
    units: NonNullable<GenerateCaseInput['generationContext']>['requiredTeachingUnits'];
    difficulty: 'easy' | 'medium' | 'hard';
    requestedTeachingUnitIds?: string[];
  }) {
    const targetCount =
      input.difficulty === 'hard' ? 2 : input.difficulty === 'easy' ? 4 : 3;
    const caseUnits = input.units.filter((unit) => unit.appliesToCaseGeneration);
    const requestedIds = new Set(input.requestedTeachingUnitIds ?? []);
    const requested = caseUnits.filter((unit) => requestedIds.has(unit.id));
    if (requested.length) {
      return requested.slice(0, 6);
    }

    const critical = caseUnits.filter((unit) => unit.importance === 'critical');
    const remaining = caseUnits.filter((unit) => unit.importance !== 'critical');

    return [...critical, ...remaining].slice(0, targetCount);
  }

  private clueRevealStrategyInstruction(
    strategy: GenerateCaseInput['clueRevealStrategy'],
  ): string | undefined {
    if (strategy === 'early_anchor') {
      return 'give a broad syndromic anchor in clues 0-1 while preserving mimics, then separate with later evidence.';
    }
    if (strategy === 'late_discriminator') {
      return 'delay the decisive discriminator until clues 3-4 and keep early clues compatible with selected mimics.';
    }
    if (strategy === 'progressive_narrowing') {
      return 'narrow stepwise from broad syndrome to organ system to discriminator to confirmation.';
    }
    if (strategy === 'classic') {
      return 'use the standard broad, directional, discriminator, narrowing, near-diagnostic, confirmatory ladder.';
    }

    return undefined;
  }

  private buildCaseTeachingAlignmentReport(
    input: GenerateCaseInput,
    generatedCase: GeneratedCase,
  ): CaseTeachingAlignmentReport | undefined {
    const context = input.generationContext;
    if (!context?.requiredTeachingUnits?.length) {
      return undefined;
    }

    const difficulty =
      context.difficultyStrategy?.targetDifficulty ??
      this.normalizeDifficulty(input.difficulty);
    const selectedUnits = this.selectCaseTeachingUnits({
      units: context.requiredTeachingUnits,
      difficulty,
      requestedTeachingUnitIds: input.targetedTeachingUnitIds,
    });
    const report = this.caseTeachingAlignmentService.buildReport({
      caseData: generatedCase,
      diagnosisRegistryId: context.diagnosis.id,
      generationContext: context,
      selectedTeachingUnits: selectedUnits,
    });
    const coveredCount = report.selectedUnits.filter((unit) => unit.covered).length;

    this.logger.log(
      JSON.stringify({
        event: 'case.generate.teaching_alignment.completed',
        answer: generatedCase.answer,
        diagnosisRegistryId: context.diagnosis.id,
        difficulty,
        selectedTeachingUnitIds: selectedUnits.map((unit) => unit.id),
        coveredCount,
        selectedCount: selectedUnits.length,
        playabilityScore: report.playability.score,
        difficultyFit: report.playability.difficultyFit,
        warnings: report.warnings,
      }),
    );

    return report;
  }

  private buildSystemPrompt(): string {
    return [
      'You generate clinically accurate USMLE-style diagnostic training cases.',
      'Use differential-first reasoning internally, then return valid JSON only.',
      'The JSON must match the requested schema exactly and must not include markdown or extra keys.',
      'Every case must have exactly 6 clues ordered 0 through 5 as a progressive diagnostic ladder: broad, directional, discriminator, narrowing, near-diagnostic, confirmatory.',
      'Define 3-5 plausible differentials before choosing clue details.',
      'Each clue must add new clinical information and progressively reduce the differential.',
      'Do not name or abbreviate the final diagnosis in clues 0 through 4.',
      'Use realistic labs, imaging, vitals, exam findings, timelines, and units where appropriate.',
      'Keep the case internally consistent and make the explanation address why the final diagnosis fits and why differentials are less likely.',
      'Do not only list differentials; explain why each differential loses against the final diagnosis using specific clue evidence.',
      'Rule-out reasoning must use specific clue evidence and avoid generic teaching prose.',
    ].join('\n');
  }

  private buildRegistryTargetSystemPrompt(): string {
    return [
      'You generate clinically accurate USMLE-style diagnostic training cases for a fixed final diagnosis.',
      'Use differential-first reasoning internally, but never choose, rename, broaden, narrow, or replace the provided diagnosis.',
      'Return valid JSON only. The JSON must match the requested schema exactly and must not include markdown or extra keys.',
      'Every case must have exactly 6 clues ordered 0 through 5 as a progressive diagnostic ladder: broad, directional, discriminator, narrowing, near-diagnostic, confirmatory.',
      'Do not include the fixed diagnosis, canonical name, or accepted aliases in the differential list.',
      'Do not name or abbreviate the fixed diagnosis in clues 0 through 4.',
      'Use realistic labs, imaging, vitals, exam findings, timelines, and units where appropriate.',
      'Do not only list differentials; explain why each differential loses against the fixed final diagnosis using specific clue evidence.',
      'Rule-out reasoning must use specific clue evidence and avoid generic teaching prose.',
    ].join('\n');
  }

  private buildDifferentialPreflightSystemPrompt(): string {
    return [
      'You are a strict clinical reviewer for differential diagnosis selection in generated Wardle cases.',
      'Return valid JSON only.',
      'Assess only the proposed differential list before the full case critique.',
      'For each differential, decide whether it is a genuine competing diagnosis for the final answer.',
      'A valid differential must be clinically plausible from clues 0-2, fit the patient age, sex, timeline, acuity, and setting, share key early features with the final diagnosis, and be separable by clues 3-5.',
      'Reject sex-specific differentials that are incompatible with the stated patient sex or anatomy. Ovarian, uterine, pregnancy-related, and gynecologic diagnoses are invalid for male patients. Prostate and testicular diagnoses are invalid for female patients. If sex or relevant anatomy is unclear, sex-specific differentials should be weak or invalid unless explicitly supported.',
      'Reject age-specific differentials that are implausible for the stated age group.',
      'Reject differentials that are ruled out immediately by demographics or clue 0 unless the case explicitly frames them as weak distractors.',
      'Reject items that are a subtype, cause/mechanism, complication, severity label, synonym/alias, or merely broadly related to the final diagnosis.',
      'Use the registry target metadata and accepted aliases when provided.',
      'Hard examples: male appendicitis plus ovarian torsion or ectopic pregnancy is invalid; female abdominal pain plus ovarian torsion can be valid when reproductive anatomy/sex is compatible; 25-year-old asthma plus COPD is invalid or weak unless strong smoking, alpha-1, or chronic history supports it; 12-year-old asthma plus COPD is invalid; AKI plus prerenal azotemia as a competing differential is invalid cause/mechanism/subtype; asthma plus asthma exacerbation is invalid subtype/severity label; pneumonia plus pulmonary embolism is valid if acute dyspnea, hypoxia, or tachycardia appears early and later clues separate it; COPD in an older smoker with chronic exertional dyspnea is valid.',
      'Diagnosis-specific competitors: appendicitis should prefer gastroenteritis, renal colic, mesenteric adenitis, right-sided diverticulitis, Crohn disease, and sex-compatible torsion/pregnancy mimics; heart failure should prefer pneumonia, COPD exacerbation, pulmonary embolism, acute coronary syndrome, renal failure/fluid overload; type 2 diabetes should prefer type 1 diabetes, Cushing syndrome, steroid-induced hyperglycemia, metabolic syndrome, and only context-supported hyperthyroidism or diabetes insipidus; pneumonia should prefer acute bronchitis, pulmonary embolism, heart failure, COPD exacerbation, chronicity-supported tuberculosis, or context-supported lung abscess.',
      'Score from 0 to 100. Pass only if all differentials are acceptable competing diagnoses and the list is ready for the full case critique.',
      'Each assessment must classify category as one of: competing_diagnosis, subtype, cause_mechanism, complication, severity_label, synonym_or_alias, broadly_related_only.',
      'Each assessment verdict must be valid, weak, or invalid.',
      'Each assessment issue must be a concise string when there is a problem, otherwise null.',
      'Use empty issues and recommendations arrays when none.',
    ].join('\n');
  }

  private buildCritiqueSystemPrompt(): string {
    return [
      'You are a strict clinical education reviewer for generated diagnostic cases.',
      'Return valid JSON only.',
      'Pass only cases that are clinically consistent, have exactly 6 progressive clues, include 3-5 plausible differentials, avoid answer leakage before the confirmatory clue, and have realistic labs/imaging when present.',
      'Score from 0 to 100. A case should pass only when it is ready to save as a draft for editorial review.',
      'Provide clinicalAccuracyScore, clueProgressionScore, differentialQualityScore, differentialRuleOutScore, differentialPlausibilityScore, differentialDiscriminationScore, clinicalEdgeValidityScore, educationalValueScore, graphConsistencyScore, and ambiguitySuitabilityScore from 0 to 100.',
      'Return invalidReasoningEdges as an array. Each item must include differential, clueOrder, evidence, claimedEffect ("weakens" or "rules_out"), verdict ("valid", "weak_or_neutral", "backwards", or "unsupported"), and issue.',
      'Assess differential plausibility using age, sex, epidemiology, acuity, timeline, and presenting syndrome. Penalize unrealistic mimics such as COPD in a 12-year-old asthma case.',
      'Detect hierarchy and mechanism errors. Penalize parent/subtype/mechanism entries listed as competing differentials, such as AKI versus prerenal azotemia, asthma versus asthma exacerbation, or a mechanism instead of a diagnosis.',
      'Critique differentialAnalysis strictly: can each differential actually be ruled out using the supplied clues, does every differential have a specific clue-grounded reason, and are the rule-outs clinically valid?',
      'Verify that cited evidence medically weakens the differential, not merely that the evidence is copied from a clue. Penalize copied but medically invalid rule-out evidence.',
      'For every differentialAnalysis.ruledOutByClues entry, decide whether the evidence genuinely decreases the probability of that differential, is neutral or weak, is unsupported by the case, or is clinically backwards.',
      'Ask whether a consultant physician would accept each reasoning edge, and whether the cited clue is the best available discriminator or a weaker/irrelevant clue when a better discriminator exists.',
      'Hard fail if any reasoning edge is backwards or unsupported, if cited evidence actually supports the differential, or if more than one edge is weak_or_neutral.',
      'Examples: hypoxia weakening pulmonary embolism is backwards; bronchodilator reversibility weakening asthma is backwards; lobar consolidation weakening pulmonary embolism is valid; bronchodilator response weakening vocal cord dysfunction is valid; normal renal ultrasound ruling out prerenal azotemia is backwards or unsupported; concentrated urine plus low urine sodium weakening ATN is valid.',
      'Penalize cases that are effectively solved before clue 4 unless the requested difficulty is clearly easy and the remaining clues still teach discriminators.',
      'Penalize explanations that only restate clue text. Reward explanations that teach discriminators between the final diagnosis and each differential.',
      'Assess graphConsistencyScore by asking whether differentialAnalysis would create clinically valid graph edges between diagnoses, findings, investigations, and rule-out evidence.',
      'Fail if differentialAnalysis is missing, any differential is unmatched, any rule-out is not grounded in a clue, rule-out evidence is hallucinated, or the explanation says a differential is ruled out without enough case evidence.',
      'Fail generic, invented, or unsupported rule-out reasoning.',
      'List concrete issues and recommendations. Use empty arrays when none.',
    ].join('\n');
  }

  private parseGeneratedCase(rawContent: string): GeneratedCase {
    const sanitized = rawContent
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');

    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitized);
    } catch (error) {
      throw new BadRequestException(
        `Failed to parse generated case JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return generatedCaseSchema.parse(parsed);
  }

  private parseGeneratedCaseForRegistryTarget(
    rawContent: string,
    target: NonNullable<PlannedGenerationSlot['diagnosis']>,
  ): GeneratedCase {
    const sanitized = rawContent
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');

    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitized);
    } catch (error) {
      throw new BadRequestException(
        `Failed to parse generated case JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const generatedCase = registryTargetGeneratedCaseParseSchema.parse(parsed);
    if (
      generatedCase.answer &&
      !this.matchesRegistryTargetTerm(generatedCase.answer, target)
    ) {
      throw new BadRequestException(
        `Generated case answer "${generatedCase.answer}" does not match fixed diagnosis "${target.displayLabel}"`,
      );
    }

    return {
      ...generatedCase,
      answer: generatedCase.answer ?? target.displayLabel,
    };
  }

  private parseCritique(rawContent: string): CaseGenerationCritique {
    const sanitized = rawContent
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');

    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitized);
    } catch (error) {
      throw new BadRequestException(
        `Failed to parse generated case critique JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return caseGenerationCritiqueSchema.parse(parsed);
  }

  private parseDifferentialPreflight(
    rawContent: string,
  ): DifferentialPreflightCritique {
    const sanitized = rawContent
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');

    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitized);
    } catch (error) {
      throw new BadRequestException(
        `Failed to parse differential preflight critique JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return differentialPreflightCritiqueSchema.parse(parsed);
  }

  private assertPassingDifferentialPreflight(
    critique: DifferentialPreflightCritique,
  ): void {
    const invalidDifferentials = critique.assessments.filter(
      (assessment) =>
        assessment.verdict === 'invalid' ||
        assessment.category !== 'competing_diagnosis' ||
        !assessment.plausibleFromClues0To2 ||
        !assessment.fitsDemographics ||
        !assessment.fitsTimelineAcuitySetting ||
        !assessment.separableByLaterClues,
    );
    const weakAssessmentCount = critique.assessments.filter(
      (assessment) => assessment.verdict === 'weak',
    ).length;

    if (
      critique.passed &&
      critique.score >= MIN_DIFFERENTIAL_PREFLIGHT_SCORE &&
      critique.issues.length === 0 &&
      invalidDifferentials.length === 0 &&
      weakAssessmentCount <= MAX_WEAK_DIFFERENTIAL_PREFLIGHT_ASSESSMENTS
    ) {
      return;
    }

    const issueSummary = [
      ...critique.issues,
      ...invalidDifferentials.map((assessment) =>
        [
          assessment.diagnosis,
          assessment.issue ??
            `classified as ${assessment.category} with ${assessment.verdict} verdict`,
        ].join(': '),
      ),
      ...(weakAssessmentCount > MAX_WEAK_DIFFERENTIAL_PREFLIGHT_ASSESSMENTS
        ? [`Too many weak differentials: ${weakAssessmentCount}`]
        : []),
    ]
      .filter((issue) => issue.trim().length > 0)
      .slice(0, 5);

    throw new BadRequestException(
      `Generated case failed differential preflight: ${
        issueSummary.length > 0 ? issueSummary.join('; ') : 'quality gate failed'
      }`,
    );
  }

  private logDifferentialPreflightFailed(
    generatedCase: GeneratedCase,
    critique: DifferentialPreflightCritique,
  ): void {
    const failureCategory: CaseGenerationFailureCategory =
      'differential_preflight';
    this.logger.warn(
      JSON.stringify({
        event: 'case.generate.differential_preflight_failed',
        answer: generatedCase.answer,
        patientSex: this.inferPatientSex(generatedCase),
        patientAge: this.inferPatientAge(generatedCase),
        score: critique.score,
        issues: critique.issues,
        failureCategory,
        failureMessage:
          critique.issues[0] ?? 'Generated case failed differential preflight',
        invalidDifferentials: critique.assessments
          .filter(
            (assessment) =>
              assessment.verdict === 'invalid' ||
              assessment.category !== 'competing_diagnosis' ||
              !assessment.plausibleFromClues0To2 ||
              !assessment.fitsDemographics ||
              !assessment.fitsTimelineAcuitySetting ||
              !assessment.separableByLaterClues,
          )
          .map((assessment) => ({
            diagnosis: assessment.diagnosis,
            category: assessment.category,
            verdict: assessment.verdict,
            issue: assessment.issue ?? null,
          })),
      }),
    );
  }

  private isPassingCritique(critique: CaseGenerationCritique): boolean {
    const componentScores = this.getAvailableCritiqueComponentScores(critique);
    const weakOrNeutralEdgeCount = critique.invalidReasoningEdges.filter(
      (edge) => edge.verdict === 'weak_or_neutral',
    ).length;
    const hasHardInvalidEdge = critique.invalidReasoningEdges.some(
      (edge) => edge.verdict === 'backwards' || edge.verdict === 'unsupported',
    );

    return (
      critique.passed &&
      critique.score >= MIN_CRITIQUE_SCORE &&
      critique.issues.length === 0 &&
      critique.invalidReasoningEdges.length === 0 &&
      !hasHardInvalidEdge &&
      weakOrNeutralEdgeCount <= 1 &&
      critique.clinicalAccuracyScore >= MIN_CLINICAL_ACCURACY_SCORE &&
      critique.clueProgressionScore >= MIN_CLUE_PROGRESSION_SCORE &&
      critique.differentialPlausibilityScore >=
        MIN_DIFFERENTIAL_PLAUSIBILITY_SCORE &&
      critique.differentialDiscriminationScore >=
        MIN_DIFFERENTIAL_DISCRIMINATION_SCORE &&
      critique.clinicalEdgeValidityScore >= MIN_CLINICAL_EDGE_VALIDITY_SCORE &&
      critique.educationalValueScore >= MIN_EDUCATIONAL_VALUE_SCORE &&
      critique.graphConsistencyScore >= MIN_GRAPH_CONSISTENCY_SCORE &&
      componentScores.every(
        (score) => score >= MIN_ANY_CRITIQUE_COMPONENT_SCORE,
      )
    );
  }

  private getAvailableCritiqueComponentScores(
    critique: Partial<CaseGenerationCritique>,
  ): number[] {
    return [
      critique.clinicalAccuracyScore,
      critique.clueProgressionScore,
      critique.differentialQualityScore,
      critique.differentialRuleOutScore,
      critique.differentialPlausibilityScore,
      critique.differentialDiscriminationScore,
      critique.clinicalEdgeValidityScore,
      critique.educationalValueScore,
      critique.graphConsistencyScore,
      critique.ambiguitySuitabilityScore,
    ].filter((score): score is number => typeof score === 'number');
  }

  private attachGenerationQuality(
    generatedCase: GeneratedCase,
    critique: CaseGenerationCritique,
    input: GenerateCaseInput = {},
  ): GeneratedCase {
    const metadata = this.deriveGenerationQualityMetadata(
      generatedCase,
      critique,
      input,
    );

    return {
      ...generatedCase,
      explanation: {
        ...generatedCase.explanation,
      generationQuality: {
        version: 'case-generator:v2',
        critiqueScore: critique.score,
        critiquePassed: critique.passed,
        critiqueIssues: critique.issues,
        critiqueRecommendations: critique.recommendations,
        differentialRuleOutScore: critique.differentialRuleOutScore,
        differentialPlausibilityScore:
          critique.differentialPlausibilityScore,
        differentialDiscriminationScore:
          critique.differentialDiscriminationScore,
        clinicalEdgeValidityScore: critique.clinicalEdgeValidityScore,
        invalidReasoningEdges: critique.invalidReasoningEdges,
        educationalValueScore: critique.educationalValueScore,
        graphConsistencyScore: critique.graphConsistencyScore,
        ...metadata,
      },
      },
    } as GeneratedCase;
  }

  private deriveGenerationQualityMetadata(
    generatedCase: GeneratedCase,
    critique: CaseGenerationCritique,
    input: GenerateCaseInput,
  ): Omit<
    NonNullable<PersistedGeneratedExplanation['generationQuality']>,
    | 'version'
    | 'critiqueScore'
    | 'critiquePassed'
    | 'critiqueIssues'
    | 'critiqueRecommendations'
    | 'differentialRuleOutScore'
    | 'differentialPlausibilityScore'
    | 'differentialDiscriminationScore'
    | 'clinicalEdgeValidityScore'
    | 'invalidReasoningEdges'
    | 'educationalValueScore'
    | 'graphConsistencyScore'
  > {
    const hasLabs = generatedCase.clues.some((clue) => clue.type === 'lab');
    const hasImaging = generatedCase.clues.some(
      (clue) => clue.type === 'imaging',
    );
    const hasVitals = generatedCase.clues.some((clue) => clue.type === 'vital');
    const estimatedSolveClue = this.estimateSolveClue(generatedCase);
    const difficultyPreference = this.normalizeDifficulty(input.difficulty);
    const teachingAlignment = this.buildCaseTeachingAlignmentReport(
      input,
      generatedCase,
    );
    const selectedUnits = this.selectedTeachingUnitsForMetadata(input);

    return {
      estimatedDifficulty: this.estimateDifficulty({
        generatedCase,
        estimatedSolveClue,
        hasLabs,
        hasImaging,
        hasVitals,
        difficultyPreference,
      }),
      estimatedSolveClue,
      specialty: this.normalizeOptionalString(input.track) ?? null,
      acuity: this.estimateAcuity(generatedCase),
      hasLabs,
      hasImaging,
      hasVitals,
      differentialCount: generatedCase.differentials.length,
      qualityScore: this.computeQualityScore(critique),
      ...(teachingAlignment ? { teachingAlignment } : {}),
      ...(input.targetedTeachingUnitIds?.length ||
      input.targetedMimics?.length ||
      input.clueRevealStrategy
        ? {
            targetedGeneration: {
              teachingUnitIds: input.targetedTeachingUnitIds ?? [],
              teachingUnits: selectedUnits.map((unit) => ({
                id: unit.id,
                label: unit.label,
                category: unit.category,
                importance: unit.importance,
              })),
              mimicDiagnosisIds:
                input.targetedMimics
                  ?.map((mimic) => mimic.diagnosisRegistryId)
                  .filter((id): id is string => Boolean(id)) ?? [],
              mimics:
                input.targetedMimics?.map((mimic) => mimic.diagnosis) ?? [],
              clueRevealStrategy: input.clueRevealStrategy ?? null,
            },
          }
        : {}),
    };
  }

  private selectedTeachingUnitsForMetadata(input: GenerateCaseInput) {
    const context = input.generationContext;
    if (!context?.requiredTeachingUnits?.length) {
      return [];
    }

    const difficulty =
      context.difficultyStrategy?.targetDifficulty ??
      this.normalizeDifficulty(input.difficulty);
    return this.selectCaseTeachingUnits({
      units: context.requiredTeachingUnits,
      difficulty,
      requestedTeachingUnitIds: input.targetedTeachingUnitIds,
    });
  }

  private estimateSolveClue(generatedCase: GeneratedCase): number {
    const orderedClues = [...generatedCase.clues].sort(
      (left, right) => left.order - right.order,
    );
    const firstStrongClue = orderedClues.find(
      (clue) =>
        clue.order >= 2 &&
        (clue.type === 'lab' ||
          clue.type === 'imaging' ||
          (clue.order >= 4 && this.hasPlausibleObjectiveDetail(clue.value))),
    );

    return Math.min(
      REQUIRED_CLUE_COUNT,
      Math.max(1, (firstStrongClue?.order ?? REQUIRED_CLUE_COUNT - 1) + 1),
    );
  }

  private estimateDifficulty(input: {
    generatedCase: GeneratedCase;
    estimatedSolveClue: number;
    hasLabs: boolean;
    hasImaging: boolean;
    hasVitals: boolean;
    difficultyPreference: 'easy' | 'medium' | 'hard';
  }): 'easy' | 'medium' | 'hard' {
    if (input.difficultyPreference === 'hard') {
      return input.estimatedSolveClue >= 5 ? 'hard' : 'medium';
    }

    if (
      input.estimatedSolveClue <= 3 &&
      input.generatedCase.differentials.length <= 3
    ) {
      return 'easy';
    }

    if (
      input.estimatedSolveClue >= 6 ||
      (!input.hasLabs && !input.hasImaging && !input.hasVitals)
    ) {
      return 'hard';
    }

    return 'medium';
  }

  private estimateAcuity(
    generatedCase: GeneratedCase,
  ): 'low' | 'medium' | 'high' | null {
    const caseText = generatedCase.clues
      .map((clue) => clue.value)
      .concat(generatedCase.explanation.summary)
      .join(' ');

    if (HIGH_ACUITY_PATTERN.test(caseText)) {
      return 'high';
    }

    if (LOW_ACUITY_PATTERN.test(caseText)) {
      return 'low';
    }

    return 'medium';
  }

  private computeQualityScore(critique: CaseGenerationCritique): number {
    const differentialPlausibilityScore =
      critique.differentialPlausibilityScore ??
      critique.differentialQualityScore;
    const differentialDiscriminationScore =
      critique.differentialDiscriminationScore ??
      critique.differentialRuleOutScore ??
      critique.differentialQualityScore;
    const clinicalEdgeValidityScore =
      critique.clinicalEdgeValidityScore ??
      critique.differentialDiscriminationScore ??
      critique.differentialRuleOutScore;
    const educationalValueScore =
      critique.educationalValueScore ?? critique.ambiguitySuitabilityScore;
    const graphConsistencyScore =
      critique.graphConsistencyScore ?? critique.differentialRuleOutScore;
    const weightedScore =
      critique.clinicalAccuracyScore * 0.22 +
      critique.clueProgressionScore * 0.13 +
      differentialPlausibilityScore * 0.18 +
      differentialDiscriminationScore * 0.17 +
      clinicalEdgeValidityScore * 0.15 +
      educationalValueScore * 0.08 +
      graphConsistencyScore * 0.07;

    return Math.round(this.clampScore(weightedScore));
  }

  private getBalancedBatchDifficulty(
    index: number,
    attempt: number,
  ): 'easy' | 'medium' | 'hard' {
    return BATCH_DIFFICULTY_ROTATION[
      (index + attempt - 1) % BATCH_DIFFICULTY_ROTATION.length
    ];
  }

  private getBatchRejectionReason(input: {
    generatedCase: GeneratedCase;
    quality: PersistedGeneratedExplanation['generationQuality'] | undefined;
    requestedCount: number;
    options: GenerateBatchOptions;
    registryFirst: boolean;
    qualityState: BatchQualityState;
    plannerTarget: PlannedGenerationSlot['diagnosis'] | null | undefined;
  }): BatchRejectionReason | null {
    const batchDedupeKey = this.getBatchAcceptedKey({
      generatedCase: input.generatedCase,
      registryFirst: input.registryFirst,
      plannerTarget: input.plannerTarget ?? null,
    });
    if (input.registryFirst) {
      if (input.qualityState.acceptedScenarioKeys.has(batchDedupeKey)) {
        return 'duplicate_scenario';
      }
    } else if (input.qualityState.acceptedAnswers.has(batchDedupeKey)) {
      return 'duplicate_answer';
    }

    const qualityScore =
      input.quality?.qualityScore ?? input.quality?.critiqueScore;
    if (
      typeof qualityScore === 'number' &&
      qualityScore < MIN_BATCH_QUALITY_SCORE
    ) {
      return 'low_quality';
    }

    if (
      !this.normalizeOptionalString(input.options.track) &&
      input.quality?.specialty &&
      this.exceedsBatchClusterLimit(
        input.qualityState.acceptedSpecialties,
        input.quality.specialty,
        input.requestedCount,
      )
    ) {
      return 'specialty_cluster';
    }

    if (
      !this.normalizeOptionalString(input.options.difficulty) &&
      input.quality?.estimatedDifficulty &&
      this.exceedsBatchClusterLimit(
        input.qualityState.acceptedDifficulties,
        input.quality.estimatedDifficulty,
        input.requestedCount,
      )
    ) {
      return 'difficulty_balance';
    }

    return null;
  }

  private exceedsBatchClusterLimit<T extends string>(
    counts: Map<T, number>,
    key: T,
    requestedCount: number,
  ): boolean {
    if (requestedCount < 3) {
      return false;
    }

    const limit = Math.max(2, Math.ceil(requestedCount * 0.5));
    return (counts.get(key) ?? 0) >= limit;
  }

  private recordAcceptedBatchCase(
    state: BatchQualityState,
    generatedCase: GeneratedCase,
    quality: PersistedGeneratedExplanation['generationQuality'] | undefined,
  ): void {
    state.accepted += 1;

    const qualityScore = quality?.qualityScore ?? quality?.critiqueScore;
    if (typeof qualityScore === 'number') {
      state.qualityScoreTotal += qualityScore;
      state.qualityScoreCount += 1;
    }

    if (quality?.specialty) {
      state.acceptedSpecialties.set(
        quality.specialty,
        (state.acceptedSpecialties.get(quality.specialty) ?? 0) + 1,
      );
    }

    if (quality?.estimatedDifficulty) {
      state.acceptedDifficulties.set(
        quality.estimatedDifficulty,
        (state.acceptedDifficulties.get(quality.estimatedDifficulty) ?? 0) + 1,
      );
    }

    state.acceptedAnswers.add(generatedCase.answer);
  }

  private getBatchAcceptedKey(input: {
    generatedCase: GeneratedCase;
    registryFirst: boolean;
    plannerTarget: PlannedGenerationSlot['diagnosis'] | null;
  }): string {
    if (input.registryFirst && input.plannerTarget) {
      return this.getCaseScenarioKey(input.generatedCase, input.plannerTarget);
    }

    return input.generatedCase.answer;
  }

  private recordAcceptedBatchKey(input: {
    state: BatchQualityState;
    registryFirst: boolean;
    key: string;
  }): void {
    if (input.registryFirst) {
      input.state.acceptedScenarioKeys.add(input.key);
      return;
    }

    input.state.acceptedAnswers.add(input.key);
  }

  private deleteAcceptedBatchKey(input: {
    state: BatchQualityState;
    registryFirst: boolean;
    key: string;
  }): void {
    if (input.registryFirst) {
      input.state.acceptedScenarioKeys.delete(input.key);
      return;
    }

    input.state.acceptedAnswers.delete(input.key);
  }

  private logBatchRejectedAttempt(input: {
    batchId: string;
    index: number;
    attempt: number;
    answer: string;
    reason: BatchRejectionReason;
    failureCategory: CaseGenerationFailureCategory;
    failureMessage: string;
    qualityScore: number | null;
    specialty: string | null;
    estimatedDifficulty: string | null;
    registryFirst?: boolean;
    plannerDiagnosis?: string | null;
    generationContextBuilt?: boolean;
  }): void {
    this.logger.warn(
      JSON.stringify({
        event: 'case.generate.rejected_attempt',
        batchId: input.batchId,
        index: input.index,
        attempt: input.attempt,
        answer: input.answer,
        reason: input.reason,
        failureCategory: input.failureCategory,
        failureMessage: input.failureMessage,
        qualityScore: input.qualityScore,
        specialty: input.specialty,
        estimatedDifficulty: input.estimatedDifficulty,
        registryFirst: input.registryFirst === true,
        plannerDiagnosis: input.plannerDiagnosis ?? null,
        generationContextBuilt: input.generationContextBuilt === true,
      }),
    );
  }

  private categoryFromBatchRejectionReason(
    reason: BatchRejectionReason,
  ): CaseGenerationFailureCategory {
    return reason;
  }

  private classifyGenerationFailure(
    error: Error,
  ): CaseGenerationFailureCategory {
    const message = error.message.toLowerCase();

    if (message.includes('must include a realistic objective finding')) {
      return 'objective_detail';
    }

    if (message.includes('demographic-incompatible differential')) {
      return 'demographic_incompatible_differential';
    }

    if (message.includes('leaks the final diagnosis')) {
      return 'answer_leakage';
    }

    if (message.includes('failed differential preflight')) {
      return 'differential_preflight';
    }

    if (
      message.includes('rule-out evidence must be copied or tightly paraphrased')
    ) {
      return 'differential_grounding';
    }

    if (message.includes('generated case failed critique')) {
      return 'full_critique';
    }

    if (message.includes('does not match fixed diagnosis')) {
      return 'registry_target_mismatch';
    }

    if (message.includes('openai returned an empty')) {
      return 'openai_empty_response';
    }

    if (
      message.includes('connection error') ||
      message.includes('network error') ||
      message.includes('fetch failed') ||
      message.includes('socket hang up') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('502')
    ) {
      return 'connection_error';
    }

    if (message.includes('failed to parse')) {
      return 'json_parse';
    }

    if (
      message.includes('schema is invalid') ||
      message.includes('invalid_type') ||
      message.includes('invalid input')
    ) {
      return 'schema_invalid';
    }

    return 'unknown';
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(100, Math.max(0, value));
  }

  private normalizeOptionalString(value?: string): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private uniqueStrings(values: string[]): string[] {
    return [...new Set(values.filter((value) => typeof value === 'string'))];
  }

  private normalizeDifficulty(value?: string): 'easy' | 'medium' | 'hard' {
    const normalized = this.normalizeOptionalString(value)?.toLowerCase();
    if (normalized === 'easy' || normalized === 'hard') {
      return normalized;
    }

    return 'medium';
  }

  private normalizeClinicalText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private containsDiagnosisLeak(clueValue: string, diagnosis: string): boolean {
    const normalizedClue = ` ${this.normalizeClinicalText(clueValue)} `;
    const normalizedDiagnosis = this.normalizeClinicalText(diagnosis);
    if (!normalizedDiagnosis) {
      return false;
    }

    if (normalizedClue.includes(` ${normalizedDiagnosis} `)) {
      return true;
    }

    const acronym = normalizedDiagnosis
      .split(' ')
      .filter((word) => !DIAGNOSIS_ACRONYM_STOPWORDS.has(word))
      .map((word) => word[0])
      .join('');
    if (acronym.length < 2) {
      return false;
    }

    return new RegExp(`\\b${acronym}\\b`, 'i').test(clueValue);
  }

  private containsAnyDiagnosisLeak(
    clueValue: string,
    diagnosisLeakTerms: string[],
  ): boolean {
    return diagnosisLeakTerms.some((term) =>
      this.containsDiagnosisLeak(clueValue, term),
    );
  }

  private getRegistryTargetTerms(
    target: NonNullable<PlannedGenerationSlot['diagnosis']>,
  ): string[] {
    const terms = [
      target.displayLabel,
      target.canonicalName,
      ...target.acceptedAliases,
    ];
    const seen = new Set<string>();

    return terms.filter((term) => {
      const normalized = this.normalizeClinicalText(term);
      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
  }

  private matchesRegistryTargetTerm(
    value: string,
    target: NonNullable<PlannedGenerationSlot['diagnosis']>,
  ): boolean {
    const normalizedValue = this.normalizeClinicalText(value);
    return this.getRegistryTargetTerms(target).some(
      (term) => this.normalizeClinicalText(term) === normalizedValue,
    );
  }

  private async findRegistryTargetByGeneratedAnswer(
    answer: string,
  ): Promise<NonNullable<PlannedGenerationSlot['diagnosis']> | null> {
    const normalizedAnswer = this.normalizeClinicalText(answer);
    if (!normalizedAnswer) {
      return null;
    }

    const registry = await this.prisma.diagnosisRegistry.findFirst({
      where: {
        active: true,
        status: 'ACTIVE',
        isPlayable: true,
        OR: [
          {
            canonicalNormalized: normalizedAnswer,
          },
          {
            displayLabel: {
              equals: answer,
              mode: 'insensitive',
            },
          },
          {
            canonicalName: {
              equals: answer,
              mode: 'insensitive',
            },
          },
          {
            aliases: {
              some: {
                normalizedTerm: normalizedAnswer,
                active: true,
                acceptedForMatch: true,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        legacyDiagnosisId: true,
        displayLabel: true,
        canonicalName: true,
        specialty: true,
        category: true,
        bodySystem: true,
        difficultyBand: true,
        aliases: {
          where: {
            active: true,
            acceptedForMatch: true,
          },
          select: {
            term: true,
          },
          orderBy: [{ rank: 'asc' }, { term: 'asc' }],
        },
      },
    });

    if (!registry) {
      return null;
    }

    return {
      diagnosisRegistryId: registry.id,
      legacyDiagnosisId: registry.legacyDiagnosisId,
      displayLabel: registry.displayLabel,
      canonicalName: registry.canonicalName,
      acceptedAliases: registry.aliases.map((alias) => alias.term),
      specialty: registry.specialty,
      category: registry.category,
      bodySystem: registry.bodySystem,
      difficultyBand: registry.difficultyBand,
      existingCaseCount: 0,
      lastGeneratedAt: null,
      recentUsePenaltyApplied: false,
    };
  }

  private getRequiredPlannerTarget(
    slot: PlannedGenerationSlot | undefined,
  ): NonNullable<PlannedGenerationSlot['diagnosis']> {
    if (!slot?.diagnosis) {
      throw new BadRequestException(
        'Registry-first generation requires a planned diagnosis target',
      );
    }

    return slot.diagnosis;
  }

  private requiresObjectiveDetail(type: ClinicalClue['type']): boolean {
    return type === 'lab' || type === 'imaging' || type === 'vital';
  }

  private hasPlausibleObjectiveDetail(
    value: string,
    type?: ClinicalClue['type'],
  ): boolean {
    if (type === 'vital') {
      return (
        NUMERIC_OBJECTIVE_PATTERN.test(value) &&
        VITAL_OBJECTIVE_PATTERN.test(value)
      );
    }

    if (type === 'lab') {
      return (
        NUMERIC_OBJECTIVE_PATTERN.test(value) ||
        LAB_OBJECTIVE_RESULT_PATTERN.test(value)
      );
    }

    if (type === 'imaging') {
      return IMAGING_OBJECTIVE_FINDING_PATTERN.test(value);
    }

    return OBJECTIVE_DETAIL_PATTERN.test(value);
  }

  private async getRegistryLeakTerms(answer: string): Promise<string[]> {
    const normalizedAnswer = this.normalizeClinicalText(answer);
    if (!normalizedAnswer) {
      return [answer];
    }

    const registry = await this.prisma.diagnosisRegistry.findFirst({
      where: {
        OR: [
          {
            canonicalNormalized: normalizedAnswer,
          },
          {
            displayLabel: {
              equals: answer,
              mode: 'insensitive',
            },
          },
          {
            canonicalName: {
              equals: answer,
              mode: 'insensitive',
            },
          },
          {
            aliases: {
              some: {
                normalizedTerm: normalizedAnswer,
                active: true,
              },
            },
          },
        ],
      },
      select: {
        canonicalName: true,
        displayLabel: true,
        aliases: {
          where: {
            active: true,
          },
          select: {
            term: true,
          },
        },
      },
    });

    const leakTerms = [
      answer,
      registry?.canonicalName,
      registry?.displayLabel,
      ...(registry?.aliases.map((alias) => alias.term) ?? []),
    ];
    const normalizedSeen = new Set<string>();
    const deduped: string[] = [];

    for (const term of leakTerms) {
      if (!term) {
        continue;
      }

      const normalized = this.normalizeClinicalText(term);
      if (!normalized || normalizedSeen.has(normalized)) {
        continue;
      }

      normalizedSeen.add(normalized);
      deduped.push(term);
    }

    return deduped;
  }

  private nextCaseDate(): Date {
    const nextTimestamp = Math.max(Date.now(), this.caseDateCursor + 1);
    this.caseDateCursor = nextTimestamp;
    return new Date(nextTimestamp);
  }

  private toPersistedExplanation(
    generatedCase: GeneratedCase,
  ): PersistedGeneratedExplanation {
    const generationQuality = this.getGenerationQuality(generatedCase);

    return {
      ...generatedCase.explanation,
      differentials: generatedCase.differentials,
      ...(generationQuality ? { generationQuality } : {}),
    };
  }

  private getGenerationQuality(
    generatedCase: GeneratedCase,
  ): PersistedGeneratedExplanation['generationQuality'] | undefined {
    const explanation =
      generatedCase.explanation as GeneratedCaseExplanationWithQuality;
    return explanation.generationQuality;
  }

  private async getNextCasePublicNumber(
    client: Prisma.TransactionClient,
  ): Promise<number> {
    const latest = await client.case.findFirst({
      where: {
        publicNumber: {
          not: null,
        },
      },
      orderBy: {
        publicNumber: 'desc',
      },
      select: {
        publicNumber: true,
      },
    });

    return (latest?.publicNumber ?? 0) + 1;
  }

  private isDuplicatePrismaError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private getCaseScenarioKey(
    generatedCase: GeneratedCase,
    target: NonNullable<PlannedGenerationSlot['diagnosis']>,
  ): string {
    const orderedClues = [...generatedCase.clues]
      .map((clue) => ({
        type: clue.type,
        value: clue.value.trim(),
        order: clue.order,
      }))
      .sort((left, right) => left.order - right.order)
      .map((clue) =>
        [
          clue.order,
          clue.type,
          this.normalizeClinicalText(clue.value),
        ].join(':'),
      );

    return [
      target.diagnosisRegistryId,
      this.normalizeClinicalText(
        generatedCase.clues.find((clue) => clue.type === 'history')?.value ??
          generatedCase.clues[0]?.value ??
          '',
      ),
      ...orderedClues,
    ].join('|');
  }

  private async findExistingCaseIdByRegistryScenario(
    diagnosisRegistryId: string,
    scenarioKey: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<string | null> {
    const existingCases = await client.case.findMany({
      where: {
        diagnosisRegistryId,
      },
      select: {
        id: true,
        title: true,
        history: true,
        symptoms: true,
        clues: true,
      },
    });

    for (const existingCase of existingCases) {
      const clues = Array.isArray(existingCase.clues)
        ? existingCase.clues
        : [];
      const parsedClues = clinicalClueSchema.array().safeParse(clues);
      if (!parsedClues.success) {
        continue;
      }

      const existingScenarioKey = this.getCaseScenarioKey(
        {
          answer: existingCase.title,
          clues: parsedClues.data,
          differentials: ['placeholder', 'placeholder 2', 'placeholder 3'],
          explanation: {
            diagnosis: existingCase.title,
            summary: '',
            reasoning: [''],
            keyFindings: [''],
            differentialAnalysis: [
              {
                diagnosis: 'placeholder',
                whyPlausibleEarly: 'placeholder early scenario overlap',
                ruledOutByClues: [
                  {
                    clueOrder: parsedClues.data[0]?.order ?? 0,
                    evidence: parsedClues.data[0]?.value ?? 'placeholder',
                    reason: 'placeholder scenario comparison',
                  },
                ],
                finalReasonLessLikely: 'placeholder scenario comparison',
              },
              {
                diagnosis: 'placeholder 2',
                whyPlausibleEarly: 'placeholder early scenario overlap',
                ruledOutByClues: [
                  {
                    clueOrder: parsedClues.data[0]?.order ?? 0,
                    evidence: parsedClues.data[0]?.value ?? 'placeholder',
                    reason: 'placeholder scenario comparison',
                  },
                ],
                finalReasonLessLikely: 'placeholder scenario comparison',
              },
              {
                diagnosis: 'placeholder 3',
                whyPlausibleEarly: 'placeholder early scenario overlap',
                ruledOutByClues: [
                  {
                    clueOrder: parsedClues.data[0]?.order ?? 0,
                    evidence: parsedClues.data[0]?.value ?? 'placeholder',
                    reason: 'placeholder scenario comparison',
                  },
                ],
                finalReasonLessLikely: 'placeholder scenario comparison',
              },
            ],
          },
        },
        {
          diagnosisRegistryId,
          legacyDiagnosisId: null,
          displayLabel: existingCase.title,
          canonicalName: existingCase.title,
          acceptedAliases: [],
          specialty: null,
          category: null,
          bodySystem: null,
          difficultyBand: null,
          existingCaseCount: 0,
          lastGeneratedAt: null,
          recentUsePenaltyApplied: false,
        },
      );
      if (existingScenarioKey === scenarioKey) {
        return existingCase.id;
      }
    }

    return null;
  }

  private async findExistingCaseIdByAnswer(
    answer: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<string | null> {
    const existing = await client.case.findFirst({
      where: {
        OR: [
          {
            title: {
              equals: answer,
              mode: 'insensitive',
            },
          },
          {
            diagnosis: {
              name: {
                equals: answer,
                mode: 'insensitive',
              },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    return existing?.id ?? null;
  }

  private async withSerializableRetry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        attempt += 1;
        const maybePrismaError = error as { code?: string };
        if (maybePrismaError.code !== 'P2034' || attempt >= maxAttempts) {
          throw error;
        }
      }
    }
  }
}
