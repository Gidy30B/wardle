import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Case as CaseModel } from '@prisma/client';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { CasesService } from '../cases/cases.service';
import { normalize } from '../diagnostics/pipeline/normalize';
import { EvaluatorApiService } from '../diagnostics/services/evaluator-api.service';
import { QueueService } from '../queue/queue.service';
import { AttemptService } from './attempt.service';
import { DailyLimitService } from './daily-limit.service';
import { ScoringService } from './scoring.service';

@Injectable()
export class GameSessionService {
  private readonly cacheTtlSeconds = 300;
  private readonly duplicateWindowMs = 5000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: RedisCacheService,
    private readonly evaluatorApiService: EvaluatorApiService,
    private readonly attemptService: AttemptService,
    private readonly dailyLimitService: DailyLimitService,
    private readonly scoringService: ScoringService,
    private readonly queueService: QueueService,
    private readonly casesService: CasesService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
  ) {}

  async startGame(input: { userId: string }) {
    return this.startDailyGame({ userId: input.userId });
  }

  async submitGuess(input: { sessionId: string; guess: string; userId: string }) {
    return this.submitDailyGuess(input);
  }

  async requestHint(input: { userId: string; sessionId: string }) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: input.sessionId },
      select: {
        id: true,
        userId: true,
        caseId: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== input.userId) {
      throw new BadRequestException('Session does not belong to user');
    }

    const cacheKey = `ai:hint:${session.caseId}`;
    const cachedHint = await this.cacheService.get(cacheKey);

    if (cachedHint) {
      return {
        status: 'ready',
        hint: cachedHint,
      };
    }

    await this.queueService.enqueueHint(session.caseId);

    return {
      status: 'processing',
    };
  }

  async startDailyGame(input: {
    userId: string;
    subscriptionTier?: 'free' | 'premium';
  }) {
    const { start: startOfDayUtc, end: endOfDayUtc, dateKey } =
      this.getUtcDayRange();
    const todayCase = await this.casesService.getTodayCase();
    const selectedCase: Pick<
      CaseModel,
      'id' | 'history' | 'symptoms' | 'difficulty' | 'date'
    > = {
      id: todayCase.case.id,
      date: todayCase.case.date,
      difficulty: todayCase.case.difficulty,
      history: todayCase.case.history,
      symptoms: todayCase.case.symptoms,
    };

    const result = await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.upsert({
          where: { id: input.userId },
          update: {
            subscriptionTier: input.subscriptionTier ?? undefined,
          },
          create: {
            id: input.userId,
            subscriptionTier: input.subscriptionTier ?? 'free',
          },
        });

        await this.dailyLimitService.assertCanStartInTransaction(tx, {
          userId: user.id,
          subscriptionTier: user.subscriptionTier,
          startOfDayUtc,
          endOfDayUtc,
        });

        const existingSession = await tx.gameSession.findFirst({
          where: {
            userId: user.id,
            dailyCaseId: todayCase.dailyCaseId,
            status: 'active',
          },
          include: {
            case: true,
            attempts: {
              select: {
                result: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        });

        if (existingSession) {
          return {
            session: existingSession,
            dailyCase: {
              id: todayCase.dailyCaseId,
              caseId: todayCase.caseId,
              case: selectedCase,
            },
            user,
          };
        }

        const session = await tx.gameSession.create({
          data: {
            caseId: todayCase.caseId,
            dailyCaseId: todayCase.dailyCaseId,
            userId: user.id,
            userTierAtStart: user.subscriptionTier,
            status: 'active',
          },
        });

        return {
          session,
          dailyCase: {
            id: todayCase.dailyCaseId,
            caseId: todayCase.caseId,
            case: selectedCase,
          },
          user,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.cacheService.set(
      this.getSessionCacheKey(result.session.id),
      JSON.stringify({
        id: result.session.id,
        caseId: result.session.caseId,
        status: result.session.status,
      }),
      this.cacheTtlSeconds,
    );

    const resumedAttempts =
      'attempts' in result.session && Array.isArray(result.session.attempts)
        ? (result.session.attempts as Array<{ result: string }>)
        : [];
    const maxClues = this.getMaxClues(result.dailyCase.case.symptoms);
    const clueIndex = this.getDerivedClueIndex(resumedAttempts, maxClues);
    const visibleCase = this.buildCasePayloadByClueIndex(
      result.dailyCase.case,
      clueIndex,
    );

    this.enqueueAiJobsForCase(result.dailyCase.caseId, {
      userId: result.user.id,
      source: 'daily_case_selected',
    });

    this.logger.info(
      {
        userId: result.user.id,
        sessionId: result.session.id,
        dailyCaseId: result.dailyCase.id,
        caseId: result.dailyCase.caseId,
      },
      'daily.case.selected',
    );

    this.logger.info(
      {
        sessionId: result.session.id,
        userId: result.user.id,
        tier: result.user.subscriptionTier,
        date: dateKey,
        dailyCaseId: result.dailyCase.id,
      },
      'daily.start.created',
    );

    return {
      sessionId: result.session.id,
      dailyCaseId: result.dailyCase.id,
      clueIndex,
      attemptsCount: resumedAttempts.length,
      case: visibleCase,
    };
  }

  async submitDailyGuess(input: {
    userId: string;
    sessionId: string;
    guess: string;
  }) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: input.sessionId },
      include: {
        case: {
          include: {
            diagnosis: true,
          },
        },
        attempts: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== input.userId) {
      throw new BadRequestException('Session does not belong to user');
    }

    if (session.status !== 'active') {
      throw new BadRequestException('Session is already completed');
    }

    const normalizedGuess = normalize(input.guess);
    const maxClues = this.getMaxClues(session.case.symptoms);
    const duplicateAttempt = await this.findDuplicateAttempt(
      session.id,
      normalizedGuess,
    );
    if (duplicateAttempt) {
      this.metrics.increment('attempt.duplicate');
      this.logger.warn(
        {
          sessionId: session.id,
          userId: input.userId,
          normalizedGuess,
          attemptId: duplicateAttempt.id,
        },
        'daily.guess.duplicate_detected',
      );

      return {
        result: duplicateAttempt.result,
        score: duplicateAttempt.score,
        attemptsCount: session.attempts.length,
        clueIndex: this.getDerivedClueIndex(session.attempts, maxClues),
        duplicate: true,
      };
    }

    const clueIndex = this.getDerivedClueIndex(session.attempts, maxClues);
    this.logClueMismatchIfAny(
      session.attempts,
      clueIndex,
      session.id,
      input.userId,
      maxClues,
    );

    const evaluation = await this.evaluatorApiService.evaluateGuess(
      input.guess,
      session.case.diagnosis.name,
    );

    const attemptsCount = session.attempts.length + 1;
    const computedScore = this.scoringService.compute({
      semanticScore: evaluation.score,
      attemptsCount,
      difficulty: session.case.difficulty,
      isCorrect: evaluation.label === 'correct',
    });

    await this.attemptService.recordAttempt({
      caseId: session.caseId,
      sessionId: session.id,
      userId: input.userId,
      guess: input.guess,
      normalizedGuess: normalize(evaluation.normalizedGuess ?? input.guess),
      score: computedScore,
      result: evaluation.label,
      signals: {
        ...evaluation.signals,
        retrievalMode: evaluation.retrievalMode ?? 'fallback',
      } as Prisma.InputJsonValue,
      evaluatorVersion: evaluation.evaluatorVersion ?? 'v2',
      clueIndexAtAttempt: clueIndex,
    });

    let nextClueIndex = clueIndex;
    let gameOver = false;
    let gameOverReason: 'correct' | 'clues_exhausted' | null = null;
    const isCorrect = evaluation.label === 'correct';
    const nextWrongAttempts =
      session.attempts.filter((item) => item.result !== 'correct').length +
      (isCorrect ? 0 : 1);
    const cluesExhausted = !isCorrect && nextWrongAttempts >= maxClues;

    if (isCorrect) {
      nextClueIndex = maxClues;
      gameOver = true;
      gameOverReason = 'correct';

      const completedAt = new Date();
      const completed = await this.prisma.gameSession.updateMany({
        where: {
          id: session.id,
          status: 'active',
        },
        data: {
          status: 'completed',
          completedAt,
        },
      });

      if (completed.count > 0) {
        if (!session.dailyCaseId) {
          throw new Error('CRITICAL: session missing dailyCaseId');
        }

        await this.queueService.enqueueGameCompleted({
          sessionId: session.id,
          userId: input.userId,
        });

        void this.queueService.enqueueExplanation(session.caseId).catch((error) => {
          this.logger.error(
            {
              caseId: session.caseId,
              sessionId: session.id,
              userId: input.userId,
              error,
            },
            'daily.explanation.enqueue_failed',
          );
        });
      }
    } else if (cluesExhausted) {
      nextClueIndex = maxClues;
      gameOver = true;
      gameOverReason = 'clues_exhausted';

      const completed = await this.prisma.gameSession.updateMany({
        where: {
          id: session.id,
          status: 'active',
        },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      if (completed.count > 0) {
        void this.queueService.enqueueExplanation(session.caseId).catch((error) => {
          this.logger.error(
            {
              caseId: session.caseId,
              sessionId: session.id,
              userId: input.userId,
              error,
            },
            'daily.explanation.enqueue_failed',
          );
        });
      }
    } else {
      nextClueIndex = Math.min(maxClues, nextWrongAttempts);
    }

    const visibleCase = this.buildCasePayloadByClueIndex(session.case, nextClueIndex);
    const explanation = gameOver
      ? this.buildCaseExplanation({
          diagnosis: session.case.diagnosis.name,
          difficulty: session.case.difficulty,
          history: session.case.history,
          symptoms: session.case.symptoms,
          outcome: gameOverReason,
          includeAdvanced: (session.userTierAtStart ?? '').toLowerCase() === 'premium',
        })
      : null;

    return {
      result: evaluation.label,
      score: computedScore,
      attemptsCount,
      semanticScore: evaluation.score,
      clueIndex: nextClueIndex,
      case: visibleCase,
      gameOver,
      gameOverReason,
      explanation,
      feedback: {
        signals: evaluation.signals,
        evaluatorVersion: evaluation.evaluatorVersion ?? 'v2',
        retrievalMode: evaluation.retrievalMode ?? 'fallback',
      },
    };
  }

  async getSessionState(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        case: {
          include: {
            diagnosis: true,
          },
        },
        attempts: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const maxClues = this.getMaxClues(session.case.symptoms);
    const clueIndex =
      session.status === 'completed'
        ? maxClues
        : this.getDerivedClueIndex(session.attempts, maxClues);
    const scopedCase = this.buildCasePayloadByClueIndex(session.case, clueIndex);

    const casePayload =
      session.status === 'completed'
        ? {
            ...scopedCase,
            diagnosis: session.case.diagnosis.name,
          }
        : scopedCase;

    return {
      session: {
        id: session.id,
        caseId: session.caseId,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      },
      clueIndex,
      attempts: session.attempts,
      case: casePayload,
    };
  }

  private enqueueAiJobsForCase(
    caseId: string,
    metadata: { userId?: string; sessionId?: string; source: string },
  ): void {
    void this.queueService.enqueueHint(caseId).catch((error) => {
      this.logger.error(
        {
          caseId,
          source: metadata.source,
          userId: metadata.userId,
          sessionId: metadata.sessionId,
          error,
        },
        'ai.hint.enqueue_failed',
      );
    });

    void this.queueService.enqueueExplanation(caseId).catch((error) => {
      this.logger.error(
        {
          caseId,
          source: metadata.source,
          userId: metadata.userId,
          sessionId: metadata.sessionId,
          error,
        },
        'ai.explanation.enqueue_failed',
      );
    });
  }

  async getCaseBySession(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        case: {
          include: {
            diagnosis: true,
          },
        },
        attempts: {
          select: {
            result: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const maxClues = this.getMaxClues(session.case.symptoms);
    const clueIndex =
      session.status === 'completed'
        ? maxClues
        : this.getDerivedClueIndex(session.attempts, maxClues);
    const scoped = this.buildCasePayloadByClueIndex(session.case, clueIndex);

    return {
      ...scoped,
      diagnosis: session.status === 'completed' ? session.case.diagnosis.name : undefined,
    };
  }

  private async findDuplicateAttempt(sessionId: string, normalizedGuess: string) {
    const since = new Date(Date.now() - this.duplicateWindowMs);
    return this.prisma.attempt.findFirst({
      where: {
        sessionId,
        normalizedGuess,
        createdAt: {
          gte: since,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private getUtcDayRange(value = new Date()) {
    const start = new Date(value);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return {
      start,
      end,
      dateKey: start.toISOString().slice(0, 10),
    };
  }

  private getDerivedClueIndex(
    attempts: Array<{
      result: string;
    }>,
    maxClues: number,
  ) {
    const wrongAttempts = attempts.filter((item) => item.result !== 'correct').length;
    return Math.min(maxClues, wrongAttempts);
  }

  private getMaxClues(symptoms: string[]) {
    return Array.isArray(symptoms) ? symptoms.length : 0;
  }

  private logClueMismatchIfAny(
    attempts: Array<{
      clueIndexAtAttempt: number | null;
      result: string;
    }>,
    derivedClueIndex: number,
    sessionId: string,
    userId: string,
    maxClues: number,
  ) {
    const lastAttempt = attempts[attempts.length - 1];
    if (!lastAttempt || lastAttempt.clueIndexAtAttempt == null) {
      return;
    }

    const expectedFromAudit =
      lastAttempt.result === 'correct'
        ? lastAttempt.clueIndexAtAttempt
        : Math.min(maxClues, lastAttempt.clueIndexAtAttempt + 1);

    if (expectedFromAudit !== derivedClueIndex) {
      this.logger.warn(
        {
          sessionId,
          userId,
          expectedFromAudit,
          derivedClueIndex,
        },
        'clue_index.mismatch_detected',
      );
    }
  }

  private buildCasePayloadByClueIndex(
    selectedCase: {
      id: string;
      history: string;
      symptoms: string[];
      difficulty: string;
      date: Date;
    },
    clueIndex: number,
  ) {
    const allSymptoms = Array.isArray(selectedCase.symptoms) ? selectedCase.symptoms : [];
    const symptomCount = Math.max(0, Math.min(allSymptoms.length, clueIndex));

    return {
      id: selectedCase.id,
      difficulty: selectedCase.difficulty,
      date: selectedCase.date.toISOString().slice(0, 10),
      history: selectedCase.history,
      symptoms: allSymptoms.slice(0, symptomCount),
    };
  }

  private buildCaseExplanation(input: {
    diagnosis: string;
    difficulty: string;
    history: string;
    symptoms: string[];
    outcome: 'correct' | 'clues_exhausted' | null;
    includeAdvanced: boolean;
  }) {
    const intro =
      input.outcome === 'correct'
        ? 'Great diagnosis. Here is the full case explanation.'
        : 'The trial ended because all clues were used. Here is the full case explanation.';

    const base = {
      diagnosis: input.diagnosis,
      difficulty: input.difficulty,
      summary: `${intro} The most likely diagnosis is ${input.diagnosis}.`,
      reasoning: [
        `History: ${input.history}`,
        `Key symptoms: ${input.symptoms.join(', ')}`,
      ],
    };

    if (!input.includeAdvanced) {
      return base;
    }

    return {
      ...base,
      deepDive:
        'Advanced interpretation: correlate symptom chronology, risk factors, and syndrome pattern weighting to validate diagnostic confidence before closure.',
      pitfalls: [
        'Anchoring too early on a single hallmark symptom.',
        'Ignoring alternate etiologies with overlapping symptom clusters.',
      ],
    };
  }

  private getSessionCacheKey(sessionId: string): string {
    return `game-session:${sessionId}`;
  }
}
