import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { UpdateUserNotificationSettingsDto } from './dto/update-user-notification-settings.dto';
import { UserNotificationSettingsService } from './user-notification-settings.service';

@Controller('user/notification-settings')
export class UserNotificationSettingsController {
  constructor(
    private readonly notificationSettingsService: UserNotificationSettingsService,
  ) {}

  @Get()
  getSettings(@Req() req: AuthenticatedRequest) {
    return this.notificationSettingsService.getForUser(req.user.id);
  }

  @Patch()
  updateSettings(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateUserNotificationSettingsDto,
  ) {
    return this.notificationSettingsService.updateForUser(req.user.id, body);
  }
}
