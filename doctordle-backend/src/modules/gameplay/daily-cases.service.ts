import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PublishTrack,
  type GameSession,
  type User,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { ASSIGNABLE_EDITORIAL_STATUSES } from '../editorial/policies/publish-policy.js';
import { DailyLimitService } from './daily-limit.service';

type SupportedSubscriptionTier = 'free' | 'premium' | 'practice';

type TodayCasePayload = {
  dailyCaseId: string;
  track: PublishTrack;
  sequenceIndex: number;
  case: {
    id: string;
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
        title: true,
        date: true,
        difficulty: true,
        diagnosisId: true,
        clues: true,
        explanation: true,
      },
    },
  },
} satisfies Prisma.DailyCaseDefaultArgs;

type DailyCaseWithCase = Prisma.DailyCaseGetPayload<
  typeof dailyCaseWithCaseArgs
>;

type ActiveSessionResult = {
  session: GameSession & {
    attempts: Array<{ result: string }>;
  };
  dailyCase: DailyCaseWithCase;
  user: User;
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

        if (existing.length > 0) {
          return existing;
        }

        const publishableCases = await tx.case.findMany({
          where: {
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
            currentRevision: {
              select: {
                publishTrack: true,
              },
            },
          },
        });

        if (publishableCases.length === 0) {
          return [];
        }

        const groupedByTrack = new Map<PublishTrack, typeof publishableCases>();

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
          .flatMap(([track, cases]) =>
            [...cases]
              .sort((left, right) => left.id.localeCompare(right.id))
              .map((caseRecord, index) => ({
                date: normalizedDate,
                caseId: caseRecord.id,
                track,
                sequenceIndex: index + 1,
              })),
          );

        if (createRows.length === 0) {
          return [];
        }

        await tx.dailyCase.createMany({
          data: createRows,
          skipDuplicates: true,
        });

        return tx.dailyCase.findMany({
          where: {
            date: normalizedDate,
          },
          orderBy: [{ track: 'asc' }, { sequenceIndex: 'asc' }],
          ...dailyCaseWithCaseArgs,
        });
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

    await this.publishDailyCasesForDate(normalizedDate);

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
            },
          });

          if (!existingSession) {
            return;
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
              throw new NotFoundException(`Daily case not found: ${dailyCaseId}`);
            }

            if (!hasPremiumTrackAccess(user.subscriptionTier, dailyCase.track)) {
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
      track: dailyCase.track,
      sequenceIndex: dailyCase.sequenceIndex,
      case: {
        id: dailyCase.case.id,
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
