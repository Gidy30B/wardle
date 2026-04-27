import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { DiagnosisRegistrySnapshotService } from './diagnosis-registry-snapshot.service';

function createSnapshotFixture() {
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
    service: new DiagnosisRegistrySnapshotService(prisma as never),
  };
}

describe('DiagnosisRegistrySnapshotService', () => {
  beforeEach(() => {
    process.env.DIAGNOSIS_AUTOCOMPLETE_ENABLED = 'true';
    process.env.SELECTION_FIRST_SUBMISSION_ENABLED = 'true';
    resetEnvCacheForTests();
  });

  afterEach(() => {
    delete process.env.DIAGNOSIS_AUTOCOMPLETE_ENABLED;
    delete process.env.SELECTION_FIRST_SUBMISSION_ENABLED;
    resetEnvCacheForTests();
  });

  it('derives a stable version from active registry metadata and flags', async () => {
    const fixture = createSnapshotFixture();
    fixture.prisma.diagnosisRegistry.count.mockResolvedValue(2);
    fixture.prisma.diagnosisAlias.count.mockResolvedValue(5);
    fixture.prisma.diagnosisRegistry.findFirst.mockResolvedValue({
      updatedAt: new Date('2026-04-21T09:00:00.000Z'),
    });
    fixture.prisma.diagnosisAlias.findFirst.mockResolvedValue({
      updatedAt: new Date('2026-04-21T10:00:00.000Z'),
    });

    const version = await fixture.service.getVersion();

    expect(version).toEqual({
      version: '1776765600000:2:5:1:1',
      generatedAt: '2026-04-21T10:00:00.000Z',
      diagnosisCount: 2,
      aliasCount: 5,
      selectionRequired: true,
      autocompleteEnabled: true,
    });
    expect(fixture.prisma.diagnosisRegistry.count).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
      },
    });
    expect(fixture.prisma.diagnosisRegistry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
        },
      }),
    );
  });

  it('returns active diagnoses and alias metadata for the local snapshot', async () => {
    const fixture = createSnapshotFixture();
    fixture.prisma.diagnosisRegistry.count.mockResolvedValue(1);
    fixture.prisma.diagnosisAlias.count.mockResolvedValue(2);
    fixture.prisma.diagnosisRegistry.findFirst
      .mockResolvedValueOnce({
        updatedAt: new Date('2026-04-21T09:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        updatedAt: new Date('2026-04-21T09:00:00.000Z'),
      });
    fixture.prisma.diagnosisAlias.findFirst
      .mockResolvedValueOnce({
        updatedAt: new Date('2026-04-21T08:30:00.000Z'),
      })
      .mockResolvedValueOnce({
        updatedAt: new Date('2026-04-21T08:30:00.000Z'),
      });
    fixture.prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-1',
        canonicalName: 'Myocardial Infarction',
        canonicalNormalized: 'myocardial infarction',
        displayLabel: 'Myocardial Infarction',
        aliases: [
          {
            id: 'alias-canonical',
            term: 'Myocardial Infarction',
            normalizedTerm: 'myocardial infarction',
            rank: 0,
            acceptedForMatch: true,
            kind: 'CANONICAL',
          },
          {
            id: 'alias-search',
            term: 'heart attack',
            normalizedTerm: 'heart attack',
            rank: 10,
            acceptedForMatch: false,
            kind: 'SEARCH_ONLY',
          },
        ],
      },
    ]);

    const snapshot = await fixture.service.getSnapshot();

    expect(snapshot.version).toBe('1776762000000:1:2:1:1');
    expect(snapshot.diagnoses).toEqual([
      {
        diagnosisId: 'registry-1',
        canonicalName: 'Myocardial Infarction',
        canonicalNormalized: 'myocardial infarction',
        displayLabel: 'Myocardial Infarction',
        aliases: [
          {
            id: 'alias-canonical',
            term: 'Myocardial Infarction',
            normalizedTerm: 'myocardial infarction',
            rank: 0,
            acceptedForMatch: true,
            matchKind: 'canonical',
          },
          {
            id: 'alias-search',
            term: 'heart attack',
            normalizedTerm: 'heart attack',
            rank: 10,
            acceptedForMatch: false,
            matchKind: 'search_only',
          },
        ],
      },
    ]);
    expect(fixture.prisma.diagnosisRegistry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
        },
      }),
    );
  });
});
