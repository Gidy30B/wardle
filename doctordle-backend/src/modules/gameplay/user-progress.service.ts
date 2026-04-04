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
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        subscriptionTier: 'free',
      },
    });

    const progress = await this.prisma.userProgress.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
      },
    });

    const derived = this.xpService.deriveLevelFromXpTotal(progress.xpTotal);
    const streak = await this.streakService.getCurrentStats(userId);

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

    return {
      xpTotal: progress.xpTotal,
      level: derived.level,
      xpCurrentLevel: derived.xpCurrentLevel,
      xpToNextLevel: derived.xpToNextLevel,
      rank: this.rankService.getRank(derived.level),
      currentStreak: streak.currentStreak,
      longestStreak: streak.bestStreak,
      bestStreak: streak.bestStreak,
    };
  }
}
