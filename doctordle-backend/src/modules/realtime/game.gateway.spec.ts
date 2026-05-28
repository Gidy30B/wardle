import { GameGateway } from './game.gateway';

describe('GameGateway runtime role Redis subscription', () => {
  const originalRole = process.env.APP_PROCESS_ROLE;

  afterEach(() => {
    if (originalRole === undefined) {
      delete process.env.APP_PROCESS_ROLE;
    } else {
      process.env.APP_PROCESS_ROLE = originalRole;
    }
    jest.restoreAllMocks();
  });

  function createGateway() {
    const clerkJwtService = {
      verifyBearerToken: jest.fn().mockResolvedValue({ clerkId: 'clerk-1' }),
    };
    const redisPubSub = {
      subscribe: jest.fn().mockResolvedValue(undefined),
    };
    const userSyncService = {
      syncUser: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };

    const gateway = new GameGateway(
      clerkJwtService as never,
      redisPubSub as never,
      userSyncService as never,
    );

    return { clerkJwtService, gateway, redisPubSub, userSyncService };
  }

  it('subscribes to websocket Redis events in the api role', async () => {
    process.env.APP_PROCESS_ROLE = 'api';
    const { gateway, redisPubSub } = createGateway();

    await gateway.onModuleInit();

    expect(redisPubSub.subscribe).toHaveBeenCalledWith(
      'ws:events',
      expect.any(Function),
    );
  });

  it('skips websocket Redis subscription in the worker role', async () => {
    process.env.APP_PROCESS_ROLE = 'worker';
    const { gateway, redisPubSub } = createGateway();

    await gateway.onModuleInit();

    expect(redisPubSub.subscribe).not.toHaveBeenCalled();
  });

  it('syncs websocket users before joining their room', async () => {
    const { clerkJwtService, gateway, userSyncService } = createGateway();
    const client = {
      id: 'socket-1',
      handshake: {
        auth: {
          token: 'token-1',
        },
      },
      data: {},
      join: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client as never);

    expect(clerkJwtService.verifyBearerToken).toHaveBeenCalledWith('token-1');
    expect(userSyncService.syncUser).toHaveBeenCalledWith({ clerkId: 'clerk-1' });
    expect(client.data).toEqual({ userId: 'user-1' });
    expect(client.join).toHaveBeenCalledWith('user-1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });
});
