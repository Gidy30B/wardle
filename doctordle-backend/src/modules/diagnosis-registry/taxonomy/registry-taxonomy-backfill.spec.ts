import {
  backfillRegistryTaxonomyFromLegacy,
  buildNullOnlyTaxonomyPatch,
} from './registry-taxonomy-backfill';

describe('buildNullOnlyTaxonomyPatch', () => {
  it('fills only empty registry taxonomy fields', () => {
    expect(
      buildNullOnlyTaxonomyPatch(
        {
          specialty: 'Emergency Medicine',
          subspecialty: null,
          bodySystem: '',
          category: null,
        },
        {
          specialty: 'Cardiology',
          bodySystem: 'Cardiovascular',
          category: 'Vascular',
        },
      ),
    ).toEqual({
      bodySystem: 'Cardiovascular',
      category: 'Vascular',
    });
  });
});

describe('backfillRegistryTaxonomyFromLegacy', () => {
  function createFixture() {
    const prisma = {
      diagnosisRegistry: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    return { prisma };
  }

  it('reports updates in dry-run mode without writing to the database', async () => {
    const fixture = createFixture();
    fixture.prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-1',
        displayLabel: 'Stroke',
        specialty: null,
        subspecialty: null,
        bodySystem: null,
        category: null,
        legacyDiagnosis: {
          id: 'diagnosis-1',
          name: 'Stroke',
          system: 'Neurology',
        },
      },
    ]);

    const summary = await backfillRegistryTaxonomyFromLegacy(
      fixture.prisma as never,
      'dry-run',
    );

    expect(summary.updatedRows).toEqual([
      {
        registryId: 'registry-1',
        displayLabel: 'Stroke',
        legacyDiagnosisId: 'diagnosis-1',
        legacyDiagnosisName: 'Stroke',
        legacySystem: 'Neurology',
        data: {
          specialty: 'Neurology',
          bodySystem: 'Nervous System',
        },
      },
    ]);
    expect(fixture.prisma.diagnosisRegistry.update).not.toHaveBeenCalled();
  });

  it('applies mapped taxonomy while preserving curated metadata', async () => {
    const fixture = createFixture();
    fixture.prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-1',
        displayLabel: 'Myocardial Infarction',
        specialty: 'Emergency Medicine',
        subspecialty: null,
        bodySystem: null,
        category: 'Cardiology',
        legacyDiagnosis: {
          id: 'diagnosis-1',
          name: 'Myocardial Infarction',
          system: 'Cardiology',
        },
      },
    ]);

    const summary = await backfillRegistryTaxonomyFromLegacy(
      fixture.prisma as never,
      'apply',
    );

    expect(summary.updatedRows[0].data).toEqual({
      bodySystem: 'Cardiovascular',
    });
    expect(fixture.prisma.diagnosisRegistry.update).toHaveBeenCalledWith({
      where: {
        id: 'registry-1',
      },
      data: {
        bodySystem: 'Cardiovascular',
      },
    });
  });

  it('reports unmapped legacy systems', async () => {
    const fixture = createFixture();
    fixture.prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-1',
        displayLabel: 'Orbital Barotrauma',
        specialty: null,
        subspecialty: null,
        bodySystem: null,
        category: null,
        legacyDiagnosis: {
          id: 'diagnosis-1',
          name: 'Orbital Barotrauma',
          system: 'Aerospace',
        },
      },
    ]);

    const summary = await backfillRegistryTaxonomyFromLegacy(
      fixture.prisma as never,
      'dry-run',
    );

    expect(summary.updatedRows).toEqual([]);
    expect(summary.unmappedSystems).toEqual([
      {
        legacySystem: 'Aerospace',
        normalizedSystem: 'aerospace',
        count: 1,
      },
    ]);
  });
});
