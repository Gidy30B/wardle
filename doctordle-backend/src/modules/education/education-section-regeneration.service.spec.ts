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

  it('regenerates investigations as a section candidate only', async () => {
    const education = buildEducation();
    const { service, tx, create, candidateService } = buildService(education, {
      investigations: buildSection('INVESTIGATION', 'ketones'),
    });

    await service.regenerateSection({
      diagnosisRegistryId: 'registry-1',
      section: 'investigations',
      expectedVersion: 3,
      userId: 'admin-1',
    });

    expect(create).toHaveBeenCalled();
    expect(candidateService.createSectionCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnosisRegistryId: 'registry-1',
        education,
        section: 'investigations',
        proposedSection: expect.arrayContaining([
            expect.objectContaining({ id: 'ketones-1' }),
        ]),
        createdByUserId: 'admin-1',
      }),
    );
    expect(tx.diagnosisEducation.updateMany).not.toHaveBeenCalled();
    expect(tx.diagnosisEducationRevision.create).not.toHaveBeenCalled();
  });

  it('regenerates exam pearls without changing management', async () => {
    const education = buildEducation();
    const { service, tx, candidateService } = buildService(education, {
      examPearls: buildSection('EXAM', 'rovsing'),
    });

    await service.regenerateSection({
      diagnosisRegistryId: 'registry-1',
      section: 'examPearls',
      expectedVersion: 3,
      userId: 'admin-1',
    });

    expect(candidateService.createSectionCandidate.mock.calls[0][0].proposedSection).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'rovsing-1' })]),
    );
    expect(tx.diagnosisEducation.updateMany).not.toHaveBeenCalled();
  });

  it('sends section-specific canonical field contracts in regeneration prompts', async () => {
    const education = buildEducation();
    const investigation = buildService(education, {
      investigations: buildSection('INVESTIGATION', 'ketones'),
    });
    const exam = buildService(education, {
      examPearls: buildSection('EXAM', 'rovsing'),
    });

    await investigation.service.regenerateSection({
      diagnosisRegistryId: 'registry-1',
      section: 'investigations',
      expectedVersion: 3,
      userId: 'admin-1',
    });
    await exam.service.regenerateSection({
      diagnosisRegistryId: 'registry-1',
      section: 'examPearls',
      expectedVersion: 3,
      userId: 'admin-1',
    });

    expect(requestUserPayload(investigation.create)).toEqual(
      expect.objectContaining({
        repairSpecification: expect.objectContaining({
          section: 'investigations',
          mustNotLose: expect.any(Array),
        }),
        sectionInstruction: expect.stringContaining('expected finding/result'),
        constraints: expect.arrayContaining([
          expect.stringContaining('changes diagnostic reasoning'),
          expect.stringContaining('Do not lose concepts listed in repairSpecification.mustNotLose'),
        ]),
      }),
    );
    expect(requestUserPayload(exam.create)).toEqual(
      expect.objectContaining({
        sectionInstruction: expect.stringContaining('mechanism explaining why'),
        constraints: expect.arrayContaining([
          expect.stringContaining('diagnostic probability'),
        ]),
      }),
    );
  });

  it('stores published education as the exact candidate base version', async () => {
    const education = buildEducation({
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      publishedAt: new Date('2026-05-01T00:00:00.000Z'),
    });
    const { service, tx, candidateService } = buildService(education, {
      management: buildSection('MANAGEMENT', 'consult'),
    });

    await service.regenerateSection({
      diagnosisRegistryId: 'registry-1',
      section: 'management',
      expectedVersion: 3,
      userId: 'admin-1',
    });

    expect(candidateService.createSectionCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        education,
        section: 'management',
      }),
    );
    expect(tx.diagnosisEducation.updateMany).not.toHaveBeenCalled();
    expect(tx.diagnosisEducationRevision.create).not.toHaveBeenCalled();
  });

  it('does not invalidate approved education when creating a candidate', async () => {
    const education = buildEducation({
      editorialStatus: DiagnosisEducationStatus.APPROVED,
      reviewedAt: new Date('2026-05-01T00:00:00.000Z'),
      reviewedByUserId: 'senior-1',
    });
    const { service, tx, candidateService } = buildService(education, {
      differentials: buildSection('HIGH_YIELD_DISCRIMINATOR', 'mimic'),
    });

    await service.regenerateSection({
      diagnosisRegistryId: 'registry-1',
      section: 'differentials',
      expectedVersion: 3,
      userId: 'admin-1',
    });

    expect(candidateService.createSectionCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        education,
        section: 'differentials',
      }),
    );
    expect(tx.diagnosisEducation.updateMany).not.toHaveBeenCalled();
  });

  it('stores coverage regression findings when regeneration drops meaningful management concepts', async () => {
    const education = buildEducation({
      management: cerebralPalsyManagementCurrent(),
    });
    const { service, candidateService } = buildService(
      education,
      {
        management: cerebralPalsyManagementWithoutLongitudinalCoverage(),
      },
      {
        displayLabel: 'Cerebral Palsy',
        canonicalName: 'cerebral_palsy',
        specialty: 'Neurology',
        category: 'Neurodevelopmental',
        bodySystem: 'Neurologic',
      },
    );

    await service.regenerateSection({
      diagnosisRegistryId: 'registry-1',
      section: 'management',
      expectedVersion: 3,
      userId: 'admin-1',
    });

    const candidateInput = candidateService.createSectionCandidate.mock.calls[0][0];
    expect(candidateInput.validation.blockers).toEqual(
      expect.arrayContaining([
        'coverage_regression',
        'coverage_regression_management',
      ]),
    );
    expect(candidateInput.validation.metadata.coverageComparison).toEqual(
      expect.objectContaining({
        coverageRegression: true,
        coverageRegressionConcepts: expect.arrayContaining([
          expect.objectContaining({ label: 'Orthopaedic surveillance' }),
          expect.objectContaining({ label: 'Family and long-term planning' }),
        ]),
      }),
    );
    expect(candidateInput.inputContext.repairSpecification).toEqual(
      expect.objectContaining({
        section: 'management',
        baseVersion: 3,
        maxItems: expect.any(Number),
      }),
    );
  });

  it('rejects stale section regeneration before calling OpenAI', async () => {
    const education = buildEducation({ version: 3 });
    const { service, tx, create } = buildService(education, {
      investigations: buildSection('INVESTIGATION', 'ketones'),
    });

    await expect(
      service.regenerateSection({
        diagnosisRegistryId: 'registry-1',
        section: 'investigations',
        expectedVersion: 2,
        userId: 'admin-1',
      }),
    ).rejects.toThrow('Education changed since this view was loaded');

    expect(create).not.toHaveBeenCalled();
    expect(tx.diagnosisEducation.updateMany).not.toHaveBeenCalled();
  });
});

