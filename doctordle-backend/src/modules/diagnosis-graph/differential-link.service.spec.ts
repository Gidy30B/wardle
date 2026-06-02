import {
  DifferentialLinkRole,
  DifferentialResolutionStatus,
} from '@prisma/client';
import { DifferentialLinkService } from './differential-link.service';

function buildFixture() {
  const prisma = {
    caseDifferentialMapping: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    educationDifferentialMapping: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    caseDifferentialLink: {
      count: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    educationDifferentialLink: {
      count: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  return {
    prisma,
    service: new DifferentialLinkService(prisma as never),
  };
}

describe('DifferentialLinkService', () => {
  it('creates a case link only for resolved mappings', async () => {
    const { prisma, service } = buildFixture();
    prisma.caseDifferentialLink.findUnique.mockResolvedValue(null);
    prisma.caseDifferentialLink.upsert.mockResolvedValue({ id: 'link-1' });

    await expect(
      service.syncCaseMappingRow({
        id: 'map-1',
        caseId: 'case-1',
        revisionId: null,
        rawText: 'Mesenteric adenitis',
        confidence: 0.92,
        status: DifferentialResolutionStatus.RESOLVED,
        resolvedDiagnosisRegistryId: 'dx-2',
      } as never),
    ).resolves.toMatchObject({ action: 'created' });

    expect(prisma.caseDifferentialLink.upsert).toHaveBeenCalledWith({
      where: { dedupeKey: 'case:case-1:current:dx-2' },
      update: expect.objectContaining({
        sourceMappingId: 'map-1',
        role: DifferentialLinkRole.DIFFERENTIAL,
      }),
      create: expect.objectContaining({
        caseId: 'case-1',
        diagnosisRegistryId: 'dx-2',
        role: DifferentialLinkRole.DIFFERENTIAL,
        sourceText: 'Mesenteric adenitis',
      }),
    });
  });

  it('removes links when a mapping is no longer resolved', async () => {
    const { prisma, service } = buildFixture();

    await expect(
      service.syncEducationMappingRow({
        id: 'map-2',
        educationId: 'education-1',
        revisionId: null,
        rawText: 'Gastroenteritis',
        confidence: null,
        status: DifferentialResolutionStatus.REJECTED,
        resolvedDiagnosisRegistryId: null,
      } as never),
    ).resolves.toMatchObject({ action: 'removed' });

    expect(prisma.educationDifferentialLink.deleteMany).toHaveBeenCalledWith({
      where: { sourceMappingId: 'map-2' },
    });
    expect(prisma.educationDifferentialLink.upsert).not.toHaveBeenCalled();
  });

  it('counts an idempotent backfill as updates after links exist', async () => {
    const { prisma, service } = buildFixture();
    prisma.caseDifferentialMapping.findMany.mockResolvedValue([
      {
        id: 'map-1',
        caseId: 'case-1',
        revisionId: null,
        rawText: 'Renal colic',
        confidence: 0.88,
        status: DifferentialResolutionStatus.RESOLVED,
        resolvedDiagnosisRegistryId: 'dx-3',
      },
    ]);
    prisma.caseDifferentialLink.findUnique.mockResolvedValue({ id: 'link-1' });
    prisma.caseDifferentialLink.upsert.mockResolvedValue({ id: 'link-1' });

    await expect(service.backfill()).resolves.toMatchObject({
      caseMappings: {
        mappingsScanned: 1,
        linksCreated: 0,
        linksUpdated: 1,
      },
    });
  });
});
