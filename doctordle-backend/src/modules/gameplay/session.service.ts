import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PublishTrack } from '@prisma/client';
import { AIContentService } from '../ai/ai-content.service';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { getEnv } from '../../core/config/env.validation';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service';
import { DiagnosisRegistryMatcherService } from '../diagnosis-registry/diagnosis-registry-matcher.service';
import type { ResolvedGameplayDiagnosisGuess } from '../diagnosis-registry/diagnosis-registry-matcher.service';
import { DiagnosisRegistrySnapshotService } from '../diagnosis-registry/diagnosis-registry-snapshot.service';
import { AttemptService } from './attempt.service';
import {
  DailyCasesService,
  hasPremiumTrackAccess,
} from './daily-cases.service';
import {
  formatDailyCaseDisplayLabel,
  formatDailyCaseTrackDisplayLabel,
} from './daily-case-labels.js';
import type {
  GameplayDiagnosisReadModel,
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
      completedAt: Date | null;
      shouldRequestReward: boolean;
      isTerminalCorrect: boolean;
    };

type GameplayCaseView = {
  id: string;
  publicNumber: number | null;
  displayLabel?: string;
  trackDisplayLabel?: string;
  difficulty: string;
  date: Date;
  diagnosis: GameplayDiagnosisReadModel;
  clues: GameplayClinicalClue[];
};

type CaseDiagnosisSource = {
  title?: string | null;
  diagnosis?: {
    id?: string | null;
    name?: string | null;
    system?: string | null;
  } | null;
  diagnosisRegistry?: {
    id: string;
    displayLabel: string;
    canonicalName: string;
    specialty?: string | null;
    category?: string | null;
    bodySystem?: string | null;
  } | null;
};

type StartDailyGameResponse =
  | {
      state: 'ready';
      sessionId: string;
      dailyCaseId: string;
      casePublicNumber: number | null;
      displayLabel: string;
      trackDisplayLabel: string;
      dailyCaseDisplayLabel: string;
      dailyCaseTrackDisplayLabel: string;
      clueIndex: number;
      attemptsCount: number;
      startedAt: string;
      completedAt: string | null;
      case: ReturnType<SessionService['buildCasePayload']>;
    }
  | {
      state: 'completed';
      sessionId: string;
      dailyCaseId: string;
      casePublicNumber: number | null;
      displayLabel: string;
      trackDisplayLabel: string;
      dailyCaseDisplayLabel: string;
      dailyCaseTrackDisplayLabel: string;
      clueIndex: number;
      attemptsCount: number;
      attempts: Array<{
        guess: string;
        result: 'correct' | 'close' | 'wrong';
        score: number;
        clueIndexAtAttempt: number | null;
      }>;
      score: number;
      startedAt: string;
      completedAt: string;
      gameOver: true;
      gameOverReason: 'correct' | 'clues_exhausted';
      explanation: GameplayCaseExplanation | null;
      nextCaseAt: string;
      case: ReturnType<SessionService['buildCasePayload']>;
    }
  | {
      state: 'waiting';
      nextCaseAt: string;
    };

