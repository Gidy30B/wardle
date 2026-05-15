import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { NotificationCampaignScheduler } from './notification-campaign.scheduler';
import { CronJob } from 'cron';

describe('NotificationCampaignScheduler', () => {
  const envKeys = [
    'APP_PROCESS_ROLE',
    'NOTIFICATION_CAMPAIGNS_ENABLED',
    'NOTIFICATION_CAMPAIGN_LIMIT',
  ] as const;
  const originalEnv = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of envKeys) {
      originalEnv.set(key, process.env[key]);
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    resetEnvCacheForTests();
    jest.clearAllMocks();
  });

  function setCampaignEnv(input: {
    enabled: boolean;
    processRole?: 'api' | 'worker';
    limit?: number;
  }) {
    process.env.NOTIFICATION_CAMPAIGNS_ENABLED = input.enabled
      ? 'true'
      : 'false';
    process.env.APP_PROCESS_ROLE = input.processRole ?? 'api';
    if (input.limit === undefined) {
      delete process.env.NOTIFICATION_CAMPAIGN_LIMIT;
    } else {
      process.env.NOTIFICATION_CAMPAIGN_LIMIT = String(input.limit);
    }
    resetEnvCacheForTests();
  }

  function createScheduler() {
    const campaignService = {
      enqueueDailyCaseAlerts: jest.fn().mockResolvedValue({
        campaign: 'daily_case_alerts',
        enqueuedCount: 2,
        skippedCount: 0,
      }),
      enqueueStreakReminders: jest.fn().mockResolvedValue({
        campaign: 'streak_reminders',
        enqueuedCount: 3,
        skippedCount: 0,
      }),
      enqueueWeeklyDigest: jest.fn().mockResolvedValue({
        campaign: 'weekly_digest',
        enqueuedCount: 4,
        skippedCount: 0,
      }),
    };
    const schedulerRegistry = {
      doesExist: jest.fn().mockReturnValue(false),
      deleteCronJob: jest.fn(),
      addCronJob: jest.fn(),
    };

    return {
      campaignService,
      scheduler: new NotificationCampaignScheduler(
        campaignService as never,
        schedulerRegistry as never,
      ),
      schedulerRegistry,
    };
  }

  it('does nothing when notification campaigns are disabled', async () => {
    setCampaignEnv({ enabled: false });
    const { campaignService, scheduler, schedulerRegistry } =
      createScheduler();

    scheduler.onModuleInit();
    await expect(scheduler.runDailyCaseAlerts()).resolves.toMatchObject({
      status: 'disabled',
      campaign: 'daily_case_alerts',
    });

    expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    expect(campaignService.enqueueDailyCaseAlerts).not.toHaveBeenCalled();
    expect(campaignService.enqueueStreakReminders).not.toHaveBeenCalled();
    expect(campaignService.enqueueWeeklyDigest).not.toHaveBeenCalled();
  });

  it('does nothing when APP_PROCESS_ROLE is not api', async () => {
    setCampaignEnv({ enabled: true, processRole: 'worker' });
    const { campaignService, scheduler, schedulerRegistry } =
      createScheduler();

    scheduler.onModuleInit();
    await expect(scheduler.runStreakReminders()).resolves.toMatchObject({
      status: 'disabled',
      campaign: 'streak_reminders',
      processRole: 'worker',
    });

    expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    expect(campaignService.enqueueDailyCaseAlerts).not.toHaveBeenCalled();
    expect(campaignService.enqueueStreakReminders).not.toHaveBeenCalled();
    expect(campaignService.enqueueWeeklyDigest).not.toHaveBeenCalled();
  });

  it('calls daily case campaign when enabled', async () => {
    setCampaignEnv({ enabled: true });
    const { campaignService, scheduler } = createScheduler();

    await scheduler.runDailyCaseAlerts();

    expect(campaignService.enqueueDailyCaseAlerts).toHaveBeenCalledWith({
      limit: 500,
    });
  });

  it('registers scheduler jobs only when enabled on the api process', () => {
    setCampaignEnv({ enabled: true, processRole: 'api' });
    const start = jest.fn();
    const cronSpy = jest.spyOn(CronJob, 'from').mockReturnValue({
      start,
    } as never);
    const { scheduler, schedulerRegistry } = createScheduler();

    scheduler.onModuleInit();

    expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(3);
    expect(cronSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cronTime: '0 8 * * *',
        timeZone: 'Africa/Nairobi',
      }),
    );
    expect(cronSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cronTime: '0 18 * * *',
        timeZone: 'Africa/Nairobi',
      }),
    );
    expect(cronSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cronTime: '30 18 * * 0',
        timeZone: 'Africa/Nairobi',
      }),
    );
    expect(start).toHaveBeenCalledTimes(3);

    cronSpy.mockRestore();
  });

  it('calls streak campaign when enabled', async () => {
    setCampaignEnv({ enabled: true, limit: 250 });
    const { campaignService, scheduler } = createScheduler();

    await scheduler.runStreakReminders();

    expect(campaignService.enqueueStreakReminders).toHaveBeenCalledWith({
      limit: 250,
    });
  });

  it('calls weekly digest only from the weekly schedule method', async () => {
    setCampaignEnv({ enabled: true });
    const { campaignService, scheduler } = createScheduler();

    await scheduler.runDailyCaseAlerts();
    await scheduler.runStreakReminders();

    expect(campaignService.enqueueWeeklyDigest).not.toHaveBeenCalled();

    await scheduler.runWeeklyDigest();

    expect(campaignService.enqueueWeeklyDigest).toHaveBeenCalledWith({
      limit: 500,
    });
  });
});
