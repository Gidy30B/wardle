import {
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  DiagnosisGraphSourceType,
} from '@prisma/client';
import { DiagnosisGraphCandidatesService } from './diagnosis-graph-candidates.service';

describe('DiagnosisGraphCandidatesService', () => {
  const candidate = {
    id: 'candidate-1',
    diagnosisRegistryId: 'registry-1',
    type: DiagnosisGraphCandidateType.FINDING,
    rawText: 'Nocturnal wheeze',
    normalizedText: 'nocturnal wheeze',
    dedupeKey: 'candidate-key',
    payload: null,
    targetDiagnosisRegistryId: null,
    unresolvedTargetText: null,
    sourceType: DiagnosisGraphSourceType.CASE,
    sourceId: 'case-1',
    sourceVersion: 1,
    sourcePath: 'clues.0',
  };

  const buildService = () => {
    const tx = {
      diagnosisGraphCandidate: {
        findUnique: jest.fn().mockResolvedValue(candidate),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...candidate, ...data }),
        ),
      },
      diagnosisGraphFact: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'fact-1', ...data }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'fact-1', ...data }),
        ),
      },
      diagnosisRegistry: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'target-1',
          canonicalNormalized: 'copd',
          displayLabel: 'COPD',
          active: true,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      diagnosisAlias: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'alias-1' }),
      },
    };
    const prisma = {
      diagnosisGraphCandidate: {
        findUnique: jest.fn().mockResolvedValue(candidate),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...candidate, ...data }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      diagnosisGraphFact: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((handler: (transaction: typeof tx) => unknown) =>
        handler(tx),
      ),
    };

    return {
      prisma,
      tx,
      service: new DiagnosisGraphCandidatesService(prisma as never, {
        resolve: jest.fn().mockResolvedValue({
          rawText: 'COPD',
          normalizedText: 'copd',
          status: 'resolved',
          resolvedRegistryId: 'target-1',
          resolvedDisplayLabel: 'COPD',
          matchType: 'canonical',
          confidence: 1,
          suggestions: [],
        }),
      } as never),
    };
  };

  it('approves a candidate and creates an active fact', async () => {
    const { tx, service } = buildService();

    const result = await service.approveCandidate('candidate-1', 'user-1');

    expect(tx.diagnosisGraphFact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosisRegistryId: 'registry-1',
          type: DiagnosisGraphCandidateType.FINDING,
          label: 'Nocturnal wheeze',
          normalizedLabel: 'nocturnal wheeze',
          dedupeKey: expect.any(String),
          status: DiagnosisGraphFactStatus.ACTIVE,
          sourceCandidateId: 'candidate-1',
        }),
      }),
    );
    expect(tx.diagnosisGraphCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DiagnosisGraphCandidateStatus.APPROVED,
          reviewedByUserId: 'user-1',
          promotedFactId: 'fact-1',
        }),
      }),
    );
    expect(result.fact.id).toBe('fact-1');
  });

  it('rejects a candidate with review metadata', async () => {
    const { prisma, service } = buildService();

    await service.rejectCandidate('candidate-1', 'user-1', {
      note: 'Too vague',
    });

    expect(prisma.diagnosisGraphCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DiagnosisGraphCandidateStatus.REJECTED,
          reviewedByUserId: 'user-1',
          reviewNote: 'Too vague',
        }),
      }),
    );
  });

  it('merges a candidate into a target fact', async () => {
    const { tx, service } = buildService();
    tx.diagnosisGraphFact.findUnique.mockResolvedValue({ id: 'fact-1' });

    await service.mergeCandidate('candidate-1', 'user-1', {
      targetFactId: 'fact-1',
      note: 'Duplicate',
    });

    expect(tx.diagnosisGraphCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DiagnosisGraphCandidateStatus.MERGED,
          reviewedByUserId: 'user-1',
          promotedFactId: 'fact-1',
          reviewNote: 'Duplicate',
        }),
      }),
    );
  });

  it('queries only active facts for the public graph', async () => {
    const { prisma, service } = buildService();

    await service.getActiveGraph('registry-1');

    expect(prisma.diagnosisGraphFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          diagnosisRegistryId: 'registry-1',
          status: DiagnosisGraphFactStatus.ACTIVE,
        },
      }),
    );
  });

  it('updates an existing null-target fact using the stable dedupe key', async () => {
    const { tx, service } = buildService();
    tx.diagnosisGraphFact.findUnique.mockResolvedValue({
      id: 'fact-1',
      sourceCandidateId: null,
      provenance: null,
    });

    await service.approveCandidate('candidate-1', 'user-1');

    expect(tx.diagnosisGraphFact.create).not.toHaveBeenCalled();
    expect(tx.diagnosisGraphFact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'fact-1' },
        data: expect.objectContaining({
          sourceCandidateId: 'candidate-1',
          dedupeKey: expect.any(String),
        }),
      }),
    );
  });

  it('uses different fact dedupe keys for the same label with different targets', async () => {
    const { tx, service } = buildService();
    tx.diagnosisGraphCandidate.findUnique
      .mockResolvedValueOnce({
        ...candidate,
        id: 'candidate-1',
        targetDiagnosisRegistryId: 'target-1',
      })
      .mockResolvedValueOnce({
        ...candidate,
        id: 'candidate-2',
        targetDiagnosisRegistryId: 'target-2',
      });

    await service.approveCandidate('candidate-1', 'user-1');
    await service.approveCandidate('candidate-2', 'user-1');

    const first = tx.diagnosisGraphFact.create.mock.calls[0][0].data.dedupeKey;
    const second = tx.diagnosisGraphFact.create.mock.calls[1][0].data.dedupeKey;
    expect(first).not.toBe(second);
  });

  it('blocks unresolved mimic promotion', async () => {
    const { tx, service } = buildService();
    tx.diagnosisGraphCandidate.findUnique.mockResolvedValue({
      ...candidate,
      type: DiagnosisGraphCandidateType.MIMIC,
      unresolvedTargetText: 'Rare mimic text',
    });

    await expect(
      service.approveCandidate('candidate-1', 'user-1'),
    ).rejects.toThrow(
      'Resolve this mimic to a diagnosis registry entry before approval.',
    );
    expect(tx.diagnosisGraphFact.create).not.toHaveBeenCalled();
  });

  it('resolves a mimic by linking an existing registry target', async () => {
    const { tx, service } = buildService();
    tx.diagnosisGraphCandidate.findUnique.mockResolvedValue({
      ...candidate,
      type: DiagnosisGraphCandidateType.MIMIC,
      unresolvedTargetText: 'COPD',
    });

    await service.resolveMimicCandidate('candidate-1', 'user-1', {
      action: 'link_existing',
      targetDiagnosisRegistryId: 'target-1',
    });

    expect(tx.diagnosisGraphCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetDiagnosisRegistryId: 'target-1',
          unresolvedTargetText: null,
          reviewedByUserId: 'user-1',
        }),
      }),
    );
  });

  it('adds a safe alias when resolving a mimic by alias', async () => {
    const { tx, service } = buildService();
    tx.diagnosisGraphCandidate.findUnique.mockResolvedValue({
      ...candidate,
      type: DiagnosisGraphCandidateType.MIMIC,
      unresolvedTargetText: 'Chronic obstructive pulmonary disease',
    });

    await service.resolveMimicCandidate('candidate-1', 'user-1', {
      action: 'add_alias_to_existing',
      targetDiagnosisRegistryId: 'target-1',
      aliasText: 'Chronic obstructive pulmonary disease',
    });

    expect(tx.diagnosisAlias.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          diagnosisRegistryId: 'target-1',
          normalizedTerm: 'chronic obstructive pulmonary disease',
          acceptedForMatch: true,
        }),
      }),
    );
  });

  it('blocks mimic alias creation when the alias collides with another canonical', async () => {
    const { tx, service } = buildService();
    tx.diagnosisGraphCandidate.findUnique.mockResolvedValue({
      ...candidate,
      type: DiagnosisGraphCandidateType.MIMIC,
      unresolvedTargetText: 'Acute Coronary Syndrome',
    });
    tx.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-2',
        canonicalName: 'Acute Coronary Syndrome',
        canonicalNormalized: 'acute coronary syndrome',
        displayLabel: 'ACS',
      },
    ]);

    await expect(
      service.resolveMimicCandidate('candidate-1', 'user-1', {
        action: 'add_alias_to_existing',
        targetDiagnosisRegistryId: 'target-1',
        aliasText: 'Acute Coronary Syndrome',
      }),
    ).rejects.toThrow('Alias validation failed');

    expect(tx.diagnosisAlias.upsert).not.toHaveBeenCalled();
  });
});
