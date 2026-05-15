import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  streakReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  challengeAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyDigest?: boolean;

  @IsOptional()
  @IsBoolean()
  productAnnouncements?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;
}
