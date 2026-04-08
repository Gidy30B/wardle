import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { CasesService } from '../cases/cases.service';

type LeaderboardMode = 'daily' | 'weekly';

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
    const key = `leaderboard:daily:${date}:${limit}`;

    const cached = await this.cache.get(key);
    if (cached) {
      this.metrics.increment('leaderboard.cache.hit');
      this.logger.info({ key }, 'leaderboard.cache_hit');
      return JSON.parse(cached) as Array<{
        rank: number;
        userId: string;
        score: number;
        attemptsCount: number;
        completedAt: string;
      }>;
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
      },
    });

    const ranked = rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      score: row.score,
      attemptsCount: row.attemptsCount,
      completedAt: row.completedAt.toISOString(),
    }));

    await this.cache.set(key, JSON.stringify(ranked), this.leaderboardTtlSeconds);

    return ranked;
  }

  async getWeekly(limit = 50) {
    const { start, end, keyDate } = this.getUtcRollingWeekRange();
    const key = `leaderboard:weekly:${keyDate}:${limit}`;

    const cached = await this.cache.get(key);
    if (cached) {
      this.metrics.increment('leaderboard.weekly.cache.hit');
      this.logger.info({ key }, 'leaderboard.weekly.cache_hit');
      return JSON.parse(cached) as Array<{
        rank: number;
        userId: string;
        score: number;
        attemptsCount: number;
        completedAt: string;
      }>;
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
      },
    });

    const ranked = rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      score: row.score,
      attemptsCount: row.attemptsCount,
      completedAt: row.completedAt.toISOString(),
    }));

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

      return {
        rank: betterCount + 1,
        userId: entry.userId,
        score: entry.score,
        attemptsCount: entry.attemptsCount,
        completedAt: entry.completedAt.toISOString(),
      };
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

    return {
      rank: betterCount + 1,
      userId: entry.userId,
      score: entry.score,
      attemptsCount: entry.attemptsCount,
      completedAt: entry.completedAt.toISOString(),
    };
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
    const deleted = await this.cache.deleteByPrefix(`leaderboard:daily:${date}:`);
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
