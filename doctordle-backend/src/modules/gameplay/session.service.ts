import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Case as CaseModel } from '@prisma/client';
import { AIContentService } from '../ai/ai-content.service';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { CasesService } from '../cases/cases.service';
import { normalize } from '../diagnostics/pipeline/normalize';
import { EvaluatorApiService } from '../diagnostics/services/evaluator-api.service';
import { AttemptService } from './attempt.service';
import { DailyLimitService } from './daily-limit.service';
import type {
  GameplayClinicalClue,
  SubmitGameGuessResponseDto,
} from './dto/submit-game-guess.dto';
import { EvaluationService } from './evaluation.service';
import { RewardOrchestrator } from './reward-orchestrator.service';

type PersistGuessResult =
  | {
      type: 'duplicate';
      attempt: {
        id: string;
        result: string;
        score: number;
      };
      attemptsCount: number;
      clueIndex: number;
    }
  | {
      type: 'persisted';
      attemptsCount: number;
      computedScore: number;
      nextClueIndex: number;
      gameOver: boolean;
      gameOverReason: 'correct' | 'clues_exhausted' | null;
      shouldRequestReward: boolean;
      isTerminalCorrect: boolean;
    };

type GameplayCaseView = {
  id: string;
  difficulty: string;
  date: Date;
  clues: GameplayClinicalClue[];
};

