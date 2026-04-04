import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('returns dashboard-ready top wrong response', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        { guess: 'flu', count: BigInt(3) },
        { guess: 'cold', count: BigInt(2) },
      ]),
    };

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const metrics = {
      increment: jest.fn(),
      observe: jest.fn(),
    };

    const service = new AnalyticsService(
      prisma as never,
      logger as never,
      metrics as never,
    );

    const response = await service.getTopWrongGuesses();

    expect(response.data).toBeDefined();
    expect(response.meta.count).toBeGreaterThan(0);
    expect(response.data[0]).toHaveProperty('guess');
    expect(response.data[0]).toHaveProperty('count');
    expect(metrics.observe).toHaveBeenCalled();
  });
});
