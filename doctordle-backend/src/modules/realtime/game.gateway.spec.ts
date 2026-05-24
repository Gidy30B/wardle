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
    const redisPubSub = {
      subscribe: jest.fn().mockResolvedValue(undefined),
    };

    const gateway = new GameGateway(
      {} as never,
      {} as never,
      redisPubSub as never,
    );

    return { gateway, redisPubSub };
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
});
