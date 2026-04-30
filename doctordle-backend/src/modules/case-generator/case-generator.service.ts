import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { getEnv } from '../../core/config/env.validation.js';
import { PrismaService } from '../../core/db/prisma.service.js';
import { CaseValidationOrchestrator } from '../case-validation/case-validation.orchestrator.js';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service.js';
import { buildMatchedDiagnosisMappingFields } from '../diagnosis-registry/diagnosis-mapping-fields.js';
import type {
  CaseGenerationCritique,
  GenerateBatchOptions,
  GenerateBatchResult,
  GenerateCaseInput,
  GeneratedCase,
  SaveGeneratedCaseOptions,
  SavedGeneratedCase,
} from './case-generator.types.js';

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

const generatedCaseSchema = z.object({
  clues: z.array(clinicalClueSchema),
  answer: z.string(),
  differentials: z.array(z.string()),
  explanation: z.object({
    diagnosis: z.string(),
    summary: z.string(),
    reasoning: z.array(z.string()),
    keyFindings: z.array(z.string()),
  }),
});

const caseGenerationCritiqueSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  clinicalAccuracyScore: z.number().min(0).max(100),
  clueProgressionScore: z.number().min(0).max(100),
  differentialQualityScore: z.number().min(0).max(100),
  ambiguitySuitabilityScore: z.number().min(0).max(100),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
});

const REQUIRED_CLUE_COUNT = 6;
const MIN_DIFFERENTIAL_COUNT = 3;
const MAX_DIFFERENTIAL_COUNT = 5;
const MAX_GENERATION_ATTEMPTS = 3;
const MIN_CRITIQUE_SCORE = 80;
const HIGH_ACUITY_PATTERN =
  /\b(shock|hypotension|hypoxic|hypoxia|respiratory distress|altered mental status|syncope|sepsis|unstable|crushing chest pain|acute abdomen|peritonitis)\b/i;
const LOW_ACUITY_PATTERN =
  /\b(chronic|intermittent|mild|stable|routine|gradual|months|years|well appearing)\b/i;
const OBJECTIVE_DETAIL_PATTERN =
  /\b(\d+(\.\d+)?|positive|negative|elevated|low|high|increased|decreased|reduced|normal|abnormal|opacity|consolidation|effusion|lesion|mass|fracture|ischemia|infiltrate|dilated|enlarged)\b/i;
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
    estimatedDifficulty: 'easy' | 'medium' | 'hard';
    estimatedSolveClue: number;
    specialty: string | null;
    acuity: 'low' | 'medium' | 'high' | null;
    hasLabs: boolean;
    hasImaging: boolean;
    hasVitals: boolean;
    differentialCount: number;
    qualityScore: number;
  };
};

