import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { DiagnosisAutocompleteService } from './diagnosis-autocomplete.service';

function createAutocompleteFixture() {
  const prisma = {
    diagnosisRegistry: {
      findMany: jest.fn(),
    },
  };

  return {
    prisma,
    service: new DiagnosisAutocompleteService(prisma as never),
  };
}

describe('DiagnosisAutocompleteService', () => {
  beforeEach(() => {
    process.env.DIAGNOSIS_REGISTRY_ENABLED = 'true';
    process.env.DIAGNOSIS_AUTOCOMPLETE_ENABLED = 'true';
    resetEnvCacheForTests();
  });

  afterEach(() => {
    delete process.env.DIAGNOSIS_REGISTRY_ENABLED;
    delete process.env.DIAGNOSIS_AUTOCOMPLETE_ENABLED;
    resetEnvCacheForTests();
  });

  it('ranks canonical prefix matches ahead of alias matches', async () => {
    const fixture = createAutocompleteFixture();
    fixture.prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'dx-1',
        displayLabel: 'Asthma',
        canonicalNormalized: 'asthma',
        aliases: [],
      },
      {
        id: 'dx-2',
        displayLabel: 'Status Asthmaticus',
        canonicalNormalized: 'status asthmaticus',
        aliases: [
          {
            id: 'alias-1',
            term: 'asthma attack',
            normalizedTerm: 'asthma attack',
            kind: 'ACCEPTED',
            rank: 5,
          },
        ],
      },
    ]);

    const result = await fixture.service.search({ query: 'Ast', limit: 5 });

    expect(result.map((item) => item.diagnosisId)).toEqual(['dx-1', 'dx-2']);
    expect(result[0]).toEqual(
      expect.objectContaining({
        diagnosisId: 'dx-1',
        aliasId: null,
        matchKind: 'canonical',
      }),
    );
    expect(fixture.prisma.diagnosisRegistry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('returns registry-backed diagnoses only and preserves alias metadata', async () => {
    const fixture = createAutocompleteFixture();
    fixture.prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'dx-1',
        displayLabel: 'Pneumonia',
        canonicalNormalized: 'pneumonia',
        aliases: [
          {
            id: 'alias-search',
            term: 'lung infection',
            normalizedTerm: 'lung infection',
            kind: 'SEARCH_ONLY',
            rank: 20,
          },
        ],
      },
    ]);

    const result = await fixture.service.search({
      query: 'lung',
      limit: 5,
    });

    expect(result).toEqual([
      {
        diagnosisId: 'dx-1',
        displayLabel: 'Pneumonia',
        aliasId: 'alias-search',
        matchKind: 'search_only',
      },
    ]);
  });

  it('returns an empty list for short queries', async () => {
    const fixture = createAutocompleteFixture();

    const result = await fixture.service.search({ query: 'a', limit: 5 });

    expect(result).toEqual([]);
    expect(fixture.prisma.diagnosisRegistry.findMany).not.toHaveBeenCalled();
  });
});
