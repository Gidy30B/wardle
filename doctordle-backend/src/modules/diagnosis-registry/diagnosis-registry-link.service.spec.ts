import { BadRequestException } from '@nestjs/common';
import {
  collectDiagnosisRegistryIntegrityReport,
  ensureDiagnosisRegistryLink,
} from './diagnosis-registry-link.service';
import { inferLegacyAliasDecision } from './diagnosis-registry-backfill';

describe('DiagnosisRegistryLinkService helpers', () => {
  it('upserts registry linkage from a legacy diagnosis id', async () => {
    const prisma: any = {
      diagnosis: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'diagnosis-1',
          name: 'Myocardial Infarction',
        }),
      },
      diagnosisRegistry: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue({
          id: 'registry-1',
          legacyDiagnosisId: 'diagnosis-1',
          status: 'ACTIVE',
        }),
        update: jest.fn(),
      },
      diagnosisAlias: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    };

    const result = await ensureDiagnosisRegistryLink(prisma, {
      diagnosisId: 'diagnosis-1',
    });

    expect(result).toEqual({
      diagnosisId: 'diagnosis-1',
      diagnosisName: 'Myocardial Infarction',
      diagnosisRegistryId: 'registry-1',
    });
    expect(prisma.diagnosisRegistry.findUnique).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          legacyDiagnosisId: 'diagnosis-1',
        },
      }),
    );
    expect(prisma.diagnosisRegistry.findUnique).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          canonicalNormalized: 'myocardial infarction',
        },
      }),
    );
    expect(prisma.diagnosisRegistry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          legacyDiagnosisId: 'diagnosis-1',
          canonicalNormalized: 'myocardial infarction',
          status: 'ACTIVE',
          active: true,
        }),
      }),
    );
    expect(prisma.diagnosisAlias.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          diagnosisRegistryId: 'registry-1',
          normalizedTerm: 'myocardial infarction',
        }),
      }),
    );
  });

  it('reuses an existing normalized canonical row instead of creating a duplicate', async () => {
    const prisma: any = {
      diagnosis: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'diagnosis-1',
          name: '  Myocardial   infarction ',
        }),
      },
      diagnosisRegistry: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'registry-1',
            legacyDiagnosisId: null,
            status: 'DRAFT',
          }),
        update: jest.fn().mockResolvedValue({
          id: 'registry-1',
          legacyDiagnosisId: 'diagnosis-1',
          status: 'ACTIVE',
        }),
      },
      diagnosisAlias: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    };

    const result = await ensureDiagnosisRegistryLink(prisma, {
      diagnosisId: 'diagnosis-1',
    });

    expect(result).toEqual({
      diagnosisId: 'diagnosis-1',
      diagnosisName: '  Myocardial   infarction ',
      diagnosisRegistryId: 'registry-1',
    });
    expect(prisma.diagnosisRegistry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'registry-1',
        },
        data: expect.objectContaining({
          legacyDiagnosisId: 'diagnosis-1',
          canonicalNormalized: 'myocardial infarction',
          status: 'ACTIVE',
          active: true,
        }),
      }),
    );
  });

  it('rejects a normalized canonical collision owned by another legacy diagnosis', async () => {
    const prisma: any = {
      diagnosis: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'diagnosis-1',
          name: 'Heart Attack',
        }),
      },
      diagnosisRegistry: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'registry-2',
            legacyDiagnosisId: 'diagnosis-2',
            status: 'ACTIVE',
          }),
      },
      diagnosisAlias: {
        upsert: jest.fn(),
      },
    };

    await expect(
      ensureDiagnosisRegistryLink(prisma, {
        diagnosisId: 'diagnosis-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when an existing legacy-linked registry would update into another canonical identity', async () => {
    const prisma: any = {
      diagnosis: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'diagnosis-1',
          name: 'Heart Attack',
        }),
      },
      diagnosisRegistry: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'registry-1',
            legacyDiagnosisId: 'diagnosis-1',
            status: 'ACTIVE',
          })
          .mockResolvedValueOnce({
            id: 'registry-2',
            legacyDiagnosisId: 'diagnosis-2',
            status: 'ACTIVE',
          }),
      },
      diagnosisAlias: {
        upsert: jest.fn(),
      },
    };

    await expect(
      ensureDiagnosisRegistryLink(prisma, {
        diagnosisId: 'diagnosis-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an explicitly mismatched diagnosis and diagnosisRegistry pair', async () => {
    const prisma: any = {
      diagnosis: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'diagnosis-1',
          name: 'Asthma',
        }),
      },
      diagnosisRegistry: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'registry-2',
          legacyDiagnosisId: 'diagnosis-2',
          status: 'ACTIVE',
        }),
      },
    };

    await expect(
      ensureDiagnosisRegistryLink(prisma, {
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: 'registry-2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('collects mismatch and collision reporting for migration audits', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ count: BigInt(2) }])
      .mockResolvedValueOnce([{ count: BigInt(1) }])
      .mockResolvedValueOnce([
        { normalizedTerm: 'mi', ownerCount: BigInt(2) },
      ]);
    const prisma: any = {
      diagnosis: {
        count: jest.fn().mockResolvedValue(3),
      },
      diagnosisRegistry: {
        count: jest.fn().mockResolvedValue(1),
      },
      case: {
        count: jest
          .fn()
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(2),
      },
      caseRevision: {
        count: jest.fn().mockResolvedValue(5),
      },
      $queryRaw: queryRaw,
    };

    const report = await collectDiagnosisRegistryIntegrityReport(prisma);

    expect(report).toEqual({
      diagnosesWithoutRegistry: 3,
      registryRowsWithoutLegacyDiagnosis: 1,
      casesWithoutRegistry: 4,
      playableCasesWithoutRegistry: 2,
      caseRevisionsWithoutRegistry: 5,
      caseDiagnosisMismatches: 2,
      caseRevisionDiagnosisMismatches: 1,
      acceptedAliasCollisions: [
        {
          normalizedTerm: 'mi',
          ownerCount: 2,
        },
      ],
    });
  });
});

describe('inferLegacyAliasDecision', () => {
  it('marks ambiguous legacy synonyms as search-only', () => {
    expect(inferLegacyAliasDecision('heart attack', true)).toEqual({
      kind: 'SEARCH_ONLY',
      acceptedForMatch: false,
      source: 'legacy_synonym_ambiguous',
    });
  });

  it('treats short compact legacy synonyms as abbreviations deterministically', () => {
    expect(inferLegacyAliasDecision('M.I.', false)).toEqual({
      kind: 'ABBREVIATION',
      acceptedForMatch: true,
      source: 'legacy_synonym_abbreviation',
    });
  });
});
