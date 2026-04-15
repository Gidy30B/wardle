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
import type {
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

type PersistedGeneratedExplanation = GeneratedCase['explanation'] & {
  differentials: string[];
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

    const prompt = this.buildPrompt(input);
    const completion = await this.openaiClient.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You generate clinically accurate USMLE-style training cases and must return valid JSON only.',
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

  validateCase(generatedCase: GeneratedCase): void {
    const parsed = generatedCaseSchema.safeParse(generatedCase);
    if (!parsed.success) {
      throw new BadRequestException(
        `Generated case schema is invalid: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'} ${issue.message}`)
          .join('; ')}`,
      );
    }

    if (generatedCase.clues.length < 3) {
      throw new BadRequestException(
        'Generated case must include at least 3 clues',
      );
    }

    const seenClueValues = new Set<string>();
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

      if (seenClueValues.has(normalizedValue)) {
        throw new BadRequestException(
          `Duplicate clue value detected: ${clue.value}`,
        );
      }

      seenClueValues.add(normalizedValue);
    }

    if (!generatedCase.answer.trim()) {
      throw new BadRequestException('Generated case answer is required');
    }

    if (!generatedCase.explanation) {
      throw new BadRequestException('Generated case explanation is required');
    }
  }

  normalizeCase(generatedCase: GeneratedCase): GeneratedCase {
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
      },
    };
  }

  async saveCase(
    generatedCase: GeneratedCase,
    options: SaveGeneratedCaseOptions = {},
  ): Promise<SavedGeneratedCase | null> {
    const normalizedCase = this.normalizeCase(generatedCase);
    this.validateCase(normalizedCase);

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

            const createdRows = await tx.$queryRawUnsafe<SavedGeneratedCase[]>(
              `
                INSERT INTO "Case" (
                  "id",
                  "title",
                  "date",
                  "difficulty",
                  "history",
                  "symptoms",
                  "clues",
                  "explanation",
                  "differentials",
                  "diagnosisId"
                )
                VALUES (
                  gen_random_uuid(),
                  $1,
                  $2,
                  $3,
                  $4,
                  $5::text[],
                  $6::jsonb,
                  $7::jsonb,
                  $8::text[],
                  $9
                )
                RETURNING "id", "title", "difficulty", "date"
              `,
              normalizedCase.answer,
              this.nextCaseDate(),
              this.normalizeDifficulty(options.difficulty),
              history,
              symptoms,
              JSON.stringify(normalizedCase.clues),
              JSON.stringify(this.toPersistedExplanation(normalizedCase)),
              normalizedCase.differentials,
              diagnosis.id,
            );

            const persistedCase = createdRows[0];
            if (!persistedCase) {
              throw new Error('Case insert completed without returning a row');
            }

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

  async generateBatch(options: GenerateBatchOptions): Promise<GenerateBatchResult> {
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
    const results: GenerateBatchResult['results'] = new Array(count);
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
            this.validateCase(generatedCase);
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
                error instanceof Error ? error.message : 'Unknown generation error',
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

    const created = results.filter((result) => result.status === 'created').length;
    const skipped = results.filter((result) => result.status === 'skipped').length;
    const failed = results.filter((result) => result.status === 'failed').length;

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

  private buildPrompt(input: GenerateCaseInput): string {
    const track = this.normalizeOptionalString(input.track);
    const difficulty = this.normalizeDifficulty(input.difficulty);
    const sequenceLabel =
      typeof input.sequence === 'number' ? `Case ${input.sequence}.` : undefined;

    return [
      sequenceLabel,
      'Generate a USMLE-style clinical case.',
      '',
      'Return JSON ONLY:',
      '{',
      '"clues": [...],',
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
      '* progressive clues',
      '* no fluff',
      track ? `* specialty focus: ${track}` : undefined,
      '',
      'Use concise, concrete clinical details and avoid naming the final diagnosis in clues.',
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n');
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

  private nextCaseDate(): Date {
    const nextTimestamp = Math.max(Date.now(), this.caseDateCursor + 1);
    this.caseDateCursor = nextTimestamp;
    return new Date(nextTimestamp);
  }

  private toPersistedExplanation(
    generatedCase: GeneratedCase,
  ): PersistedGeneratedExplanation {
    return {
      ...generatedCase.explanation,
      differentials: generatedCase.differentials,
    };
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