type CompletedLearningLibraryResponse = {
  generatedAt: string;
  cases: Array<{
    sessionId: string;
    dailyCaseId: string;
    casePublicNumber: number | null;
    displayLabel: string;
    trackDisplayLabel: string;
    track: PublishTrack;
    sequenceIndex: number;
    completedAt: string;
    playerResult: {
      solved: boolean;
      attemptsUsed: number;
      timeSecs: number | null;
    };
    case: {
      id: string;
      publicNumber: number | null;
      displayLabel: string;
      trackDisplayLabel: string;
      title: string;
      date: string;
      difficulty: string;
      clues: GameplayClinicalClue[];
      explanation: GameplayCaseExplanation | null;
      specialty: string;
      category: string | null;
      bodySystem: string | null;
      diagnosis: GameplayDiagnosisReadModel;
    };
  }>;
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
    private readonly caseEligibilityPolicy: CaseEligibilityPolicyService,
    private readonly diagnosisRegistrySnapshotService: DiagnosisRegistrySnapshotService,
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

  async getCompletedLearningLibrary(input: {
    userId: string;
    limit?: number;
  }): Promise<CompletedLearningLibraryResponse> {
    const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 100)));
    const sessions = await this.prisma.gameSession.findMany({
      where: {
        userId: input.userId,
        status: 'completed',
        completedAt: {
          not: null,
        },
      },
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
      take: limit,
      include: {
        dailyCase: {
          select: {
            id: true,
            date: true,
            track: true,
            sequenceIndex: true,
          },
        },
        case: {
          include: {
            diagnosis: {
              select: {
                id: true,
                name: true,
                system: true,
              },
            },
            diagnosisRegistry: {
              select: {
                id: true,
                displayLabel: true,
                canonicalName: true,
                specialty: true,
                category: true,
                bodySystem: true,
              },
            },
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

    const cases = await Promise.all(
      sessions.map(async (session) => {
        const gameplayCase = await this.hydrateGameplayCase(session.case);
        const responseCase = this.buildCasePayload(gameplayCase);
        const latestAttempt = session.attempts.at(-1);
        const completedAt = session.completedAt ?? new Date();
        const timeSecs =
          session.startedAt && session.completedAt
            ? Math.max(
                0,
                Math.round(
                  (session.completedAt.getTime() -
                    session.startedAt.getTime()) /
                    1000,
                ),
              )
            : null;

        return {
          sessionId: session.id,
          dailyCaseId: session.dailyCaseId,
          casePublicNumber: session.case.publicNumber ?? null,
          displayLabel: formatDailyCaseDisplayLabel({
            ...session.dailyCase,
            case: session.case,
          }),
          trackDisplayLabel: formatDailyCaseTrackDisplayLabel(
            {
              ...session.dailyCase,
              case: session.case,
            },
          ),
          track: session.dailyCase.track,
          sequenceIndex: session.dailyCase.sequenceIndex,
          completedAt: completedAt.toISOString(),
          playerResult: {
            solved: latestAttempt?.result === 'correct',
            attemptsUsed: session.attempts.length,
            timeSecs,
          },
          case: {
            id: session.case.id,
            publicNumber: session.case.publicNumber ?? null,
            diagnosisRegistryId: session.case.diagnosisRegistryId ?? null,
            educationAvailable: Boolean(session.case.diagnosisRegistryId),
            displayLabel: responseCase.displayLabel,
            trackDisplayLabel: responseCase.trackDisplayLabel,
            title: session.case.title,
            diagnosis: responseCase.diagnosis,
            specialty: responseCase.diagnosis.specialty,
            category: responseCase.diagnosis.category,
            bodySystem: responseCase.diagnosis.bodySystem,
            date: session.case.date.toISOString().slice(0, 10),
            difficulty: session.case.difficulty,
            clues: responseCase.clues,
            explanation: this.buildGameplayExplanation({
              explanation: session.case.explanation,
              differentials: session.case.differentials,
            }),
          },
        };
      }),
    );

    return {
      generatedAt: new Date().toISOString(),
      cases,
    };
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
      : this.resolveRequestedStartDailyCaseId(todayCases.cases, {
          dailyCaseId: input.dailyCaseId,
          track: input.track,
          sequenceIndex: input.sequenceIndex,
        }) ??
        (await this.resolveStartableDailyCaseId(
          input.userId,
          todayCases.cases,
        ));

    if (!selectedDailyCaseId && !replayMode) {
      selectedDailyCaseId = await this.findMostRecentTodaySessionDailyCaseId(
        input.userId,
        todayCases.cases.map((entry) => entry.dailyCaseId),
      );
    }

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
        });
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
      });

      await this.dailyCasesService.resetUserSessionForDailyCaseReplay(
        input.userId,
        selectedDailyCaseId,
      );
    }

    const result =
      await this.dailyCasesService.getOrCreateGameSessionForDailyCase(
        input.userId,
        selectedDailyCaseId,
      );

    this.assertSessionMatchesDailyCase({
      sessionId: result.session.id,
      sessionCaseId: result.session.caseId,
      dailyCaseId: result.dailyCase.id,
      dailyCaseCaseId: result.dailyCase.caseId,
    });

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

    if (result.session.status === 'completed' && result.session.completedAt) {
      return await this.buildCompletedStartResponse(result);
    }

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
    const displayLabel = formatDailyCaseDisplayLabel(result.dailyCase);
    const trackDisplayLabel = formatDailyCaseTrackDisplayLabel(
      result.dailyCase,
    );
    const responseCase = {
      ...this.buildCasePayload(gameplayCase),
      displayLabel,
      trackDisplayLabel,
    };

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
      casePublicNumber: result.dailyCase.case.publicNumber ?? null,
      displayLabel,
      trackDisplayLabel,
      dailyCaseDisplayLabel: displayLabel,
      dailyCaseTrackDisplayLabel: trackDisplayLabel,
      clueIndex,
      attemptsCount: resumedAttempts.length,
      startedAt: result.session.startedAt.toISOString(),
      completedAt: result.session.completedAt
        ? result.session.completedAt.toISOString()
        : null,
      case: responseCase,
    };
  }

  private async buildCompletedStartResponse(input: Awaited<
    ReturnType<DailyCasesService['getOrCreateGameSessionForDailyCase']>
  >): Promise<Extract<StartDailyGameResponse, { state: 'completed' }>> {
    if (!input.session.completedAt) {
      throw new BadRequestException('Completed session is missing completedAt');
    }

    const gameplayCase = await this.hydrateGameplayCase(input.dailyCase.case);
    const maxClues = this.getTotalClues(gameplayCase);
    const displayLabel = formatDailyCaseDisplayLabel(input.dailyCase);
    const trackDisplayLabel = formatDailyCaseTrackDisplayLabel(input.dailyCase);
    const responseCase = {
      ...this.buildCasePayload(gameplayCase),
      displayLabel,
      trackDisplayLabel,
    };
    const attempts = input.session.attempts.map((attempt) => ({
      guess: attempt.guess,
      result: this.normalizeAttemptResult(attempt.result),
      score: attempt.score,
      clueIndexAtAttempt: attempt.clueIndexAtAttempt,
    }));
    const latestAttempt = attempts.at(-1);
    const gameOverReason =
      latestAttempt?.result === 'correct' ? 'correct' : 'clues_exhausted';
    const clueIndex =
      gameOverReason === 'correct'
        ? (latestAttempt?.clueIndexAtAttempt ?? maxClues)
        : maxClues;

    return {
      state: 'completed',
      sessionId: input.session.id,
      dailyCaseId: input.dailyCase.id,
      casePublicNumber: input.dailyCase.case.publicNumber ?? null,
      displayLabel,
      trackDisplayLabel,
      dailyCaseDisplayLabel: displayLabel,
      dailyCaseTrackDisplayLabel: trackDisplayLabel,
      clueIndex,
      attemptsCount: attempts.length,
      attempts,
      score: latestAttempt?.score ?? 0,
      startedAt: input.session.startedAt.toISOString(),
      completedAt: input.session.completedAt.toISOString(),
      gameOver: true,
      gameOverReason,
      explanation: this.buildGameplayExplanation({
        explanation: input.dailyCase.case.explanation,
        differentials: input.dailyCase.case.differentials,
      }),
      nextCaseAt: this.getDefaultNextCaseAt().toISOString(),
      case: responseCase,
    };
  }

  private normalizeAttemptResult(value: string): 'correct' | 'close' | 'wrong' {
    return value === 'correct' || value === 'close' ? value : 'wrong';
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
              diagnosis: {
                select: {
                  id: true,
                  name: true,
                  system: true,
                },
              },
              diagnosisRegistry: {
                select: {
                  id: true,
                  displayLabel: true,
                  canonicalName: true,
                  specialty: true,
                  category: true,
                  bodySystem: true,
                },
              },
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

      await this.assertResolvableDiagnosisSelection({
        sessionId: session.id,
        userId: input.userId,
        resolution,
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
              selectedDiagnosisId: resolution.submittedDiagnosisRegistryId,
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
                strictMatchedDiagnosisId:
                  resolution.resolvedDiagnosisRegistryId,
                retrievalMode: evaluation.retrievalMode ?? 'selected-id-only',
              } as Prisma.InputJsonValue,
              evaluatorVersion: evaluation.evaluatorVersion ?? 'registry:v2',
              clueIndexAtAttempt: outcome.clueIndex,
            });

            const completedAt = outcome.gameOver ? new Date() : null;
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
                    completedAt,
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
              completedAt,
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
          startedAt: session.startedAt.toISOString(),
          completedAt: session.completedAt
            ? session.completedAt.toISOString()
            : null,
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
        startedAt: session.startedAt.toISOString(),
        completedAt: persisted.completedAt
          ? persisted.completedAt.toISOString()
          : session.completedAt
            ? session.completedAt.toISOString()
            : null,
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
            diagnosis: {
              select: {
                id: true,
                name: true,
                system: true,
              },
            },
            diagnosisRegistry: {
              select: {
                id: true,
                displayLabel: true,
                canonicalName: true,
                specialty: true,
                category: true,
                bodySystem: true,
              },
            },
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
        ? responseCase
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
            diagnosis: {
              select: {
                id: true,
                name: true,
                system: true,
              },
            },
            diagnosisRegistry: {
              select: {
                id: true,
                displayLabel: true,
                canonicalName: true,
                specialty: true,
                category: true,
                bodySystem: true,
              },
            },
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
      diagnosis: session.status === 'completed' ? responseCase.diagnosis : null,
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
      const exactMatch = cases.find(
        (entry) => entry.dailyCaseId === input.dailyCaseId,
      );
      if (!exactMatch) {
        throw new BadRequestException(
          "Requested dev replay dailyCaseId is not available in today's feed",
        );
      }

      return exactMatch.dailyCaseId;
    }

    if (input.track && input.sequenceIndex) {
      const exactTrackMatch = cases.find(
        (entry) =>
          entry.track === input.track &&
          entry.sequenceIndex === input.sequenceIndex,
      );

      if (!exactTrackMatch) {
        throw new BadRequestException(
          "Requested dev replay track/sequenceIndex is not available in today's feed",
        );
      }

      return exactTrackMatch.dailyCaseId;
    }

    if (input.track) {
      const trackCases = cases.filter((entry) => entry.track === input.track);

      if (trackCases.length === 0) {
        throw new BadRequestException(
          "Requested dev replay track is not available in today's feed",
        );
      }

      if (trackCases.length === 1) {
        return trackCases[0].dailyCaseId;
      }

      const recentTrackSession =
        await this.findMostRecentTodaySessionDailyCaseId(
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

  private resolveRequestedStartDailyCaseId(
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
  ): string | null {
    if (input.dailyCaseId) {
      const exactMatch = cases.find(
        (entry) => entry.dailyCaseId === input.dailyCaseId,
      );

      if (!exactMatch) {
        throw new BadRequestException(
          "Requested dailyCaseId is not available in today's feed",
        );
      }

      return exactMatch.dailyCaseId;
    }

    if (!input.track && !input.sequenceIndex) {
      return null;
    }

    if (!input.track || !input.sequenceIndex) {
      throw new BadRequestException(
        'Provide both track and sequenceIndex to select a daily case',
      );
    }

    const exactTrackMatch = cases.find(
      (entry) =>
        entry.track === input.track &&
        entry.sequenceIndex === input.sequenceIndex,
    );

    if (!exactTrackMatch) {
      throw new BadRequestException(
        "Requested track/sequenceIndex is not available in today's feed",
      );
    }

    return exactTrackMatch.dailyCaseId;
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

  private async assertResolvableDiagnosisSelection(input: {
    sessionId: string;
    userId: string;
    resolution: ResolvedGameplayDiagnosisGuess;
  }): Promise<void> {
    if (
      input.resolution.isResolvable &&
      input.resolution.resolutionMethod === 'SELECTED_ID'
    ) {
      return;
    }

    this.logWarnEvent('daily.guess.invalid_selected_diagnosis', {
      sessionId: input.sessionId,
      userId: input.userId,
      submittedDiagnosisRegistryId:
        input.resolution.submittedDiagnosisRegistryId,
      resolutionMethod: input.resolution.resolutionMethod,
      resolutionReason: input.resolution.resolutionReason ?? null,
    });

    const dictionaryVersion =
      await this.diagnosisRegistrySnapshotService.getVersion();
    const staleSelection =
      input.resolution.resolutionReason === 'MERGED_SELECTED_ID' ||
      input.resolution.resolutionReason === 'UNUSABLE_SELECTED_ID';

    throw new BadRequestException({
      code: staleSelection
        ? 'DICTIONARY_STALE'
        : 'INVALID_DIAGNOSIS_SELECTION',
      message: staleSelection
        ? 'Diagnosis dictionary changed. Please reselect your diagnosis.'
        : 'Selected diagnosis is no longer available. Please reselect your diagnosis.',
      currentDictionaryVersion: dictionaryVersion.version,
      resolutionMethod: input.resolution.resolutionMethod,
      resolutionReason: input.resolution.resolutionReason ?? null,
      submittedDiagnosisRegistryId:
        input.resolution.submittedDiagnosisRegistryId,
      resolvedDiagnosisRegistryId:
        input.resolution.resolvedDiagnosisRegistryId,
    });
  }

  private async hydrateGameplayCase(selectedCase: {
    id: string;
    publicNumber?: number | null;
    difficulty: string;
    date: Date;
    title?: string | null;
    diagnosis?: CaseDiagnosisSource['diagnosis'];
    diagnosisRegistry?: CaseDiagnosisSource['diagnosisRegistry'];
  }): Promise<GameplayCaseView> {
    return {
      ...selectedCase,
      publicNumber: selectedCase.publicNumber ?? null,
      diagnosis: this.buildDiagnosisReadModel(selectedCase),
      clues: await this.getCaseClues(selectedCase.id),
    };
  }

  private buildDiagnosisReadModel(
    source: CaseDiagnosisSource,
  ): GameplayDiagnosisReadModel {
    const registry = source.diagnosisRegistry ?? null;
    const legacy = source.diagnosis ?? null;
    const legacyName = this.normalizeOptionalText(legacy?.name);
    const title = this.normalizeOptionalText(source.title);
    const displayLabel =
      this.normalizeOptionalText(registry?.displayLabel) ??
      this.normalizeOptionalText(registry?.canonicalName) ??
      legacyName ??
      title ??
      'Unknown diagnosis';
    const canonicalName =
      this.normalizeOptionalText(registry?.canonicalName) ??
      legacyName ??
      null;
    const specialty =
      this.normalizeOptionalText(registry?.specialty) ??
      this.normalizeOptionalText(registry?.category) ??
      this.normalizeOptionalText(registry?.bodySystem) ??
      this.normalizeOptionalText(legacy?.system) ??
      'General Medicine';

    return {
      id: registry?.id ?? legacy?.id ?? null,
      displayLabel,
      canonicalName,
      specialty,
      category: this.normalizeOptionalText(registry?.category),
      bodySystem: this.normalizeOptionalText(registry?.bodySystem),
    };
  }

  private async getCaseClues(caseId: string): Promise<GameplayClinicalClue[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ clues: unknown | null }>
    >('SELECT "clues" FROM "Case" WHERE "id" = $1', caseId);

    const rawClues = rows[0]?.clues;
    const parsedClues = this.caseEligibilityPolicy.validatePlayableClues(
      rawClues,
      { caseId },
    ).clues;
    if (!parsedClues.length) {
      throw new BadRequestException(`Case ${caseId} has no playable clues`);
    }

    return parsedClues;
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
    const differentialAnalysis = this.normalizeDifferentialAnalysis(
      explanationRecord?.differentialAnalysis,
    );

    if (
      !summary &&
      keyFindings.length === 0 &&
      !reasoning &&
      differentials.length === 0 &&
      differentialAnalysis.length === 0
    ) {
      return null;
    }

    return {
      summary: summary ?? null,
      keyFindings: keyFindings.length > 0 ? keyFindings : null,
      reasoning: reasoning ?? null,
      differentials: differentials.length > 0 ? differentials : null,
      differentialAnalysis:
        differentialAnalysis.length > 0 ? differentialAnalysis : null,
    };
  }

  private normalizeDifferentialAnalysis(value: unknown): NonNullable<
    GameplayCaseExplanation['differentialAnalysis']
  > {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }

        const record = item as Record<string, unknown>;
        const diagnosis = this.normalizeOptionalText(record.diagnosis);
        const whyPlausibleEarly = this.normalizeOptionalText(
          record.whyPlausibleEarly,
        );
        const finalReasonLessLikely = this.normalizeOptionalText(
          record.finalReasonLessLikely,
        );

        if (!diagnosis || !whyPlausibleEarly || !finalReasonLessLikely) {
          return null;
        }

        const ruledOutByClues = Array.isArray(record.ruledOutByClues)
          ? record.ruledOutByClues
              .map((ruleOut) => {
                if (
                  !ruleOut ||
                  typeof ruleOut !== 'object' ||
                  Array.isArray(ruleOut)
                ) {
                  return null;
                }

                const ruleOutRecord = ruleOut as Record<string, unknown>;
                const clueOrder =
                  typeof ruleOutRecord.clueOrder === 'number' &&
                  Number.isFinite(ruleOutRecord.clueOrder)
                    ? ruleOutRecord.clueOrder
                    : null;
                const evidence = this.normalizeOptionalText(
                  ruleOutRecord.evidence,
                );
                const reason = this.normalizeOptionalText(
                  ruleOutRecord.reason,
                );

                if (clueOrder === null || !evidence || !reason) {
                  return null;
                }

                return {
                  clueOrder,
                  evidence,
                  reason,
                };
              })
              .filter(
                (
                  ruleOut,
                ): ruleOut is NonNullable<
                  GameplayCaseExplanation['differentialAnalysis']
                >[number]['ruledOutByClues'][number] => ruleOut !== null,
              )
          : [];

        return {
          diagnosis,
          whyPlausibleEarly,
          ruledOutByClues,
          finalReasonLessLikely,
        };
      })
      .filter(
        (
          item,
        ): item is NonNullable<
          GameplayCaseExplanation['differentialAnalysis']
        >[number] => item !== null,
      );
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
      casePublicNumber: selectedCase.publicNumber,
      displayLabel:
        selectedCase.displayLabel ??
        (selectedCase.publicNumber
          ? `Case ${selectedCase.publicNumber}`
          : `Daily Case ${selectedCase.date.toISOString().slice(0, 10)} #1`),
      trackDisplayLabel:
        selectedCase.trackDisplayLabel ??
        (selectedCase.publicNumber
          ? `Daily Case ${selectedCase.publicNumber}`
          : `Daily Case ${selectedCase.date.toISOString().slice(0, 10)} #1`),
      difficulty: selectedCase.difficulty,
      date: selectedCase.date.toISOString().slice(0, 10),
      diagnosis: selectedCase.diagnosis,
      clues,
    };
  }

  private getTotalClues(selectedCase: GameplayCaseView): number {
    return selectedCase.clues.length;
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

  private assertSessionMatchesDailyCase(input: {
    sessionId: string;
    sessionCaseId: string;
    dailyCaseId: string;
    dailyCaseCaseId: string;
  }): void {
    if (input.sessionCaseId === input.dailyCaseCaseId) {
      return;
    }

    this.logWarnEvent('daily.start.session_assignment_mismatch', {
      sessionId: input.sessionId,
      dailyCaseId: input.dailyCaseId,
      sessionCaseId: input.sessionCaseId,
      dailyCaseCaseId: input.dailyCaseCaseId,
    });

    throw new BadRequestException(
      'Session case no longer matches the assigned daily case',
    );
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
