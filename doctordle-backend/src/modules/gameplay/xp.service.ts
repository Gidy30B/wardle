import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { PrismaService } from '../../core/db/prisma.service';

type ComputeXpInput = {
  isCorrect: boolean;
  clueIndex: number;
  attemptsCount: number;
  streak: number;
};

export type CalculateRewardInput = ComputeXpInput;

export type CalculateRewardResult = {
  xpAwarded: number;
};

@Injectable()
export class XpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
  ) {}

  calculateReward(input: CalculateRewardInput): CalculateRewardResult {
    const normalizedClueIndex = Math.max(0, Math.floor(input.clueIndex));
    const normalizedAttempts = Math.max(1, Math.floor(input.attemptsCount));

    const baseXp = input.isCorrect
      ? normalizedClueIndex <= 0
        ? 100
        : normalizedClueIndex === 1
          ? 70
          : 40
      : 10;

    const attemptPenalty = input.isCorrect ? Math.max(0, (normalizedAttempts - 1) * 5) : 0;
    const streakBonus =
      input.streak >= 30 ? 150 : input.streak >= 7 ? 50 : input.streak >= 3 ? 10 : 0;

    return {
      xpAwarded: Math.max(1, baseXp + streakBonus - attemptPenalty),
    };
  }

  computeXP(input: ComputeXpInput): number {
    return this.calculateReward(input).xpAwarded;
  }

  deriveLevelFromXpTotal(xpTotal: number): {
    level: number;
    xpCurrentLevel: number;
    xpToNextLevel: number;
  } {
    const safeXpTotal = Math.max(0, Math.floor(xpTotal));
    const rawLevel = Math.floor(Math.sqrt(safeXpTotal / 100));
    const level = Math.max(1, rawLevel);

    const levelStartXp = 100 * Math.pow(level, 2);
    const nextLevelXp = 100 * Math.pow(level + 1, 2);

    return {
      level,
      xpCurrentLevel: Math.max(0, safeXpTotal - levelStartXp),
      xpToNextLevel: Math.max(100, nextLevelXp - levelStartXp),
    };
  }

  async awardXpForSession(input: {
    sessionId: string;
    userId: string;
    streak: number;
    attemptsCount: number;
  }): Promise<
    | {
        applied: false;
        reason: 'already_awarded' | 'session_not_found';
      }
    | {
        applied: true;
        xpGained: number;
        level: number;
        xpTotal: number;
        xpCurrentLevel: number;
      }
  > {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({
        where: { id: input.sessionId },
        select: {
          id: true,
          userId: true,
          xpAwardedAt: true,
          status: true,
          attempts: {
            select: {
              clueIndexAtAttempt: true,
              result: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          _count: {
            select: {
              attempts: true,
            },
          },
        },
      });

      if (!session || session.userId !== input.userId || session.status !== 'completed') {
        return {
          applied: false,
          reason: 'session_not_found' as const,
        };
      }

      if (session.xpAwardedAt) {
        this.metrics.increment('xp.already_awarded');
        this.logger.warn({
          event: 'xp.already_awarded',
          sessionId: input.sessionId,
          userId: input.userId,
          xpAwardedAt: session.xpAwardedAt.toISOString(),
        });

        return {
          applied: false,
          reason: 'already_awarded' as const,
        };
      }

      const mark = await tx.gameSession.updateMany({
        where: {
          id: input.sessionId,
          userId: input.userId,
          xpAwardedAt: null,
          status: 'completed',
        },
        data: {
          xpAwardedAt: new Date(),
        },
      });

      if (mark.count === 0) {
        this.metrics.increment('xp.already_awarded');
        this.logger.warn({
          event: 'xp.already_awarded',
          sessionId: input.sessionId,
          userId: input.userId,
        });

        return {
          applied: false,
          reason: 'already_awarded' as const,
        };
      }

      const lastAttempt = session.attempts[0];
      const clueIndex = Math.max(0, lastAttempt?.clueIndexAtAttempt ?? 0);
      const isCorrect = lastAttempt?.result === 'correct';
      const attemptsCount = Math.max(1, input.attemptsCount || session._count.attempts || 1);

      const reward = this.calculateReward({
        isCorrect,
        clueIndex,
        attemptsCount,
        streak: input.streak,
      });
      const xpGained = reward.xpAwarded;

      const progress = await tx.userProgress.upsert({
        where: { userId: input.userId },
        update: {
          xpTotal: {
            increment: xpGained,
          },
        },
        create: {
          userId: input.userId,
          xpTotal: xpGained,
          level: 1,
          xpCurrentLevel: 0,
        },
      });

      const derived = this.deriveLevelFromXpTotal(progress.xpTotal);

      const updated = await tx.userProgress.update({
        where: { userId: input.userId },
        data: {
          level: derived.level,
          xpCurrentLevel: derived.xpCurrentLevel,
        },
      });

      this.metrics.increment('xp.awarded');
      this.metrics.observe('xp.gained', xpGained);
      this.logger.info({
        event: 'xp.awarded',
        sessionId: input.sessionId,
        userId: input.userId,
        xpGained,
        clueIndex,
        attemptsCount,
        isCorrect,
        xpTotal: updated.xpTotal,
        level: updated.level,
      });

      return {
        applied: true as const,
        xpGained,
        level: updated.level,
        xpTotal: updated.xpTotal,
        xpCurrentLevel: updated.xpCurrentLevel,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }
}
