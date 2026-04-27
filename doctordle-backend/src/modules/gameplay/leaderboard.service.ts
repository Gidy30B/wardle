import { Injectable } from '@nestjs/common';
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

type LeaderboardAggregate = LeaderboardRow;

type LeaderboardEntryDto = {
  rank: number;
  userId: string;
  displayName?: string;
  organizationName?: string;
  streak?: number;
  score: number;
  attemptsCount: number;
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
    const key = `leaderboard:daily:v3:${date}:${limit}`;

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
        { completedAt: 'asc' },
      ],
      take: limit,
      select: {
        userId: true,
        score: true,
        attemptsCount: true,
        completedAt: true,
        user: this.getPublicUserSelect(),
      },
    });

    const ranked = rows.map((row, index) =>
      this.toLeaderboardEntry(row, index + 1),
    );

    if (ranked.length > 0) {
      await this.cache.set(key, JSON.stringify(ranked), this.leaderboardTtlSeconds);
    }

    return ranked;
  }

  async getWeekly(limit = 50) {
    const { start, end, keyDate } = this.getUtcRollingWeekRange();
    const key = `leaderboard:weekly:v3:${keyDate}:${limit}`;

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
      .map((row, index) =>
      this.toLeaderboardEntry(row, index + 1),
    );

    if (ranked.length > 0) {
      await this.cache.set(key, JSON.stringify(ranked), this.leaderboardTtlSeconds);
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
          OR: [
            { score: { gt: entry.score } },
            { score: entry.score, attemptsCount: { lt: entry.attemptsCount } },
            {
              score: entry.score,
              attemptsCount: entry.attemptsCount,
              completedAt: { lt: entry.completedAt },
            },
          ],
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
    timeToComplete?: number;
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
        (input.score === existing.score && input.attemptsCount < existing.attemptsCount) ||
        (input.score === existing.score &&
          input.attemptsCount === existing.attemptsCount &&
          input.completedAt < existing.completedAt);

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
    const weeklyDeleted = await this.cache.deleteByPrefix('leaderboard:weekly:');
    this.logger.info({ date, deleted }, 'leaderboard.cache_invalidated');
    this.logger.info({ deleted: weeklyDeleted }, 'leaderboard.weekly.cache_invalidated');
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
    return `leaderboard:daily:v3:${date}:${limit}`;
  }

  private getWeeklyCacheKey(limit: number, keyDate?: string) {
    return `leaderboard:weekly:v3:${keyDate ?? this.getUtcRollingWeekRange().keyDate}:${limit}`;
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

  private async getWeeklyRows(start: Date, end: Date): Promise<LeaderboardRow[]> {
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
        aggregates.set(row.userId, { ...row });
        continue;
      }

      current.score += row.score;
      current.attemptsCount += row.attemptsCount;
      current.completedAt =
        current.completedAt < row.completedAt
          ? current.completedAt
          : row.completedAt;
    }

    return Array.from(aggregates.values()).sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      if (left.attemptsCount !== right.attemptsCount) {
        return left.attemptsCount - right.attemptsCount;
      }

      return left.completedAt.getTime() - right.completedAt.getTime();
    });
  }

  private toLeaderboardEntry(row: LeaderboardRow, rank: number): LeaderboardEntryDto {
    const displayName = row.user.displayName?.trim() || undefined;
    const organizationName =
      row.user.organizations[0]?.organization.name.trim() || undefined;
    const streak = row.user.stats?.currentStreak;

    return {
      rank,
      userId: row.userId,
      ...(displayName ? { displayName } : {}),
      ...(organizationName ? { organizationName } : {}),
      ...(typeof streak === 'number' ? { streak } : {}),
      score: row.score,
      attemptsCount: row.attemptsCount,
      completedAt: row.completedAt.toISOString(),
    };
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
