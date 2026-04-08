import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { RankService } from './rank.service';
import { StreakService } from './streak.service';
import { XpService } from './xp.service';

@Injectable()
export class UserProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankService: RankService,
    private readonly streakService: StreakService,
    private readonly xpService: XpService,
  ) {}

  async getProgress(userId: string) {
    const progress = await this.prisma.userProgress.findUnique({
      where: { userId },
    });

    const xpTotal = progress?.xpTotal ?? 0;
    const derived = this.xpService.deriveLevelFromXpTotal(xpTotal);
    const streak = await this.streakService.getCurrentStats(userId);

    return {
      xpTotal,
      level: derived.level,
      xpCurrentLevel: derived.xpCurrentLevel,
      xpToNextLevel: derived.xpToNextLevel,
      rank: this.rankService.getRank(derived.level),
      currentStreak: streak.currentStreak,
      longestStreak: streak.bestStreak,
      bestStreak: streak.bestStreak,
    };
  }

  async syncProgress(userId: string) {
    const progress = await this.prisma.userProgress.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
      },
    });

    const derived = this.xpService.deriveLevelFromXpTotal(progress.xpTotal);

    if (
      progress.level !== derived.level ||
      progress.xpCurrentLevel !== derived.xpCurrentLevel
    ) {
      await this.prisma.userProgress.update({
        where: { userId },
        data: {
          level: derived.level,
          xpCurrentLevel: derived.xpCurrentLevel,
        },
      });
    }

    return this.getProgress(userId);
  }
}
