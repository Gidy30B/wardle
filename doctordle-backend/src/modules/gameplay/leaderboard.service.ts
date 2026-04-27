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

  async getToday(limit = 50) {
    const { date } = this.getUtcDayRange();
    const key = `leaderboard:daily:v2:${date}:${limit}`;

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
      await this.cache.set(key, JSON.stringify([]), this.leaderboardTtlSeconds);
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

    await this.cache.set(key, JSON.stringify(ranked), this.leaderboardTtlSeconds);

    return ranked;
  }

  async getWeekly(limit = 50) {
    const { start, end, keyDate } = this.getUtcRollingWeekRange();
    const key = `leaderboard:weekly:v2:${keyDate}:${limit}`;

    const cached = await this.cache.get(key);
    if (cached) {
      this.metrics.increment('leaderboard.weekly.cache.hit');
      this.logger.info({ key }, 'leaderboard.weekly.cache_hit');
      return JSON.parse(cached) as LeaderboardEntryDto[];
    }

    this.metrics.increment('leaderboard.weekly.cache.miss');
    this.logger.info({ key }, 'leaderboard.weekly.cache_miss');

    const rows = await this.prisma.leaderboardEntry.findMany({
      where: {
        completedAt: {
          gte: start,
          lt: end,
        },
      },
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

    await this.cache.set(key, JSON.stringify(ranked), this.leaderboardTtlSeconds);

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
    const entry = await this.prisma.leaderboardEntry.findFirst({
      where: {
        userId: input.userId,
        completedAt: {
          gte: start,
          lt: end,
        },
      },
      orderBy: [
        { score: 'desc' },
        { attemptsCount: 'asc' },
        { completedAt: 'asc' },
      ],
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
        completedAt: {
          gte: start,
          lt: end,
        },
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
