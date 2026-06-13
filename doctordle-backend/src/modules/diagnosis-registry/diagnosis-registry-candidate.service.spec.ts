import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisEditorialOnboardingStatus,
  DiagnosisRegistryCandidateStatus,
  DifferentialResolutionStatus,
} from '@prisma/client';
import { DiagnosisRegistryCandidateService } from './diagnosis-registry-candidate.service';

function createFixture() {
  const prisma: any = {
    caseDifferentialMapping: {
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(async (args) => ({
        id: args.where.id,
        ...args.data,
      })),
    },
    educationDifferentialMapping: {
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(async (args) => ({
        id: args.where.id,
        ...args.data,
      })),
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
      findUnique: jest.fn().mockResolvedValue({
        id: 'registry-created',
        displayLabel: 'Rare Mimic Syndrome',
        canonicalNormalized: 'rare mimic syndrome',
      }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(async (args) => ({
        id: 'registry-created',
        ...args.data,
      })),
    },
    diagnosisAlias: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(async (args) => ({
        id: 'alias-created',
        term: args.create.term,
        normalizedTerm: args.create.normalizedTerm,
      })),
    },
    $transaction: jest.fn(async (handler) => handler(prisma)),
  };
  const differentialLinkService = {
    syncCaseMappingRow: jest.fn().mockResolvedValue({ action: 'created' }),
    syncEducationMappingRow: jest.fn().mockResolvedValue({ action: 'created' }),
  };

  return {
    prisma,
    differentialLinkService,
    service: new DiagnosisRegistryCandidateService(
      prisma as never,
      differentialLinkService as never,
    ),
  };
}

function unresolvedCaseMapping(
  status: DifferentialResolutionStatus = DifferentialResolutionStatus.UNRESOLVED,
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

  it('adds activation readiness for created draft registry rows in the queue', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistryCandidate.findMany.mockResolvedValue([
      {
        id: 'candidate-1',
        createdRegistryId: 'registry-created',
        proposedDisplayLabel: 'Rare Mimic Syndrome',
      },
    ]);
    prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-created',
        displayLabel: 'Rare Mimic Syndrome',
        canonicalName: 'Rare Mimic Syndrome',
        canonicalNormalized: 'rare mimic syndrome',
        status: 'DRAFT',
        active: false,
        isPlayable: false,
        isGeneratable: false,
        onboardingStatus: 'NEW',
        specialty: null,
        bodySystem: null,
        category: null,
        createdRegistryCandidates: [{ id: 'candidate-1' }],
        aliases: [],
      },
    ]);

    const result = await service.listCandidates();

    expect(result[0].registryQueueState).toEqual(
      expect.objectContaining({
        status: 'DRAFT',
        dictionaryVisible: false,
        activationBlocked: true,
        missingMetadataFields: ['specialty', 'body system or category'],
        aliasCount: 0,
        suggestedMetadataAvailable: true,
      }),
    );
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
    expect(prisma.diagnosisRegistry.create).not.toHaveBeenCalled();
  });

  it('creates a draft registry from a candidate and resolves the source mapping', async () => {
    const { prisma, differentialLinkService, service } = createFixture();
    prisma.diagnosisRegistryCandidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      proposedCanonicalName: 'Rare Mimic Syndrome',
      proposedCanonicalNormalized: 'rare mimic syndrome',
      proposedDisplayLabel: 'Rare Mimic Syndrome',
      proposedAliases: ['Rare Mimic'],
      sourceMappingId: 'map-1',
      sourceRawText: 'Rare Mimic Syndrome',
      status: DiagnosisRegistryCandidateStatus.CANDIDATE,
      createdRegistryId: null,
    });
    prisma.caseDifferentialMapping.findUnique
      .mockResolvedValueOnce({ id: 'map-1' })
      .mockResolvedValueOnce({
        ...unresolvedCaseMapping(),
        status: DifferentialResolutionStatus.RESOLVED,
        resolvedDiagnosisRegistryId: 'registry-created',
      });
    const result = await service.createRegistryFromCandidate(
      'candidate-1',
      'senior-1',
    );

    expect(prisma.diagnosisRegistry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          active: false,
          onboardingStatus: DiagnosisEditorialOnboardingStatus.NEW,
          onboardingStartedAt: expect.any(Date),
          isPlayable: false,
          isGeneratable: false,
        }),
      }),
    );
    expect(prisma.diagnosisAlias.upsert).toHaveBeenCalled();
    expect(prisma.caseDifferentialMapping.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DifferentialResolutionStatus.RESOLVED,
          resolvedDiagnosisRegistryId: 'registry-created',
        }),
      }),
    );
    expect(differentialLinkService.syncCaseMappingRow).toHaveBeenCalled();
    expect(prisma.diagnosisRegistryCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DiagnosisRegistryCandidateStatus.CREATED,
          createdRegistryId: 'registry-created',
          approvedByUserId: 'senior-1',
        }),
      }),
    );
    expect(result.mappingsResolvedCount).toBe(1);
    expect(result.structuredLinksUpdatedCount).toBe(1);
  });

  it('blocks candidate creation when canonical registry already exists', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistryCandidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      proposedCanonicalName: 'Rare Mimic Syndrome',
      proposedDisplayLabel: 'Rare Mimic Syndrome',
      proposedAliases: [],
      sourceMappingId: null,
      sourceRawText: 'Rare Mimic Syndrome',
      status: DiagnosisRegistryCandidateStatus.CANDIDATE,
      createdRegistryId: null,
    });
    prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-existing',
        canonicalName: 'Rare Mimic Syndrome',
        displayLabel: 'Rare Mimic Syndrome',
        status: 'ACTIVE',
      },
    ]);

    await expect(
      service.createRegistryFromCandidate('candidate-1', 'senior-1'),
    ).rejects.toThrow(ConflictException);
    expect(prisma.diagnosisRegistry.create).not.toHaveBeenCalled();
  });

  it('skips invalid aliases with warnings instead of failing creation', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistryCandidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      proposedCanonicalName: 'Rare Mimic Syndrome',
      proposedDisplayLabel: 'Rare Mimic Syndrome',
      proposedAliases: ['Rare Mimic'],
      sourceMappingId: null,
      sourceRawText: 'Rare Mimic Syndrome',
      status: DiagnosisRegistryCandidateStatus.NEEDS_REVIEW,
      createdRegistryId: null,
    });
    prisma.diagnosisRegistry.findMany.mockResolvedValueOnce([]);
    prisma.diagnosisAlias.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'alias-existing',
          diagnosisRegistryId: 'other-registry',
          term: 'Rare Mimic',
          normalizedTerm: 'rare mimic',
          kind: 'ACCEPTED',
          acceptedForMatch: true,
          diagnosis: { id: 'other-registry', displayLabel: 'Other Registry' },
        },
      ]);

    const result = await service.createRegistryFromCandidate(
      'candidate-1',
      'senior-1',
    );

    expect(result.rejectedAliases).toHaveLength(1);
    expect(result.createdAliases).toHaveLength(0);
    expect(prisma.diagnosisRegistryCandidate.update).toHaveBeenCalled();
  });

  it('cannot recreate an already-created candidate', async () => {
    const { prisma, service } = createFixture();
    prisma.diagnosisRegistryCandidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      status: DiagnosisRegistryCandidateStatus.CREATED,
      createdRegistryId: 'registry-created',
    });

    await expect(
      service.createRegistryFromCandidate('candidate-1', 'senior-1'),
    ).rejects.toThrow(ConflictException);
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
