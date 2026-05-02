import { IsArray, IsBoolean, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategoryValue,
} from '../notification.types';

class NotificationPreferencePatchDto {
  @IsIn(NOTIFICATION_CATEGORIES)
  category!: NotificationCategoryValue;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferencePatchDto)
  preferences!: NotificationPreferencePatchDto[];
}
