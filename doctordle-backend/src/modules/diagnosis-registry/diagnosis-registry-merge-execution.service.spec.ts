import { BadRequestException } from '@nestjs/common';
import { DiagnosisRegistryStatus } from '@prisma/client';
import { DiagnosisRegistryMergeExecutionService } from './diagnosis-registry-merge-execution.service';
import type { RegistryMergeAnalysis } from './diagnosis-registry-merge-analysis.service';

function analysis(overrides: Partial<RegistryMergeAnalysis> = {}) {
  return {
    analysisHash: 'analysis-hash-1',
    allowed: true,
    severity: 'LOW',
    blockers: [],
    warnings: [],
    readiness: { score: 100, label: 'ready' },
    impact: {},
    conflicts: {
      aliases: [],
      teachingRules: [],
      graph: [],
      lifecycle: [],
      duplicateCases: [],
    },
    recommendations: [],
    mergePreview: {
      resultingCanonical: 'Target Diagnosis',
      resultingAliases: [],
      resultingStatus: DiagnosisRegistryStatus.ACTIVE,
      resultingVisibility: {
        editorialVisible: true,
        dictionaryVisible: true,
        playable: true,
        generatable: true,
      },
    },
    source: {
      id: 'source',
      canonicalName: 'Source Diagnosis',
      canonicalNormalized: 'source diagnosis',
      displayLabel: 'Source Diagnosis',
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isPlayable: true,
      isGeneratable: true,
      onboardingStatus: 'COMPLETE',
      aliases: [],
    },
    target: {
      id: 'target',
      canonicalName: 'Target Diagnosis',
      canonicalNormalized: 'target diagnosis',
      displayLabel: 'Target Diagnosis',
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isPlayable: true,
      isGeneratable: true,
      onboardingStatus: 'COMPLETE',
      aliases: [],
    },
    ...overrides,
  } satisfies RegistryMergeAnalysis;
}

function tx() {
  return {
    diagnosisRegistry: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'target',
        displayLabel: 'Target Diagnosis',
        canonicalNormalized: 'target diagnosis',
      }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'source' }),
      delete: jest.fn(),
    },
    diagnosisRegistryMergeLog: {
      create: jest.fn().mockResolvedValue({ id: 'merge-log-1' }),
    },
    diagnosisAlias: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'alias-created' }),
      update: jest.fn().mockResolvedValue({ id: 'alias-moved' }),
    },
    diagnosisEducation: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    diagnosisEditorialBrief: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    diagnosisTeachingRule: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    case: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    caseRevision: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
    caseDifferentialMapping: {
      updateMany: jest.fn().mockResolvedValue({ count: 4 }),
    },
    educationDifferentialMapping: {
      updateMany: jest.fn().mockResolvedValue({ count: 5 }),
    },
    diagnosisRegistryCandidate: {
      updateMany: jest.fn().mockResolvedValue({ count: 6 }),
    },
    caseDifferentialLink: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'case-link-1', caseId: 'case-1', caseRevisionId: null },
      ]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'case-link-1' }),
    },
    educationDifferentialLink: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'education-link-1', educationId: 'education-1', educationRevisionId: null },
      ]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'education-link-1' }),
    },
    diagnosisGraphFact: {
      updateMany: jest.fn().mockResolvedValue({ count: 7 }),
    },
    diagnosisGraphCandidate: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'candidate-1',
          type: 'FINDING',
          sourceType: 'CASE',
          sourceId: 'case-1',
          sourcePath: 'path',
          normalizedText: 'finding',
        },
      ]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'candidate-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 8 }),
    },
    attempt: {
      updateMany: jest.fn().mockResolvedValue({ count: 9 }),
    },
  };
}

function serviceFor(mergeAnalysis = analysis()) {
  const transactionClient = tx();
  const prisma = {
    $transaction: jest.fn(async (callback) => callback(transactionClient)),
  };
  const analyzer = {
    analyzeMerge: jest.fn().mockResolvedValue(mergeAnalysis),
  };
  return {
    service: new DiagnosisRegistryMergeExecutionService(
      prisma as never,
      analyzer as never,
    ),
    prisma,
    analyzer,
    tx: transactionClient,
  };
}

