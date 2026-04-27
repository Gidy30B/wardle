import {
  DiagnosisAliasKind,
  DiagnosisMappingMethod,
  DiagnosisRegistryStatus,
} from '@prisma/client';
import { DiagnosisRegistryEditorialService } from './diagnosis-registry-editorial.service';

jest.mock('./diagnosis-registry-import.service', () => ({
  importDiagnosisRegistryRecords: jest.fn(),
}));

import { importDiagnosisRegistryRecords } from './diagnosis-registry-import.service';

describe('DiagnosisRegistryEditorialService', () => {
  function createFixture() {
    const prisma: any = {
      diagnosisRegistry: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      diagnosisAlias: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
      diagnosis: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    const diagnosisRegistryLinkService = {
      resolveForWrite: jest.fn(),
    };

    return {
      prisma,
      diagnosisRegistryLinkService,
      service: new DiagnosisRegistryEditorialService(
        prisma as never,
        diagnosisRegistryLinkService as never,
      ),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches canonical names and aliases with compact ranked results', async () => {
    const fixture = createFixture();
    fixture.prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-1',
        canonicalName: 'Asthma Exacerbation',
        canonicalNormalized: 'asthma exacerbation',
        status: DiagnosisRegistryStatus.ACTIVE,
        category: 'Pulmonology',
        specialty: null,
        searchPriority: 50,
        isDescriptive: false,
        isCompositional: false,
        notes: null,
        legacyDiagnosisId: 'diagnosis-1',
        aliases: [
          {
            id: 'alias-1',
            term: 'Asthma attack',
            normalizedTerm: 'asthma attack',
            kind: DiagnosisAliasKind.ACCEPTED,
            acceptedForMatch: true,
            rank: 10,
          },
        ],
      },
      {
        id: 'registry-2',
        canonicalName: 'Status Asthmaticus',
        canonicalNormalized: 'status asthmaticus',
        status: DiagnosisRegistryStatus.ACTIVE,
        category: 'Pulmonology',
        specialty: null,
        searchPriority: 80,
        isDescriptive: false,
        isCompositional: false,
        notes: null,
        legacyDiagnosisId: 'diagnosis-2',
        aliases: [],
      },
    ]);

    const results = await fixture.service.search({
      query: 'asthma',
      limit: 5,
    });

    expect(results).toEqual([
      expect.objectContaining({
        id: 'registry-1',
        canonicalName: 'Asthma Exacerbation',
        matchSource: 'canonical',
        aliasPreview: ['Asthma attack'],
      }),
      expect.objectContaining({
        id: 'registry-2',
        canonicalName: 'Status Asthmaticus',
        matchSource: 'canonical',
      }),
    ]);
    expect(fixture.prisma.diagnosisRegistry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: DiagnosisRegistryStatus.ACTIVE,
        }),
      }),
    );
  });

  it('creates a diagnosis deterministically and links it through the hardened ensure logic', async () => {
    const fixture = createFixture();
    (importDiagnosisRegistryRecords as jest.Mock).mockResolvedValue({
      totalRecords: 1,
    });
    fixture.prisma.diagnosisRegistry.findUnique
      .mockResolvedValueOnce({
        id: 'registry-1',
        canonicalName: 'Myocardial Infarction',
        canonicalNormalized: 'myocardial infarction',
        status: DiagnosisRegistryStatus.ACTIVE,
        category: 'Cardiology',
        specialty: null,
        searchPriority: 0,
        isDescriptive: false,
        isCompositional: false,
        notes: null,
        legacyDiagnosisId: null,
        aliases: [
          {
            id: 'alias-1',
            term: 'MI',
            normalizedTerm: 'mi',
            kind: DiagnosisAliasKind.ABBREVIATION,
            acceptedForMatch: true,
            rank: 5,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'registry-1',
        canonicalName: 'Myocardial Infarction',
        canonicalNormalized: 'myocardial infarction',
        status: DiagnosisRegistryStatus.ACTIVE,
        category: 'Cardiology',
        specialty: null,
        searchPriority: 0,
        isDescriptive: false,
        isCompositional: false,
        notes: null,
        legacyDiagnosisId: 'diagnosis-1',
        aliases: [
          {
            id: 'alias-1',
            term: 'MI',
            normalizedTerm: 'mi',
            kind: DiagnosisAliasKind.ABBREVIATION,
            acceptedForMatch: true,
            rank: 5,
          },
        ],
      });
    fixture.prisma.diagnosis.findFirst.mockResolvedValue(null);
    fixture.prisma.diagnosis.create.mockResolvedValue({
      id: 'diagnosis-1',
    });
    fixture.diagnosisRegistryLinkService.resolveForWrite.mockResolvedValue({
      diagnosisId: 'diagnosis-1',
      diagnosisRegistryId: 'registry-1',
    });

    const result = await fixture.service.createDiagnosis({
      canonicalName: 'Myocardial Infarction',
      aliases: ['MI', ' Heart attack '],
      category: 'Cardiology',
    });

    expect(importDiagnosisRegistryRecords).toHaveBeenCalledWith(
      fixture.prisma,
      [
        expect.objectContaining({
          canonicalName: 'Myocardial Infarction',
          category: 'Cardiology',
          status: DiagnosisRegistryStatus.ACTIVE,
          aliases: [
            { alias: 'MI' },
            { alias: 'Heart attack' },
          ],
        }),
      ],
    );
    expect(fixture.prisma.diagnosis.create).toHaveBeenCalledWith({
      data: {
        name: 'Myocardial Infarction',
      },
      select: {
        id: true,
      },
    });
    expect(fixture.diagnosisRegistryLinkService.resolveForWrite).toHaveBeenCalledWith(
      {
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: 'registry-1',
      },
      fixture.prisma,
    );
    expect(result).toEqual({
      diagnosisId: 'diagnosis-1',
      diagnosisRegistryId: 'registry-1',
      mappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
      registry: expect.objectContaining({
        id: 'registry-1',
        canonicalName: 'Myocardial Infarction',
        aliasPreview: ['MI'],
      }),
    });
  });

  it('rejects accepted alias collisions across registry entries', async () => {
    const fixture = createFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValue({
      id: 'registry-1',
      canonicalName: 'Asthma',
      canonicalNormalized: 'asthma',
      status: DiagnosisRegistryStatus.ACTIVE,
      category: null,
      specialty: null,
      searchPriority: 0,
      isDescriptive: false,
      isCompositional: false,
      notes: null,
      legacyDiagnosisId: 'diagnosis-1',
      aliases: [],
    });
    fixture.prisma.diagnosisAlias.findFirst.mockResolvedValue({
      id: 'alias-conflict',
    });

    await expect(
      fixture.service.addAlias('registry-1', {
        alias: 'Reactive airway disease',
        kind: DiagnosisAliasKind.ACCEPTED,
      }),
    ).rejects.toThrow('Accepted alias collision');

    expect(fixture.prisma.diagnosisAlias.upsert).not.toHaveBeenCalled();
  });
});
