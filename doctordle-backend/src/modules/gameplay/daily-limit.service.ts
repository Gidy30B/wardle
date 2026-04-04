import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { getEnv } from '../../core/config/env.validation';

@Injectable()
export class DailyLimitService {
  assertCanStartInTransaction(
    tx: PrismaClient | Prisma.TransactionClient,
    input: {
      userId: string;
      subscriptionTier: string;
      startOfDayUtc: Date;
      endOfDayUtc: Date;
    },
  ): Promise<void> {
    const env = getEnv();

    if (env.NODE_ENV === 'development' && env.DEV_BYPASS_DAILY_LIMIT) {
      console.warn('[DEV BYPASS ACTIVE] Daily limit disabled for user:', input.userId);
      return Promise.resolve();
    }

    const tier = (input.subscriptionTier ?? '').toLowerCase();
    if (tier === 'premium') {
      return Promise.resolve();
    }

    return (async () => {
      const completedToday = await tx.gameSession.count({
        where: {
          userId: input.userId,
          status: 'completed',
          completedAt: {
            gte: input.startOfDayUtc,
            lt: input.endOfDayUtc,
          },
        },
      });

      if (completedToday >= 1) {
        throw new BadRequestException('Daily free limit reached');
      }
    })();
  }
}
