import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisRegistryCandidateStatus,
  DifferentialResolutionStatus,
} from '@prisma/client';
import { DiagnosisRegistryCandidateService } from './diagnosis-registry-candidate.service';

function createFixture() {
  const prisma = {
    caseDifferentialMapping: {
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    educationDifferentialMapping: {
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    diagnosisRegistryCandidate: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(async (args) => ({
        id: 'candidate-1',
        ...args.data,
      })),
      update: jest.fn(async (args) => ({
        id: args.where.id,
        ...args.data,
      })),
    },
    diagnosisRegistry: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    diagnosisAlias: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  return {
    prisma,
    service: new DiagnosisRegistryCandidateService(prisma as never),
  };
}

function unresolvedCaseMapping(
  status = DifferentialResolutionStatus.UNRESOLVED,
) {
  return {
    id: 'map-1',
    rawText: 'Rare Mimic Syndrome',
    normalizedText: 'rare mimic syndrome',
    status,
    caseId: 'case-1',
    revisionId: null,
    case: {
      diagnosisRegistryId: 'context-1',
    },
  };
}

describe('DiagnosisRegistryCandidateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a candidate from an unresolved case differential mapping', async () => {
    const { prisma, service } = createFixture();
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue(
      unresolvedCaseMapping(),
    );

    const result = await service.createFromDifferentialMapping({
      mappingId: 'map-1',
    });

    expect(prisma.diagnosisRegistryCandidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          proposedCanonicalName: 'Rare Mimic Syndrome',
          proposedCanonicalNormalized: 'rare mimic syndrome',
          proposedDisplayLabel: 'Rare Mimic Syndrome',
          sourceType: 'case',
          sourceId: 'case-1',
          sourceMappingId: 'map-1',
          sourceRawText: 'Rare Mimic Syndrome',
          contextDiagnosisRegistryId: 'context-1',
          status: DiagnosisRegistryCandidateStatus.CANDIDATE,
        }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'candidate-1' }));
  });

  it('creates a candidate from an ambiguous education differential mapping', async () => {
    const { prisma, service } = createFixture();
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue(null);
    prisma.educationDifferentialMapping.findUnique.mockResolvedValue({
      id: 'map-2',
      rawText: 'Education Mimic',
      normalizedText: 'education mimic',
      status: DifferentialResolutionStatus.AMBIGUOUS,
      educationId: 'education-1',
      revisionId: 'revision-1',
      diagnosisRegistryId: 'context-2',
    });

    await service.createFromDifferentialMapping({ mappingId: 'map-2' });

    expect(prisma.diagnosisRegistryCandidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'education_revision',
          sourceId: 'revision-1',
          contextDiagnosisRegistryId: 'context-2',
        }),
      }),
    );
  });

  it('does not create a candidate from a resolved mapping', async () => {
    const { prisma, service } = createFixture();
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue(
      unresolvedCaseMapping(DifferentialResolutionStatus.RESOLVED),
    );

    await expect(
      service.createFromDifferentialMapping({ mappingId: 'map-1' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.diagnosisRegistryCandidate.create).not.toHaveBeenCalled();
  });

  it('prevents duplicate candidates for the same source mapping and normalized canonical', async () => {
    const { prisma, service } = createFixture();
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue(
      unresolvedCaseMapping(),
    );
    prisma.diagnosisRegistryCandidate.findFirst.mockResolvedValue({
      id: 'candidate-existing',
    });

    await expect(
      service.createFromDifferentialMapping({ mappingId: 'map-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('stores registry and alias duplicate suggestions', async () => {
    const { prisma, service } = createFixture();
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue(
      unresolvedCaseMapping(),
    );
    prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-1',
        canonicalName: 'Rare Mimic Syndrome',
        displayLabel: 'Rare Mimic Syndrome',
        status: 'ACTIVE',
      },
    ]);
    prisma.diagnosisAlias.findMany.mockResolvedValue([
      {
        id: 'alias-1',
        term: 'Rare Mimic',
        kind: 'ACCEPTED',
        diagnosis: {
          id: 'registry-2',
          canonicalName: 'Other Mimic',
          displayLabel: 'Other Mimic',
          status: 'ACTIVE',
        },
      },
    ]);

    await service.createFromDifferentialMapping({ mappingId: 'map-1' });

    expect(prisma.diagnosisRegistryCandidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duplicateSuggestions: expect.objectContaining({
            registryCanonicalMatches: expect.arrayContaining([
              expect.objectContaining({ id: 'registry-1' }),
            ]),
            registryAliasMatches: expect.arrayContaining([
              expect.objectContaining({ aliasId: 'alias-1' }),
            ]),
          }),
        }),
      }),
    );
  });

  it('returns exact editorial queue counts', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistryCandidate.count
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(4);
    prisma.caseDifferentialMapping.count.mockResolvedValue(3);
    prisma.educationDifferentialMapping.count.mockResolvedValue(2);

    await expect(service.getQueueSummary()).resolves.toEqual({
      registryCandidateCount: 9,
      unresolvedDifferentialCount: 5,
      pendingRegistryCandidateCount: 4,
    });
  });

  it('reviews candidates without creating registry entries', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistryCandidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
    });

    await service.reviewCandidate('candidate-1', 'reviewer-1', {
      action: 'mark_needs_review',
      note: 'Needs senior discussion',
    });

    expect(prisma.diagnosisRegistryCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DiagnosisRegistryCandidateStatus.NEEDS_REVIEW,
          reviewerUserId: 'reviewer-1',
          reviewNote: 'Needs senior discussion',
        }),
      }),
    );
    expect(
      (prisma.diagnosisRegistry as Record<string, unknown>).create,
    ).toBeUndefined();
  });

  it('rejects candidates', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistryCandidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
    });

    await service.reviewCandidate('candidate-1', 'reviewer-1', {
      action: 'reject',
      note: 'Not a diagnosis',
    });

    expect(prisma.diagnosisRegistryCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DiagnosisRegistryCandidateStatus.REJECTED,
        }),
      }),
    );
  });

  it('merges duplicate candidates after validating the target candidate', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistryCandidate.findUnique
      .mockResolvedValueOnce({ id: 'candidate-1' })
      .mockResolvedValueOnce({
        id: 'candidate-2',
        proposedDisplayLabel: 'Duplicate',
      });

    await service.reviewCandidate('candidate-1', 'reviewer-1', {
      action: 'merge_duplicate_candidate',
      duplicateCandidateId: 'candidate-2',
    });

    expect(prisma.diagnosisRegistryCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DiagnosisRegistryCandidateStatus.MERGED,
        }),
      }),
    );
  });

  it('throws when mapping cannot be found', async () => {
    const { prisma, service } = createFixture();
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue(null);
    prisma.educationDifferentialMapping.findUnique.mockResolvedValue(null);

    await expect(
      service.createFromDifferentialMapping({ mappingId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });
});
