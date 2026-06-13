import { DiagnosisAliasKind } from '@prisma/client';
import { DifferentialRegistryResolutionService } from './differential-registry-resolution.service';

describe('DifferentialRegistryResolutionService', () => {
  function buildService(rows: unknown[]) {
    const prisma = {
      diagnosisRegistry: {
        findMany: jest.fn().mockResolvedValue(rows),
      },
    };

    return {
      prisma,
      service: new DifferentialRegistryResolutionService(prisma as never),
    };
  }

  it('resolves an exact canonical differential', async () => {
    const { prisma, service } = buildService([
      {
        id: 'registry-2',
        displayLabel: 'COPD',
        canonicalName: 'Chronic obstructive pulmonary disease',
        canonicalNormalized: 'chronic obstructive pulmonary disease',
        aliases: [],
      },
    ]);

    await expect(
      service.resolve({
        rawText: 'Chronic obstructive pulmonary disease',
        contextDiagnosisRegistryId: 'registry-1',
      }),
    ).resolves.toMatchObject({
      status: 'resolved',
      resolvedRegistryId: 'registry-2',
      matchType: 'canonical',
    });

    expect(prisma.diagnosisRegistry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          active: true,
        }),
      }),
    );
  });

  it('resolves an alias differential', async () => {
    const { service } = buildService([
      {
        id: 'registry-2',
        displayLabel: 'Chronic obstructive pulmonary disease',
        canonicalName: 'Chronic obstructive pulmonary disease',
        canonicalNormalized: 'chronic obstructive pulmonary disease',
        aliases: [
          {
            normalizedTerm: 'copd',
            kind: DiagnosisAliasKind.ABBREVIATION,
            acceptedForMatch: true,
          },
        ],
      },
    ]);

    await expect(
      service.resolve({ rawText: 'COPD' }),
    ).resolves.toMatchObject({
      status: 'resolved',
      resolvedRegistryId: 'registry-2',
      matchType: 'alias',
    });
  });

  it('resolves a parenthetical variant', async () => {
    const { service } = buildService([
      {
        id: 'registry-2',
        displayLabel: 'COPD',
        canonicalName: 'Chronic obstructive pulmonary disease',
        canonicalNormalized: 'copd',
        aliases: [],
      },
    ]);

    await expect(
      service.resolve({ rawText: 'Chronic obstructive pulmonary disease (COPD)' }),
    ).resolves.toMatchObject({
      status: 'resolved',
      resolvedRegistryId: 'registry-2',
      matchType: 'parenthetical_variant',
    });
  });

  it('returns ambiguous when top suggestions tie', async () => {
    const { service } = buildService([
      {
        id: 'registry-2',
        displayLabel: 'Myocardial infarction',
        canonicalName: 'Myocardial infarction',
        canonicalNormalized: 'myocardial infarction',
        aliases: [
          {
            normalizedTerm: 'mi',
            kind: DiagnosisAliasKind.ABBREVIATION,
            acceptedForMatch: true,
          },
        ],
      },
      {
        id: 'registry-3',
        displayLabel: 'Mitral insufficiency',
        canonicalName: 'Mitral insufficiency',
        canonicalNormalized: 'mitral insufficiency',
        aliases: [
          {
            normalizedTerm: 'mi',
            kind: DiagnosisAliasKind.ABBREVIATION,
            acceptedForMatch: true,
          },
        ],
      },
    ]);

    await expect(service.resolve({ rawText: 'MI' })).resolves.toMatchObject({
      status: 'ambiguous',
      suggestions: expect.arrayContaining([
        expect.objectContaining({ diagnosisRegistryId: 'registry-2' }),
        expect.objectContaining({ diagnosisRegistryId: 'registry-3' }),
      ]),
    });
  });

  it('returns unresolved when no registry match exists', async () => {
    const { service } = buildService([]);

    await expect(
      service.resolve({ rawText: 'Rare mimic text' }),
    ).resolves.toMatchObject({
      status: 'unresolved',
      suggestions: [],
    });
  });

  it('only queries dictionary-visible registry entries', async () => {
    const { prisma, service } = buildService([]);

    await service.resolve({ rawText: 'Draft mimic text' });

    expect(prisma.diagnosisRegistry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          active: true,
        }),
      }),
    );
  });
});
