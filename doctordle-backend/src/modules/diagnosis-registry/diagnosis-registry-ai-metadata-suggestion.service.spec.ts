import { NotFoundException } from '@nestjs/common';
import { DiagnosisRegistryStatus } from '@prisma/client';
import { DiagnosisRegistryAiMetadataSuggestionService } from './diagnosis-registry-ai-metadata-suggestion.service';

type MockOpenAiClient = {
  chat: {
    completions: {
      create: jest.Mock;
    };
  };
};

function registry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'registry-1',
    canonicalName: 'JIA',
    canonicalNormalized: 'jia',
    displayLabel: 'JIA',
    status: DiagnosisRegistryStatus.DRAFT,
    active: true,
    isPlayable: true,
    isGeneratable: false,
    onboardingStatus: 'READY_FOR_REVIEW',
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
    excludedClueTypes: null,
    aliases: [],
    createdRegistryCandidates: [
      {
        sourceRawText: 'JIA',
        sourceType: 'case_differential',
        sourceId: 'case-1',
        sourceMappingId: 'mapping-1',
        proposedAliases: ['JIA'],
      },
    ],
    cases: [
      {
        title: 'Child with chronic joint swelling',
        proposedDiagnosisText: 'JIA',
        differentials: ['septic arthritis', 'reactive arthritis'],
        explanation: { summary: 'Chronic arthritis in a child.' },
        currentRevision: {
          title: 'Child with chronic joint swelling',
          proposedDiagnosisText: 'JIA',
          differentials: ['septic arthritis'],
          explanation: { summary: 'Morning stiffness and joint swelling.' },
        },
      },
    ],
    ...overrides,
  };
}

function buildPrisma(row: unknown | null = registry()) {
  return {
    diagnosisRegistry: {
      findUnique: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    diagnosisAlias: {
      create: jest.fn(),
    },
  };
}

function mockOpenAi(payload: unknown): MockOpenAiClient {
  return {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify(payload),
              },
            },
          ],
        }),
      },
    },
  };
}

function attachOpenAi(
  service: DiagnosisRegistryAiMetadataSuggestionService,
  openaiClient: MockOpenAiClient,
) {
  (
    service as unknown as {
      openaiClient: MockOpenAiClient;
    }
  ).openaiClient = openaiClient;
}

