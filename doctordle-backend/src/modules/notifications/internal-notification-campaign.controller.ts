import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { InternalApiGuard } from '../../auth/internal-api.guard';
import { Public } from '../../auth/public.decorator';
import { NotificationCampaignService } from './notification-campaign.service';

class NotificationCampaignLimitDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsString()
  targetUserId?: string;
}

class DailyCaseAlertsDto extends NotificationCampaignLimitDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}

class StreakRemindersDto extends NotificationCampaignLimitDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}

class WeeklyDigestDto extends NotificationCampaignLimitDto {
  @IsOptional()
  @IsDateString()
  weekStart?: string;

  @IsOptional()
  @IsDateString()
  weekEnd?: string;
}

@Controller('internal/notifications/campaigns')
@Public()
@UseGuards(InternalApiGuard)
export class InternalNotificationCampaignController {
  constructor(
    private readonly notificationCampaignService: NotificationCampaignService,
  ) {}

  @Post('daily-case-alerts')
  enqueueDailyCaseAlerts(@Body() body: DailyCaseAlertsDto = {}) {
    return this.notificationCampaignService.enqueueDailyCaseAlerts(body);
  }

  @Post('streak-reminders')
  enqueueStreakReminders(@Body() body: StreakRemindersDto = {}) {
    return this.notificationCampaignService.enqueueStreakReminders(body);
  }

  @Post('weekly-digest')
  enqueueWeeklyDigest(@Body() body: WeeklyDigestDto = {}) {
    return this.notificationCampaignService.enqueueWeeklyDigest(body);
  }
}