function buildService(
  education: ReturnType<typeof buildEducation>,
  response: Record<string, unknown>,
  registryOverrides: Record<string, unknown> = {},
) {
  const tx = {
    diagnosisEducation: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockImplementation(async () => ({
        ...education,
        version: education.version + 1,
        editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
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
        ...registryOverrides,
      }),
    },
    $transaction: jest.fn(
      async (handler: (transaction: typeof tx) => Promise<unknown>) =>
        handler(tx),
    ),
  };
  const candidate = {
    id: 'candidate-1',
    diagnosisRegistryId: 'registry-1',
    educationId: education.id,
    reviewStatus: 'PENDING_REVIEW',
  };
  const candidateService = {
    createSectionCandidate: jest.fn().mockResolvedValue(candidate),
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
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    candidateService as never,
  );
  const create = jest.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(response) } }],
  });
  (
    service as unknown as {
      openaiClient: { chat: { completions: { create: typeof create } } };
    }
  ).openaiClient = { chat: { completions: { create } } };

  return { service, tx, create, candidateService, candidate };
}

function requestUserPayload(create: jest.Mock) {
  const request = create.mock.calls[0][0];
  const userMessage = request.messages.find(
    (message: { role: string }) => message.role === 'user',
  );
  return JSON.parse(userMessage.content);
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

function cerebralPalsyManagementCurrent() {
  return [
    managementPearl(
      'multidisciplinary-diagnosis',
      'Multidisciplinary diagnosis and GMFCS classification',
      'Use multidisciplinary diagnosis and gross motor function classification to define severity, functional goals, and communication needs.',
    ),
    managementPearl(
      'therapy',
      'Physiotherapy and occupational therapy',
      'Start physiotherapy and occupational therapy to preserve range, strengthen function, support equipment needs, and reduce contractures.',
    ),
    managementPearl(
      'spasticity',
      'Spasticity management',
      'Treat spasticity when tone limits hygiene, comfort, sleep, or function, escalating from therapy to medicines or focal treatment.',
    ),
    managementPearl(
      'comorbidity',
      'Comorbidity screening',
      'Screen for seizures, feeding difficulty, nutrition, pain, sleep, vision, hearing, and communication comorbidities during follow-up.',
    ),
    managementPearl(
      'orthopaedic-surveillance',
      'Orthopaedic surveillance',
      'Maintain orthopaedic surveillance for hip displacement, scoliosis, gait deterioration, and contractures because mobility can worsen silently.',
    ),
    managementPearl(
      'family-planning',
      'Family and long-term planning',
      'Include family goals, school support, equipment, transition planning, and respite needs in the long-term care plan.',
    ),
  ];
}

function cerebralPalsyManagementWithoutLongitudinalCoverage() {
  return [
    managementPearl(
      'diagnosis',
      'Multidisciplinary diagnosis and GMFCS classification',
      'Coordinate multidisciplinary diagnosis with gross motor function classification to set severity, function, and communication goals.',
    ),
    managementPearl(
      'therapy',
      'Physiotherapy and occupational therapy',
      'Use physiotherapy and occupational therapy when motor impairment limits function, range, equipment use, or participation.',
    ),
    managementPearl(
      'spasticity',
      'Spasticity management',
      'Treat spasticity when tone causes pain, hygiene difficulty, sleep disruption, or function loss.',
    ),
    managementPearl(
      'comorbidity',
      'Comorbidity screening',
      'Screen for seizures, feeding difficulty, nutrition, sleep, pain, vision, hearing, and communication comorbidities.',
    ),
  ];
}

function managementPearl(id: string, title: string, content: string) {
  return {
    id,
    type: 'MANAGEMENT',
    title,
    content,
    whyItMatters:
      'This changes operational planning because specific management anchors shape follow-up.',
    discriminator: 'Specific management anchor rather than generic supportive care.',
    managementImplication:
      'Use this anchor to guide monitoring, escalation, therapy, or family planning.',
    escalationImplication:
      'Delayed recognition can weaken longitudinal function or care coordination.',
    trapAvoided: 'Avoid replacing specific management with generic advice.',
  };
}
