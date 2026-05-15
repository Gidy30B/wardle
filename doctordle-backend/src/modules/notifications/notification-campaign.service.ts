import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { NotificationType } from './notification-type.constants';
import {
  NotificationCategory,
  type NotificationCategoryValue,
} from './notification.types';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationProducerService } from './notification-producer.service';

type CampaignResult = {
  campaign: string;
  dryRun: boolean;
  consideredCount: number;
  eligibleCount: number;
  enqueuedCount: number;
  skippedCount: number;
};

type DailyCaseAlertInput = {
  date?: string;
  limit?: number;
  dryRun?: boolean;
  targetUserId?: string;
};

type StreakReminderInput = {
  date?: string;
  limit?: number;
  dryRun?: boolean;
  targetUserId?: string;
};

type WeeklyDigestInput = {
  weekStart?: string;
  weekEnd?: string;
  limit?: number;
  dryRun?: boolean;
  targetUserId?: string;
};

const DEFAULT_BATCH_LIMIT = 5000;

@Injectable()
export class NotificationCampaignService {
  private readonly logger = new Logger(NotificationCampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationProducer: NotificationProducerService,
    private readonly notificationPreferences: NotificationPreferencesService,
  ) {}

  async enqueueDailyCaseAlerts(
    input: DailyCaseAlertInput = {},
  ): Promise<CampaignResult & { date: string; dailyCaseId: string | null }> {
    const date = this.toUtcDay(input.date ? new Date(input.date) : new Date());
    const dateKey = this.toDateKey(date);
    const limit = this.normalizeLimit(input.limit);

    const dailyCase = await this.prisma.dailyCase.findFirst({
      where: {
        date,
        track: 'DAILY',
        sequenceIndex: 1,
      },
      select: {
        id: true,
      },
    });

    if (!dailyCase) {
      return {
        campaign: 'daily_case_alerts',
        dryRun: input.dryRun === true,
        date: dateKey,
        dailyCaseId: null,
        consideredCount: 0,
        eligibleCount: 0,
        enqueuedCount: 0,
        skippedCount: 0,
      };
    }

    const users = await this.prisma.user.findMany({
      where: {
        ...(input.targetUserId ? { id: input.targetUserId } : {}),
        clerkId: {
          not: null,
        },
        sessions: {
          none: {
            dailyCaseId: dailyCase.id,
          },
        },
      },
      select: {
        id: true,
      },
      take: limit,
      orderBy: {
        id: 'asc',
      },
    });

    const eligibleUsers = await this.filterEligibleUsers(
      users,
      NotificationType.GameplayDailyCaseAvailable,
      NotificationCategory.Gameplay,
    );

    if (!input.dryRun) {
      for (const user of eligibleUsers) {
        await this.notificationProducer.enqueueDailyCaseAvailable({
          userId: user.id,
          dailyCaseId: dailyCase.id,
          date: dateKey,
        });
      }
    }

    this.logCampaign('daily_case_alerts', eligibleUsers.length, {
      date: dateKey,
      dailyCaseId: dailyCase.id,
      dryRun: input.dryRun === true,
      consideredCount: users.length,
      skippedCount: users.length - eligibleUsers.length,
    });

    return {
      campaign: 'daily_case_alerts',
      dryRun: input.dryRun === true,
      date: dateKey,
      dailyCaseId: dailyCase.id,
      consideredCount: users.length,
      eligibleCount: eligibleUsers.length,
      enqueuedCount: input.dryRun ? 0 : eligibleUsers.length,
      skippedCount: users.length - eligibleUsers.length,
    };
  }

  async enqueueStreakReminders(
    input: StreakReminderInput = {},
  ): Promise<CampaignResult & { date: string }> {
    const date = this.toUtcDay(input.date ? new Date(input.date) : new Date());
    const yesterday = new Date(date);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dateKey = this.toDateKey(date);
    const limit = this.normalizeLimit(input.limit);

    const users = await this.prisma.user.findMany({
      where: {
        ...(input.targetUserId ? { id: input.targetUserId } : {}),
        clerkId: {
          not: null,
        },
        stats: {
          currentStreak: {
            gt: 0,
          },
          lastPlayedDate: yesterday,
        },
        sessions: {
          none: {
            completedAt: {
              gte: date,
              lt: this.addDays(date, 1),
            },
          },
        },
      },
      select: {
        id: true,
      },
      take: limit,
      orderBy: {
        id: 'asc',
      },
    });

    const eligibleUsers = await this.filterEligibleUsers(
      users,
      NotificationType.StreakReminder,
      NotificationCategory.Streak,
    );

    if (!input.dryRun) {
      for (const user of eligibleUsers) {
        await this.notificationProducer.enqueueStreakReminder({
          userId: user.id,
          reminderDate: dateKey,
        });
      }
    }

    this.logCampaign('streak_reminders', eligibleUsers.length, {
      date: dateKey,
      dryRun: input.dryRun === true,
      consideredCount: users.length,
      skippedCount: users.length - eligibleUsers.length,
    });

    return {
      campaign: 'streak_reminders',
      dryRun: input.dryRun === true,
      date: dateKey,
      consideredCount: users.length,
      eligibleCount: eligibleUsers.length,
      enqueuedCount: input.dryRun ? 0 : eligibleUsers.length,
      skippedCount: users.length - eligibleUsers.length,
    };
  }

