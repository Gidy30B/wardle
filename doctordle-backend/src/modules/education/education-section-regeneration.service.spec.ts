import {
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
} from '@prisma/client';
import { resetEnvCacheForTests } from '../../core/config/env.validation';
import { EducationSectionRegenerationService } from './education-section-regeneration.service';

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

describe('EducationSectionRegenerationService', () => {
  beforeEach(() => {
    Object.entries(requiredEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
    process.env.OPENAI_API_KEY = 'test-key';
    resetEnvCacheForTests();
  });

  it('regenerates investigations only and creates a new revision', async () => {
    const education = buildEducation();
    const { service, tx, create } = buildService(education, {
      investigations: buildSection('INVESTIGATION', 'ketones'),
    });

    await service.regenerateSection({
      diagnosisRegistryId: 'registry-1',
      section: 'investigations',
      userId: 'admin-1',
    });

    expect(create).toHaveBeenCalled();
    expect(tx.diagnosisEducation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'education-1' },
        data: expect.objectContaining({
          investigations: expect.arrayContaining([
            expect.objectContaining({ id: 'ketones-1' }),
          ]),
          editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
          version: { increment: 1 },
        }),
      }),
    );
    expect(tx.diagnosisEducation.update.mock.calls[0][0].data.management).toBeUndefined();
    expect(tx.diagnosisEducationRevision.create).toHaveBeenCalledTimes(2);
  });

  it('regenerates exam pearls without changing management', async () => {
    const education = buildEducation();
    const { service, tx } = buildService(education, {
      examPearls: buildSection('EXAM', 'rovsing'),
    });

    await service.regenerateSection({
      diagnosisRegistryId: 'registry-1',
      section: 'examPearls',
      userId: 'admin-1',
    });

    expect(tx.diagnosisEducation.update.mock.calls[0][0].data.examPearls).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'rovsing-1' })]),
    );
    expect(tx.diagnosisEducation.update.mock.calls[0][0].data.management).toBeUndefined();
  });

  it('preserves published education by snapshotting before update', async () => {
    const education = buildEducation({
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      publishedAt: new Date('2026-05-01T00:00:00.000Z'),
    });
    const { service, tx } = buildService(education, {
      management: buildSection('MANAGEMENT', 'consult'),
    });

    await service.regenerateSection({
      diagnosisRegistryId: 'registry-1',
      section: 'management',
      userId: 'admin-1',
    });

    expect(tx.diagnosisEducationRevision.findUnique).toHaveBeenCalledWith({
      where: {
        educationId_version: {
          educationId: 'education-1',
          version: 3,
        },
      },
    });
    expect(tx.diagnosisEducation.update.mock.calls[0][0].data.publishedAt).toBeNull();
    expect(tx.diagnosisEducationRevision.create).toHaveBeenCalledTimes(2);
  });
});

function buildService(
  education: ReturnType<typeof buildEducation>,
  response: Record<string, unknown>,
) {
  const tx = {
    diagnosisEducation: {
      update: jest.fn().mockImplementation(async ({ data }) => ({
        ...education,
        ...data,
        version: education.version + 1,
        editorialStatus: data.editorialStatus,
        publishedAt: data.publishedAt ?? education.publishedAt,
      })),
    },
    diagnosisEducationRevision: {
      findUnique: jest.fn().mockResolvedValue(null),
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
        difficultyBand: 'BASIC',
        aliases: [{ term: 'Acute appendicitis' }],
        education,
      }),
    },
    $transaction: jest.fn(
      async (handler: (transaction: typeof tx) => Promise<unknown>) =>
        handler(tx),
    ),
  };
  const generationContextBuilder = {
    build: jest.fn().mockResolvedValue({
      diagnosis: { id: 'registry-1', displayLabel: 'Appendicitis' },
      conciseClinicalContext: 'Appendicitis',
      learningGoals: [],
      requiredTeachingUnits: [],
      mustInclude: ['Rovsing sign'],
      scoringSystems: ['Alvarado score'],
      investigations: ['CBC', 'CT abdomen'],
      mimics: [{ diagnosis: 'gastroenteritis' }],
      discriminators: [],
      pitfalls: ['normal early WBC'],
      managementAnchors: ['surgical consultation'],
    }),
  };
  const service = new EducationSectionRegenerationService(
    prisma as never,
    generationContextBuilder as never,
  );
  const create = jest.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(response) } }],
  });
  (
    service as unknown as {
      openaiClient: { chat: { completions: { create: typeof create } } };
    }
  ).openaiClient = { chat: { completions: { create } } };

  return { service, tx, create };
}

function buildEducation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'education-1',
    diagnosisRegistryId: 'registry-1',
    title: 'Appendicitis',
    summary: {
      definition: 'Appendicitis.',
      highYieldTakeaway: 'Use discriminators.',
    },
    clinicalPattern: [],
    keySymptoms: [],
    keySigns: [],
    examPearls: buildSection('EXAM', 'existing-exam'),
    scoringSystems: [],
    investigations: buildSection('INVESTIGATION', 'existing-investigation'),
    differentials: buildSection('HIGH_YIELD_DISCRIMINATOR', 'existing-mimic'),
    management: buildSection('MANAGEMENT', 'existing-management'),
    complications: [],
    pitfalls: [],
    recallPrompts: [],
    references: ['source'],
    editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
    source: DiagnosisEducationSource.AI_ASSISTED,
    version: 3,
    generatedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    publishedAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildSection(type: string, prefix: string) {
  return [1, 2, 3].map((index) => ({
    id: `${prefix}-${index}`,
    type,
    title: `${prefix} ${index}`,
    content:
      'Both conditions can overlap early, but this item names a specific discriminator because mechanism and consequence matter clinically.',
    whyItMatters:
      'The interpretation supports diagnosis and changes escalation rather than listing a generic fact.',
    discriminator:
      'Specific focal discriminator rather than diffuse nonspecific symptoms.',
    managementImplication:
      'Use this item to guide consultation, testing, or reassessment.',
    escalationImplication:
      'Delay can worsen risk when the discriminator is ignored.',
    trapAvoided:
      'Avoid anchoring on the shared early presentation.',
  }));
}
