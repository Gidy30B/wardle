import { DiagnosisRegistryDictionaryService } from './diagnosis-registry-dictionary.service';

function createDictionaryFixture() {
  const prisma = {
    diagnosisRegistry: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    diagnosisAlias: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  return {
    prisma,
    service: new DiagnosisRegistryDictionaryService(prisma as never),
  };
}

describe('DiagnosisRegistryDictionaryService', () => {
  it('builds a compact public dictionary from active diagnoses only', async () => {
    const fixture = createDictionaryFixture();
    fixture.prisma.diagnosisRegistry.count.mockResolvedValue(2);
    fixture.prisma.diagnosisAlias.count.mockResolvedValue(3);
    fixture.prisma.diagnosisRegistry.findFirst.mockResolvedValue({
      updatedAt: new Date('2026-04-22T08:00:00.000Z'),
    });
    fixture.prisma.diagnosisAlias.findFirst.mockResolvedValue({
      updatedAt: new Date('2026-04-22T09:00:00.000Z'),
    });
    fixture.prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'dx-2',
        displayLabel: 'Asthma Exacerbation',
        searchPriority: 80,
        category: 'Pulmonology',
        aliases: [
          {
            term: 'Asthma attack',
            normalizedTerm: 'asthma attack',
            rank: 10,
          },
        ],
      },
      {
        id: 'dx-1',
        displayLabel: 'Appendicitis',
        searchPriority: 80,
        category: null,
        aliases: [
          {
            term: 'Acute appendicitis',
            normalizedTerm: 'acute appendicitis',
            rank: 10,
          },
          {
            term: 'Acute appendicitis',
            normalizedTerm: 'acute appendicitis',
            rank: 11,
          },
        ],
      },
    ]);

    const payload = await fixture.service.getDictionary();

    expect(payload).toEqual({
      version: '1776848400000:2:3',
      generatedAt: '2026-04-22T09:00:00.000Z',
      items: [
        {
          id: 'dx-2',
          label: 'Asthma Exacerbation',
          aliases: ['Asthma attack'],
          priority: 80,
          category: 'Pulmonology',
        },
        {
          id: 'dx-1',
          label: 'Appendicitis',
          aliases: ['Acute appendicitis'],
          priority: 80,
        },
      ],
    });
    expect(fixture.prisma.diagnosisRegistry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
        },
        orderBy: [{ searchPriority: 'desc' }, { displayLabel: 'asc' }],
      }),
    );
    expect(fixture.prisma.diagnosisAlias.count).toHaveBeenCalledWith({
      where: {
        active: true,
        kind: {
          in: ['ACCEPTED', 'ABBREVIATION', 'SEARCH_ONLY'],
        },
        diagnosis: {
          status: 'ACTIVE',
        },
      },
    });
  });

  it('returns an empty stable payload when no active diagnoses exist', async () => {
    const fixture = createDictionaryFixture();
    fixture.prisma.diagnosisRegistry.count.mockResolvedValue(0);
    fixture.prisma.diagnosisAlias.count.mockResolvedValue(0);
    fixture.prisma.diagnosisRegistry.findFirst.mockResolvedValue(null);
    fixture.prisma.diagnosisAlias.findFirst.mockResolvedValue(null);
    fixture.prisma.diagnosisRegistry.findMany.mockResolvedValue([]);

    const payload = await fixture.service.getDictionary();

    expect(payload).toEqual({
      version: '0:0:0',
      generatedAt: '1970-01-01T00:00:00.000Z',
      items: [],
    });
  });
});
