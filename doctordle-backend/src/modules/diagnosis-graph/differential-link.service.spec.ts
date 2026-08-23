import {
  DiagnosisEducationStatus,
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
    diagnosisEducation: {
      findUnique: jest.fn().mockResolvedValue({
        editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      }),
    },
    diagnosisEducationRevision: {
      findUnique: jest.fn().mockResolvedValue({
        editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      }),
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

  it('creates education links only for published education mappings', async () => {
    const { prisma, service } = buildFixture();
    prisma.educationDifferentialLink.findUnique.mockResolvedValue(null);
    prisma.educationDifferentialLink.upsert.mockResolvedValue({ id: 'link-2' });

    await expect(
      service.syncEducationMappingRow({
        id: 'map-2',
        educationId: 'education-1',
        revisionId: null,
        rawText: 'Gastroenteritis',
        confidence: 0.9,
        status: DifferentialResolutionStatus.RESOLVED,
        resolvedDiagnosisRegistryId: 'dx-2',
      } as never),
    ).resolves.toMatchObject({ action: 'created' });

    expect(prisma.diagnosisEducation.findUnique).toHaveBeenCalledWith({
      where: { id: 'education-1' },
      select: { editorialStatus: true },
    });
    expect(prisma.educationDifferentialLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          educationId: 'education-1',
          diagnosisRegistryId: 'dx-2',
          role: DifferentialLinkRole.TEACHING_DIFFERENTIAL,
        }),
      }),
    );
  });

  it('removes education links from non-published current education mappings', async () => {
    const { prisma, service } = buildFixture();
    prisma.diagnosisEducation.findUnique.mockResolvedValue({
      editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
    });

    await expect(
      service.syncEducationMappingRow({
        id: 'map-3',
        educationId: 'education-1',
        revisionId: null,
        rawText: 'Gastroenteritis',
        confidence: 0.9,
        status: DifferentialResolutionStatus.RESOLVED,
        resolvedDiagnosisRegistryId: 'dx-2',
      } as never),
    ).resolves.toMatchObject({ action: 'removed_untrusted' });

    expect(prisma.educationDifferentialLink.deleteMany).toHaveBeenCalledWith({
      where: { sourceMappingId: 'map-3' },
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