type GeneratedCaseExplanationWithQuality = GeneratedCase['explanation'] & {
  generationQuality?: PersistedGeneratedExplanation['generationQuality'];
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
  ) {
    if (this.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: this.env.OPENAI_API_KEY,
      });
    }
  }

  async generateCase(input: GenerateCaseInput = {}): Promise<GeneratedCase> {
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

        const critique = await this.critiqueGeneratedCase(normalizedCase);
        if (!this.isPassingCritique(critique)) {
          throw new BadRequestException(
            `Generated case failed critique: ${critique.issues.join('; ')}`,
          );
        }

        return this.attachGenerationQuality(normalizedCase, critique, input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          JSON.stringify({
            event: 'case.generate.retry',
            attempt,
            maxAttempts: MAX_GENERATION_ATTEMPTS,
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

  validateCase(generatedCase: GeneratedCase): void {
    this.validateCaseAgainstLeakTerms(generatedCase, [generatedCase.answer]);
  }

  private async validateCaseWithRegistry(
    generatedCase: GeneratedCase,
  ): Promise<void> {
    const leakTerms = await this.getRegistryLeakTerms(generatedCase.answer);
    this.validateCaseAgainstLeakTerms(generatedCase, leakTerms);
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
        (clue.type === 'lab' || clue.type === 'imaging') &&
        !this.hasPlausibleObjectiveDetail(clue.value)
      ) {
        throw new BadRequestException(
          `Lab or imaging clue at order ${clue.order} must include a realistic objective finding`,
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

    const answerKey = normalizedCase.answer;
    const seenAnswers = options.seenAnswers;
    if (seenAnswers?.has(answerKey)) {
      return null;
    }

    seenAnswers?.add(answerKey);

    try {
      if (!options.skipExistingAnswerCheck) {
        const duplicateCheck = await this.findExistingCaseIdByAnswer(
          normalizedCase.answer,
        );
        if (duplicateCheck) {
          return null;
        }
      }

      const history =
        normalizedCase.clues.find((clue) => clue.type === 'history')?.value ??
        normalizedCase.clues[0]?.value ??
        normalizedCase.answer;

      const symptoms = normalizedCase.clues
        .filter((clue) => clue.type === 'symptom')
        .map((clue) => clue.value);
      const createdCase = await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            if (!options.skipExistingAnswerCheck) {
              const existing = await this.findExistingCaseIdByAnswer(
                normalizedCase.answer,
                tx,
              );
              if (existing) {
                return null;
              }
            }

            const normalizedTrack = this.normalizeOptionalString(options.track);
            const diagnosis = await tx.diagnosis.upsert({
              where: {
                name: normalizedCase.answer,
              },
              update: {},
              create: {
                name: normalizedCase.answer,
                ...(normalizedTrack
                  ? { system: normalizedTrack.toLowerCase() }
                  : {}),
              },
              select: {
                id: true,
              },
            });

            const resolvedDiagnosisLink =
              await this.diagnosisRegistryLinkService.resolveForWrite(
                {
                  diagnosisId: diagnosis.id,
                },
                tx,
              );
            const diagnosisMappingFields = buildMatchedDiagnosisMappingFields({
              diagnosisName: resolvedDiagnosisLink.diagnosisName,
              proposedDiagnosisText: normalizedCase.answer,
              method: 'LEGACY_BACKFILL',
            });

            const persistedCase = await tx.case.create({
              data: {
                title: normalizedCase.answer,
                date: this.nextCaseDate(),
                difficulty: this.normalizeDifficulty(options.difficulty),
                history,
                symptoms,
                clues: normalizedCase.clues as Prisma.InputJsonValue,
                explanation: this.toPersistedExplanation(
                  normalizedCase,
                ) as Prisma.InputJsonValue,
                differentials: normalizedCase.differentials,
                diagnosisId: resolvedDiagnosisLink.diagnosisId,
                diagnosisRegistryId: resolvedDiagnosisLink.diagnosisRegistryId,
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
          answer: normalizedCase.answer,
        }),
      );

      return createdCase;
    } catch (error) {
      if (!this.isDuplicatePrismaError(error)) {
        seenAnswers?.delete(answerKey);
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
    const concurrency = Math.max(
      1,
      Math.min(5, Math.trunc(options.concurrency ?? 5)),
    );
    const results = new Array<GenerateBatchResult['results'][number]>(count);
    let nextIndex = 0;

    this.logger.log(
      JSON.stringify({
        event: 'case.generate.started',
        batchId,
        count,
        track: this.normalizeOptionalString(options.track),
        difficulty: this.normalizeDifficulty(options.difficulty),
        concurrency,
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

          try {
            const generatedCase = await this.generateCase({
              track: options.track,
              difficulty: options.difficulty,
              batchId,
              sequence: currentIndex + 1,
            });
            await this.validateCaseWithRegistry(generatedCase);
            const normalizedCase = this.normalizeCase(generatedCase);
            const savedCase = await this.saveCase(normalizedCase, {
              track: options.track,
              difficulty: options.difficulty,
              seenAnswers,
            });

            if (!savedCase) {
              results[currentIndex] = {
                index: currentIndex,
                status: 'skipped',
                reason: 'duplicate_answer',
                answer: normalizedCase.answer,
              };

              this.logger.log(
                JSON.stringify({
                  event: 'case.generate.success',
                  batchId,
                  index: currentIndex,
                  answer: normalizedCase.answer,
                  outcome: 'skipped_duplicate',
                }),
              );
              continue;
            }

            results[currentIndex] = {
              index: currentIndex,
              status: 'created',
              caseId: savedCase.id,
              answer: normalizedCase.answer,
            };

            this.logger.log(
              JSON.stringify({
                event: 'case.generate.success',
                batchId,
                index: currentIndex,
                caseId: savedCase.id,
                answer: normalizedCase.answer,
                outcome: 'created',
              }),
            );
          } catch (error) {
            results[currentIndex] = {
              index: currentIndex,
              status: 'failed',
              error:
                error instanceof Error
                  ? error.message
                  : 'Unknown generation error',
            };

            this.logger.error(
              JSON.stringify({
                event: 'case.generate.failed',
                batchId,
                index: currentIndex,
                error: error instanceof Error ? error.message : String(error),
              }),
              error instanceof Error ? error.stack : undefined,
            );
          }
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

    const summary: GenerateBatchResult = {
      batchId,
      requested: count,
      created,
      skipped,
      failed,
      results,
    };

    this.logger.log(
      JSON.stringify({
        event: 'case.generate.batch.completed',
        batchId,
        requested: summary.requested,
        created: summary.created,
        skipped: summary.skipped,
        failed: summary.failed,
      }),
    );

    return summary;
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

  private buildPrompt(input: GenerateCaseInput, attempt = 1): string {
    const track = this.normalizeOptionalString(input.track);
    const difficulty = this.normalizeDifficulty(input.difficulty);
    const sequenceLabel =
      typeof input.sequence === 'number'
        ? `Case ${input.sequence}.`
        : undefined;

    return [
      sequenceLabel,
      attempt > 1
        ? `Regeneration attempt ${attempt}: correct prior quality failures by producing a fresh case.`
        : undefined,
      'Generate one clinically consistent USMLE-style diagnostic case using differential-first reasoning.',
      '',
      'Required reasoning plan before writing JSON:',
      'Step 1: define the correct diagnosis.',
      'Step 2: define 3-5 plausible differentials that could fit the early presentation.',
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
      '"keyFindings": [...]',
      '}',
      '}',
      '',
      'Constraints:',
      '',
      '* clinically accurate',
      `* ${difficulty} difficulty`,
      '* exactly 6 clues with orders 0 through 5',
      '* 3-5 plausible differentials',
      '* each clue introduces new information',
      '* clues become stronger from broad to confirmatory',
      '* clues 0-4 must not name or abbreviate the final diagnosis or its common aliases',
      '* labs and imaging must use realistic objective findings',
      '* maintain age, sex, timeline, vitals, labs, and imaging consistency',
      '* no duplicate clues',
      '* no fluff',
      track ? `* specialty focus: ${track}` : undefined,
      '',
      'Use concise, concrete clinical details. Do not include extra JSON keys.',
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n');
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
    ].join('\n');
  }

  private buildCritiqueSystemPrompt(): string {
    return [
      'You are a strict clinical education reviewer for generated diagnostic cases.',
      'Return valid JSON only.',
      'Pass only cases that are clinically consistent, have exactly 6 progressive clues, include 3-5 plausible differentials, avoid answer leakage before the confirmatory clue, and have realistic labs/imaging when present.',
      'Score from 0 to 100. A case should pass only when it is ready to save as a draft for editorial review.',
      'Provide clinicalAccuracyScore, clueProgressionScore, differentialQualityScore, and ambiguitySuitabilityScore from 0 to 100.',
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

  private isPassingCritique(critique: CaseGenerationCritique): boolean {
    return (
      critique.passed &&
      critique.score >= MIN_CRITIQUE_SCORE &&
      critique.issues.length === 0
    );
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
  > {
    const hasLabs = generatedCase.clues.some((clue) => clue.type === 'lab');
    const hasImaging = generatedCase.clues.some(
      (clue) => clue.type === 'imaging',
    );
    const hasVitals = generatedCase.clues.some((clue) => clue.type === 'vital');
    const estimatedSolveClue = this.estimateSolveClue(generatedCase);
    const difficultyPreference = this.normalizeDifficulty(input.difficulty);

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
    };
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
    const weightedScore =
      critique.clinicalAccuracyScore * 0.35 +
      critique.clueProgressionScore * 0.25 +
      critique.differentialQualityScore * 0.25 +
      critique.ambiguitySuitabilityScore * 0.15;

    return Math.round(this.clampScore(weightedScore));
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

  private hasPlausibleObjectiveDetail(value: string): boolean {
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

  private isDuplicatePrismaError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
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
