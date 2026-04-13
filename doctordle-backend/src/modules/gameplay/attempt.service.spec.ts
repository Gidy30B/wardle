import { AttemptService } from './attempt.service';

describe('AttemptService', () => {
  it('records attempt and emits analytics hooks', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a-1', score: 0.91 });
    const prisma = {
      attempt: {
        create,
      },
    };

    const metrics = {
      increment: jest.fn(),
      observe: jest.fn(),
    };

    const rewardOrchestrator = {
      emitAttemptRecorded: jest.fn().mockResolvedValue(undefined),
      emitAttemptRecordFailed: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AttemptService(
      prisma as never,
      metrics as never,
      rewardOrchestrator as never,
    );

    const attempt = await service.recordAttempt({
      caseId: 'c-1',
      sessionId: 's-1',
      userId: 'u-1',
      guess: 'heart attack',
      normalizedGuess: 'heart attack',
      score: 0.91,
      result: 'correct',
      signals: { synonym: true },
      evaluatorVersion: 'v2',
    });

    expect(attempt).toHaveProperty('score', 0.91);
    expect(create).toHaveBeenCalledTimes(1);
    expect(metrics.increment).toHaveBeenCalledWith('attempt.created');
    expect(metrics.observe).toHaveBeenCalled();
    expect(rewardOrchestrator.emitAttemptRecorded).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'c-1',
        sessionId: 's-1',
        userId: 'u-1',
        result: 'correct',
      }),
    );
  });
});
