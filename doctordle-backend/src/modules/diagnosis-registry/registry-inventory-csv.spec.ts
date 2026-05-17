import { DiagnosisAliasKind, DiagnosisRegistryStatus } from '@prisma/client';
import { importDiagnosisRegistryCsv } from './registry-inventory-csv';

const CSV_HEADER = [
  'displayLabel',
  'canonicalName',
  'specialty',
  'subspecialty',
  'bodySystem',
  'organSystem',
  'category',
  'aliases',
  'difficultyBand',
  'rarityBand',
  'clinicalSetting',
  'ageGroup',
  'urgencyLevel',
  'isPlayable',
  'isGeneratable',
  'searchPriority',
  'isDescriptive',
  'isCompositional',
  'notes',
].join(',');

function csvRow(values: string[]) {
  return values.join(',');
}

function createCsvImporterFixture() {
  const prisma = {
    diagnosisRegistry: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    diagnosisAlias: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  return { prisma };
}

describe('importDiagnosisRegistryCsv', () => {
  it('dry-runs by default without writing registry or alias rows', async () => {
    const fixture = createCsvImporterFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValue(null);
    fixture.prisma.diagnosisAlias.findFirst.mockResolvedValue(null);
    const csv = [
      CSV_HEADER,
      csvRow([
        'Asthma',
        'Asthma',
        'Pulmonology',
        '',
        'Respiratory',
        'Airways',
        'Obstructive',
        'Bronchial asthma',
        'BASIC',
        'COMMON',
        'OUTPATIENT',
        'ANY',
        'URGENT',
        'true',
        'true',
        '90',
        'false',
        'false',
        'Common obstructive airway disease',
      ]),
    ].join('\n');

    const summary = await importDiagnosisRegistryCsv(
      fixture.prisma as never,
      csv,
    );

    expect(summary).toEqual(
      expect.objectContaining({
        mode: 'dry-run',
        totalRows: 1,
        validRows: 1,
        created: 1,
        aliasesCreated: 1,
        invalidRows: [],
        duplicateCanonicalNames: [],
      }),
    );
    expect(fixture.prisma.diagnosisRegistry.create).not.toHaveBeenCalled();
    expect(fixture.prisma.diagnosisRegistry.update).not.toHaveBeenCalled();
    expect(fixture.prisma.diagnosisAlias.create).not.toHaveBeenCalled();
    expect(fixture.prisma.diagnosisAlias.update).not.toHaveBeenCalled();
  });

  it('applies new registry rows with actual schema metadata', async () => {
    const fixture = createCsvImporterFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValue(null);
    fixture.prisma.diagnosisRegistry.create.mockResolvedValue({
      id: 'registry-1',
    });
    fixture.prisma.diagnosisAlias.findFirst.mockResolvedValue(null);
    const csv = [
      CSV_HEADER,
      csvRow([
        'Myocardial Infarction',
        'Myocardial Infarction',
        'Cardiology',
        'Interventional Cardiology',
        'Cardiovascular',
        'Myocardium',
        'Vascular',
        'Heart attack',
        'INTERMEDIATE',
        'COMMON',
        'EMERGENCY',
        'ADULT',
        'EMERGENT',
        'true',
        'true',
        '100',
        'false',
        'false',
        'Canonical ACS diagnosis',
      ]),
    ].join('\n');

    const summary = await importDiagnosisRegistryCsv(
      fixture.prisma as never,
      csv,
      { mode: 'apply' },
    );

    expect(summary.created).toBe(1);
    expect(fixture.prisma.diagnosisRegistry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          canonicalName: 'Myocardial Infarction',
          canonicalNormalized: 'myocardial infarction',
          displayLabel: 'Myocardial Infarction',
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          specialty: 'Cardiology',
          subspecialty: 'Interventional Cardiology',
          bodySystem: 'Cardiovascular',
          organSystem: 'Myocardium',
          category: 'Vascular',
          difficultyBand: 'INTERMEDIATE',
          rarityBand: 'COMMON',
          clinicalSetting: 'EMERGENCY',
          ageGroup: 'ADULT',
          urgencyLevel: 'EMERGENT',
          isPlayable: true,
          isGeneratable: true,
          searchPriority: 100,
          isDescriptive: false,
          isCompositional: false,
          notes: 'Canonical ACS diagnosis',
        }),
      }),
    );
  });

  it('creates accepted gameplay aliases from semicolon-separated aliases', async () => {
    const fixture = createCsvImporterFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValue(null);
    fixture.prisma.diagnosisRegistry.create.mockResolvedValue({
      id: 'registry-1',
    });
    fixture.prisma.diagnosisAlias.findFirst.mockResolvedValue(null);
    const csv = [
      CSV_HEADER,
      csvRow([
        'Stroke',
        'Ischemic Stroke',
        'Neurology',
        '',
        'Nervous System',
        'Brain',
        'Vascular',
        'Cerebral infarction;CVA',
        'INTERMEDIATE',
        'COMMON',
        'EMERGENCY',
        'ADULT',
        'EMERGENT',
        'true',
        'true',
        '80',
        'false',
        'false',
        '',
      ]),
    ].join('\n');

    const summary = await importDiagnosisRegistryCsv(
      fixture.prisma as never,
      csv,
      { mode: 'apply' },
    );

    expect(summary.aliasesCreated).toBe(2);
    expect(fixture.prisma.diagnosisAlias.create).toHaveBeenCalledTimes(2);
    expect(fixture.prisma.diagnosisAlias.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosisRegistryId: 'registry-1',
          term: 'Cerebral infarction',
          kind: DiagnosisAliasKind.ACCEPTED,
          acceptedForMatch: true,
          active: true,
        }),
      }),
    );
    expect(fixture.prisma.diagnosisAlias.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosisRegistryId: 'registry-1',
          term: 'CVA',
          kind: DiagnosisAliasKind.ACCEPTED,
          acceptedForMatch: true,
          active: true,
        }),
      }),
    );
  });

  it('rejects duplicate canonical names in the same CSV', async () => {
    const fixture = createCsvImporterFixture();
    const csv = [
      CSV_HEADER,
      csvRow([
        'Asthma',
        'Asthma',
        'Pulmonology',
        '',
        'Respiratory',
        '',
        'Obstructive',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]),
      csvRow([
        'Asthma Duplicate',
        'asthma',
        'Pulmonology',
        '',
        'Respiratory',
        '',
        'Obstructive',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]),
    ].join('\n');

    const summary = await importDiagnosisRegistryCsv(
      fixture.prisma as never,
      csv,
      { mode: 'apply' },
    );

    expect(summary.duplicateCanonicalNames).toEqual([
      expect.objectContaining({
        rowNumber: 3,
        canonicalName: 'asthma',
      }),
    ]);
    expect(fixture.prisma.diagnosisRegistry.create).not.toHaveBeenCalled();
  });

  it('preserves existing curated metadata when optional CSV cells are blank', async () => {
    const fixture = createCsvImporterFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValue({
      id: 'registry-1',
      canonicalName: 'Migraine',
      displayLabel: 'Migraine',
      specialty: 'Neurology',
      subspecialty: 'Headache Medicine',
      bodySystem: 'Nervous System',
      organSystem: 'Brain',
      category: 'Primary Headache',
      difficultyBand: 'BASIC',
      rarityBand: 'COMMON',
      clinicalSetting: 'OUTPATIENT',
      ageGroup: 'ADULT',
      urgencyLevel: 'ROUTINE',
      isPlayable: false,
      isGeneratable: false,
      searchPriority: 70,
      isDescriptive: true,
      isCompositional: true,
      notes: 'Curated note',
    });
    const csv = [
      CSV_HEADER,
      csvRow([
        'Migraine',
        'Migraine',
        'Neurology',
        '',
        'Nervous System',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]),
    ].join('\n');

    const summary = await importDiagnosisRegistryCsv(
      fixture.prisma as never,
      csv,
      { mode: 'apply' },
    );

    expect(summary.updated).toBe(0);
    expect(fixture.prisma.diagnosisRegistry.update).not.toHaveBeenCalled();
  });

  it('rejects invalid enum values', async () => {
    const fixture = createCsvImporterFixture();
    const csv = [
      CSV_HEADER,
      csvRow([
        'Asthma',
        'Asthma',
        'Pulmonology',
        '',
        'Respiratory',
        '',
        'Obstructive',
        '',
        'SUPERHARD',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]),
    ].join('\n');

    const summary = await importDiagnosisRegistryCsv(
      fixture.prisma as never,
      csv,
      { mode: 'apply' },
    );

    expect(summary.invalidRows).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        canonicalName: 'Asthma',
        reason: 'difficultyBand has invalid value "SUPERHARD"',
      }),
    ]);
    expect(fixture.prisma.diagnosisRegistry.create).not.toHaveBeenCalled();
  });
});
