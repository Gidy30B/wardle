import { CaseReviewGovernanceRepository } from './case-review-governance.repository';

describe('CaseReviewGovernanceRepository', () => {
  function createClient() {
    return {
      caseReviewContextSnapshot: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      caseEditorialDecision: {
        create: jest.fn<(args: unknown) => Promise<unknown>>(),
        findMany: jest.fn(),
      },
      caseReviewEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
  }

  function createDecisionInput(overrides = {}) {
    return {
      caseReviewId: 'review-1',
      contextSnapshotId: 'snapshot-1',
      caseId: 'case-1',
      revisionId: 'revision-1',
      decisionType: 'APPROVE' as const,
      actorUserId: 'user-1',
      actorRole: 'editor',
      rationale: 'The case is clinically coherent and validated.',
      previousEditorialStatus: 'REVIEW',
      resultingEditorialStatus: 'APPROVED',
      ...overrides,
    };
  }

  function createSnapshot(overrides = {}) {
    return {
      id: 'snapshot-1',
      caseReviewId: 'review-1',
      caseId: 'case-1',
      revisionId: 'revision-1',
      purpose: 'DECISION_SUBMISSION' as const,
      ...overrides,
    };
  }

  it('requires a non-empty rationale before recording an editorial decision', async () => {
    const repository = new CaseReviewGovernanceRepository();
    const client = createClient();

    await expect(
      repository.createEditorialDecision(
        client,
        createDecisionInput({ rationale: '   ' }),
      ),
    ).rejects.toThrow('non-empty rationale');

    expect(client.caseReviewContextSnapshot.findUnique).not.toHaveBeenCalled();
    expect(client.caseEditorialDecision.create).not.toHaveBeenCalled();
  });

  it('requires decisions to link to an existing matching context snapshot', async () => {
    const repository = new CaseReviewGovernanceRepository();
    const client = createClient();

    client.caseReviewContextSnapshot.findUnique.mockResolvedValue(
      createSnapshot({ revisionId: 'revision-other' }),
    );

    await expect(
      repository.createEditorialDecision(client, createDecisionInput()),
    ).rejects.toThrow('same review, case, and revision');

    expect(client.caseEditorialDecision.create).not.toHaveBeenCalled();
  });

  it('trims rationale and records decisions against the linked snapshot', async () => {
    const repository = new CaseReviewGovernanceRepository();
    const client = createClient();

    client.caseReviewContextSnapshot.findUnique.mockResolvedValue(
      createSnapshot(),
    );
    let capturedCreateArgs: unknown;
    client.caseEditorialDecision.create.mockImplementation((args) => {
      capturedCreateArgs = args;
      return Promise.resolve({ id: 'decision-1' });
    });

    await expect(
      repository.createEditorialDecision(
        client,
        createDecisionInput({
          rationale: '  Ready after validation and review.  ',
        }),
      ),
    ).resolves.toEqual({ id: 'decision-1' });

    expect(client.caseEditorialDecision.create).toHaveBeenCalledTimes(1);

    const typedCreateArgs = capturedCreateArgs as {
      data?: Record<string, unknown>;
    };

    expect(typedCreateArgs.data?.contextSnapshotId).toBe('snapshot-1');
    expect(typedCreateArgs.data?.caseReviewId).toBe('review-1');
    expect(typedCreateArgs.data?.caseId).toBe('case-1');
    expect(typedCreateArgs.data?.revisionId).toBe('revision-1');
    expect(typedCreateArgs.data?.rationale).toBe(
      'Ready after validation and review.',
    );
  });

  it('requires mark-ready decisions to reference approval and publication-readiness context', async () => {
    const repository = new CaseReviewGovernanceRepository();
    const client = createClient();

    client.caseReviewContextSnapshot.findUnique.mockResolvedValue(
      createSnapshot({ purpose: 'DECISION_SUBMISSION' }),
    );

    await expect(
      repository.createEditorialDecision(
        client,
        createDecisionInput({
          decisionType: 'MARK_READY_TO_PUBLISH',
          readinessOutcome: 'READY',
          approvingDecisionId: 'decision-approval',
        }),
      ),
    ).rejects.toThrow('publication-readiness context snapshot');

    client.caseReviewContextSnapshot.findUnique.mockResolvedValue(
      createSnapshot({ purpose: 'PUBLICATION_READINESS' }),
    );

    await expect(
      repository.createEditorialDecision(
        client,
        createDecisionInput({
          decisionType: 'MARK_READY_TO_PUBLISH',
          readinessOutcome: 'READY',
          approvingDecisionId: null,
        }),
      ),
    ).rejects.toThrow('linked approving editorial decision');

    await expect(
      repository.createEditorialDecision(
        client,
        createDecisionInput({
          decisionType: 'MARK_READY_TO_PUBLISH',
          readinessOutcome: null,
          approvingDecisionId: 'decision-approval',
        }),
      ),
    ).rejects.toThrow('readiness outcome');

    expect(client.caseEditorialDecision.create).not.toHaveBeenCalled();
  });

  it('queries governance history chronologically across snapshots, decisions, and events', async () => {
    const repository = new CaseReviewGovernanceRepository();
    const client = createClient();

    client.caseReviewContextSnapshot.findMany.mockResolvedValue([
      { id: 'snapshot-b', createdAt: new Date('2026-07-19T10:01:00.000Z') },
    ]);
    client.caseEditorialDecision.findMany.mockResolvedValue([
      { id: 'decision-a', createdAt: new Date('2026-07-19T10:02:00.000Z') },
    ]);
    client.caseReviewEvent.findMany.mockResolvedValue([
      { id: 'event-a', createdAt: new Date('2026-07-19T10:00:00.000Z') },
    ]);

    await expect(repository.listCaseHistory(client, 'case-1')).resolves.toEqual(
      [
        expect.objectContaining({ id: 'event-a', kind: 'REVIEW_EVENT' }),
        expect.objectContaining({
          id: 'snapshot-b',
          kind: 'CONTEXT_SNAPSHOT',
        }),
        expect.objectContaining({
          id: 'decision-a',
          kind: 'EDITORIAL_DECISION',
        }),
      ],
    );

    expect(client.caseReviewContextSnapshot.findMany).toHaveBeenCalledWith({
      where: { caseId: 'case-1' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(client.caseEditorialDecision.findMany).toHaveBeenCalledWith({
      where: { caseId: 'case-1' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(client.caseReviewEvent.findMany).toHaveBeenCalledWith({
      where: { caseId: 'case-1' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  });
});
