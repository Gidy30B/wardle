import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { UserNotificationSettingsController } from './user-notification-settings.controller';

describe('UserNotificationSettingsController', () => {
  const req = {
    user: {
      id: 'user-1',
      clerkId: 'clerk-1',
      role: 'USER',
    },
  } as AuthenticatedRequest;

  function createController() {
    const service = {
      getForUser: jest.fn().mockResolvedValue({
        settings: {
          streakReminders: true,
          challengeAlerts: true,
          weeklyDigest: true,
          productAnnouncements: true,
          pushNotifications: false,
        },
      }),
      updateForUser: jest.fn().mockResolvedValue({
        settings: {
          streakReminders: false,
          challengeAlerts: true,
          weeklyDigest: true,
          productAnnouncements: true,
          pushNotifications: false,
        },
      }),
    };

    return {
      controller: new UserNotificationSettingsController(service as never),
      service,
    };
  }

  it('fetches notification settings for the authenticated user', async () => {
    const { controller, service } = createController();

    await controller.getSettings(req);

    expect(service.getForUser).toHaveBeenCalledWith('user-1');
  });

  it('updates notification settings for the authenticated user', async () => {
    const { controller, service } = createController();
    const body = {
      streakReminders: false,
      pushNotifications: true,
    };

    await controller.updateSettings(req, body);

    expect(service.updateForUser).toHaveBeenCalledWith('user-1', body);
  });

  it('ignores any caller-supplied user identity and scopes updates to req.user.id', async () => {
    const { controller, service } = createController();
    const body = {
      streakReminders: false,
      userId: 'user-2',
    } as never;

    await controller.updateSettings(req, body);

    expect(service.updateForUser).toHaveBeenCalledWith('user-1', body);
    expect(service.updateForUser).not.toHaveBeenCalledWith('user-2', body);
  });
});