  async enqueueWeeklyDigest(
    input: WeeklyDigestInput = {},
  ): Promise<CampaignResult & { weekStart: string; weekEnd: string }> {
    const bounds = this.resolveWeekBounds(input.weekStart, input.weekEnd);
    const limit = this.normalizeLimit(input.limit);

    const rows = await this.prisma.gameSession.groupBy({
      by: ['userId'],
      where: {
        ...(input.targetUserId ? { userId: input.targetUserId } : {}),
        status: 'completed',
        completedAt: {
          gte: bounds.start,
          lt: bounds.end,
        },
        user: {
          clerkId: {
            not: null,
          },
        },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        userId: 'asc',
      },
      take: limit,
    });

    const weekStart = this.toDateKey(bounds.start);
    const weekEnd = this.toDateKey(bounds.end);

    const eligibleRows = await this.filterEligibleUsers(
      rows,
      NotificationType.LearningWeeklyDigest,
      NotificationCategory.Learning,
    );

    if (!input.dryRun) {
      for (const row of eligibleRows) {
        await this.notificationProducer.enqueueLearningWeeklyDigest({
          userId: row.userId,
          weekStart,
          reviewedCount: row._count._all,
        });
      }
    }

    this.logCampaign('weekly_digest', eligibleRows.length, {
      weekStart,
      weekEnd,
      dryRun: input.dryRun === true,
      consideredCount: rows.length,
      skippedCount: rows.length - eligibleRows.length,
    });

    return {
      campaign: 'weekly_digest',
      dryRun: input.dryRun === true,
      weekStart,
      weekEnd,
      consideredCount: rows.length,
      eligibleCount: eligibleRows.length,
      enqueuedCount: input.dryRun ? 0 : eligibleRows.length,
      skippedCount: rows.length - eligibleRows.length,
    };
  }

  private async filterEligibleUsers<T extends { userId?: string; id?: string }>(
    rows: T[],
    type: string,
    category: NotificationCategoryValue,
  ): Promise<T[]> {
    const eligibleRows: T[] = [];

    for (const row of rows) {
      const userId = row.userId ?? row.id;
      if (!userId) {
        continue;
      }

      const enabled = await this.notificationPreferences.isNotificationEnabled({
        userId,
        type,
        category,
      });

      if (enabled) {
        eligibleRows.push(row);
      }
    }

    return eligibleRows;
  }

  private resolveWeekBounds(rawStart?: string, rawEnd?: string) {
    if (rawStart && rawEnd) {
      return {
        start: this.toUtcDay(new Date(rawStart)),
        end: this.toUtcDay(new Date(rawEnd)),
      };
    }

    const today = this.toUtcDay(new Date());
    const day = today.getUTCDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    const currentMonday = new Date(today);
    currentMonday.setUTCDate(currentMonday.getUTCDate() - daysSinceMonday);
    const previousMonday = new Date(currentMonday);
    previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);

    return {
      start: previousMonday,
      end: currentMonday,
    };
  }

  private normalizeLimit(limit: number | undefined): number {
    return Math.max(1, Math.min(10000, Math.floor(limit ?? DEFAULT_BATCH_LIMIT)));
  }

  private toUtcDay(value: Date): Date {
    const day = new Date(value);
    day.setUTCHours(0, 0, 0, 0);
    return day;
  }

  private addDays(value: Date, days: number): Date {
    const date = new Date(value);
    date.setUTCDate(date.getUTCDate() + days);
    return date;
  }

  private toDateKey(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private logCampaign(
    campaign: string,
    enqueuedCount: number,
    details: Record<string, unknown>,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'notification.campaign.enqueued',
        campaign,
        enqueuedCount,
        ...details,
      }),
    );
  }
}
