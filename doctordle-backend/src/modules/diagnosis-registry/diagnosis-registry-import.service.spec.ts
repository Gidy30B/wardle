import {
  DiagnosisAliasKind,
  DiagnosisRegistryStatus,
} from '@prisma/client';
import { importDiagnosisRegistryRecords } from './diagnosis-registry-import.service';

function createImportFixture() {
  const prisma = {
    diagnosisRegistry: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    diagnosisAlias: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  return { prisma };
}

describe('importDiagnosisRegistryRecords', () => {
  it('creates a new diagnosis and imports gameplay-safe aliases deterministically', async () => {
    const fixture = createImportFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValue(null);
    fixture.prisma.diagnosisRegistry.create.mockResolvedValue({
      id: 'registry-1',
      canonicalName: 'Myocardial Infarction',
      canonicalNormalized: 'myocardial infarction',
      displayLabel: 'Myocardial Infarction',
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isDescriptive: false,
      isCompositional: false,
      searchPriority: 90,
      icd10Code: null,
      icd11Code: null,
      category: 'Cardiology',
      specialty: null,
      notes: null,
    });
    fixture.prisma.diagnosisAlias.findUnique.mockResolvedValue(null);
    fixture.prisma.diagnosisAlias.findFirst.mockResolvedValue(null);

    const summary = await importDiagnosisRegistryRecords(fixture.prisma as never, [
      {
        canonicalName: 'Myocardial Infarction',
        searchPriority: 90,
        category: 'Cardiology',
        aliases: [
          {
            alias: 'Heart attack',
            kind: DiagnosisAliasKind.SEARCH_ONLY,
            isAcceptedForGameplay: false,
          },
          {
            alias: 'MI',
            kind: DiagnosisAliasKind.ABBREVIATION,
          },
        ],
      },
    ]);

    expect(summary).toEqual({
      totalRecords: 1,
      createdDiagnoses: 1,
      reusedDiagnoses: 0,
      updatedDiagnoses: 1,
      createdAliases: 2,
      skippedAliases: 0,
      collisions: 0,
      errors: [],
    });
    expect(fixture.prisma.diagnosisRegistry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          canonicalNormalized: 'myocardial infarction',
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          searchPriority: 90,
        }),
      }),
    );
    expect(fixture.prisma.diagnosisAlias.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          diagnosisRegistryId: 'registry-1',
          normalizedTerm: 'myocardial infarction',
          kind: DiagnosisAliasKind.CANONICAL,
        }),
      }),
    );
    expect(fixture.prisma.diagnosisAlias.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosisRegistryId: 'registry-1',
          normalizedTerm: 'heart attack',
          kind: DiagnosisAliasKind.SEARCH_ONLY,
          acceptedForMatch: false,
        }),
      }),
    );
    expect(fixture.prisma.diagnosisAlias.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosisRegistryId: 'registry-1',
          normalizedTerm: 'mi',
          kind: DiagnosisAliasKind.ABBREVIATION,
          acceptedForMatch: true,
        }),
      }),
    );
  });

  it('reuses an existing canonical diagnosis by normalized identity and stays idempotent on rerun', async () => {
    const fixture = createImportFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValue({
      id: 'registry-1',
      canonicalName: 'Myocardial Infarction',
      canonicalNormalized: 'myocardial infarction',
      displayLabel: 'Myocardial Infarction',
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isDescriptive: false,
      isCompositional: false,
      searchPriority: 90,
      icd10Code: null,
      icd11Code: null,
      category: 'Cardiology',
      specialty: null,
      notes: null,
    });
    fixture.prisma.diagnosisRegistry.update.mockResolvedValue({
      id: 'registry-1',
      canonicalName: 'myocardial infarction',
      canonicalNormalized: 'myocardial infarction',
      displayLabel: 'myocardial infarction',
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isDescriptive: false,
      isCompositional: false,
      searchPriority: 90,
      icd10Code: null,
      icd11Code: null,
      category: 'Cardiology',
      specialty: null,
      notes: null,
    });
    fixture.prisma.diagnosisAlias.findUnique
      .mockResolvedValueOnce({
        id: 'alias-1',
        diagnosisRegistryId: 'registry-1',
        term: 'MI',
        normalizedTerm: 'mi',
        kind: DiagnosisAliasKind.ABBREVIATION,
        acceptedForMatch: true,
        rank: 5,
        source: 'seed_import',
        active: true,
      })
      .mockResolvedValueOnce({
        id: 'alias-1',
        diagnosisRegistryId: 'registry-1',
        term: 'MI',
        normalizedTerm: 'mi',
        kind: DiagnosisAliasKind.ABBREVIATION,
        acceptedForMatch: true,
        rank: 5,
        source: 'seed_import',
        active: true,
      });
    fixture.prisma.diagnosisAlias.findFirst.mockResolvedValue(null);

    const firstSummary = await importDiagnosisRegistryRecords(
      fixture.prisma as never,
      [
        {
          canonicalName: '  myocardial   infarction ',
          searchPriority: 90,
          category: 'Cardiology',
          aliases: [{ alias: 'MI', kind: DiagnosisAliasKind.ABBREVIATION }],
        },
      ],
    );
    const secondSummary = await importDiagnosisRegistryRecords(
      fixture.prisma as never,
      [
        {
          canonicalName: 'Myocardial Infarction',
          searchPriority: 90,
          category: 'Cardiology',
          aliases: [{ alias: 'MI', kind: DiagnosisAliasKind.ABBREVIATION }],
        },
      ],
    );

    expect(firstSummary.createdDiagnoses).toBe(0);
    expect(firstSummary.reusedDiagnoses).toBe(1);
    expect(firstSummary.updatedDiagnoses).toBe(1);
    expect(firstSummary.createdAliases).toBe(0);
    expect(firstSummary.skippedAliases).toBe(1);
    expect(secondSummary.createdDiagnoses).toBe(0);
    expect(secondSummary.reusedDiagnoses).toBe(1);
    expect(secondSummary.updatedDiagnoses).toBe(0);
    expect(secondSummary.createdAliases).toBe(0);
    expect(secondSummary.skippedAliases).toBe(1);
    expect(fixture.prisma.diagnosisRegistry.create).not.toHaveBeenCalled();
    expect(fixture.prisma.diagnosisAlias.create).not.toHaveBeenCalled();
  });

  it('updates provided status and keeps compatibility active in sync', async () => {
    const fixture = createImportFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValue({
      id: 'registry-1',
      canonicalName: 'Myocardial Infarction',
      canonicalNormalized: 'myocardial infarction',
      displayLabel: 'Myocardial Infarction',
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isDescriptive: false,
      isCompositional: false,
      searchPriority: 90,
      icd10Code: null,
      icd11Code: null,
      category: 'Cardiology',
      specialty: null,
      notes: null,
    });
    fixture.prisma.diagnosisRegistry.update.mockResolvedValue({
      id: 'registry-1',
      canonicalName: 'Myocardial Infarction',
      canonicalNormalized: 'myocardial infarction',
      displayLabel: 'Myocardial Infarction',
      status: DiagnosisRegistryStatus.DEPRECATED,
      active: false,
      isDescriptive: false,
      isCompositional: false,
      searchPriority: 90,
      icd10Code: null,
      icd11Code: null,
      category: 'Cardiology',
      specialty: null,
      notes: null,
    });

    const summary = await importDiagnosisRegistryRecords(fixture.prisma as never, [
      {
        canonicalName: 'Myocardial Infarction',
        status: DiagnosisRegistryStatus.DEPRECATED,
      },
    ]);

    expect(summary.reusedDiagnoses).toBe(1);
    expect(summary.updatedDiagnoses).toBe(1);
    expect(fixture.prisma.diagnosisRegistry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DiagnosisRegistryStatus.DEPRECATED,
          active: false,
        }),
      }),
    );
  });

  it('skips duplicate aliases on the same diagnosis deterministically', async () => {
    const fixture = createImportFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValue({
      id: 'registry-1',
      canonicalName: 'Asthma Exacerbation',
      canonicalNormalized: 'asthma exacerbation',
      displayLabel: 'Asthma Exacerbation',
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isDescriptive: false,
      isCompositional: false,
      searchPriority: 50,
      icd10Code: null,
      icd11Code: null,
      category: null,
      specialty: null,
      notes: null,
    });
    fixture.prisma.diagnosisAlias.findUnique.mockResolvedValue(null);
    fixture.prisma.diagnosisAlias.findFirst.mockResolvedValue(null);

    const summary = await importDiagnosisRegistryRecords(fixture.prisma as never, [
      {
        canonicalName: 'Asthma Exacerbation',
        aliases: [
          { alias: 'Asthma attack', kind: DiagnosisAliasKind.ACCEPTED },
          { alias: ' asthma   attack ', kind: DiagnosisAliasKind.ACCEPTED },
        ],
      },
    ]);

    expect(summary.createdAliases).toBe(1);
    expect(summary.skippedAliases).toBe(1);
    expect(fixture.prisma.diagnosisAlias.create).toHaveBeenCalledTimes(1);
  });

  it('reports accepted alias collisions without silently creating ambiguous aliases', async () => {
    const fixture = createImportFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValue({
      id: 'registry-2',
      canonicalName: 'Myocardial Infarction',
      canonicalNormalized: 'myocardial infarction',
      displayLabel: 'Myocardial Infarction',
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
      isDescriptive: false,
      isCompositional: false,
      searchPriority: 90,
      icd10Code: null,
      icd11Code: null,
      category: null,
      specialty: null,
      notes: null,
    });
    fixture.prisma.diagnosisAlias.findUnique.mockResolvedValue(null);
    fixture.prisma.diagnosisAlias.findFirst.mockResolvedValue({
      id: 'alias-conflict',
      diagnosisRegistryId: 'registry-1',
      term: 'Heart attack',
      normalizedTerm: 'heart attack',
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 10,
      source: 'seed_import',
      active: true,
    });

    const summary = await importDiagnosisRegistryRecords(fixture.prisma as never, [
      {
        canonicalName: 'Myocardial Infarction',
        aliases: [{ alias: 'Heart attack', kind: DiagnosisAliasKind.ACCEPTED }],
      },
    ]);

    expect(summary.collisions).toBe(1);
    expect(summary.errors).toEqual([
      {
        canonicalName: 'Myocardial Infarction',
        reason: 'Accepted alias collision for "Heart attack" (heart attack)',
      },
    ]);
    expect(fixture.prisma.diagnosisAlias.create).not.toHaveBeenCalled();
  });
});
