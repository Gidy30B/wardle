import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PublishTrack, Case as CaseModel } from '@prisma/client';
import { AIContentService } from '../ai/ai-content.service';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { getEnv } from '../../core/config/env.validation';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { DiagnosisRegistryMatcherService } from '../diagnosis-registry/diagnosis-registry-matcher.service';
import { AttemptService } from './attempt.service';
import {
  DailyCasesService,
  hasPremiumTrackAccess,
} from './daily-cases.service';
import type {
  GameplayCaseExplanation,
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

type StartDailyGameResponse =
  | {
      state: 'ready';
      sessionId: string;
      dailyCaseId: string;
      clueIndex: number;
      attemptsCount: number;
      case: ReturnType<SessionService['buildCasePayload']>;
    }
  | {
      state: 'waiting';
      nextCaseAt: string;
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
    private readonly diagnosisRegistryMatcherService: DiagnosisRegistryMatcherService,
    private readonly attemptService: AttemptService,
    private readonly evaluationService: EvaluationService,
    private readonly rewardOrchestrator: RewardOrchestrator,
    private readonly dailyCasesService: DailyCasesService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
  ) {}

  async startGame(input: {
    userId: string;
    dailyCaseId?: string;
    devReplay?: boolean;
    track?: PublishTrack;
    sequenceIndex?: number;
  }) {
    return this.startDailyGame({
      userId: input.userId,
      dailyCaseId: input.dailyCaseId,
      devReplay: input.devReplay,
      track: input.track,
      sequenceIndex: input.sequenceIndex,
    });
  }

  async submitGuess(input: {
    sessionId: string;
    guess?: string;
    userId: string;
    diagnosisRegistryId: string;
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
    dailyCaseId?: string;
    devReplay?: boolean;
    track?: PublishTrack;
    sequenceIndex?: number;
  }): Promise<StartDailyGameResponse> {
    if (input.subscriptionTier) {
      await this.prisma.user.upsert({
        where: { id: input.userId },
        update: {
          subscriptionTier: input.subscriptionTier,
        },
        create: {
          id: input.userId,
          subscriptionTier: input.subscriptionTier,
        },
      });
    }

    const todayCases = await this.dailyCasesService.getTodayCasesForUser(
      input.userId,
    );
    const devReplayRequested = this.isDevReplayRequested(input.devReplay);
    let replayMode: 'explicit' | 'auto' | null = devReplayRequested
      ? 'explicit'
      : null;
    let selectedDailyCaseId = devReplayRequested
      ? await this.resolveDevReplayDailyCaseId(input.userId, todayCases.cases, {
          dailyCaseId: input.dailyCaseId,
          track: input.track,
          sequenceIndex: input.sequenceIndex,
        })
      : input.dailyCaseId
        ? input.dailyCaseId
        : await this.resolveStartableDailyCaseId(input.userId, todayCases.cases);

    if (!selectedDailyCaseId && !replayMode) {
      this.logEvent('daily.start.dev_replay.auto_lookup', {
        userId: input.userId,
        todayCaseIds: todayCases.cases.map((entry) => entry.dailyCaseId),
        todayCaseCount: todayCases.cases.length,
      });

      selectedDailyCaseId = await this.resolveAutoDevReplayDailyCaseId(
        input.userId,
        todayCases.cases,
      );

      if (selectedDailyCaseId) {
        replayMode = 'auto';
      }
    }

    if (!selectedDailyCaseId) {
      if (devReplayRequested) {
        this.logWarnEvent('daily.start.dev_replay.no_target', {
          userId: input.userId,
          requestedDailyCaseId: input.dailyCaseId ?? null,
          requestedTrack: input.track ?? null,
          requestedSequenceIndex: input.sequenceIndex ?? null,
        })
      }

      this.logWarnEvent('daily.start.waiting.no_selected_case', {
        userId: input.userId,
        replayMode,
        devReplayRequested,
        requestedDailyCaseId: input.dailyCaseId ?? null,
        requestedTrack: input.track ?? null,
        requestedSequenceIndex: input.sequenceIndex ?? null,
        todayCaseIds: todayCases.cases.map((entry) => entry.dailyCaseId),
        todayCaseCount: todayCases.cases.length,
      });

      return {
        state: 'waiting',
        nextCaseAt: this.getDefaultNextCaseAt().toISOString(),
      };
    }

    if (replayMode) {
      this.logEvent('daily.start.dev_replay.requested', {
        userId: input.userId,
        dailyCaseId: selectedDailyCaseId,
        mode: replayMode,
        requestedDailyCaseId: input.dailyCaseId ?? null,
        requestedTrack: input.track ?? null,
        requestedSequenceIndex: input.sequenceIndex ?? null,
      })

      await this.dailyCasesService.resetUserSessionForDailyCaseReplay(
        input.userId,
        selectedDailyCaseId,
      );
    }

    const result = await this.dailyCasesService.getOrCreateGameSessionForDailyCase(
      input.userId,
      selectedDailyCaseId,
    );
    const selectedCase: Pick<CaseModel, 'id' | 'difficulty' | 'date'> = {
      id: result.dailyCase.case.id,
      date: result.dailyCase.case.date,
      difficulty: result.dailyCase.case.difficulty,
    };
    const { dateKey } = this.getUtcDayRange(result.dailyCase.date);

    await this.cacheService.set(
      this.getSessionCacheKey(result.session.id),
      JSON.stringify({
        id: result.session.id,
        caseId: result.session.caseId,
        status: result.session.status,
      }),
      this.cacheTtlSeconds,
    );

    if (result.session.status !== 'active') {
      this.logWarnEvent('daily.start.waiting.non_active_session', {
        userId: input.userId,
        sessionId: result.session.id,
        dailyCaseId: result.dailyCase.id,
        sessionStatus: result.session.status,
        replayMode,
      });

      return {
        state: 'waiting',
        nextCaseAt: this.getDefaultNextCaseAt().toISOString(),
      };
    }

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
      state: 'ready',
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
    guess?: string;
    diagnosisRegistryId: string;
  }): Promise<SubmitGameGuessResponseDto> {
    const submittedDiagnosisRegistryId = input.diagnosisRegistryId?.trim();
    if (!submittedDiagnosisRegistryId) {
      throw new BadRequestException('diagnosisRegistryId is required');
    }

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
          user: {
            select: {
              subscriptionTier: true,
            },
          },
          dailyCase: {
            select: {
              track: true,
            },
          },
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

      this.assertSessionSubmitAccess({
        track: session.dailyCase.track,
        userTierAtStart: session.userTierAtStart,
        currentUserTier: session.user.subscriptionTier,
      });

      const gameplayCase = await this.hydrateGameplayCase(session.case);
      const maxClues = this.getTotalClues(gameplayCase);
      const sessionCaseWithRegistry = session.case as typeof session.case & {
        diagnosisRegistryId?: string | null;
      };
      const registryGuessEvaluation =
        await this.diagnosisRegistryMatcherService.evaluateGameplayGuess({
          expectedDiagnosisRegistryId:
            sessionCaseWithRegistry.diagnosisRegistryId ?? null,
          submittedGuessText: input.guess,
          submittedDiagnosisRegistryId,
        });
      const resolution = registryGuessEvaluation.resolution;
      const evaluation = registryGuessEvaluation.evaluation;
      const submittedGuess =
        resolution.submittedGuessText ??
        input.guess?.trim() ??
        submittedDiagnosisRegistryId?.trim() ??
        '';
      const normalizedGuess =
        resolution.normalizedGuess || evaluation.normalizedGuess || '';

      await this.rewardOrchestrator.emitAttemptEvaluated({
        sessionId: session.id,
        userId: input.userId,
        result: evaluation.label,
        semanticScore: evaluation.score,
        evaluatorVersion: evaluation.evaluatorVersion ?? 'registry:v2',
        retrievalMode: evaluation.retrievalMode ?? 'selected-id-only',
        submittedDiagnosisRegistryId:
          resolution.submittedDiagnosisRegistryId ?? null,
        submittedGuessText: resolution.submittedGuessText ?? null,
        resolvedDiagnosisRegistryId:
          resolution.resolvedDiagnosisRegistryId ?? null,
        resolutionMethod: resolution.resolutionMethod,
        resolutionReason: resolution.resolutionReason ?? null,
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
                user: {
                  select: {
                    subscriptionTier: true,
                  },
                },
                dailyCase: {
                  select: {
                    track: true,
                  },
                },
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

            this.assertSessionSubmitAccess({
              track: freshSession.dailyCase.track,
              userTierAtStart: freshSession.userTierAtStart,
              currentUserTier: freshSession.user.subscriptionTier,
            });

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
              guess: submittedGuess,
              normalizedGuess,
              selectedDiagnosisId:
                resolution.submittedDiagnosisRegistryId,
              strictMatchedDiagnosisId: resolution.resolvedDiagnosisRegistryId,
              strictMatchOutcome: resolution.resolutionMethod,
              score: outcome.computedScore,
              result: evaluation.label,
              signals: {
                ...evaluation.signals,
                strictMatchEnabled: true,
                strictMatchMatched: registryGuessEvaluation.isCorrect,
                strictMatchOutcome: resolution.resolutionMethod,
                selectedDiagnosisId: resolution.submittedDiagnosisRegistryId,
                strictMatchedDiagnosisId: resolution.resolvedDiagnosisRegistryId,
                retrievalMode: evaluation.retrievalMode ?? 'selected-id-only',
              } as Prisma.InputJsonValue,
              evaluatorVersion: evaluation.evaluatorVersion ?? 'registry:v2',
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
        ? this.buildGameplayExplanation({
            explanation: session.case.explanation,
            differentials: session.case.differentials,
          })
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
          evaluatorVersion: evaluation.evaluatorVersion ?? 'registry:v2',
          retrievalMode: evaluation.retrievalMode ?? 'selected-id-only',
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
    const explanation =
      session.status === 'completed'
        ? this.buildGameplayExplanation({
            explanation: session.case.explanation,
            differentials: session.case.differentials,
          })
        : null;

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
      explanation,
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

  private isDevReplayRequested(requested: boolean | undefined): boolean {
    if (!requested) {
      return false;
    }

    const env = getEnv();
    return env.NODE_ENV !== 'production' && env.ENABLE_DEV_REPLAY;
  }

  private async resolveDevReplayDailyCaseId(
    userId: string,
    cases: Array<{
      dailyCaseId: string;
      track: PublishTrack;
      sequenceIndex: number;
    }>,
    input: {
      dailyCaseId?: string;
      track?: PublishTrack;
      sequenceIndex?: number;
    },
  ): Promise<string | null> {
    if (cases.length === 0) {
      return null;
    }

    if (input.dailyCaseId) {
      const exactMatch = cases.find((entry) => entry.dailyCaseId === input.dailyCaseId);
      if (!exactMatch) {
        throw new BadRequestException(
          'Requested dev replay dailyCaseId is not available in today\'s feed',
        );
      }

      return exactMatch.dailyCaseId;
    }

    if (input.track && input.sequenceIndex) {
      const exactTrackMatch = cases.find(
        (entry) =>
          entry.track === input.track && entry.sequenceIndex === input.sequenceIndex,
      );

      if (!exactTrackMatch) {
        throw new BadRequestException(
          'Requested dev replay track/sequenceIndex is not available in today\'s feed',
        );
      }

      return exactTrackMatch.dailyCaseId;
    }

    if (input.track) {
      const trackCases = cases.filter((entry) => entry.track === input.track);

      if (trackCases.length === 0) {
        throw new BadRequestException(
          'Requested dev replay track is not available in today\'s feed',
        );
      }

      if (trackCases.length === 1) {
        return trackCases[0].dailyCaseId;
      }

      const recentTrackSession = await this.findMostRecentTodaySessionDailyCaseId(
        userId,
        trackCases.map((entry) => entry.dailyCaseId),
      );

      if (recentTrackSession) {
        return recentTrackSession;
      }

      throw new BadRequestException(
        'Dev replay target is ambiguous for this track; provide sequenceIndex or dailyCaseId',
      );
    }

    const recentTodaySession = await this.findMostRecentTodaySessionDailyCaseId(
      userId,
      cases.map((entry) => entry.dailyCaseId),
    );

    if (recentTodaySession) {
      return recentTodaySession;
    }

    if (cases.length === 1) {
      return cases[0].dailyCaseId;
    }

    throw new BadRequestException(
      'Dev replay target is ambiguous; provide dailyCaseId or track + sequenceIndex',
    );
  }

  private async resolveAutoDevReplayDailyCaseId(
    userId: string,
    cases: Array<{ dailyCaseId: string }>,
  ): Promise<string | null> {
    const env = getEnv();
    this.logEvent('daily.start.dev_replay.auto_lookup.evaluate', {
      userId,
      nodeEnv: env.NODE_ENV,
      enableDevReplay: env.ENABLE_DEV_REPLAY,
      todayCaseIds: cases.map((entry) => entry.dailyCaseId),
      todayCaseCount: cases.length,
    });

    if (env.NODE_ENV === 'production' || !env.ENABLE_DEV_REPLAY) {
      return null;
    }

    const replayDailyCaseId = await this.findMostRecentTodaySessionDailyCaseId(
      userId,
      cases.map((entry) => entry.dailyCaseId),
    );

    this.logEvent('daily.start.dev_replay.auto_lookup.result', {
      userId,
      replayDailyCaseId,
    });

    return replayDailyCaseId;
  }

  private async findMostRecentTodaySessionDailyCaseId(
    userId: string,
    dailyCaseIds: string[],
  ): Promise<string | null> {
    if (dailyCaseIds.length === 0) {
      return null;
    }

    const session = await this.prisma.gameSession.findFirst({
      where: {
        userId,
        dailyCaseId: {
          in: dailyCaseIds,
        },
      },
      orderBy: [{ startedAt: 'desc' }],
      select: {
        dailyCaseId: true,
      },
    });

    return session?.dailyCaseId ?? null;
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

  private buildGameplayExplanation(input: {
    explanation: Prisma.JsonValue | null;
    differentials?: string[] | null;
  }): GameplayCaseExplanation | null {
    const candidate = this.parseUnknownJson(input.explanation);
    const explanationRecord =
      candidate && typeof candidate === 'object' && !Array.isArray(candidate)
        ? (candidate as Record<string, unknown>)
        : null;

    const summary = this.normalizeOptionalText(explanationRecord?.summary);
    const keyFindings = this.normalizeStringArray(
      explanationRecord?.keyFindings,
    );
    const reasoningSegments = this.normalizeStringArray(
      explanationRecord?.reasoning,
    );
    const reasoning =
      reasoningSegments.length > 0
        ? reasoningSegments.join('\n\n')
        : this.normalizeOptionalText(explanationRecord?.reasoning);
    const differentials = this.normalizeStringArray(input.differentials);

    if (!summary && keyFindings.length === 0 && !reasoning && differentials.length === 0) {
      return null;
    }

    return {
      summary: summary ?? null,
      keyFindings: keyFindings.length > 0 ? keyFindings : null,
      reasoning: reasoning ?? null,
      differentials: differentials.length > 0 ? differentials : null,
    };
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

  private normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.normalizeOptionalText(item))
      .filter((item): item is string => item !== null);
  }

  private getSessionCacheKey(sessionId: string): string {
    return `game-session:${sessionId}`;
  }

  private getDefaultNextCaseAt(now = new Date()): Date {
    const next = new Date(now);
    next.setUTCHours(24, 0, 0, 0);
    return next;
  }

  private async resolveStartableDailyCaseId(
    userId: string,
    cases: Array<{ dailyCaseId: string }>,
  ): Promise<string | null> {
    if (cases.length === 0) {
      return null;
    }

    const sessions = await this.prisma.gameSession.findMany({
      where: {
        userId,
        dailyCaseId: {
          in: cases.map((entry) => entry.dailyCaseId),
        },
      },
      select: {
        dailyCaseId: true,
        status: true,
      },
    });

    const sessionByDailyCaseId = new Map(
      sessions.map((session) => [session.dailyCaseId, session.status]),
    );

    for (const dailyCase of cases) {
      const status = sessionByDailyCaseId.get(dailyCase.dailyCaseId);
      if (!status || status === 'active') {
        return dailyCase.dailyCaseId;
      }
    }

    return null;
  }

  private assertSessionSubmitAccess(input: {
    track: 'DAILY' | 'PREMIUM' | 'PRACTICE';
    userTierAtStart: string | null;
    currentUserTier: string | null;
  }): void {
    if (input.track !== 'PREMIUM') {
      return;
    }

    if (
      input.userTierAtStart === 'premium' ||
      hasPremiumTrackAccess(input.currentUserTier, input.track)
    ) {
      return;
    }

    throw new ForbiddenException(
      'Premium access is required to continue this daily case',
    );
  }

}
