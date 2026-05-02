import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './notification-preferences.service';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
  };
};

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Get()
  list(@Req() req: AuthenticatedRequest, @Query() query: ListNotificationsDto) {
    return this.notificationsService.listForUser({
      userId: req.user.userId,
      limit: query.limit,
      unreadOnly: query.unreadOnly,
    });
  }

  @Get('unread-count')
  unreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getUnreadCount(req.user.userId);
  }

  @Get('preferences')
  async preferences(@Req() req: AuthenticatedRequest) {
    const preferences = await this.preferencesService.listForUser(req.user.userId);
    return { preferences };
  }

  @Patch('read-all')
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(req.user.userId);
  }

  @Patch('preferences')
  async updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    const preferences = await this.preferencesService.updateForUser(
      req.user.userId,
      body.preferences,
    );
    return { preferences };
  }

  @Patch(':id/read')
  async markRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const notification = await this.notificationsService.markRead(
      req.user.userId,
      id,
    );
    return { notification };
  }
}
