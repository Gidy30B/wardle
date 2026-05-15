import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { NotificationCategory } from './notification.types';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  const req = {
    user: {
      id: 'user-1',
      clerkId: 'clerk-1',
      role: 'USER',
    },
  } as AuthenticatedRequest;

  function createController() {
    const notificationsService = {
      listForUser: jest.fn().mockResolvedValue({ notifications: [] }),
      getUnreadCount: jest.fn().mockResolvedValue({ unreadCount: 0 }),
      markAllRead: jest.fn().mockResolvedValue({ updatedCount: 0 }),
      markRead: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    };

    const preferencesService = {
      listForUser: jest.fn().mockResolvedValue({
        preferences: [
          {
            category: NotificationCategory.Streak,
            inAppEnabled: true,
            pushEnabled: false,
            emailEnabled: false,
          },
        ],
      }),
      updateForUser: jest.fn().mockResolvedValue([
        {
          category: NotificationCategory.Streak,
          inAppEnabled: false,
          pushEnabled: false,
          emailEnabled: false,
        },
      ]),
    };

    return {
      controller: new NotificationsController(
        notificationsService as never,
        preferencesService as never,
      ),
      notificationsService,
      preferencesService,
    };
  }

  it('fetches own notifications', async () => {
    const { controller, notificationsService } = createController();

    await controller.list(req, { limit: 20, unreadOnly: true });

    expect(notificationsService.listForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 20,
      unreadOnly: true,
    });
  });

  it('fetches own preferences', async () => {
    const { controller, preferencesService } = createController();

    await controller.preferences(req);

    expect(preferencesService.listForUser).toHaveBeenCalledWith('user-1');
  });

  it('updates own preferences', async () => {
    const { controller, preferencesService } = createController();
    const body = {
      preferences: [
        {
          category: NotificationCategory.Streak,
          inAppEnabled: false,
        },
      ],
    };

    await controller.updatePreferences(req, body);

    expect(preferencesService.updateForUser).toHaveBeenCalledWith(
      'user-1',
      body.preferences,
    );
  });

  it('scopes read mutations to the authenticated user', async () => {
    const { controller, notificationsService } = createController();

    await controller.markRead(req, 'notification-from-somewhere');
    await controller.markAllRead(req);
    await controller.unreadCount(req);

    expect(notificationsService.markRead).toHaveBeenCalledWith(
      'user-1',
      'notification-from-somewhere',
    );
    expect(notificationsService.markAllRead).toHaveBeenCalledWith('user-1');
    expect(notificationsService.getUnreadCount).toHaveBeenCalledWith('user-1');
  });
});
