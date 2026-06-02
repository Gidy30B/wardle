import { DifferentialResolutionStatus } from '@prisma/client';
import { DifferentialMappingService } from './differential-mapping.service';

function resolved(rawText: string, normalizedText = rawText.toLowerCase()) {
  return {
    rawText,
    normalizedText,
    status: 'resolved' as const,
    resolvedRegistryId: 'target-1',
    resolvedDisplayLabel: 'Target diagnosis',
    matchType: 'canonical' as const,
    confidence: 1,
    suggestions: [
      {
        diagnosisRegistryId: 'target-1',
        displayLabel: 'Target diagnosis',
        canonicalName: 'target diagnosis',
        matchType: 'canonical' as const,
        confidence: 1,
      },
    ],
  };
}

function buildFixture() {
  const prisma = {
    case: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    caseRevision: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    diagnosisEducation: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    diagnosisEducationRevision: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    caseDifferentialMapping: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    educationDifferentialMapping: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    diagnosisRegistry: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'target-1',
        displayLabel: 'Target diagnosis',
        canonicalNormalized: 'target diagnosis',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    diagnosisAlias: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
  };
  const resolver = {
    resolve: jest.fn(),
  };
  const linkService = {
    syncCaseMappingRow: jest.fn(),
    syncEducationMappingRow: jest.fn(),
  };

  return {
    prisma,
    resolver,
    linkService,
    service: new DifferentialMappingService(
      prisma as never,
      resolver as never,
      linkService as never,
    ),
  };
}

describe('DifferentialMappingService', () => {
  it('extracts case differential strings and persists resolved mappings', async () => {
    const { prisma, resolver, service } = buildFixture();
    prisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      diagnosisRegistryId: 'context-1',
      differentials: ['Pneumonia'],
    });
    resolver.resolve.mockResolvedValue(resolved('Pneumonia', 'pneumonia'));
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue(null);
    prisma.caseDifferentialMapping.upsert.mockResolvedValue({
      status: DifferentialResolutionStatus.RESOLVED,
    });

    await expect(service.mapCase('case-1')).resolves.toMatchObject({
      totalExtracted: 1,
      resolved: 1,
    });
    expect(resolver.resolve).toHaveBeenCalledWith({
      rawText: 'Pneumonia',
      contextDiagnosisRegistryId: 'context-1',
    });
    expect(prisma.caseDifferentialMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          caseId: 'case-1',
          rawText: 'Pneumonia',
          normalizedText: 'pneumonia',
          resolvedDiagnosisRegistryId: 'target-1',
        }),
      }),
    );
  });

  it('extracts education differential objects by diagnosis title', async () => {
    const { prisma, resolver, service } = buildFixture();
    prisma.diagnosisEducation.findUnique.mockResolvedValue({
      id: 'education-1',
      diagnosisRegistryId: 'context-1',
      differentials: [{ diagnosis: 'Mesenteric adenitis' }],
    });
    resolver.resolve.mockResolvedValue(
      resolved('Mesenteric adenitis', 'mesenteric adenitis'),
    );
    prisma.educationDifferentialMapping.findUnique.mockResolvedValue(null);
    prisma.educationDifferentialMapping.upsert.mockResolvedValue({
      status: DifferentialResolutionStatus.RESOLVED,
    });

    await expect(service.mapEducation('education-1')).resolves.toMatchObject({
      totalExtracted: 1,
      resolved: 1,
    });
    expect(prisma.educationDifferentialMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          educationId: 'education-1',
          diagnosisRegistryId: 'context-1',
          rawText: 'Mesenteric adenitis',
        }),
      }),
    );
  });

  it('preserves rejected mappings during idempotent refresh', async () => {
    const { prisma, resolver, service } = buildFixture();
    prisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      diagnosisRegistryId: 'context-1',
      differentials: ['Rare mimic'],
    });
    resolver.resolve.mockResolvedValue(resolved('Rare mimic', 'rare mimic'));
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue({
      status: DifferentialResolutionStatus.REJECTED,
    });

    await expect(service.mapCase('case-1')).resolves.toMatchObject({
      rejected: 1,
    });
    expect(prisma.caseDifferentialMapping.upsert).not.toHaveBeenCalled();
  });

  it('resolves by linking an existing registry diagnosis', async () => {
    const { prisma, linkService, service } = buildFixture();
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue({ id: 'map-1' });
    prisma.caseDifferentialMapping.update.mockResolvedValue({
      id: 'map-1',
      status: DifferentialResolutionStatus.RESOLVED,
    });

    await service.resolveMapping('map-1', 'user-1', {
      action: 'link_existing',
      targetDiagnosisRegistryId: 'target-1',
      reason: 'Reviewed',
    });

    expect(prisma.caseDifferentialMapping.update).toHaveBeenCalledWith({
      where: { id: 'map-1' },
      data: expect.objectContaining({
        status: DifferentialResolutionStatus.RESOLVED,
        resolvedDiagnosisRegistryId: 'target-1',
        reviewedByUserId: 'user-1',
        reviewNote: 'Reviewed',
      }),
    });
    expect(linkService.syncCaseMappingRow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'map-1',
        status: DifferentialResolutionStatus.RESOLVED,
      }),
    );
  });

  it('adds an accepted alias before resolving when requested', async () => {
    const { prisma, service } = buildFixture();
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue(null);
    prisma.educationDifferentialMapping.findUnique.mockResolvedValue({ id: 'map-1' });
    prisma.educationDifferentialMapping.update.mockResolvedValue({
      id: 'map-1',
      status: DifferentialResolutionStatus.RESOLVED,
    });

    await service.resolveMapping('map-1', 'user-1', {
      action: 'add_alias_to_existing',
      targetDiagnosisRegistryId: 'target-1',
      aliasText: 'MI',
    });

    expect(prisma.diagnosisAlias.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          diagnosisRegistryId: 'target-1',
          term: 'MI',
          normalizedTerm: 'mi',
          acceptedForMatch: true,
        }),
      }),
    );
    expect(prisma.educationDifferentialMapping.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DifferentialResolutionStatus.RESOLVED,
        }),
      }),
    );
  });

  it('blocks alias creation during differential resolution when validation finds a collision', async () => {
    const { prisma, service } = buildFixture();
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue({ id: 'map-1' });
    prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-2',
        canonicalName: 'Acute Coronary Syndrome',
        canonicalNormalized: 'acute coronary syndrome',
        displayLabel: 'ACS',
      },
    ]);

    await expect(
      service.resolveMapping('map-1', 'user-1', {
        action: 'add_alias_to_existing',
        targetDiagnosisRegistryId: 'target-1',
        aliasText: 'Acute Coronary Syndrome',
      }),
    ).rejects.toThrow('Alias validation failed');

    expect(prisma.diagnosisAlias.upsert).not.toHaveBeenCalled();
    expect(prisma.caseDifferentialMapping.update).not.toHaveBeenCalled();
  });

  it('removes structured links when a mapping is rejected', async () => {
    const { prisma, linkService, service } = buildFixture();
    prisma.caseDifferentialMapping.findUnique.mockResolvedValue({
      id: 'map-1',
      rawText: 'Bad mimic',
    });
    prisma.caseDifferentialMapping.update.mockResolvedValue({
      id: 'map-1',
      status: DifferentialResolutionStatus.REJECTED,
    });

    await service.resolveMapping('map-1', 'user-1', {
      action: 'reject',
      reason: 'Not a true differential',
    });

    expect(linkService.syncCaseMappingRow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'map-1',
        status: DifferentialResolutionStatus.REJECTED,
      }),
    );
  });
});
