import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
} from '@prisma/client';
import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { DiagnosisEducationService } from './diagnosis-education.service';

const requiredEnv = {
  DATABASE_URL: 'postgres://example',
  REDIS_URL: 'redis://example',
  CLERK_JWT_ISSUER: 'https://example.com',
  CLERK_JWT_AUDIENCE: 'audience',
  NODE_ENV: 'test',
  LOG_LEVEL: 'debug',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  SCORE_WEIGHT_EXACT: '1',
  SCORE_WEIGHT_SYNONYM: '1',
  SCORE_WEIGHT_FUZZY: '1',
  SCORE_WEIGHT_EMBEDDING: '1',
  SCORE_WEIGHT_ONTOLOGY: '1',
  EVALUATOR_VERSION: 'v2',
} as const;

function buildEducation(
  overrides: Partial<{
    id: string;
    diagnosisRegistryId: string;
    title: string;
    summary: unknown;
    clinicalPattern: unknown;
    keySymptoms: unknown;
    keySigns: unknown;
    examPearls: unknown;
    scoringSystems: unknown;
    investigations: unknown;
    differentials: unknown;
    management: unknown;
    complications: unknown;
    pitfalls: unknown;
    recallPrompts: unknown;
    references: unknown;
    editorialStatus: DiagnosisEducationStatus;
    source: DiagnosisEducationSource;
    version: number;
    generatedAt: Date | null;
    reviewedAt: Date | null;
    reviewedByUserId: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: 'education-1',
    diagnosisRegistryId: 'registry-1',
    title: 'Appendicitis',
    summary: {
      definition: 'Inflammation of the appendix.',
      highYieldTakeaway: 'Migration to RLQ pain is high-yield.',
    },
    clinicalPattern: ['Migratory abdominal pain'],
    keySymptoms: ['Anorexia'],
    keySigns: ['McBurney point tenderness'],
    examPearls: [{ label: 'Rovsing sign', explanation: 'RLQ pain with LLQ palpation.' }],
    scoringSystems: null,
    investigations: null,
    differentials: null,
    management: null,
    complications: null,
    pitfalls: ['Atypical presentations occur.'],
    recallPrompts: null,
    references: null,
    editorialStatus: DiagnosisEducationStatus.PUBLISHED,
    source: DiagnosisEducationSource.MANUAL,
    version: 1,
    generatedAt: null,
    reviewedAt: new Date('2026-05-01T00:00:00.000Z'),
    reviewedByUserId: 'admin-1',
    publishedAt: new Date('2026-05-01T00:00:00.000Z'),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildRegistryForGeneration() {
  return {
    id: 'registry-1',
    displayLabel: 'Appendicitis',
    canonicalName: 'appendicitis',
    specialty: 'General Surgery',
    category: 'Inflammatory',
    bodySystem: 'Gastrointestinal',
    clinicalSetting: 'EMERGENCY',
    difficultyBand: 'BASIC',
    aliases: [{ term: 'Acute appendicitis', acceptedForMatch: true }],
    cases: [
      {
        title: 'Appendicitis',
        clues: [],
        explanation: {
          summary: 'Migratory right lower quadrant pain.',
        },
        differentials: ['Gastroenteritis'],
      },
    ],
  };
}

function buildValidGeneratedDraft(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    summary: {
      definition: 'Inflammation of the appendix.',
      highYieldTakeaway: 'Migratory right lower quadrant pain is high-yield.',
    },
    clinicalPattern: ['Periumbilical pain migrates to the right lower quadrant'],
    keySymptoms: ['Anorexia', 'Nausea'],
    keySigns: ['McBurney point tenderness'],
    examPearls: [
      {
        id: 'rovsing-sign',
        label: 'Rovsing sign',
        explanation: 'Right lower quadrant pain with left lower quadrant palpation.',
      },
    ],
    scoringSystems: [
      {
        id: 'alvarado-score',
        name: 'Alvarado score',
        use: 'Risk stratification for suspected appendicitis.',
        components: ['Migration', 'Anorexia', 'Nausea or vomiting'],
        caution: 'Use as an educational aid, not a standalone diagnosis.',
      },
    ],
    investigations: ['CBC may show leukocytosis'],
    differentials: [
      {
        id: 'gastroenteritis',
        diagnosis: 'Gastroenteritis',
        distinguishingPoint: 'Usually has diffuse cramps and diarrhea.',
      },
    ],
    management: ['Surgical consultation and supportive care.'],
    complications: ['Perforation', 'Abscess'],
    pitfalls: ['Atypical presentations can occur.'],
    recallPrompts: [
      {
        id: 'appendicitis-pattern',
        type: 'SHORT_ANSWER',
        prompt: 'What pain migration pattern suggests appendicitis?',
        answer: 'Periumbilical pain migrating to the right lower quadrant.',
        sourceSection: 'clinicalPattern',
        difficulty: 'BASIC',
      },
    ],
    references: ['Editorial review required before publication.'],
    ...overrides,
  };
}

function mockOpenAiDraft(service: DiagnosisEducationService, payload: string) {
  const create = jest.fn().mockResolvedValue({
    choices: [{ message: { content: payload } }],
  });

  Object.defineProperty(service, 'openaiClient', {
    value: {
      chat: {
        completions: {
          create,
        },
      },
    },
  });

  return create;
}

function buildService() {
  const tx = {
    diagnosisEducation: {
      update: jest.fn(),
      create: jest.fn(),
    },
    diagnosisEducationRevision: {
      create: jest.fn().mockResolvedValue({ id: 'revision-1' }),
    },
  };
  const prisma = {
    diagnosisRegistry: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'registry-1',
        displayLabel: 'Appendicitis',
        canonicalName: 'appendicitis',
        specialty: 'General Surgery',
        category: 'Inflammatory',
        bodySystem: 'Gastrointestinal',
        clinicalSetting: 'EMERGENCY',
        difficultyBand: 'BASIC',
      }),
    },
    diagnosisEducation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    gameSession: {
      findFirst: jest.fn().mockResolvedValue({ id: 'session-1' }),
    },
    $transaction: jest.fn(
      async (handler: (transaction: typeof tx) => Promise<unknown>) =>
        handler(tx),
    ),
  };

  return {
    prisma,
    tx,
    service: new DiagnosisEducationService(prisma as never),
  };
}

