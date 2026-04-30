import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { CasesService } from '../cases/cases.service';

type LeaderboardMode = 'daily' | 'weekly';
type LeaderboardRow = {
  userId: string;
  score: number;
  attemptsCount: number;
  timeToComplete: number | null;
  completedAt: Date;
  user: {
    displayName: string | null;
    stats: {
      currentStreak: number;
    } | null;
    organizations: Array<{
      organization: {
        name: string;
      };
    }>;
  };
};

type LeaderboardAggregate = LeaderboardRow & {
  casesCompleted: number;
  totalTimeToComplete: number | null;
};

type LeaderboardEntryDto = {
  rank: number;
  userId: string;
  displayName?: string;
  organizationName?: string;
  streak?: number;
  score: number;
  attemptsCount: number;
  timeToComplete?: number | null;
  totalTimeToComplete?: number | null;
  casesCompleted?: number;
  completedAt: string;
};

type LeaderboardCacheDiagnosticMode = 'daily' | 'weekly';
export type LeaderboardCacheDiagnostic = {
  key: string;
  hit: boolean;
};

@Injectable()
export class LeaderboardService {
  private readonly leaderboardTtlSeconds = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
    private readonly casesService: CasesService,
  ) {}

  async getCacheDiagnostic(input: {
    mode: LeaderboardCacheDiagnosticMode;
    limit: number;
  }): Promise<LeaderboardCacheDiagnostic> {
    const key =
      input.mode === 'daily'
        ? this.getDailyCacheKey(input.limit)
        : this.getWeeklyCacheKey(input.limit);
    const cached = await this.cache.get(key);

    return {
      key,
      hit: Boolean(cached),
    };
  }

  async getToday(limit = 50) {
    const { date } = this.getUtcDayRange();
    const key = `leaderboard:daily:v4:${date}:${limit}`;

    const cached = await this.cache.get(key);
    if (cached) {
      this.metrics.increment('leaderboard.cache.hit');
      this.logger.info({ key }, 'leaderboard.cache_hit');
      return JSON.parse(cached) as LeaderboardEntryDto[];
    }

    this.metrics.increment('leaderboard.cache.miss');
    this.logger.info({ key }, 'leaderboard.cache_miss');

    const dailyCase = await this.casesService.getTodayCase();

    if (!dailyCase) {
      return [];
    }

    const rows = await this.prisma.leaderboardEntry.findMany({
      where: { dailyCaseId: dailyCase.dailyCaseId },
      orderBy: [
        { score: 'desc' },
        { attemptsCount: 'asc' },
        { timeToComplete: { sort: 'asc', nulls: 'last' } },
        { completedAt: 'asc' },
      ],
      take: limit,
      select: {
        userId: true,
        score: true,
        attemptsCount: true,
        timeToComplete: true,
        completedAt: true,
        user: this.getPublicUserSelect(),
      },
    });

    const ranked = rows.map((row, index) =>
      this.toLeaderboardEntry(row, index + 1),
    );

    if (ranked.length > 0) {
      await this.cache.set(
        key,
        JSON.stringify(ranked),
        this.leaderboardTtlSeconds,
      );
    }

    return ranked;
  }

  async getWeekly(limit = 50) {
    const { start, end, keyDate } = this.getUtcRollingWeekRange();
    const key = `leaderboard:weekly:v4:${keyDate}:${limit}`;

    const cached = await this.cache.get(key);
    if (cached) {
      this.metrics.increment('leaderboard.weekly.cache.hit');
      this.logger.info({ key }, 'leaderboard.weekly.cache_hit');
      return JSON.parse(cached) as LeaderboardEntryDto[];
    }

    this.metrics.increment('leaderboard.weekly.cache.miss');
    this.logger.info({ key }, 'leaderboard.weekly.cache_miss');

    const rows = await this.getWeeklyRows(start, end);
    const ranked = this.aggregateWeeklyRows(rows)
      .slice(0, limit)
      .map((row, index) => this.toLeaderboardEntry(row, index + 1));

    if (ranked.length > 0) {
      await this.cache.set(
        key,
        JSON.stringify(ranked),
        this.leaderboardTtlSeconds,
      );
    }

    return ranked;
  }

  async getUserPosition(input: { userId: string; mode: LeaderboardMode }) {
    if (input.mode === 'daily') {
      const dailyCase = await this.casesService.getTodayCase();

      if (!dailyCase) {
        return null;
      }

      const entry = await this.prisma.leaderboardEntry.findUnique({
        where: {
          dailyCaseId_userId: {
            dailyCaseId: dailyCase.dailyCaseId,
            userId: input.userId,
          },
        },
        select: {
          userId: true,
          score: true,
          attemptsCount: true,
          timeToComplete: true,
          completedAt: true,
          user: this.getPublicUserSelect(),
        },
      });

      if (!entry) {
        return null;
      }

      const betterCount = await this.prisma.leaderboardEntry.count({
        where: {
          dailyCaseId: dailyCase.dailyCaseId,
          OR: this.getDailyBetterEntryWhere(entry),
        },
      });

      return this.toLeaderboardEntry(entry, betterCount + 1);
    }

    const { start, end } = this.getUtcRollingWeekRange();
    const rankedRows = this.aggregateWeeklyRows(
      await this.getWeeklyRows(start, end),
    );
    const index = rankedRows.findIndex((row) => row.userId === input.userId);

    if (index < 0) {
      return null;
    }

    return this.toLeaderboardEntry(rankedRows[index], index + 1);
  }

  async upsertCompletion(input: {
    userId: string;
    dailyCaseId: string;
    score: number;
    attemptsCount: number;
    completedAt: Date;
    timeToComplete?: number | null;
  }) {
    const existing = await this.prisma.leaderboardEntry.findUnique({
      where: {
        dailyCaseId_userId: {
          dailyCaseId: input.dailyCaseId,
          userId: input.userId,
        },
      },
    });

    if (!existing) {
      await this.prisma.leaderboardEntry.create({
        data: {
          userId: input.userId,
          dailyCaseId: input.dailyCaseId,
          score: input.score,
          attemptsCount: input.attemptsCount,
          timeToComplete: input.timeToComplete,
          completedAt: input.completedAt,
        },
      });
    } else {
      const shouldReplace =
        input.score > existing.score ||
        (input.score === existing.score &&
          input.attemptsCount < existing.attemptsCount) ||
        (input.score === existing.score &&
          input.attemptsCount === existing.attemptsCount &&
          this.compareCompletionTieBreakers(
            {
              timeToComplete: input.timeToComplete ?? null,
              completedAt: input.completedAt,
            },
            existing,
          ) < 0);

      if (shouldReplace) {
        await this.prisma.leaderboardEntry.update({
          where: { id: existing.id },
          data: {
            score: input.score,
            attemptsCount: input.attemptsCount,
            timeToComplete: input.timeToComplete,
            completedAt: input.completedAt,
          },
        });
      }
    }

    const { date } = this.getUtcDayRange(input.completedAt);
    const deleted = await this.cache.deleteByPrefix(`leaderboard:daily:`);
    const weeklyDeleted = await this.cache.deleteByPrefix(
      'leaderboard:weekly:',
    );
    this.logger.info({ date, deleted }, 'leaderboard.cache_invalidated');
    this.logger.info(
      { deleted: weeklyDeleted },
      'leaderboard.weekly.cache_invalidated',
    );
  }

  private getUtcDayRange(value = new Date()) {
    const start = new Date(value);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return {
      date: start.toISOString().slice(0, 10),
      start,
      end,
    };
  }

  private getDailyCacheKey(limit: number) {
    const { date } = this.getUtcDayRange();
    return `leaderboard:daily:v4:${date}:${limit}`;
  }

  private getWeeklyCacheKey(limit: number, keyDate?: string) {
    return `leaderboard:weekly:v4:${keyDate ?? this.getUtcRollingWeekRange().keyDate}:${limit}`;
  }

  private getPublicUserSelect() {
    return {
      select: {
        displayName: true,
        stats: {
          select: {
            currentStreak: true,
          },
        },
        organizations: {
          where: {
            status: 'ACTIVE' as const,
          },
          orderBy: {
            createdAt: 'asc' as const,
          },
          take: 1,
          select: {
            organization: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    };
  }

  private async getWeeklyRows(
    start: Date,
    end: Date,
  ): Promise<LeaderboardRow[]> {
    return this.prisma.leaderboardEntry.findMany({
      where: {
        completedAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        userId: true,
        score: true,
        attemptsCount: true,
        timeToComplete: true,
        completedAt: true,
        user: this.getPublicUserSelect(),
      },
    });
  }

  private aggregateWeeklyRows(rows: LeaderboardRow[]): LeaderboardAggregate[] {
    const aggregates = new Map<string, LeaderboardAggregate>();

    for (const row of rows) {
      const current = aggregates.get(row.userId);

      if (!current) {
        aggregates.set(row.userId, {
          ...row,
          casesCompleted: 1,
          totalTimeToComplete: row.timeToComplete,
        });
        continue;
      }

      current.score += row.score;
      current.attemptsCount += row.attemptsCount;
      current.casesCompleted += 1;
      current.totalTimeToComplete =
        current.totalTimeToComplete == null || row.timeToComplete == null
          ? null
          : current.totalTimeToComplete + row.timeToComplete;
      current.completedAt =
        current.completedAt < row.completedAt
          ? current.completedAt
          : row.completedAt;
    }

    return Array.from(aggregates.values()).sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      if (left.casesCompleted !== right.casesCompleted) {
        return right.casesCompleted - left.casesCompleted;
      }

      if (left.attemptsCount !== right.attemptsCount) {
        return left.attemptsCount - right.attemptsCount;
      }

      const timeComparison = this.compareNullableTime(
        left.totalTimeToComplete,
        right.totalTimeToComplete,
      );
      if (timeComparison !== 0) {
        return timeComparison;
      }

      return left.completedAt.getTime() - right.completedAt.getTime();
    });
  }

  private toLeaderboardEntry(
    row: LeaderboardRow,
    rank: number,
  ): LeaderboardEntryDto {
    const displayName = row.user.displayName?.trim() || undefined;
    const organizationName =
      row.user.organizations[0]?.organization.name.trim() || undefined;
    const streak = row.user.stats?.currentStreak;
    const aggregate = row as Partial<LeaderboardAggregate>;

    return {
      rank,
      userId: row.userId,
      ...(displayName ? { displayName } : {}),
      ...(organizationName ? { organizationName } : {}),
      ...(typeof streak === 'number' ? { streak } : {}),
      score: row.score,
      attemptsCount: row.attemptsCount,
      timeToComplete: row.timeToComplete,
      ...(aggregate.totalTimeToComplete !== undefined
        ? { totalTimeToComplete: aggregate.totalTimeToComplete }
        : {}),
      ...(aggregate.casesCompleted !== undefined
        ? { casesCompleted: aggregate.casesCompleted }
        : {}),
      completedAt: row.completedAt.toISOString(),
    };
  }

  private compareCompletionTieBreakers(
    left: { timeToComplete: number | null; completedAt: Date },
    right: { timeToComplete: number | null; completedAt: Date },
  ) {
    const timeComparison = this.compareNullableTime(
      left.timeToComplete,
      right.timeToComplete,
    );
    if (timeComparison !== 0) {
      return timeComparison;
    }

    return left.completedAt.getTime() - right.completedAt.getTime();
  }

  private compareNullableTime(left: number | null, right: number | null) {
    if (left == null && right == null) {
      return 0;
    }

    if (left == null) {
      return 1;
    }

    if (right == null) {
      return -1;
    }

    return left - right;
  }

  private getDailyBetterEntryWhere(entry: {
    score: number;
    attemptsCount: number;
    timeToComplete: number | null;
    completedAt: Date;
  }): Prisma.LeaderboardEntryWhereInput[] {
    const sameScoreAndAttempts = {
      score: entry.score,
      attemptsCount: entry.attemptsCount,
    };

    const fasterTime =
      entry.timeToComplete == null
        ? {
            ...sameScoreAndAttempts,
            timeToComplete: {
              not: null,
            },
          }
        : {
            ...sameScoreAndAttempts,
            timeToComplete: {
              lt: entry.timeToComplete,
            },
          };

    const sameTimeEarlierCompletion =
      entry.timeToComplete == null
        ? {
            ...sameScoreAndAttempts,
            timeToComplete: null,
            completedAt: { lt: entry.completedAt },
          }
        : {
            ...sameScoreAndAttempts,
            timeToComplete: entry.timeToComplete,
            completedAt: { lt: entry.completedAt },
          };

    return [
      { score: { gt: entry.score } },
      { score: entry.score, attemptsCount: { lt: entry.attemptsCount } },
      fasterTime,
      sameTimeEarlierCompletion,
    ];
  }

  private getUtcRollingWeekRange(value = new Date()) {
    const end = new Date(value);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 7);

    return {
      start,
      end,
      keyDate: end.toISOString().slice(0, 10),
    };
  }
}
