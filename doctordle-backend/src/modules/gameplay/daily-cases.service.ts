import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisRegistryStatus,
  Prisma,
  PublishTrack,
  type GameSession,
  type User,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service';
import { DiagnosisRegistryLifecyclePolicyService } from '../diagnosis-registry/diagnosis-registry-lifecycle-policy.service.js';
import {
  AssignmentBlockedReason,
  AssignmentResult,
  CaseAssignmentService,
} from './case-assignment.service.js';
import {
  formatDailyCaseDisplayLabel,
  formatDailyCaseTrackDisplayLabel,
} from './daily-case-labels.js';
import { DailyLimitService } from './daily-limit.service';
import type { GameplayDiagnosisReadModel } from './dto/submit-game-guess.dto';

type SupportedSubscriptionTier = 'free' | 'premium' | 'practice';

type TodayCasePayload = {
  dailyCaseId: string;
  casePublicNumber: number | null;
  displayLabel: string;
  trackDisplayLabel: string;
  track: PublishTrack;
  sequenceIndex: number;
  case: {
    id: string;
    publicNumber: number | null;
    displayLabel: string;
    trackDisplayLabel: string;
    title: string;
    date: string;
    difficulty: string;
    diagnosisId: string | null;
    diagnosis: GameplayDiagnosisReadModel;
    clues: Prisma.JsonValue | null;
    explanation: Prisma.JsonValue | null;
    differentials: Prisma.JsonValue | null;
  };
};

const dailyCaseWithCaseArgs = {
  include: {
    case: {
      select: {
        id: true,
        publicNumber: true,
        title: true,
        date: true,
        difficulty: true,
        diagnosisId: true,
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
        clues: true,
        explanation: true,
        differentials: true,
        editorialStatus: true,
        currentRevisionId: true,
        currentRevision: {
          select: {
            id: true,
            date: true,
            publishTrack: true,
          },
        },
      },
    },
  },
} satisfies Prisma.DailyCaseDefaultArgs;

type DailyCaseWithCase = Prisma.DailyCaseGetPayload<
  typeof dailyCaseWithCaseArgs
>;

type CaseEditorialStatusLike = CaseEditorialStatus | null;

type ActiveSessionResult = {
  session: GameSession & {
    attempts: Array<{
      guess: string;
      result: string;
      score: number;
      clueIndexAtAttempt: number | null;
    }>;
  };
  dailyCase: DailyCaseWithCase;
  user: User;
};

type DailyCaseScheduleExcludedReason =
  | AssignmentBlockedReason
  | 'already_scheduled'
  | 'invalid_clues'
  | 'no_playable_clues'
  | 'invalid_clue_type'
  | 'missing_diagnosis'
  | 'missing_explanation'
  | 'invalid_status';

type DailyCaseScheduleWindowSlot = {
  date: string;
  dailyCaseId: string;
  caseId: string;
  track: PublishTrack;
  sequenceIndex: number;
};

export type DailyCaseScheduleWindowResult = AssignmentResult & {
  startDate: string;
  days: number;
  createdCount: number;
  existingCount: number;
  missingDates: string[];
  createdSlots: DailyCaseScheduleWindowSlot[];
  existingSlots: DailyCaseScheduleWindowSlot[];
  blockedCases: AssignmentResult['blockedCases'];
  skippedSlots: AssignmentResult['skippedSlots'];
  excludedCases: Array<{
    caseId: string;
    reason: DailyCaseScheduleExcludedReason;
  }>;
};

const TRACK_PRIORITY: Record<PublishTrack, number> = {
  [PublishTrack.DAILY]: 1,
  [PublishTrack.PREMIUM]: 2,
  [PublishTrack.PRACTICE]: 3,
};