describe('DiagnosisRegistryMergeExecutionService', () => {
  it('rejects blocked analysis without opening a transaction', async () => {
    const { service, prisma } = serviceFor(
      analysis({
        allowed: false,
        severity: 'BLOCKED',
        blockers: ['Alias conflict'],
      }),
    );

    await expect(
      service.executeMerge({
        sourceDiagnosisRegistryId: 'source',
        targetDiagnosisRegistryId: 'target',
        performedByUserId: 'senior-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects when expected analysis hash changed', async () => {
    const { service, prisma } = serviceFor();

    await expect(
      service.executeMerge({
        sourceDiagnosisRegistryId: 'source',
        targetDiagnosisRegistryId: 'target',
        performedByUserId: 'senior-1',
        expectedAnalysisHash: 'stale-hash',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reassigns registry-linked references, deprecates source, and creates merge log', async () => {
    const { service, tx: transactionClient } = serviceFor();

    const result = await service.executeMerge({
      sourceDiagnosisRegistryId: 'source',
      targetDiagnosisRegistryId: 'target',
      performedByUserId: 'senior-1',
      reason: 'Duplicate row',
      expectedAnalysisHash: 'analysis-hash-1',
    });

    expect(result.mergeLogId).toBe('merge-log-1');
    expect(transactionClient.case.updateMany).toHaveBeenCalledWith({
      where: { diagnosisRegistryId: 'source' },
      data: { diagnosisRegistryId: 'target' },
    });
    expect(transactionClient.caseRevision.updateMany).toHaveBeenCalledWith({
      where: { diagnosisRegistryId: 'source' },
      data: { diagnosisRegistryId: 'target' },
    });
    expect(
      transactionClient.caseDifferentialMapping.updateMany,
    ).toHaveBeenCalledWith({
      where: { resolvedDiagnosisRegistryId: 'source' },
      data: { resolvedDiagnosisRegistryId: 'target' },
    });
    expect(transactionClient.diagnosisRegistry.update).toHaveBeenCalledWith({
      where: { id: 'source' },
      data: {
        status: DiagnosisRegistryStatus.DEPRECATED,
        active: false,
        isPlayable: false,
        isGeneratable: false,
      },
      select: { id: true },
    });
    expect(
      transactionClient.diagnosisRegistryMergeLog.create,
    ).toHaveBeenCalled();
    expect(transactionClient.diagnosisRegistry.delete).not.toHaveBeenCalled();
  });

  it('skips duplicate differential links safely', async () => {
    const { service, tx: transactionClient } = serviceFor();
    transactionClient.caseDifferentialLink.findFirst.mockResolvedValue({
      id: 'duplicate-link',
    });

    const result = await service.executeMerge({
      sourceDiagnosisRegistryId: 'source',
      targetDiagnosisRegistryId: 'target',
      performedByUserId: 'senior-1',
    });

    expect(transactionClient.caseDifferentialLink.update).not.toHaveBeenCalled();
    expect(result.reassignmentSummary.referencesSkipped.caseDifferentialLink).toBe(1);
  });

  it('skips aliases that would collide with the target', async () => {
    const { service, tx: transactionClient } = serviceFor();
    transactionClient.diagnosisAlias.findMany.mockResolvedValue([
      {
        id: 'alias-1',
        term: 'Existing alias',
        normalizedTerm: 'existing alias',
        acceptedForMatch: true,
      },
    ]);
    transactionClient.diagnosisAlias.findUnique.mockResolvedValue({
      id: 'target-alias',
    });

    const result = await service.executeMerge({
      sourceDiagnosisRegistryId: 'source',
      targetDiagnosisRegistryId: 'target',
      performedByUserId: 'senior-1',
    });

    expect(transactionClient.diagnosisAlias.update).not.toHaveBeenCalled();
    expect(result.reassignmentSummary.aliasesSkipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: 'Existing alias' }),
      ]),
    );
  });
});
