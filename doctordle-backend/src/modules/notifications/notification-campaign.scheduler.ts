import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { getEnv } from '../../core/config/env.validation';
import { NotificationCampaignService } from './notification-campaign.service';

const NOTIFICATION_CAMPAIGN_TIMEZONE = 'Africa/Nairobi';
const DAILY_CASE_ALERTS_CRON_JOB = 'notification-campaign-daily-case-alerts';
const STREAK_REMINDERS_CRON_JOB = 'notification-campaign-streak-reminders';
const WEEKLY_DIGEST_CRON_JOB = 'notification-campaign-weekly-digest';

type NotificationCampaignName =
  | 'daily_case_alerts'
  | 'streak_reminders'
  | 'weekly_digest';

type NotificationCampaignSchedulerConfig = {
  configuredEnabled: boolean;
  enabled: boolean;
  processRole: string;
  limit: number;
  timezone: string;
};

type DisabledCampaignResult = {
  status: 'disabled';
  campaign: NotificationCampaignName;
  processRole: string;
  configuredEnabled: boolean;
  eligibleProcessRole: 'api';
};

@Injectable()
export class NotificationCampaignScheduler implements OnModuleInit {
  private readonly logger = new Logger(NotificationCampaignScheduler.name);

  constructor(
    private readonly campaignService: NotificationCampaignService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    this.registerCronJobs();
  }

  async runDailyCaseAlerts() {
    const config = this.getConfig();
    if (!config.enabled) {
      return this.recordDisabled('daily_case_alerts', config);
    }

    const result = await this.campaignService.enqueueDailyCaseAlerts({
      limit: config.limit,
    });
    this.logResult(result);
    return result;
  }

  async runStreakReminders() {
    const config = this.getConfig();
    if (!config.enabled) {
      return this.recordDisabled('streak_reminders', config);
    }

    const result = await this.campaignService.enqueueStreakReminders({
      limit: config.limit,
    });
    this.logResult(result);
    return result;
  }

  async runWeeklyDigest() {
    const config = this.getConfig();
    if (!config.enabled) {
      return this.recordDisabled('weekly_digest', config);
    }

    const result = await this.campaignService.enqueueWeeklyDigest({
      limit: config.limit,
    });
    this.logResult(result);
    return result;
  }

  private registerCronJobs(): void {
    const config = this.getConfig();

    if (!config.enabled) {
      this.logger.log(
        JSON.stringify({
          event: 'notification.campaign.scheduler.disabled',
          processRole: config.processRole,
          configuredEnabled: config.configuredEnabled,
          eligibleProcessRole: 'api',
        }),
      );
      return;
    }

    this.registerCronJob(DAILY_CASE_ALERTS_CRON_JOB, '0 8 * * *', () => {
      void this.runDailyCaseAlerts();
    });
    this.registerCronJob(STREAK_REMINDERS_CRON_JOB, '0 18 * * *', () => {
      void this.runStreakReminders();
    });
    this.registerCronJob(WEEKLY_DIGEST_CRON_JOB, '30 18 * * 0', () => {
      void this.runWeeklyDigest();
    });
  }

  private registerCronJob(
    name: string,
    cron: string,
    onTick: () => void,
  ): void {
    try {
      if (this.schedulerRegistry.doesExist('cron', name)) {
        this.schedulerRegistry.deleteCronJob(name);
      }

      const job = CronJob.from({
        cronTime: cron,
        onTick,
        start: false,
        timeZone: NOTIFICATION_CAMPAIGN_TIMEZONE,
        waitForCompletion: true,
        name,
      });

      this.schedulerRegistry.addCronJob(name, job);
      job.start();
      this.logger.log(
        JSON.stringify({
          event: 'notification.campaign.scheduler.registered',
          cronJobName: name,
          cron,
          timezone: NOTIFICATION_CAMPAIGN_TIMEZONE,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'notification.campaign.scheduler.registration_failed',
          cronJobName: name,
          cron,
          timezone: NOTIFICATION_CAMPAIGN_TIMEZONE,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private recordDisabled(
    campaign: NotificationCampaignName,
    config: NotificationCampaignSchedulerConfig,
  ): DisabledCampaignResult {
    const result: DisabledCampaignResult = {
      status: 'disabled',
      campaign,
      processRole: config.processRole,
      configuredEnabled: config.configuredEnabled,
      eligibleProcessRole: 'api',
    };
    this.logger.log(
      JSON.stringify({
        event: 'notification.campaign.scheduler.run.disabled',
        ...result,
      }),
    );
    return result;
  }

  private logResult(result: {
    campaign: string;
    enqueuedCount: number;
    skippedCount: number;
  }): void {
    this.logger.log(
      JSON.stringify({
        event: 'notification.campaign.scheduler.completed',
        campaign: result.campaign,
        enqueuedCount: result.enqueuedCount,
        skippedCount: result.skippedCount,
      }),
    );
  }

  private getConfig(): NotificationCampaignSchedulerConfig {
    const env = getEnv();
    const processRole = env.APP_PROCESS_ROLE;
    return {
      configuredEnabled: env.NOTIFICATION_CAMPAIGNS_ENABLED,
      enabled: env.NOTIFICATION_CAMPAIGNS_ENABLED && processRole === 'api',
      processRole,
      limit: env.NOTIFICATION_CAMPAIGN_LIMIT,
      timezone: NOTIFICATION_CAMPAIGN_TIMEZONE,
    };
  }
}
