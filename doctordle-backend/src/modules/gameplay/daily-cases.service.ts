import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CaseEditorialStatus,
  Prisma,
  PublishTrack,
  type GameSession,
  type User,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { ASSIGNABLE_EDITORIAL_STATUSES } from '../editorial/policies/publish-policy.js';
import {
  formatDailyCaseDisplayLabel,
  formatDailyCaseTrackDisplayLabel,
} from './daily-case-labels.js';
import { DailyLimitService } from './daily-limit.service';

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
    diagnosisId: string;
    clues: Prisma.JsonValue | null;
    explanation: Prisma.JsonValue | null;
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
        clues: true,
        explanation: true,
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
    attempts: Array<{ result: string }>;
  };
  dailyCase: DailyCaseWithCase;
  user: User;
};

type DailyCaseScheduleExcludedReason =
  | 'already_scheduled'
  | 'invalid_clues'
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

export type DailyCaseScheduleWindowResult = {
  startDate: string;
  days: number;
  createdCount: number;
  existingCount: number;
  missingDates: string[];
  createdSlots: DailyCaseScheduleWindowSlot[];
  existingSlots: DailyCaseScheduleWindowSlot[];
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
        result: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    },
  } satisfies Prisma.GameSessionInclude;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyLimitService: DailyLimitService,
  ) {}

  async ensureScheduleWindow(
    startDate: Date | string = new Date(),
    days = 7,
    source = 'daily_scheduler',
  ): Promise<DailyCaseScheduleWindowResult> {
    if (!Number.isInteger(days) || days < 1 || days > 31) {
      throw new BadRequestException(
        'Schedule window days must be an integer between 1 and 31',
      );
    }

    const normalizedStart = normalizeDailyDate(startDate);
    const windowDates = Array.from({ length: days }, (_, index) => {
      const date = new Date(normalizedStart);
      date.setUTCDate(date.getUTCDate() + index);
      return date;
    });
    const windowEnd = new Date(normalizedStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + days);
    const lastWindowDate = windowDates[windowDates.length - 1];
    const today = normalizeDailyDate(new Date());

    this.logger.log(
      JSON.stringify({
        event: 'daily_case.schedule.window.started',
        source,
        startDate: normalizedStart.toISOString(),
        days,
        endDateExclusive: windowEnd.toISOString(),
        track: PublishTrack.DAILY,
        sequenceIndex: 1,
      }),
    );

    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          await this.acquireScheduleWindowLock(tx);

          const existingWindowSlots = await tx.dailyCase.findMany({
            where: {
              date: {
                gte: normalizedStart,
                lte: lastWindowDate,
              },
              track: PublishTrack.DAILY,
              sequenceIndex: 1,
            },
            orderBy: [{ date: 'asc' }],
            ...dailyCaseWithCaseArgs,
          });
          const existingWindowDateKeys = new Set(
            existingWindowSlots.map((slot) => this.toDateKey(slot.date)),
          );

          for (const dailyCase of existingWindowSlots) {
            this.logger.log(
              JSON.stringify({
                event: 'daily_case.schedule.slot.exists',
                source,
                date: dailyCase.date.toISOString(),
                dailyCaseId: dailyCase.id,
                caseId: dailyCase.caseId,
                track: dailyCase.track,
                sequenceIndex: dailyCase.sequenceIndex,
              }),
            );
          }

          const scheduledAssignments = await tx.dailyCase.findMany({
            orderBy: [
              { date: 'asc' },
              { track: 'asc' },
              { sequenceIndex: 'asc' },
            ],
            select: {
              id: true,
              caseId: true,
              date: true,
              track: true,
              sequenceIndex: true,
            },
          });
          const scheduledCaseIds = new Set(
            scheduledAssignments.map((assignment) => assignment.caseId),
          );

          const inventoryCases = await tx.case.findMany({
            orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              title: true,
              diagnosisId: true,
              clues: true,
              explanation: true,
              editorialStatus: true,
              approvedAt: true,
            },
          });

          const eligibleCases: typeof inventoryCases = [];
          const excludedCases: DailyCaseScheduleWindowResult['excludedCases'] =
            [];

          for (const caseRecord of inventoryCases) {
            const reason = this.getScheduleExclusionReason(
              caseRecord,
              scheduledCaseIds,
            );

            if (reason) {
              excludedCases.push({ caseId: caseRecord.id, reason });
              this.logger.log(
                JSON.stringify({
                  event: 'daily_case.schedule.case.excluded',
                  source,
                  caseId: caseRecord.id,
                  caseTitle: caseRecord.title,
                  editorialStatus: caseRecord.editorialStatus ?? null,
                  reason,
                }),
              );
              continue;
            }

            eligibleCases.push(caseRecord);
          }

          this.logger.log(
            JSON.stringify({
              event: 'daily_case.schedule.inventory.loaded',
              source,
              inventoryCount: inventoryCases.length,
              eligibleCount: eligibleCases.length,
              excludedCount: excludedCases.length,
              alreadyScheduledCaseCount: scheduledCaseIds.size,
              existingWindowSlotCount: existingWindowSlots.length,
            }),
          );

          const usedCaseIds = new Set(scheduledCaseIds);
          const createRows: Array<{
            date: Date;
            caseId: string;
            track: PublishTrack;
            sequenceIndex: number;
          }> = [];
          const missingDates: string[] = [];

          for (const date of windowDates) {
            const dateKey = this.toDateKey(date);

            if (existingWindowDateKeys.has(dateKey)) {
              continue;
            }

            if (date.getTime() < today.getTime()) {
              missingDates.push(dateKey);
              this.logger.warn(
                JSON.stringify({
                  event: 'daily_case.schedule.slot.missing_no_inventory',
                  source,
                  date: date.toISOString(),
                  track: PublishTrack.DAILY,
                  sequenceIndex: 1,
                  reason: 'past_date_immutable',
                }),
              );
              continue;
            }

            const caseRecord = eligibleCases.find(
              (candidate) => !usedCaseIds.has(candidate.id),
            );

            if (!caseRecord) {
              missingDates.push(dateKey);
              this.logger.warn(
                JSON.stringify({
                  event: 'daily_case.schedule.slot.missing_no_inventory',
                  source,
                  date: date.toISOString(),
                  track: PublishTrack.DAILY,
                  sequenceIndex: 1,
                  remainingEligibleCaseCount: eligibleCases.filter(
                    (candidate) => !usedCaseIds.has(candidate.id),
                  ).length,
                }),
              );
              continue;
            }

            createRows.push({
              date,
              caseId: caseRecord.id,
              track: PublishTrack.DAILY,
              sequenceIndex: 1,
            });
            usedCaseIds.add(caseRecord.id);
          }

          const createResult =
            createRows.length > 0
              ? await tx.dailyCase.createMany({
                  data: createRows,
                  skipDuplicates: true,
                })
              : { count: 0 };

          const finalWindowSlots = await tx.dailyCase.findMany({
            where: {
              date: {
                gte: normalizedStart,
                lte: lastWindowDate,
              },
              track: PublishTrack.DAILY,
              sequenceIndex: 1,
            },
            orderBy: [{ date: 'asc' }],
            ...dailyCaseWithCaseArgs,
          });
          const finalSlotByDate = new Map(
            finalWindowSlots.map((slot) => [this.toDateKey(slot.date), slot]),
          );
          const createRowByDate = new Map(
            createRows.map((row) => [this.toDateKey(row.date), row]),
          );
          const createdSlots: DailyCaseScheduleWindowSlot[] = [];

          for (const [dateKey, row] of createRowByDate.entries()) {
            const dailyCase = finalSlotByDate.get(dateKey);
            if (!dailyCase || dailyCase.caseId !== row.caseId) {
              continue;
            }

            const slot = this.toScheduleWindowSlot(dailyCase);
            createdSlots.push(slot);
            this.logger.log(
              JSON.stringify({
                event: 'daily_case.schedule.slot.created',
                source,
                date: dailyCase.date.toISOString(),
                dailyCaseId: dailyCase.id,
                caseId: dailyCase.caseId,
                track: dailyCase.track,
                sequenceIndex: dailyCase.sequenceIndex,
              }),
            );
          }

          const result: DailyCaseScheduleWindowResult = {
            startDate: this.toDateKey(normalizedStart),
            days,
            createdCount: createResult.count,
            existingCount: existingWindowSlots.length,
            missingDates,
            createdSlots,
            existingSlots: existingWindowSlots.map((slot) =>
              this.toScheduleWindowSlot(slot),
            ),
            excludedCases,
          };

          this.logger.log(
            JSON.stringify({
              event: 'daily_case.schedule.window.completed',
              source,
              startDate: normalizedStart.toISOString(),
              days,
              createdCount: result.createdCount,
              existingCount: result.existingCount,
              missingDates: result.missingDates,
              excludedCount: result.excludedCases.length,
            }),
          );

          return result;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
  }

  async publishDailyCasesForDate(date: Date | string) {
    const normalizedDate = normalizeDailyDate(date);
    const nextDate = new Date(normalizedDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.dailyCase.findMany({
          where: {
            date: normalizedDate,
          },
          orderBy: [{ track: 'asc' }, { sequenceIndex: 'asc' }],
          ...dailyCaseWithCaseArgs,
        });

        this.logger.log(
          JSON.stringify({
            event: 'daily_case.publish.started',
            source: 'daily_publisher',
            normalizedDate: normalizedDate.toISOString(),
            existingSlotCount: existing.length,
          }),
        );

        const publishableCases = await tx.case.findMany({
          where: {
            // TODO(diagnosis-phase-7): Apply diagnosis publish readiness here when
            // publish gating moves beyond editorial status alone.
            editorialStatus: {
              in: [...ASSIGNABLE_EDITORIAL_STATUSES],
            },
            currentRevision: {
              is: {
                date: {
                  gte: normalizedDate,
                  lt: nextDate,
                },
              },
            },
          },
          orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            title: true,
            date: true,
            difficulty: true,
            diagnosisId: true,
            clues: true,
            explanation: true,
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
        });

        const groupedByTrack = new Map<PublishTrack, typeof publishableCases>();
        const usedCaseIds = new Set(
          existing.map((dailyCase) => dailyCase.caseId),
        );
        const existingSlotKeys = new Set(
          existing.map((dailyCase) =>
            this.getDailyCaseSlotKey(dailyCase.track, dailyCase.sequenceIndex),
          ),
        );

        this.logSuspiciousExistingAssignments(existing, normalizedDate);
        await this.logRecentDuplicateCaseAssignments(tx, normalizedDate);
        this.logPreservedSlots(existing, normalizedDate);

        for (const caseRecord of publishableCases) {
          if (!this.hasPlayableClueArray(caseRecord.clues)) {
            continue;
          }

          const track =
            caseRecord.currentRevision?.publishTrack ?? PublishTrack.DAILY;
          const group = groupedByTrack.get(track) ?? [];
          group.push(caseRecord);
          groupedByTrack.set(track, group);
        }

        const createRows = Array.from(groupedByTrack.entries())
          .sort(
            ([leftTrack], [rightTrack]) =>
              getTrackPriority(leftTrack) - getTrackPriority(rightTrack),
          )
          .flatMap(([track, cases]) => {
            const rows: Array<{
              date: Date;
              caseId: string;
              track: PublishTrack;
              sequenceIndex: number;
            }> = [];

            const sortedCases = [...cases].sort((left, right) =>
              left.id.localeCompare(right.id),
            );

            for (
              let sequenceIndex = 1;
              sequenceIndex <= sortedCases.length;
              sequenceIndex += 1
            ) {
              const slotKey = this.getDailyCaseSlotKey(track, sequenceIndex);

              if (existingSlotKeys.has(slotKey)) {
                continue;
              }

              const caseRecord = sortedCases.find(
                (candidate) => !usedCaseIds.has(candidate.id),
              );

              if (!caseRecord) {
                this.logger.warn(
                  JSON.stringify({
                    event: 'daily_case.publish.insufficient_unused_candidates',
                    source: 'daily_publisher',
                    normalizedDate: normalizedDate.toISOString(),
                    track,
                    sequenceIndex,
                    requiredSlotMissing: true,
                    candidateCount: sortedCases.length,
                    existingSlotCount: sortedCases.filter((candidate) =>
                      usedCaseIds.has(candidate.id),
                    ).length,
                  }),
                );
                break;
              }

              rows.push({
                date: normalizedDate,
                caseId: caseRecord.id,
                track,
                sequenceIndex,
              });
              usedCaseIds.add(caseRecord.id);
            }

            return rows;
          });

        if (createRows.length === 0) {
          if (existing.length === 0) {
            this.logger.warn(
              JSON.stringify({
                event: 'daily_case.publish.no_slots_created',
                source: 'daily_publisher',
                normalizedDate: normalizedDate.toISOString(),
                eligibleCandidateCount: publishableCases.length,
                playableTrackCount: groupedByTrack.size,
              }),
            );
          }

          this.logMissingRequiredSlots(existing, normalizedDate);

          return existing;
        }

        const caseById = new Map(
          publishableCases.map((caseRecord) => [caseRecord.id, caseRecord]),
        );
        this.logCreateRequestedSlots(createRows, normalizedDate, caseById);

        const createResult = await tx.dailyCase.createMany({
          data: createRows,
          skipDuplicates: true,
        });

        this.logger.log(
          JSON.stringify({
            event: 'daily_case.publish.create_many.completed',
            source: 'daily_publisher',
            normalizedDate: normalizedDate.toISOString(),
            requestedCreateCount: createRows.length,
            createdCount: createResult.count,
            skippedDuplicateCount: createRows.length - createResult.count,
          }),
        );

        const finalRows = await tx.dailyCase.findMany({
          where: {
            date: normalizedDate,
          },
          orderBy: [{ track: 'asc' }, { sequenceIndex: 'asc' }],
          ...dailyCaseWithCaseArgs,
        });

        this.logMissingRequiredSlots(finalRows, normalizedDate);
        this.logCreatedSlots(createRows, finalRows, normalizedDate);

        return finalRows;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
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
        clues: dailyCase.case.clues,
        explanation: dailyCase.case.explanation,
      },
    };
  }

  private hasPlayableClueArray(value: unknown): boolean {
    const parsed =
      typeof value === 'string'
        ? (() => {
            try {
              return JSON.parse(value);
            } catch {
              return null;
            }
          })()
        : value;

    return Array.isArray(parsed) && parsed.length > 0;
  }

  private assertDailyCasePlayableForStart(dailyCase: DailyCaseWithCase): void {
    const isAssignable = ASSIGNABLE_EDITORIAL_STATUSES.some(
      (status) => status === dailyCase.case.editorialStatus,
    );

    if (!isAssignable) {
      throw new BadRequestException(
        'Daily case is no longer eligible for gameplay',
      );
    }

    if (!this.hasPlayableClueArray(dailyCase.case.clues)) {
      throw new BadRequestException('Daily case has no playable clues');
    }
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
      clues: Prisma.JsonValue | null;
      explanation: Prisma.JsonValue | null;
      editorialStatus: CaseEditorialStatusLike;
    },
    scheduledCaseIds: Set<string>,
  ): DailyCaseScheduleExcludedReason | null {
    if (scheduledCaseIds.has(caseRecord.id)) {
      return 'already_scheduled';
    }

    const isAssignable = ASSIGNABLE_EDITORIAL_STATUSES.some(
      (status) => status === caseRecord.editorialStatus,
    );

    if (!isAssignable) {
      return 'invalid_status';
    }

    if (!this.hasPlayableClueArray(caseRecord.clues)) {
      return 'invalid_clues';
    }

    if (!caseRecord.diagnosisId?.trim()) {
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