describe('DiagnosisEducationService', () => {
  beforeEach(() => {
    Object.entries(requiredEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_EDUCATION_GENERATION_ENABLED;
    resetEnvCacheForTests();
  });

  afterEach(() => {
    Object.keys(requiredEnv).forEach((key) => {
      delete process.env[key];
    });
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_EDUCATION_GENERATION_ENABLED;
    resetEnvCacheForTests();
  });

  it('returns published player education when user completed a matching diagnosis', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisEducation.findFirst.mockResolvedValue({
      ...buildEducation(),
      diagnosisRegistry: {
        id: 'registry-1',
        displayLabel: 'Appendicitis',
        canonicalName: 'appendicitis',
        specialty: 'General Surgery',
        category: 'Inflammatory',
        bodySystem: 'Gastrointestinal',
        clinicalSetting: 'EMERGENCY',
        difficultyBand: 'BASIC',
      },
    });

    const result = await service.getPublishedForUser({
      userId: 'user-1',
      diagnosisRegistryId: 'registry-1',
    });

    expect(prisma.gameSession.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: 'completed',
        completedAt: {
          not: null,
        },
        case: {
          diagnosisRegistryId: 'registry-1',
        },
      },
      select: { id: true },
    });

    expect(prisma.diagnosisEducation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          diagnosisRegistryId: 'registry-1',
          editorialStatus: DiagnosisEducationStatus.PUBLISHED,
        },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        diagnosisRegistryId: 'registry-1',
        title: 'Appendicitis',
        version: 1,
      }),
    );
  });

  it('returns 404 when published education exists but user has not completed matching diagnosis', async () => {
    const { prisma, service } = buildService();
    prisma.gameSession.findFirst.mockResolvedValue(null);

    await expect(
      service.getPublishedForUser({
        userId: 'user-1',
        diagnosisRegistryId: 'registry-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.diagnosisEducation.findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when user only has an incomplete session', async () => {
    const { prisma, service } = buildService();
    prisma.gameSession.findFirst.mockResolvedValue(null);

    await expect(
      service.getPublishedForUser({
        userId: 'user-1',
        diagnosisRegistryId: 'registry-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.gameSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'completed',
          completedAt: { not: null },
        }) as unknown,
      }),
    );
  });

  it('returns 404 when completed session is for a different diagnosis', async () => {
    const { prisma, service } = buildService();
    prisma.gameSession.findFirst.mockResolvedValue(null);

    await expect(
      service.getPublishedForUser({
        userId: 'user-1',
        diagnosisRegistryId: 'registry-2',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.gameSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          case: {
            diagnosisRegistryId: 'registry-2',
          },
        }) as unknown,
      }),
    );
  });

  it('hides missing or unpublished education from players', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisEducation.findFirst.mockResolvedValue(null);

    await expect(
      service.getPublishedForUser({
        userId: 'user-1',
        diagnosisRegistryId: 'registry-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks publication when high-risk content has no references', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisEducation.findUnique.mockResolvedValue(
      buildEducation({
        editorialStatus: DiagnosisEducationStatus.APPROVED,
        management: ['Surgical consultation and supportive care.'],
        references: null,
      }),
    );

    await expect(
      service.reviewEducation(
        'education-1',
        { status: DiagnosisEducationStatus.PUBLISHED },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks publication when content contains dosing', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisEducation.findUnique.mockResolvedValue(
      buildEducation({
        editorialStatus: DiagnosisEducationStatus.APPROVED,
        management: ['Give 500 mg of medication.'],
        references: ['reviewed source'],
      }),
    );

    await expect(
      service.reviewEducation(
        'education-1',
        { status: DiagnosisEducationStatus.PUBLISHED },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps AI draft generation disabled unless explicitly enabled', async () => {
    const { service } = buildService();

    await expect(
      service.generateDraft('registry-1', 'admin-1'),
    ).rejects.toThrow('AI education generation is disabled');
  });

  it('fails safely when AI returns malformed JSON', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_EDUCATION_GENERATION_ENABLED = 'true';
    resetEnvCacheForTests();
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      buildRegistryForGeneration(),
    );
    prisma.diagnosisEducation.findUnique.mockResolvedValue(null);
    mockOpenAiDraft(service, '{"summary":');

    await expect(
      service.generateDraft('registry-1', 'admin-1'),
    ).rejects.toThrow('AI returned invalid education JSON');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails safely when AI returns malformed section shapes', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_EDUCATION_GENERATION_ENABLED = 'true';
    resetEnvCacheForTests();
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      buildRegistryForGeneration(),
    );
    prisma.diagnosisEducation.findUnique.mockResolvedValue(null);
    mockOpenAiDraft(
      service,
      JSON.stringify(
        buildValidGeneratedDraft({
          examPearls: ['Rovsing sign'],
        }),
      ),
    );

    await expect(
      service.generateDraft('registry-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a validated AI draft as needs-review content', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_EDUCATION_GENERATION_ENABLED = 'true';
    resetEnvCacheForTests();
    const { prisma, tx, service } = buildService();
    const savedEducation = buildEducation({
      editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
      source: DiagnosisEducationSource.AI_ASSISTED,
      reviewedAt: null,
      reviewedByUserId: null,
      publishedAt: null,
    });
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      buildRegistryForGeneration(),
    );
    prisma.diagnosisEducation.findUnique.mockResolvedValue(null);
    tx.diagnosisEducation.create.mockResolvedValue(savedEducation);
    mockOpenAiDraft(service, JSON.stringify(buildValidGeneratedDraft()));

    const result = await service.generateDraft('registry-1', 'admin-1');

    expect(tx.diagnosisEducation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosisRegistryId: 'registry-1',
          editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
          source: DiagnosisEducationSource.AI_ASSISTED,
          reviewedAt: null,
          reviewedByUserId: null,
          publishedAt: null,
          summary: {
            definition: 'Inflammation of the appendix.',
            highYieldTakeaway:
              'Migratory right lower quadrant pain is high-yield.',
          },
          examPearls: [
            {
              id: 'rovsing-sign',
              label: 'Rovsing sign',
              explanation:
                'Right lower quadrant pain with left lower quadrant palpation.',
            },
          ],
        }),
      }),
    );
    expect(result).toEqual(savedEducation);
  });

  it('requests the exact diagnosis education JSON schema from AI', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_EDUCATION_GENERATION_ENABLED = 'true';
    resetEnvCacheForTests();
    const { prisma, tx, service } = buildService();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      buildRegistryForGeneration(),
    );
    prisma.diagnosisEducation.findUnique.mockResolvedValue(null);
    tx.diagnosisEducation.create.mockResolvedValue(
      buildEducation({
        editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
        source: DiagnosisEducationSource.AI_ASSISTED,
        reviewedAt: null,
        reviewedByUserId: null,
        publishedAt: null,
      }),
    );
    const create = mockOpenAiDraft(
      service,
      JSON.stringify(buildValidGeneratedDraft()),
    );

    await service.generateDraft('registry-1', 'admin-1');

    const request = create.mock.calls[0][0] as {
      response_format: {
        type: string;
        json_schema?: { strict?: boolean; schema?: unknown };
      };
      messages: Array<{ role: string; content: string }>;
    };
    expect(request.response_format.type).toBe('json_schema');
    expect(request.response_format.json_schema?.strict).toBe(true);
    expect(request.messages[0].content).toContain(
      'Use clinicalPattern, not recognitionPattern.',
    );
    expect(request.messages[0].content).toContain(
      'Use differentials, not differentialDistinguishers.',
    );
    expect(request.messages[1].content).toContain('"clinicalPattern"');
    expect(request.messages[1].content).toContain('"differentials"');
    expect(request.messages[0].content).toContain('named signs');
    expect(request.messages[0].content).toContain(
      'differentials are not comparative',
    );
    expect(request.messages[0].content).toContain('pitfalls are vague');
    expect(request.messages[1].content).toContain('McBurney point tenderness');
    expect(request.messages[1].content).toContain('Rovsing sign');
    expect(request.messages[1].content).toContain('Psoas sign');
    expect(request.messages[1].content).toContain('Obturator sign');
    expect(request.messages[1].content).toContain('rebound');
    expect(request.messages[1].content).toContain('MANTRELS / Alvarado score');
    expect(request.messages[1].content).toContain(
      'Gastroenteritis usually has prominent diarrhea/vomiting',
    );
    expect(request.messages[1].content).toContain(
      'A normal white blood cell count does not exclude',
    );
    expect(request.messages[1].content).toContain('BMJ Best Practice');
  });

  it('normalizes safe legacy AI aliases before validation', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_EDUCATION_GENERATION_ENABLED = 'true';
    resetEnvCacheForTests();
    const { prisma, tx, service } = buildService();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      buildRegistryForGeneration(),
    );
    prisma.diagnosisEducation.findUnique.mockResolvedValue(null);
    tx.diagnosisEducation.create.mockResolvedValue(
      buildEducation({
        editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
        source: DiagnosisEducationSource.AI_ASSISTED,
        reviewedAt: null,
        reviewedByUserId: null,
        publishedAt: null,
      }),
    );
    mockOpenAiDraft(
      service,
      JSON.stringify({
        ...buildValidGeneratedDraft({
          summary: 'Inflammation of the appendix.',
          clinicalPattern: undefined,
          differentials: undefined,
        }),
        recognitionPattern: [
          'Periumbilical pain migrates to the right lower quadrant',
        ],
        differentialDistinguishers: [
          {
            id: 'gastroenteritis',
            diagnosis: 'Gastroenteritis',
            distinguishingPoint: 'Usually has diffuse cramps and diarrhea.',
          },
        ],
      }),
    );

    await service.generateDraft('registry-1', 'admin-1');

    expect(tx.diagnosisEducation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          summary: {
            definition: 'Inflammation of the appendix.',
          },
          clinicalPattern: [
            'Periumbilical pain migrates to the right lower quadrant',
          ],
          differentials: [
            {
              id: 'gastroenteritis',
              diagnosis: 'Gastroenteritis',
              distinguishingPoint: 'Usually has diffuse cramps and diarrhea.',
            },
          ],
        }),
      }),
    );
  });

  it('does not expose generated needs-review content to players', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisEducation.findFirst.mockResolvedValue(null);

    await expect(
      service.getPublishedForUser({
        userId: 'user-1',
        diagnosisRegistryId: 'registry-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.diagnosisEducation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editorialStatus: DiagnosisEducationStatus.PUBLISHED,
        }) as unknown,
      }),
    );
  });

  it('does not overwrite published education with an AI draft', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_EDUCATION_GENERATION_ENABLED = 'true';
    resetEnvCacheForTests();
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      buildRegistryForGeneration(),
    );
    prisma.diagnosisEducation.findUnique.mockResolvedValue(
      buildEducation({
        editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      }),
    );
    const create = mockOpenAiDraft(
      service,
      JSON.stringify(buildValidGeneratedDraft()),
    );

    await expect(
      service.generateDraft('registry-1', 'admin-1'),
    ).rejects.toThrow(
      'Cannot generate over published education. Archive or create draft manually first.',
    );
    expect(create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