export function normalizeDailyDate(value: Date | string = new Date()): Date {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid daily case date: ${value}`);
  }

  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

export function getTrackPriority(track: PublishTrack): number {
  return TRACK_PRIORITY[track] ?? Number.MAX_SAFE_INTEGER;
}

export function hasPremiumTrackAccess(
  tier: string | null | undefined,
  track: PublishTrack,
): boolean {
  if (track === PublishTrack.DAILY) {
    return true;
  }

  if (track === PublishTrack.PREMIUM) {
    return normalizeSubscriptionTier(tier) === 'premium';
  }

  return false;
}

function normalizeSubscriptionTier(
  tier: string | null | undefined,
): SupportedSubscriptionTier {
  const normalized = (tier ?? 'free').trim().toLowerCase();
  if (normalized === 'premium') {
    return 'premium';
  }

  if (normalized === 'practice') {
    return 'practice';
  }

  return 'free';
}

function getAllowedTracksForTier(
  tier: string | null | undefined,
): PublishTrack[] {
  const normalized = normalizeSubscriptionTier(tier);
  if (normalized === 'premium' || normalized === 'practice') {
    return [PublishTrack.DAILY, PublishTrack.PREMIUM];
  }

  return [PublishTrack.DAILY];
}

@Injectable()
export class DailyCasesService {
  private readonly logger = new Logger(DailyCasesService.name);

  private readonly sessionInclude = {
    attempts: {
      select: {
        guess: true,
        result: true,
        score: true,
        clueIndexAtAttempt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    },
  } satisfies Prisma.GameSessionInclude;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyLimitService: DailyLimitService,
    private readonly caseEligibilityPolicy: CaseEligibilityPolicyService,
    @Optional()
    private caseAssignmentService?: CaseAssignmentService,
    @Optional()
    private readonly lifecyclePolicy?: DiagnosisRegistryLifecyclePolicyService,
  ) {}

  async ensureScheduleWindow(
    startDate: Date | string = new Date(),
    days = 7,
    source = 'daily_scheduler',
  ): Promise<DailyCaseScheduleWindowResult> {
    return this.toScheduleWindowResult(
      await this.getAssignmentService().ensureWindow({
        startDate,
        days,
        source,
      }),
    );
  }

  async assignDailyCasesForDate(date: Date | string) {
    return this.getAssignmentService().assignDate({
      date,
      source: 'daily_publisher',
    });
  }

  async publishDailyCasesForDate(date: Date | string) {
    const normalizedDate = normalizeDailyDate(date);
    await this.assignDailyCasesForDate(normalizedDate);

    return this.prisma.dailyCase.findMany({
      where: {
        date: normalizedDate,
      },
      orderBy: [{ track: 'asc' }, { sequenceIndex: 'asc' }],
      ...dailyCaseWithCaseArgs,
    });
  }

  async listAvailableDailyCasesForTier(
    tier: string,
    date: Date | string = new Date(),
  ) {
    const normalizedDate = normalizeDailyDate(date);
    const allowedTracks = getAllowedTracksForTier(tier);

    return this.prisma.dailyCase.findMany({
      where: {
        date: normalizedDate,
        track: {
          in: allowedTracks,
        },
      },
      orderBy: [{ track: 'asc' }, { sequenceIndex: 'asc' }],
      ...dailyCaseWithCaseArgs,
    });
  }

  async getTodayCasesForUser(userId: string, date: Date | string = new Date()) {
    const normalizedDate = normalizeDailyDate(date);
    const user = await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
      },
      select: {
        subscriptionTier: true,
      },
    });

    const cases = await this.listAvailableDailyCasesForTier(
      user.subscriptionTier,
      normalizedDate,
    );

    return {
      date: normalizedDate.toISOString().slice(0, 10),
      cases: cases.map((dailyCase) => this.mapTodayCasePayload(dailyCase)),
    };
  }

  async findDailyCaseForDate(input: {
    date?: Date | string;
    track?: PublishTrack;
    sequenceIndex?: number;
  }): Promise<DailyCaseWithCase | null> {
    const normalizedDate = normalizeDailyDate(input.date ?? new Date());

    return this.prisma.dailyCase.findUnique({
      where: {
        date_track_sequenceIndex: {
          date: normalizedDate,
          track: input.track ?? PublishTrack.DAILY,
          sequenceIndex: input.sequenceIndex ?? 1,
        },
      },
      ...dailyCaseWithCaseArgs,
    });
  }

  async resetUserSessionForDailyCaseReplay(
    userId: string,
    dailyCaseId: string,
  ): Promise<void> {
    await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const user = await tx.user.upsert({
            where: { id: userId },
            update: {},
            create: {
              id: userId,
            },
          });

          const dailyCase = await tx.dailyCase.findUnique({
            where: {
              id: dailyCaseId,
            },
            select: {
              id: true,
              caseId: true,
              track: true,
            },
          });

          if (!dailyCase) {
            throw new NotFoundException(`Daily case not found: ${dailyCaseId}`);
          }

          if (!hasPremiumTrackAccess(user.subscriptionTier, dailyCase.track)) {
            throw new ForbiddenException(
              'Premium access is required to replay this daily case',
            );
          }

          const existingSession = await tx.gameSession.findUnique({
            where: {
              userId_dailyCaseId: {
                userId: user.id,
                dailyCaseId,
              },
            },
            select: {
              id: true,
              caseId: true,
            },
          });

          if (!existingSession) {
            return;
          }

          if (existingSession.caseId !== dailyCase.caseId) {
            throw new BadRequestException(
              'Existing session case no longer matches the assigned daily case',
            );
          }

          await tx.attempt.deleteMany({
            where: {
              sessionId: existingSession.id,
            },
          });

          await tx.leaderboardEntry.deleteMany({
            where: {
              userId: user.id,
              dailyCaseId,
            },
          });

          await tx.gameSession.update({
            where: {
              id: existingSession.id,
            },
            data: {
              status: 'active',
              startedAt: new Date(),
              completedAt: null,
              currentClueIndexLegacy: 0,
              processingAt: null,
              processedAt: null,
              xpAwardedAt: null,
              userTierAtStart: user.subscriptionTier,
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
  }

  async getOrCreateGameSessionForDailyCase(
    userId: string,
    dailyCaseId: string,
  ): Promise<ActiveSessionResult> {
    try {
      return await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const user = await tx.user.upsert({
              where: { id: userId },
              update: {},
              create: {
                id: userId,
              },
            });

            const dailyCase = await tx.dailyCase.findUnique({
              where: {
                id: dailyCaseId,
              },
              ...dailyCaseWithCaseArgs,
            });

            if (!dailyCase) {
              throw new NotFoundException(
                `Daily case not found: ${dailyCaseId}`,
              );
            }

            this.assertDailyCasePlayableForStart(dailyCase);

            if (
              !hasPremiumTrackAccess(user.subscriptionTier, dailyCase.track)
            ) {
              throw new ForbiddenException(
                'Premium access is required to start this daily case',
              );
            }

            const existingSession = await tx.gameSession.findUnique({
              where: {
                userId_dailyCaseId: {
                  userId: user.id,
                  dailyCaseId,
                },
              },
              include: this.sessionInclude,
            });

            if (existingSession) {
              if (existingSession.caseId !== dailyCase.caseId) {
                throw new BadRequestException(
                  'Existing session case no longer matches the assigned daily case',
                );
              }

              return {
                session: existingSession,
                dailyCase,
                user,
              } satisfies ActiveSessionResult;
            }

            const startOfDayUtc = normalizedDateRangeStart(dailyCase.date);
            const endOfDayUtc = new Date(startOfDayUtc);
            endOfDayUtc.setUTCDate(endOfDayUtc.getUTCDate() + 1);

            await this.dailyLimitService.assertCanStartInTransaction(tx, {
              userId: user.id,
              subscriptionTier: user.subscriptionTier,
              startOfDayUtc,
              endOfDayUtc,
            });

            const session = await tx.gameSession.create({
              data: {
                caseId: dailyCase.caseId,
                dailyCaseId: dailyCase.id,
                userId: user.id,
                userTierAtStart: user.subscriptionTier,
                status: 'active',
              },
              include: this.sessionInclude,
            });

            return {
              session,
              dailyCase,
              user,
            } satisfies ActiveSessionResult;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        ),
      );
    } catch (error) {
      const maybePrismaError = error as { code?: string };
      if (maybePrismaError.code !== 'P2002') {
        throw error;
      }

      const [session, dailyCase, user] = await Promise.all([
        this.prisma.gameSession.findUnique({
          where: {
            userId_dailyCaseId: {
              userId,
              dailyCaseId,
            },
          },
          include: this.sessionInclude,
        }),
        this.prisma.dailyCase.findUnique({
          where: {
            id: dailyCaseId,
          },
          ...dailyCaseWithCaseArgs,
        }),
        this.prisma.user.findUnique({
          where: {
            id: userId,
          },
        }),
      ]);

      if (!session || !dailyCase || !user) {
        throw error;
      }

      this.assertDailyCasePlayableForStart(dailyCase);

      if (session.caseId !== dailyCase.caseId) {
        throw new BadRequestException(
          'Existing session case no longer matches the assigned daily case',
        );
      }

      return {
        session,
        dailyCase,
        user,
      };
    }
  }

  private mapTodayCasePayload(dailyCase: DailyCaseWithCase): TodayCasePayload {
    return {
      dailyCaseId: dailyCase.id,
      casePublicNumber: dailyCase.case.publicNumber ?? null,
      displayLabel: formatDailyCaseDisplayLabel(dailyCase),
      trackDisplayLabel: formatDailyCaseTrackDisplayLabel(dailyCase),
      track: dailyCase.track,
      sequenceIndex: dailyCase.sequenceIndex,
      case: {
        id: dailyCase.case.id,
        publicNumber: dailyCase.case.publicNumber ?? null,
        displayLabel: formatDailyCaseDisplayLabel(dailyCase),
        trackDisplayLabel: formatDailyCaseTrackDisplayLabel(dailyCase),
        title: dailyCase.case.title,
        date: dailyCase.case.date.toISOString().slice(0, 10),
        difficulty: dailyCase.case.difficulty,
        diagnosisId: dailyCase.case.diagnosisId,
        diagnosis: this.buildDiagnosisReadModel(dailyCase.case),
        clues: dailyCase.case.clues,
        explanation: dailyCase.case.explanation,
        differentials: dailyCase.case.differentials,
      },
    };
  }

  private buildDiagnosisReadModel(source: {
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
  }): GameplayDiagnosisReadModel {
    const registry = source.diagnosisRegistry ?? null;
    const legacy = source.diagnosis ?? null;
    const legacyName = this.normalizeOptionalText(legacy?.name);
    const displayLabel =
      this.normalizeOptionalText(registry?.displayLabel) ??
      this.normalizeOptionalText(registry?.canonicalName) ??
      legacyName ??
      this.normalizeOptionalText(source.title) ??
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

  private normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private assertDailyCasePlayableForStart(dailyCase: DailyCaseWithCase): void {
    if (
      !this.caseEligibilityPolicy.isGameplayEditorialStatus(
        dailyCase.case.editorialStatus,
      )
    ) {
      throw new BadRequestException(
        'Daily case is no longer eligible for gameplay',
      );
    }

    const clueValidation = this.caseEligibilityPolicy.validatePlayableClues(
      dailyCase.case.clues,
      { caseId: dailyCase.case.id },
    );
    if (!clueValidation.valid) {
      throw new BadRequestException('Daily case has no playable clues');
    }
  }

  private getAssignmentService(): CaseAssignmentService {
    this.caseAssignmentService ??= new CaseAssignmentService(
      this.prisma,
      this.caseEligibilityPolicy,
      this.lifecyclePolicy,
    );
    return this.caseAssignmentService;
  }

  private toScheduleWindowResult(
    result: AssignmentResult,
  ): DailyCaseScheduleWindowResult {
    return {
      ...result,
      days: result.days ?? 1,
      excludedCases: result.blockedCases.map((item) => ({
        caseId: item.caseId,
        reason: item.reason,
      })),
    };
  }

  private getDailyCaseSlotKey(
    track: PublishTrack,
    sequenceIndex: number,
  ): string {
    return `${track}:${sequenceIndex}`;
  }

  private async acquireScheduleWindowLock(
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('daily_case_schedule_window'))`;
  }

  private getScheduleExclusionReason(
    caseRecord: {
      id: string;
      diagnosisId: string | null;
      diagnosisRegistryId: string | null;
      diagnosisMappingStatus: string;
      diagnosisRegistry?: {
        id: string;
        status: DiagnosisRegistryStatus;
        active: boolean;
        isPlayable: boolean;
      } | null;
      clues: Prisma.JsonValue | null;
      explanation: Prisma.JsonValue | null;
      editorialStatus: CaseEditorialStatusLike;
    },
    scheduledCaseIds: Set<string>,
  ): DailyCaseScheduleExcludedReason | null {
    if (scheduledCaseIds.has(caseRecord.id)) {
      return 'already_scheduled';
    }

    if (
      !this.caseEligibilityPolicy.isAssignableEditorialStatus(
        caseRecord.editorialStatus,
      )
    ) {
      return 'invalid_status';
    }

    const clueReason = this.caseEligibilityPolicy.getSchedulerClueExclusionReason(
      caseRecord.clues,
    );
    if (clueReason) {
      return clueReason;
    }

    if (
      !caseRecord.diagnosisRegistryId?.trim() ||
      caseRecord.diagnosisMappingStatus !== 'MATCHED' ||
      !this.isScheduleRegistryPlayable(caseRecord.diagnosisRegistry)
    ) {
      return 'missing_diagnosis';
    }

    if (
      caseRecord.explanation === null ||
      caseRecord.explanation === undefined
    ) {
      return 'missing_explanation';
    }

    return null;
  }

  private toScheduleWindowSlot(
    dailyCase: DailyCaseWithCase,
  ): DailyCaseScheduleWindowSlot {
    return {
      date: this.toDateKey(dailyCase.date),
      dailyCaseId: dailyCase.id,
      caseId: dailyCase.caseId,
      track: dailyCase.track,
      sequenceIndex: dailyCase.sequenceIndex,
    };
  }

  private isScheduleRegistryPlayable(
    registry:
      | {
          status: DiagnosisRegistryStatus;
          active: boolean;
          isPlayable: boolean;
        }
      | null
      | undefined,
  ): boolean {
    if (!registry) {
      return false;
    }

    return (
      this.lifecyclePolicy?.isPlayable(registry) ??
      (registry.status === DiagnosisRegistryStatus.ACTIVE &&
        registry.active &&
        registry.isPlayable)
    );
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private logSuspiciousExistingAssignments(
    existing: DailyCaseWithCase[],
    normalizedDate: Date,
  ): void {
    const caseIdCounts = new Map<string, number>();
    for (const dailyCase of existing) {
      caseIdCounts.set(
        dailyCase.caseId,
        (caseIdCounts.get(dailyCase.caseId) ?? 0) + 1,
      );
    }

    for (const dailyCase of existing) {
      if ((caseIdCounts.get(dailyCase.caseId) ?? 0) <= 1) {
        continue;
      }

      this.logger.warn(
        JSON.stringify({
          event: 'daily_case.publish.suspicious_existing_duplicate_case',
          source: 'daily_publisher',
          normalizedDate: normalizedDate.toISOString(),
          dailyCaseId: dailyCase.id,
          caseId: dailyCase.caseId,
          track: dailyCase.track,
          sequenceIndex: dailyCase.sequenceIndex,
        }),
      );
    }
  }

  private async logRecentDuplicateCaseAssignments(
    tx: Prisma.TransactionClient,
    normalizedDate: Date,
  ): Promise<void> {
    const recentWindowStart = new Date(normalizedDate);
    recentWindowStart.setUTCDate(recentWindowStart.getUTCDate() - 14);

    const recent = await tx.dailyCase.findMany({
      where: {
        date: {
          gte: recentWindowStart,
          lte: normalizedDate,
        },
      },
      orderBy: [{ date: 'asc' }, { track: 'asc' }, { sequenceIndex: 'asc' }],
      ...dailyCaseWithCaseArgs,
    });

    const byCaseId = new Map<string, DailyCaseWithCase[]>();
    for (const dailyCase of recent) {
      const rows = byCaseId.get(dailyCase.caseId) ?? [];
      rows.push(dailyCase);
      byCaseId.set(dailyCase.caseId, rows);
    }

    for (const [caseId, rows] of byCaseId.entries()) {
      const recentDates = Array.from(
        new Set(rows.map((row) => row.date.toISOString().slice(0, 10))),
      );

      if (recentDates.length <= 1) {
        continue;
      }

      this.logger.warn(
        JSON.stringify({
          event: 'daily_case.publish.recent_duplicate_case',
          source: 'daily_publisher',
          normalizedDate: normalizedDate.toISOString(),
          caseId,
          recentDateCount: recentDates.length,
          recentDates,
          assignments: rows.map((row) => ({
            dailyCaseId: row.id,
            normalizedDate: row.date.toISOString(),
            track: row.track,
            sequenceIndex: row.sequenceIndex,
          })),
        }),
      );
    }
  }

  private logPreservedSlots(
    existing: DailyCaseWithCase[],
    normalizedDate: Date,
  ): void {
    for (const dailyCase of existing) {
      this.logger.log(
        JSON.stringify({
          event: 'daily_case.publish.slot_preserved',
          source: 'daily_publisher',
          normalizedDate: normalizedDate.toISOString(),
          dailyCaseId: dailyCase.id,
          track: dailyCase.track,
          sequenceIndex: dailyCase.sequenceIndex,
          ...this.buildDailyCaseLogContext(dailyCase),
        }),
      );
    }
  }

  private logCreateRequestedSlots(
    createRows: Array<{
      date: Date;
      caseId: string;
      track: PublishTrack;
      sequenceIndex: number;
    }>,
    normalizedDate: Date,
    caseById: Map<
      string,
      {
        title: string;
        editorialStatus: CaseEditorialStatusLike;
        currentRevisionId: string | null;
        currentRevision: {
          date: Date;
          publishTrack: PublishTrack | null;
        } | null;
      }
    >,
  ): void {
    for (const row of createRows) {
      const caseRecord = caseById.get(row.caseId);
      this.logger.log(
        JSON.stringify({
          event: 'daily_case.create_requested',
          source: 'daily_publisher',
          normalizedDate: normalizedDate.toISOString(),
          track: row.track,
          sequenceIndex: row.sequenceIndex,
          caseId: row.caseId,
          caseTitle: caseRecord?.title ?? null,
          editorialStatus: caseRecord?.editorialStatus ?? null,
          currentRevisionId: caseRecord?.currentRevisionId ?? null,
          currentRevisionDate:
            caseRecord?.currentRevision?.date.toISOString() ?? null,
          currentRevisionPublishTrack:
            caseRecord?.currentRevision?.publishTrack ?? null,
        }),
      );
    }
  }

  private logCreatedSlots(
    createRows: Array<{
      date: Date;
      caseId: string;
      track: PublishTrack;
      sequenceIndex: number;
    }>,
    finalRows: DailyCaseWithCase[],
    normalizedDate: Date,
  ): void {
    const requestedSlotKeys = new Set(
      createRows.map((row) =>
        this.getDailyCaseSlotKey(row.track, row.sequenceIndex),
      ),
    );

    for (const dailyCase of finalRows) {
      const slotKey = this.getDailyCaseSlotKey(
        dailyCase.track,
        dailyCase.sequenceIndex,
      );

      if (!requestedSlotKeys.has(slotKey)) {
        continue;
      }

      this.logger.log(
        JSON.stringify({
          event: 'daily_case.created',
          source: 'daily_publisher',
          normalizedDate: normalizedDate.toISOString(),
          dailyCaseId: dailyCase.id,
          track: dailyCase.track,
          sequenceIndex: dailyCase.sequenceIndex,
          ...this.buildDailyCaseLogContext(dailyCase),
        }),
      );
    }
  }

  private logMissingRequiredSlots(
    finalRows: DailyCaseWithCase[],
    normalizedDate: Date,
  ): void {
    const hasRequiredSlot = finalRows.some(
      (row) => row.track === PublishTrack.DAILY && row.sequenceIndex === 1,
    );

    if (hasRequiredSlot) {
      return;
    }

    this.logger.warn(
      JSON.stringify({
        event: 'daily_case.publish.required_slot_missing',
        source: 'daily_publisher',
        normalizedDate: normalizedDate.toISOString(),
        track: PublishTrack.DAILY,
        sequenceIndex: 1,
        finalSlotCount: finalRows.length,
      }),
    );
  }

  private buildDailyCaseLogContext(dailyCase: DailyCaseWithCase) {
    return {
      caseId: dailyCase.caseId,
      caseTitle: dailyCase.case.title,
      editorialStatus: dailyCase.case.editorialStatus ?? null,
      currentRevisionId: dailyCase.case.currentRevisionId ?? null,
      currentRevisionDate:
        dailyCase.case.currentRevision?.date.toISOString() ?? null,
      currentRevisionPublishTrack:
        dailyCase.case.currentRevision?.publishTrack ?? null,
    };
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

function normalizedDateRangeStart(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
