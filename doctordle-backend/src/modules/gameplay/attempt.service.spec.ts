import { AttemptService } from './attempt.service';

describe('AttemptService', () => {
  it('records attempt and emits analytics hooks', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a-1', score: 0.91 });
    const prisma = {
      attempt: {
        create,
      },
      diagnosisRegistry: {
        findMany: jest.fn(),
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

  it('preflights selected diagnosis references before creating an attempt', async () => {
    const create = jest.fn();
    const prisma = {
      attempt: {
        create,
      },
      diagnosisRegistry: {
        findMany: jest.fn().mockResolvedValue([]),
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

    await expect(
      service.recordAttempt({
        caseId: 'c-1',
        sessionId: 's-1',
        userId: 'u-1',
        guess: 'missing diagnosis',
        normalizedGuess: 'missing diagnosis',
        selectedDiagnosisId: 'missing-registry',
        strictMatchedDiagnosisId: null,
        score: 0,
        result: 'wrong',
        signals: {},
        evaluatorVersion: 'registry:v2',
      }),
    ).rejects.toThrow('Selected diagnosis is no longer available');

    expect(prisma.diagnosisRegistry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: {
            in: ['missing-registry'],
          },
        },
      }),
    );
    expect(create).not.toHaveBeenCalled();
    expect(metrics.increment).not.toHaveBeenCalledWith('attempt.created');
  });

  it('records attempts when selected and matched diagnosis ids exist', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a-1', score: 1 });
    const tx = {
      attempt: {
        create,
      },
      diagnosisRegistry: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'registry-1' },
          { id: 'registry-2' },
        ]),
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
      {} as never,
      metrics as never,
      rewardOrchestrator as never,
    );

    const attempt = await service.recordAttemptInTransaction(tx as never, {
      caseId: 'c-1',
      sessionId: 's-1',
      userId: 'u-1',
      guess: 'asthma',
      normalizedGuess: 'asthma',
      selectedDiagnosisId: 'registry-1',
      strictMatchedDiagnosisId: 'registry-2',
      score: 1,
      result: 'correct',
      signals: {},
      evaluatorVersion: 'registry:v2',
    });

    expect(attempt).toEqual({ id: 'a-1', score: 1 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(rewardOrchestrator.emitAttemptRecorded).toHaveBeenCalled();
  });
});
