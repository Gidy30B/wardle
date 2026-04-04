import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';

@Injectable()
export class StreakService {
  constructor(private readonly prisma: PrismaService) {}

  private toUtcDay(value: Date): Date {
    const day = new Date(value);
    day.setUTCHours(0, 0, 0, 0);
    return day;
  }

  private isSameDay(a: Date | null | undefined, b: Date): boolean {
    return !!a && this.toUtcDay(a).getTime() === b.getTime();
  }

  private getYesterday(day: Date): Date {
    const yesterday = new Date(day);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return yesterday;
  }

  async updateOnCompletion(input: { userId: string; completedAt: Date }) {
    const day = this.toUtcDay(input.completedAt);
    const yesterday = this.getYesterday(day);

    const stats = await this.prisma.userStats.findUnique({
      where: { userId: input.userId },
    });

    if (!stats) {
      await this.prisma.userStats.create({
        data: {
          userId: input.userId,
          currentStreak: 1,
          bestStreak: 1,
          lastPlayedDate: day,
        },
      });
      return 1;
    }

    const playedYesterday = this.isSameDay(stats.lastPlayedDate, yesterday);
    const playedToday = this.isSameDay(stats.lastPlayedDate, day);

    if (playedToday) {
      return stats.currentStreak;
    }

    const currentStreak = playedYesterday ? stats.currentStreak + 1 : 1;
    const bestStreak = Math.max(stats.bestStreak, currentStreak);

    await this.prisma.userStats.update({
      where: { userId: input.userId },
      data: {
        currentStreak,
        bestStreak,
        lastPlayedDate: day,
      },
    });

    return currentStreak;
  }

  async getCurrentStats(userId: string, now = new Date()) {
    const day = this.toUtcDay(now);
    const yesterday = this.getYesterday(day);

    const stats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      return {
        currentStreak: 0,
        bestStreak: 0,
        lastPlayedDate: null as Date | null,
      };
    }

    const playedToday = this.isSameDay(stats.lastPlayedDate, day);
    const playedYesterday = this.isSameDay(stats.lastPlayedDate, yesterday);

    if (!playedToday && !playedYesterday && stats.currentStreak !== 0) {
      const reset = await this.prisma.userStats.update({
        where: { userId },
        data: {
          currentStreak: 0,
        },
      });

      return {
        currentStreak: reset.currentStreak,
        bestStreak: reset.bestStreak,
        lastPlayedDate: reset.lastPlayedDate,
      };
    }

    return {
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      lastPlayedDate: stats.lastPlayedDate,
    };
  }
}
