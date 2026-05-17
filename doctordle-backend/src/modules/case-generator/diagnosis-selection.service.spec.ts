import { DiagnosisRegistryStatus } from '@prisma/client';
import { DiagnosisSelectionService } from './diagnosis-selection.service';

describe('DiagnosisSelectionService', () => {
  it('selects active playable generatable registry diagnoses with filters', async () => {
    const prisma = {
      diagnosisRegistry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'registry-1',
            legacyDiagnosisId: 'diagnosis-1',
            displayLabel: 'Asthma',
            canonicalName: 'asthma',
            aliases: [{ term: 'Reactive airway disease' }],
            specialty: 'Pulmonology',
            category: 'Obstructive',
            bodySystem: 'Respiratory',
            difficultyBand: 'INTERMEDIATE',
            searchPriority: 4,
            _count: {
              cases: 0,
            },
            cases: [],
          },
        ]),
      },
    };
    const service = new DiagnosisSelectionService(prisma as never);

    const result = await service.selectDiagnoses({
      count: 3,
      specialty: 'Pulmonology',
      bodySystem: 'Respiratory',
      difficulty: 'medium',
      excludeRegistryIds: ['registry-used'],
    });

    expect(prisma.diagnosisRegistry.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        status: DiagnosisRegistryStatus.ACTIVE,
        isPlayable: true,
        isGeneratable: true,
        specialty: {
          equals: 'Pulmonology',
          mode: 'insensitive',
        },
        bodySystem: {
          equals: 'Respiratory',
          mode: 'insensitive',
        },
        difficultyBand: 'INTERMEDIATE',
        id: {
          notIn: ['registry-used'],
        },
      },
      orderBy: [{ searchPriority: 'desc' }, { displayLabel: 'asc' }],
      select: {
        id: true,
        legacyDiagnosisId: true,
        displayLabel: true,
        canonicalName: true,
        specialty: true,
        category: true,
        bodySystem: true,
        difficultyBand: true,
        searchPriority: true,
        _count: {
          select: {
            cases: true,
          },
        },
        cases: {
          orderBy: {
            date: 'desc',
          },
          take: 1,
          select: {
            date: true,
          },
        },
        aliases: {
          where: {
            active: true,
            acceptedForMatch: true,
          },
          select: {
            term: true,
          },
          orderBy: [{ rank: 'asc' }, { term: 'asc' }],
        },
      },
    });
    expect(result).toEqual([
      {
        diagnosisRegistryId: 'registry-1',
        legacyDiagnosisId: 'diagnosis-1',
        displayLabel: 'Asthma',
        canonicalName: 'asthma',
        acceptedAliases: ['Reactive airway disease'],
        specialty: 'Pulmonology',
        category: 'Obstructive',
        bodySystem: 'Respiratory',
        difficultyBand: 'INTERMEDIATE',
        existingCaseCount: 0,
        lastGeneratedAt: null,
        recentUsePenaltyApplied: false,
      },
    ]);
  });

  it('prefers unused diagnoses, then least-used, then not-recently generated diagnoses', async () => {
    const oldDate = new Date('2020-01-01T00:00:00.000Z');
    const recentDate = new Date();
    const prisma = {
      diagnosisRegistry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'recent-used',
            legacyDiagnosisId: 'diagnosis-recent',
            displayLabel: 'Recent Used',
            canonicalName: 'recent used',
            aliases: [],
            specialty: 'Neurology',
            category: null,
            bodySystem: 'Nervous System',
            difficultyBand: 'INTERMEDIATE',
            searchPriority: 100,
            _count: { cases: 1 },
            cases: [{ date: recentDate }],
          },
          {
            id: 'old-used',
            legacyDiagnosisId: 'diagnosis-old',
            displayLabel: 'Old Used',
            canonicalName: 'old used',
            aliases: [],
            specialty: 'Neurology',
            category: null,
            bodySystem: 'Nervous System',
            difficultyBand: 'INTERMEDIATE',
            searchPriority: 1,
            _count: { cases: 1 },
            cases: [{ date: oldDate }],
          },
          {
            id: 'unused',
            legacyDiagnosisId: 'diagnosis-unused',
            displayLabel: 'Unused',
            canonicalName: 'unused',
            aliases: [],
            specialty: 'Neurology',
            category: null,
            bodySystem: 'Nervous System',
            difficultyBand: 'INTERMEDIATE',
            searchPriority: 0,
            _count: { cases: 0 },
            cases: [],
          },
        ]),
      },
    };
    const service = new DiagnosisSelectionService(prisma as never);

    const result = await service.selectDiagnosisCandidates({
      count: 3,
      specialty: 'Neurology',
    });

    expect(result.candidates.map((candidate) => candidate.diagnosisRegistryId))
      .toEqual(['unused', 'old-used', 'recent-used']);
    expect(result).toEqual(
      expect.objectContaining({
        candidateCount: 3,
        unusedCandidateCount: 1,
        repeatedCandidateCount: 2,
        existingCaseCountByDiagnosis: {
          unused: 0,
          'old-used': 1,
          'recent-used': 1,
        },
        recentUsePenaltyApplied: true,
      }),
    );
  });

  it('returns no rows for zero-count plans', async () => {
    const prisma = {
      diagnosisRegistry: {
        findMany: jest.fn(),
      },
    };
    const service = new DiagnosisSelectionService(prisma as never);

    await expect(service.selectDiagnoses({ count: 0 })).resolves.toEqual([]);
    expect(prisma.diagnosisRegistry.findMany).not.toHaveBeenCalled();
  });
});
