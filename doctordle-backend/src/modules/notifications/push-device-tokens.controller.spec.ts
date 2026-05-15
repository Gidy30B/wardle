import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PushDeviceTokensController } from './push-device-tokens.controller';

describe('PushDeviceTokensController', () => {
  const req = {
    user: {
      id: 'user-1',
      clerkId: 'clerk-1',
      role: 'USER',
    },
  } as AuthenticatedRequest;

  function createController() {
    const service = {
      registerForUser: jest.fn().mockResolvedValue({
        token: {
          id: 'push-token-1',
        },
      }),
      disableForUser: jest.fn().mockResolvedValue({
        disabled: true,
      }),
    };

    return {
      controller: new PushDeviceTokensController(service as never),
      service,
    };
  }

  it('registers token for the authenticated user', async () => {
    const { controller, service } = createController();
    const body = {
      token: 'ExponentPushToken[test]',
      platform: 'android' as const,
      deviceId: 'device-1',
      appVersion: '1.0.0',
    };

    await controller.register(req, body);

    expect(service.registerForUser).toHaveBeenCalledWith('user-1', body);
  });

  it('disables token for the authenticated user', async () => {
    const { controller, service } = createController();

    await controller.disable(req, 'ExponentPushToken[test]');

    expect(service.disableForUser).toHaveBeenCalledWith(
      'user-1',
      'ExponentPushToken[test]',
    );
  });

  it('unauthenticated requests fail through the global Clerk guard', async () => {
    const guard = new ClerkAuthGuard(
      new Reflector(),
      {} as never,
      {} as never,
    );
    const context = {
      getHandler: jest.fn().mockReturnValue(() => undefined),
      getClass: jest.fn().mockReturnValue(PushDeviceTokensController),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
