import { NotFoundException } from '@nestjs/common';
import { DiagnosisRegistryMetadataSuggestionService } from './diagnosis-registry-metadata-suggestion.service';

function buildPrisma(registry: unknown | null) {
  return {
    diagnosisRegistry: {
      findUnique: jest.fn().mockResolvedValue(registry),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
    diagnosisAlias: {
      count: jest.fn().mockResolvedValue(0),
    },
    diagnosisRegistryCandidate: {
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('DiagnosisRegistryMetadataSuggestionService', () => {
  it('suggests metadata and aliases from registry candidate provenance', async () => {
    const prisma = buildPrisma({
      id: 'registry-1',
      canonicalName: 'Diabetic ketoacidosis',
      canonicalNormalized: 'diabetic ketoacidosis',
      displayLabel: 'Diabetic Ketoacidosis',
      specialty: null,
      subspecialty: null,
      category: null,
      bodySystem: null,
      organSystem: null,
      difficultyBand: null,
      rarityBand: null,
      clinicalSetting: null,
      ageGroup: null,
      urgencyLevel: null,
      preferredClueTypes: null,
      aliases: [],
      createdRegistryCandidates: [
        {
          sourceRawText: 'DKA',
          proposedAliases: ['DKA'],
        },
      ],
      cases: [],
    });
    const service = new DiagnosisRegistryMetadataSuggestionService(prisma as never);

    const result = await service.suggestRegistryMetadata('registry-1');

    expect(result.metadata.specialty).toBe('Endocrinology');
    expect(result.metadata.urgencyLevel).toBe('EMERGENT');
    expect(result.aliases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: 'DKA', acceptedForMatch: true }),
      ]),
    );
    expect(result.duplicateRisk).toEqual({
      canonicalMatches: 0,
      aliasMatches: 0,
      pendingCandidateMatches: 0,
    });
  });

  it('throws when the registry entry is missing', async () => {
    const service = new DiagnosisRegistryMetadataSuggestionService(
      buildPrisma(null) as never,
    );

    await expect(
      service.suggestRegistryMetadata('missing-registry'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