describe('DiagnosisRegistryAiMetadataSuggestionService', () => {
  it('expands JIA into pediatric rheumatology metadata without mutating registry rows', async () => {
    const prisma = buildPrisma();
    const openaiClient = mockOpenAi({
      canonicalName: 'juvenile idiopathic arthritis',
      displayLabel: 'Juvenile Idiopathic Arthritis',
      aliases: ['JIA', 'juvenile rheumatoid arthritis'],
      specialty: 'Rheumatology',
      subspecialty: 'Pediatric Rheumatology',
      category: 'Inflammatory',
      bodySystem: 'Musculoskeletal',
      organSystem: 'Joints',
      difficultyBand: 'INTERMEDIATE',
      rarityBand: 'UNCOMMON',
      clinicalSetting: 'OUTPATIENT',
      ageGroup: 'PEDIATRIC',
      urgencyLevel: 'ROUTINE',
      preferredClueTypes: ['history', 'exam', 'lab', 'imaging'],
      excludedClueTypes: [],
      confidence: 0.82,
      rationale: 'JIA is a common abbreviation for juvenile idiopathic arthritis.',
      warnings: [],
    });
    const service = new DiagnosisRegistryAiMetadataSuggestionService(
      prisma as never,
    );
    attachOpenAi(service, openaiClient);

    const result = await service.generateAiMetadataSuggestion('registry-1', {
      includeAliases: true,
      includeMetadata: true,
    });

    expect(result.suggestion.canonicalName).toBe(
      'juvenile idiopathic arthritis',
    );
    expect(result.suggestion.aliases).toEqual(
      expect.arrayContaining(['JIA', 'juvenile rheumatoid arthritis']),
    );
    expect(result.suggestion.specialty).toBe('Rheumatology');
    expect(result.suggestion.ageGroup).toBe('PEDIATRIC');
    expect(result.suggestion.preferredClueTypes).toEqual(
      expect.arrayContaining(['history', 'exam', 'lab', 'imaging']),
    );
    expect(openaiClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: 'json_object' },
      }),
    );
    expect(prisma.diagnosisRegistry.update).not.toHaveBeenCalled();
    expect(prisma.diagnosisAlias.create).not.toHaveBeenCalled();
  });

  it('expands CHF into cardiology metadata', async () => {
    const prisma = buildPrisma(
      registry({
        canonicalName: 'CHF',
        canonicalNormalized: 'chf',
        displayLabel: 'CHF',
        createdRegistryCandidates: [
          {
            sourceRawText: 'CHF',
            sourceType: 'case_differential',
            sourceId: 'case-2',
            sourceMappingId: 'mapping-2',
            proposedAliases: ['CHF'],
          },
        ],
      }),
    );
    const service = new DiagnosisRegistryAiMetadataSuggestionService(
      prisma as never,
    );
    attachOpenAi(
      service,
      mockOpenAi({
        canonicalName: 'congestive heart failure',
        displayLabel: 'Congestive Heart Failure',
        aliases: [
          'CHF',
          'heart failure',
          'cardiac failure',
          'congestive cardiac failure',
        ],
        specialty: 'Cardiology',
        subspecialty: null,
        category: 'Cardiomyopathy',
        bodySystem: 'Cardiovascular',
        organSystem: 'Heart',
        difficultyBand: 'BASIC',
        rarityBand: 'COMMON',
        clinicalSetting: 'OUTPATIENT',
        ageGroup: 'ADULT',
        urgencyLevel: 'ROUTINE',
        preferredClueTypes: ['history', 'exam', 'lab'],
        excludedClueTypes: [],
        confidence: 0.9,
        rationale: 'CHF is a standard abbreviation for congestive heart failure.',
        warnings: [],
      }),
    );

    const result = await service.generateAiMetadataSuggestion('registry-1');

    expect(result.suggestion.canonicalName).toBe('congestive heart failure');
    expect(result.suggestion.specialty).toBe('Cardiology');
    expect(result.suggestion.bodySystem).toBe('Cardiovascular');
    expect(result.suggestion.organSystem).toBe('Heart');
    expect(result.suggestion.aliases).toEqual(
      expect.arrayContaining(['CHF', 'heart failure']),
    );
  });

  it('coerces invalid enum values and removes invalid clue types safely', async () => {
    const service = new DiagnosisRegistryAiMetadataSuggestionService(
      buildPrisma() as never,
    );

    const result = service.sanitizeSuggestion(
      {
        canonicalName: 'JIA',
        displayLabel: 'JIA',
        aliases: ['JIA'],
        specialty: 'Rheumatology',
        category: 'Inflammatory',
        bodySystem: 'Musculoskeletal',
        organSystem: 'Joints',
        difficultyBand: 'VERY_HARD',
        rarityBand: 'FREQUENT',
        clinicalSetting: 'CLINIC',
        ageGroup: 'CHILD',
        urgencyLevel: 'LOW',
        preferredClueTypes: ['history', 'xray', 'lab'],
        excludedClueTypes: ['made_up'],
        confidence: 1.7,
        rationale: 'Test payload',
        warnings: [],
      },
      { canonicalName: 'JIA', displayLabel: 'JIA' },
    );

    expect(result.difficultyBand).toBe('INTERMEDIATE');
    expect(result.rarityBand).toBe('COMMON');
    expect(result.clinicalSetting).toBe('OUTPATIENT');
    expect(result.ageGroup).toBe('PEDIATRIC');
    expect(result.urgencyLevel).toBe('ROUTINE');
    expect(result.preferredClueTypes).toEqual(
      expect.arrayContaining(['history', 'lab', 'imaging']),
    );
    expect(result.excludedClueTypes).toEqual([]);
    expect(result.metadataConfidence).toBeLessThan(1);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('metadata_remapped:difficultyBand'),
        expect.stringContaining('metadata_remapped:ageGroup'),
        expect.stringContaining('metadata_unmapped:excludedClueTypes'),
      ]),
    );
  });

  it('uses condition-specific JIA metadata when AI identity is right but metadata is generic', async () => {
    const service = new DiagnosisRegistryAiMetadataSuggestionService(
      buildPrisma() as never,
    );

    const result = service.sanitizeSuggestion(
      {
        canonicalName: 'Juvenile Idiopathic Arthritis',
        displayLabel: 'Juvenile Idiopathic Arthritis',
        aliases: ['JIA'],
        specialty: 'General Medicine',
        category: 'General',
        bodySystem: 'General',
        organSystem: 'General',
        clinicalSetting: 'Clinic',
        ageGroup: 'Child',
        urgencyLevel: 'Chronic',
        confidence: 0.8,
        rationale: 'Expanded abbreviation but omitted specific metadata.',
        warnings: [],
      },
      { canonicalName: 'JIA', canonicalNormalized: 'jia', displayLabel: 'JIA' },
    );

    expect(result.specialty).toBe('Rheumatology');
    expect(result.subspecialty).toBe('Pediatric Rheumatology');
    expect(result.category).toBe('Inflammatory');
    expect(result.bodySystem).toBe('Musculoskeletal');
    expect(result.organSystem).toBe('Joints');
    expect(result.rarityBand).toBe('COMMON');
    expect(result.ageGroup).toBe('PEDIATRIC');
    expect(result.aliases).toEqual(
      expect.arrayContaining([
        'JIA',
        'juvenile idiopathic arthritis',
        'juvenile rheumatoid arthritis',
      ]),
    );
    expect(result.identityConfidence).toBeGreaterThanOrEqual(0.88);
    expect(result.metadataConfidence).toBeGreaterThanOrEqual(0.7);
  });

  it('does not allow generic metadata to keep high confidence for unknown diagnoses', () => {
    const service = new DiagnosisRegistryAiMetadataSuggestionService(
      buildPrisma() as never,
    );

    const result = service.sanitizeSuggestion(
      {
        canonicalName: 'Mystery Syndrome',
        displayLabel: 'Mystery Syndrome',
        aliases: [],
        specialty: 'General Medicine',
        category: 'General',
        bodySystem: 'General',
        organSystem: 'General',
        clinicalSetting: 'Unknown place',
        ageGroup: 'Unknown age',
        urgencyLevel: 'Unknown urgency',
        confidence: 0.92,
        rationale: 'High identity confidence but generic metadata.',
        warnings: [],
      },
      {
        canonicalName: 'Mystery Syndrome',
        canonicalNormalized: 'mystery syndrome',
        displayLabel: 'Mystery Syndrome',
      },
    );

    expect(result.specialty).toBeNull();
    expect(result.category).toBeNull();
    expect(result.bodySystem).toBeNull();
    expect(result.organSystem).toBeNull();
    expect(result.metadataConfidence).toBeLessThan(0.7);
    expect(result.confidence).toBe(result.metadataConfidence);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('generic_fallback_avoided:specialty'),
        expect.stringContaining('metadata_unmapped:clinicalSetting'),
      ]),
    );
  });

  it('throws when the registry row is missing', async () => {
    const service = new DiagnosisRegistryAiMetadataSuggestionService(
      buildPrisma(null) as never,
    );
    attachOpenAi(service, mockOpenAi({}));

    await expect(
      service.generateAiMetadataSuggestion('missing-registry'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