@Injectable()
export class SessionService {
  private readonly cacheTtlSeconds = 300;
  private readonly duplicateWindowMs = 5000;
  private readonly sessionClaimTimeoutMs = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: RedisCacheService,
    private readonly aiContentService: AIContentService,
    private readonly evaluatorApiService: EvaluatorApiService,
    private readonly attemptService: AttemptService,
    private readonly dailyLimitService: DailyLimitService,
    private readonly evaluationService: EvaluationService,
    private readonly rewardOrchestrator: RewardOrchestrator,
    private readonly casesService: CasesService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
  ) {}

  async startGame(input: { userId: string }) {
    return this.startDailyGame({ userId: input.userId });
  }

  async submitGuess(input: {
    sessionId: string;
    guess: string;
    userId: string;
  }): Promise<SubmitGameGuessResponseDto> {
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

    return this.aiContentService.getHint(session.caseId);
  }

  async startDailyGame(input: {
    userId: string;
    subscriptionTier?: 'free' | 'premium';
  }) {
    const {
      start: startOfDayUtc,
      end: endOfDayUtc,
      dateKey,
    } = this.getUtcDayRange();
    const todayCase = await this.casesService.getTodayCase();
    const selectedCase: Pick<
      CaseModel,
      'id' | 'difficulty' | 'date'
    > = {
      id: todayCase.case.id,
      date: todayCase.case.date,
      difficulty: todayCase.case.difficulty,
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

    const gameplayCase = await this.hydrateGameplayCase(result.dailyCase.case);
    const resumedAttempts =
      'attempts' in result.session && Array.isArray(result.session.attempts)
        ? (result.session.attempts as Array<{ result: string }>)
        : [];
    const maxClues = this.getTotalClues(gameplayCase);
    const clueIndex = this.evaluationService.getDerivedClueIndex(
      resumedAttempts,
      maxClues,
    );
    const responseCase = this.buildCasePayload(gameplayCase);

    this.logEvent('daily.case.selected', {
      userId: result.user.id,
      sessionId: result.session.id,
      dailyCaseId: result.dailyCase.id,
      caseId: result.dailyCase.caseId,
    });

    this.logEvent('daily.start.created', {
      sessionId: result.session.id,
      userId: result.user.id,
      tier: result.user.subscriptionTier,
      date: dateKey,
      dailyCaseId: result.dailyCase.id,
    });

    return {
      sessionId: result.session.id,
      dailyCaseId: result.dailyCase.id,
      clueIndex,
      attemptsCount: resumedAttempts.length,
      case: responseCase,
    };
  }

  async submitDailyGuess(input: {
    userId: string;
    sessionId: string;
    guess: string;
  }): Promise<SubmitGameGuessResponseDto> {
    await this.rewardOrchestrator.emitAttemptSubmitted({
      sessionId: input.sessionId,
      userId: input.userId,
    });

    const claimAt = await this.claimActiveSession(
      input.sessionId,
      input.userId,
    );

    try {
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
      const gameplayCase = await this.hydrateGameplayCase(session.case);
      const maxClues = this.getTotalClues(gameplayCase);
      const evaluation = await this.evaluatorApiService.evaluateGuess(
        input.guess,
        session.case.diagnosis.name,
      );

      await this.rewardOrchestrator.emitAttemptEvaluated({
        sessionId: session.id,
        userId: input.userId,
        result: evaluation.label,
        semanticScore: evaluation.score,
        evaluatorVersion: evaluation.evaluatorVersion ?? 'v2',
        retrievalMode: evaluation.retrievalMode ?? 'fallback',
      });

      const persisted = await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const freshSession = await tx.gameSession.findUnique({
              where: { id: input.sessionId },
              select: {
                id: true,
                caseId: true,
                userId: true,
                dailyCaseId: true,
                userTierAtStart: true,
                status: true,
                processingAt: true,
                attempts: {
                  select: {
                    id: true,
                    result: true,
                    score: true,
                    normalizedGuess: true,
                    clueIndexAtAttempt: true,
                  },
                  orderBy: {
                    createdAt: 'asc',
                  },
                },
              },
            });

            if (!freshSession) {
              throw new NotFoundException('Session not found');
            }

            if (freshSession.userId !== input.userId) {
              throw new BadRequestException('Session does not belong to user');
            }

            if (freshSession.status !== 'active') {
              throw new BadRequestException('Session is already completed');
            }

            if (
              !freshSession.processingAt ||
              freshSession.processingAt.getTime() !== claimAt.getTime()
            ) {
              throw new BadRequestException(
                'Session is currently processing another guess',
              );
            }

            const duplicateAttempt = await this.findDuplicateAttempt(
              tx,
              freshSession.id,
              normalizedGuess,
            );

            if (duplicateAttempt) {
              const derivedClueIndex =
                this.evaluationService.getDerivedClueIndex(
                  freshSession.attempts,
                  maxClues,
                );

              await tx.gameSession.updateMany({
                where: {
                  id: freshSession.id,
                  userId: input.userId,
                  status: 'active',
                  processingAt: claimAt,
                },
                data: {
                  processingAt: null,
                },
              });

              return {
                type: 'duplicate',
                attempt: duplicateAttempt,
                attemptsCount: freshSession.attempts.length,
                clueIndex: derivedClueIndex,
              } satisfies PersistGuessResult;
            }

            const clueMismatch = this.evaluationService.getClueMismatch(
              freshSession.attempts,
              maxClues,
            );

            if (clueMismatch) {
              this.logWarnEvent('clue_index.mismatch_detected', {
                sessionId: freshSession.id,
                userId: input.userId,
                expectedFromAudit: clueMismatch.expectedFromAudit,
                derivedClueIndex: clueMismatch.derivedClueIndex,
              });
            }

            const outcome = this.evaluationService.computeGuessOutcome({
              attempts: freshSession.attempts,
              semanticScore: evaluation.score,
              difficulty: session.case.difficulty,
              evaluationLabel: evaluation.label,
              maxClues,
            });

            await this.attemptService.recordAttemptInTransaction(tx, {
              caseId: freshSession.caseId,
              sessionId: freshSession.id,
              userId: input.userId,
              guess: input.guess,
              normalizedGuess: normalize(
                evaluation.normalizedGuess ?? input.guess,
              ),
              score: outcome.computedScore,
              result: evaluation.label,
              signals: {
                ...evaluation.signals,
                retrievalMode: evaluation.retrievalMode ?? 'fallback',
              } as Prisma.InputJsonValue,
              evaluatorVersion: evaluation.evaluatorVersion ?? 'v2',
              clueIndexAtAttempt: outcome.clueIndex,
            });

            const sessionUpdate = outcome.gameOver
              ? await tx.gameSession.updateMany({
                  where: {
                    id: freshSession.id,
                    userId: input.userId,
                    status: 'active',
                    processingAt: claimAt,
                  },
                  data: {
                    status: 'completed',
                    completedAt: new Date(),
                    processingAt: null,
                  },
                })
              : await tx.gameSession.updateMany({
                  where: {
                    id: freshSession.id,
                    userId: input.userId,
                    status: 'active',
                    processingAt: claimAt,
                  },
                  data: {
                    processingAt: null,
                  },
                });

            if (sessionUpdate.count === 0) {
              throw new BadRequestException(
                'Session is currently processing another guess',
              );
            }

            return {
              type: 'persisted',
              attemptsCount: outcome.attemptsCount,
              computedScore: outcome.computedScore,
              nextClueIndex: outcome.nextClueIndex,
              gameOver: outcome.gameOver,
              gameOverReason: outcome.gameOverReason,
              shouldRequestReward: outcome.shouldRequestReward,
              isTerminalCorrect: outcome.isTerminalCorrect,
            } satisfies PersistGuessResult;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        ),
      );

      if (persisted.type === 'duplicate') {
        this.metrics.increment('attempt.duplicate');
        this.logWarnEvent('daily.guess.duplicate_detected', {
          sessionId: session.id,
          userId: input.userId,
          normalizedGuess,
          attemptId: persisted.attempt.id,
        });

        return {
          result: persisted.attempt.result as 'correct' | 'close' | 'wrong',
          score: persisted.attempt.score,
          attemptsCount: persisted.attemptsCount,
          clueIndex: persisted.clueIndex,
          isTerminalCorrect: false,
          duplicate: true,
        };
      }

      if (persisted.gameOver && persisted.gameOverReason) {
        await this.rewardOrchestrator.emitSessionCompleted({
          sessionId: session.id,
          userId: input.userId,
          reason: persisted.gameOverReason,
        });
      }

      if (persisted.shouldRequestReward) {
        await this.rewardOrchestrator.emitRewardRequested({
          sessionId: session.id,
          userId: input.userId,
        });
      }

      const responseCase = this.buildCasePayload(gameplayCase);
      const explanation = persisted.gameOver
        ? await this.aiContentService.getExplanation(session.caseId, input.userId)
        : null;

      return {
        result: evaluation.label,
        score: persisted.computedScore,
        attemptsCount: persisted.attemptsCount,
        semanticScore: evaluation.score,
        clueIndex: persisted.nextClueIndex,
        isTerminalCorrect: persisted.isTerminalCorrect,
        case: responseCase,
        gameOver: persisted.gameOver,
        gameOverReason: persisted.gameOverReason,
        explanation,
        ...(persisted.shouldRequestReward
          ? { rewardStatus: 'processing' as const }
          : {}),
        feedback: {
          signals: evaluation.signals,
          evaluatorVersion: evaluation.evaluatorVersion ?? 'v2',
          retrievalMode: evaluation.retrievalMode ?? 'fallback',
        },
      };
    } finally {
      await this.releaseSessionClaim(input.sessionId, input.userId, claimAt);
    }
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

    const gameplayCase = await this.hydrateGameplayCase(session.case);
    const maxClues = this.getTotalClues(gameplayCase);
    const clueIndex =
      session.status === 'completed'
        ? maxClues
        : this.evaluationService.getDerivedClueIndex(
            session.attempts,
            maxClues,
          );
    const responseCase = this.buildCasePayload(gameplayCase);

    const casePayload =
      session.status === 'completed'
        ? {
            ...responseCase,
            diagnosis: session.case.diagnosis.name,
          }
        : responseCase;

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

    const gameplayCase = await this.hydrateGameplayCase(session.case);
    const maxClues = this.getTotalClues(gameplayCase);
    const clueIndex =
      session.status === 'completed'
        ? maxClues
        : this.evaluationService.getDerivedClueIndex(
            session.attempts,
            maxClues,
          );
    const responseCase = this.buildCasePayload(gameplayCase);

    return {
      ...responseCase,
      diagnosis:
        session.status === 'completed'
          ? session.case.diagnosis.name
          : undefined,
    };
  }

  private async findDuplicateAttempt(
    client: PrismaService | Prisma.TransactionClient,
    sessionId: string,
    normalizedGuess: string,
  ) {
    const since = new Date(Date.now() - this.duplicateWindowMs);
    return client.attempt.findFirst({
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
      select: {
        id: true,
        result: true,
        score: true,
      },
    });
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

  private async claimActiveSession(
    sessionId: string,
    userId: string,
  ): Promise<Date> {
    const claimAt = new Date();
    const staleBefore = new Date(
      claimAt.getTime() - this.sessionClaimTimeoutMs,
    );
    const claimed = await this.prisma.gameSession.updateMany({
      where: {
        id: sessionId,
        userId,
        status: 'active',
        OR: [
          {
            processingAt: null,
          },
          {
            processingAt: {
              lt: staleBefore,
            },
          },
        ],
      },
      data: {
        processingAt: claimAt,
      },
    });

    if (claimed.count > 0) {
      return claimAt;
    }

    const existing = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        status: true,
        processingAt: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Session not found');
    }

    if (existing.userId !== userId) {
      throw new BadRequestException('Session does not belong to user');
    }

    if (existing.status !== 'active') {
      throw new BadRequestException('Session is already completed');
    }

    if (existing.processingAt && existing.processingAt >= staleBefore) {
      throw new BadRequestException(
        'Session is currently processing another guess',
      );
    }

    throw new BadRequestException(
      'Unable to claim session for guess submission',
    );
  }

  private async releaseSessionClaim(
    sessionId: string,
    userId: string,
    claimAt: Date,
  ): Promise<void> {
    await this.prisma.gameSession
      .updateMany({
        where: {
          id: sessionId,
          userId,
          processingAt: claimAt,
          processedAt: null,
        },
        data: {
          processingAt: null,
        },
      })
      .catch((error) => {
        this.logWarnEvent('session.claim.release_failed', {
          sessionId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  private logEvent(
    event: string,
    meta: { sessionId?: string; userId?: string; [key: string]: unknown },
  ): void {
    this.logger.info(
      {
        event,
        correlationId: meta.sessionId ?? null,
        ...meta,
      },
      event,
    );
  }

  private logWarnEvent(
    event: string,
    meta: { sessionId?: string; userId?: string; [key: string]: unknown },
  ): void {
    this.logger.warn(
      {
        event,
        correlationId: meta.sessionId ?? null,
        ...meta,
      },
      event,
    );
  }

  private async hydrateGameplayCase(
    selectedCase: {
      id: string;
      difficulty: string;
      date: Date;
    },
  ): Promise<GameplayCaseView> {
    return {
      ...selectedCase,
      clues: await this.getCaseClues(selectedCase.id),
    };
  }

  private async getCaseClues(caseId: string): Promise<GameplayClinicalClue[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ clues: unknown | null }>>(
      'SELECT "clues" FROM "Case" WHERE "id" = $1',
      caseId,
    );

    const rawClues = rows[0]?.clues;
    const parsedClues = this.parseCaseClues(caseId, rawClues);
    if (!parsedClues.length) {
      throw new BadRequestException(`Case ${caseId} has no playable clues`);
    }

    return parsedClues;
  }

  private parseCaseClues(
    caseId: string,
    value: unknown,
  ): GameplayClinicalClue[] {
    const parsed = this.parseUnknownJson(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized: GameplayClinicalClue[] = [];

    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry === null) {
        return [];
      }

      const candidate = entry as {
        id?: unknown;
        type?: unknown;
        value?: unknown;
        order?: unknown;
      };

      if (
        candidate.type !== 'history' &&
        candidate.type !== 'symptom' &&
        candidate.type !== 'vital' &&
        candidate.type !== 'lab' &&
        candidate.type !== 'exam' &&
        candidate.type !== 'imaging'
      ) {
        return [];
      }

      if (typeof candidate.order !== 'number' || !Number.isInteger(candidate.order)) {
        return [];
      }

      const normalizedValue = this.normalizeClueValue(candidate.value);
      if (!normalizedValue) {
        return [];
      }

      normalized.push({
        id:
          typeof candidate.id === 'string' && candidate.id.trim().length > 0
            ? candidate.id
            : '',
        type: candidate.type,
        value: normalizedValue,
        order: candidate.order,
      });
    }

    if (normalized.length === 0) {
      return [];
    }

    return normalized
      .sort((left, right) => left.order - right.order)
      .map((clue) => ({
        ...clue,
        id: clue.id || `${caseId}-${clue.order}`,
      }));
  }

  private parseUnknownJson(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private buildCasePayload(selectedCase: GameplayCaseView) {
    const clues = [...selectedCase.clues]
      .sort((left, right) => left.order - right.order)
      .map((clue, index) => ({
        ...clue,
        order: index,
      }));

    return {
      id: selectedCase.id,
      difficulty: selectedCase.difficulty,
      date: selectedCase.date.toISOString().slice(0, 10),
      clues,
    };
  }

  private getTotalClues(selectedCase: GameplayCaseView): number {
    return selectedCase.clues.length;
  }

  private normalizeClueValue(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private getSessionCacheKey(sessionId: string): string {
    return `game-session:${sessionId}`;
  }
}
