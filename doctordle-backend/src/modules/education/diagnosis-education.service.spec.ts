import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
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
    examPearls: [
      { label: 'Rovsing sign', explanation: 'RLQ pain with LLQ palpation.' },
    ],
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
        clues: [
          { type: 'history', value: 'Periumbilical pain migrated to RLQ' },
          { type: 'exam', value: 'Rovsing sign is present' },
          { type: 'lab', value: 'Mild leukocytosis' },
          { type: 'imaging', value: 'RAW_FOURTH_CLUE_SHOULD_NOT_BE_SENT' },
        ],
        explanation: {
          summary: 'Migratory right lower quadrant pain.',
          rawNarrative:
            'FULL_RAW_CASE_PAYLOAD_SHOULD_NOT_BE_SENT because it is too large.',
          differentialAnalysis: [
            {
              diagnosis: 'Gastroenteritis',
              whyPlausibleEarly:
                'Early abdominal pain and nausea overlap with gastroenteritis.',
              ruledOutByClues: [
                {
                  clueOrder: 2,
                  evidence: 'Rovsing sign is present',
                  reason:
                    'Peritoneal irritation favors appendicitis over gastroenteritis.',
                },
              ],
              finalReasonLessLikely:
                'Localized peritoneal signs argue against gastroenteritis.',
            },
          ],
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
    clinicalPattern: [
      {
        pattern: 'Periumbilical pain migrates to the right lower quadrant',
        whyItMatters:
          'Migration favors appendicitis because pain localizes as inflammation reaches the parietal peritoneum.',
        progression: 'Visceral periumbilical pain precedes localized RLQ pain.',
        commonTrap: 'Diffuse early pain can be mistaken for gastroenteritis.',
      },
      {
        pattern: 'Anorexia and nausea accompany progressive focal tenderness',
        whyItMatters:
          'This combination supports intra-abdominal inflammation over isolated indigestion.',
        progression: 'Systemic symptoms often follow pain onset.',
        commonTrap: 'Vomiting before pain should broaden the differential.',
      },
      {
        pattern: 'Atypical appendix position shifts the pain map',
        whyItMatters:
          'Retrocecal or pelvic location can lower suspicion if clinicians expect only classic McBurney pain.',
        progression: 'Tenderness may evolve outside the classic RLQ focus.',
        commonTrap: 'Urinary or flank symptoms can distract from appendicitis.',
      },
    ],
    keySymptoms: [
      {
        finding: 'Anorexia',
        whyItMatters:
          'Anorexia supports appendicitis when paired with migratory focal pain.',
        diagnosticImpact: 'Increases suspicion for appendiceal inflammation.',
        discriminator: 'Less typical of isolated renal colic.',
      },
      {
        finding: 'Nausea after pain onset',
        whyItMatters:
          'Pain preceding vomiting favors surgical abdominal pathology over primary gastroenteritis.',
        diagnosticImpact: 'Supports appendicitis pattern.',
        discriminator: 'Gastroenteritis often has early vomiting or diarrhea.',
      },
      {
        finding: 'Progressive focal pain',
        whyItMatters:
          'Progression toward localized tenderness argues against transient cramps.',
        diagnosticImpact: 'Raises suspicion for peritoneal irritation.',
        discriminator: 'Diffuse cramping favors gastroenteritis.',
      },
    ],
    keySigns: [
      {
        finding: 'McBurney point tenderness',
        whyItMatters:
          'Focal RLQ tenderness supports local appendiceal irritation.',
        diagnosticImpact: 'Raises suspicion for appendicitis.',
        discriminator: 'Diffuse tenderness is less specific.',
      },
      {
        finding: 'Rebound or guarding',
        whyItMatters:
          'Peritoneal signs suggest advanced inflammation or perforation risk.',
        diagnosticImpact: 'Increases urgency.',
        discriminator:
          'Simple gastroenteritis should not cause focal peritonism.',
      },
      {
        finding: 'Rovsing sign',
        whyItMatters:
          'Contralateral palpation causing RLQ pain supports peritoneal irritation.',
        diagnosticImpact: 'Supports appendicitis.',
        discriminator:
          'Functional pain is less likely to produce this pattern.',
      },
    ],
    examPearls: [
      {
        id: 'rovsing-sign',
        label: 'Rovsing sign',
        explanation:
          'Right lower quadrant pain with left lower quadrant palpation.',
        whyItMatters:
          'It supports peritoneal irritation and helps distinguish appendicitis from diffuse gastroenteritis.',
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
    investigations: [
      {
        test: 'CBC',
        significance:
          'Leukocytosis supports inflammation but does not rule appendicitis in or out alone.',
        interpretation: 'A left shift increases suspicion when the story fits.',
        discriminator:
          'Normal WBC should not override progressive focal RLQ findings.',
      },
      {
        test: 'Ultrasound',
        significance:
          'Useful first-line imaging in children and pregnancy because it can show a noncompressible appendix without radiation.',
        interpretation:
          'Positive imaging supports appendicitis; nondiagnostic imaging may need escalation.',
        discriminator: 'Ovarian or urinary mimics may also be assessed.',
      },
      {
        test: 'CT abdomen/pelvis',
        significance:
          'High diagnostic yield in adults when diagnosis is uncertain or complications are suspected.',
        interpretation:
          'Appendiceal enlargement or periappendiceal inflammation supports diagnosis.',
        discriminator:
          'Can reveal diverticulitis, stone, abscess, or malignancy mimics.',
      },
    ],
    differentials: [
      {
        id: 'gastroenteritis',
        diagnosis: 'Gastroenteritis',
        whyConfused:
          'Both can cause abdominal pain, nausea, and low-grade fever.',
        distinguishingPoint:
          'Prominent diarrhea and diffuse crampy pain favor gastroenteritis, while progressive focal RLQ tenderness favors appendicitis.',
        keySeparator: 'Localization and peritoneal signs.',
        classicTrap:
          'Assuming early appendicitis is viral gastroenteritis before pain localizes.',
      },
    ],
    management: [
      {
        step: 'Early surgical assessment',
        rationale:
          'Definitive management planning matters because delayed recognition increases perforation risk.',
        urgency:
          'Urgent when peritoneal signs, sepsis, or perforation concern is present.',
      },
      {
        step: 'Supportive care while evaluating',
        rationale:
          'Fluids, analgesia, and antiemetics stabilize the learner-level management frame without replacing diagnosis.',
        urgency: 'Prompt in dehydrated or systemically unwell patients.',
      },
      {
        step: 'Imaging-directed confirmation when uncertain',
        rationale:
          'Imaging helps separate appendicitis from gynecologic, urinary, and bowel mimics.',
        urgency: 'Do not delay escalation when peritonitis is present.',
      },
    ],
    complications: ['Perforation', 'Abscess'],
    pitfalls: [
      {
        pitfall: 'Normal WBC false reassurance',
        whyItHappens:
          'Early appendicitis may not yet have strong lab abnormalities.',
        consequence: 'Delayed diagnosis can increase perforation risk.',
        saferHeuristic:
          'Prioritize progression and focal peritoneal findings over a single normal lab.',
      },
      {
        pitfall: 'Pelvic or retrocecal appendix anatomy',
        whyItHappens: 'Position changes the site of irritation.',
        consequence: 'Pain may appear suprapubic, flank, or back-predominant.',
        saferHeuristic:
          'Use psoas, obturator, and serial exams when localization is atypical.',
      },
      {
        pitfall: 'Transient pain improvement after perforation',
        whyItHappens: 'Pressure can briefly decompress after rupture.',
        consequence: 'False reassurance may delay treatment of peritonitis.',
        saferHeuristic:
          'Reassess vitals and peritoneal signs when symptoms change suddenly.',
      },
    ],
    recallPrompts: [
      {
        id: 'appendicitis-pattern',
        type: 'WHY_IT_MATTERS',
        prompt:
          'Why does periumbilical pain migrating to the RLQ increase suspicion for appendicitis?',
        answer:
          'It reflects progression from visceral to parietal peritoneal irritation, making appendicitis more likely than nonspecific gastroenteritis.',
        explanation:
          'The temporal pain shift is a diagnostic reasoning anchor, not just a symptom.',
        linkedConcept: 'migratory pain',
        sourceSection: 'clinicalPattern',
        difficulty: 'BASIC',
      },
      {
        id: 'appendicitis-vs-gastroenteritis',
        type: 'DISTINGUISH',
        prompt: 'What pattern favors appendicitis over gastroenteritis?',
        answer:
          'Progressive localized RLQ tenderness and peritoneal signs favor appendicitis over diffuse cramps with prominent diarrhea.',
        explanation: 'The key is localization and peritoneal irritation.',
        linkedConcept: 'appendicitis vs gastroenteritis',
        sourceSection: 'differentials',
        difficulty: 'BASIC',
      },
      {
        id: 'appendicitis-rovsing-recall',
        type: 'PEARL_RECALL',
        prompt: 'What does Rovsing sign suggest?',
        answer:
          'Right lower quadrant pain with left lower quadrant palpation suggests peritoneal irritation.',
        explanation: 'It is an exam-based clue toward appendicitis.',
        linkedConcept: 'Rovsing sign',
        sourceSection: 'examPearls',
        difficulty: 'BASIC',
      },
    ],
    references: ['Editorial review required before publication.'],
    ...overrides,
  };
}

function buildTypedPearl(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dka-kussmaul-respirations',
    type: 'EXAM',
    title: 'Kussmaul respirations',
    content:
      'Deep, labored respirations support clinically significant metabolic acidosis rather than uncomplicated hyperglycemia.',
    whyItMatters:
      'This shifts concern toward advanced DKA physiology and need for close monitoring.',
    discriminator:
      'Favors ketoacidosis over isolated hyperglycemia or anxiety-related tachypnea.',
    managementImplication:
      'Prompts electrolyte-aware DKA management rather than simple glucose correction.',
    escalationImplication:
      'Raises concern for monitored care when paired with altered mentation or profound acidemia.',
    trapAvoided:
      'Avoids dismissing compensatory respiratory effort as nonspecific shortness of breath.',
    ...overrides,
  };
}

function assertStrictOpenAiSchema(schema: unknown, path = 'root') {
  if (!schema || typeof schema !== 'object') {
    return;
  }

  const record = schema as Record<string, unknown>;
  if (record.type === 'object' || record.properties) {
    const properties = (record.properties ?? {}) as Record<string, unknown>;
    const keys = Object.keys(properties);

    expect(record.additionalProperties).toBe(false);
    expect(Array.isArray(record.required)).toBe(true);

    for (const key of keys) {
      expect(record.required as string[]).toContain(key);
      assertStrictOpenAiSchema(properties[key], `${path}.${key}`);
    }
  }

  if (record.type === 'array' && record.items) {
    assertStrictOpenAiSchema(record.items, `${path}[]`);
  }

  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    const children = record[key];
    if (Array.isArray(children)) {
      children.forEach((child, index) =>
        assertStrictOpenAiSchema(child, `${path}.${key}[${index}]`),
      );
    }
  }
}

function setMockOpenAiCreate(
  service: DiagnosisEducationService,
  create: jest.Mock,
) {
  Object.defineProperty(service, 'openaiClient', {
    value: {
      chat: {
        completions: {
          create,
        },
      },
    },
  });
}

function mockOpenAiDraft(service: DiagnosisEducationService, payload: string) {
  const create = jest.fn().mockResolvedValue({
    choices: [{ message: { content: payload } }],
  });

  setMockOpenAiCreate(service, create);

  return create;
}

function mockOpenAiError(overrides: Record<string, unknown> = {}) {
  return Object.assign(new Error('Connection error'), {
    name: 'APIConnectionError',
    requestID: 'req_test_123',
    cause: Object.assign(new Error('other side closed'), {
      code: 'UND_ERR_SOCKET',
    }),
    ...overrides,
  });
}

function mockRetryDelay(service: DiagnosisEducationService) {
  return jest
    .spyOn(
      service as unknown as {
        waitForOpenAiRetry: (delayMs: number) => Promise<void>;
      },
      'waitForOpenAiRetry',
    )
    .mockResolvedValue(undefined);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function buildService(overrides: { generationContextBuilder?: unknown } = {}) {
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
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      create: jest.fn(),
    },
    gameSession: {
      findFirst: jest.fn().mockResolvedValue({ id: 'session-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(
      async (handler: (transaction: typeof tx) => Promise<unknown>) =>
        handler(tx),
    ),
  };

  return {
    prisma,
    tx,
    service: new DiagnosisEducationService(
      prisma as never,
      undefined,
      undefined,
      undefined,
      overrides.generationContextBuilder as never,
    ),
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
    expect(result).not.toHaveProperty('qualityWarnings');
  });

  it('returns admin-only quality warnings for review visibility', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisEducation.findUnique.mockResolvedValue(
      buildEducation({
        clinicalPattern: ['Patients may present with a variety of symptoms.'],
        differentials: ['Gastroenteritis may present with abdominal pain.'],
        recallPrompts: [
          {
            id: 'trivia',
            type: 'SHORT_ANSWER',
            prompt: 'What is appendicitis?',
            answer: 'Appendix inflammation.',
            sourceSection: 'summary',
            difficulty: 'BASIC',
          },
        ],
      }),
    );

    const result = await service.getAdminByDiagnosisRegistryId('registry-1');

    expect(result).toEqual(
      expect.objectContaining({
        education: expect.objectContaining({
          id: 'education-1',
        }) as unknown,
        qualityWarnings: expect.arrayContaining([
          'generic_filler_phrases_detected',
          'missing_structured_why_layer',
          'missing_comparative_differential_reasoning',
          'missing_why_it_matters_recall_prompt',
        ]) as unknown,
        publishBlockers: expect.any(Array) as unknown,
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

  it('makes published education visible to players immediately after review publish', async () => {
    const { prisma, tx, service } = buildService();
    let education = buildEducation({
      editorialStatus: DiagnosisEducationStatus.APPROVED,
      publishedAt: null,
      references: ['reviewed source'],
    });
    prisma.diagnosisEducation.findUnique.mockImplementation(
      async () => education,
    );
    tx.diagnosisEducation.update.mockImplementation(async ({ data }) => {
      education = {
        ...education,
        editorialStatus: data.editorialStatus,
        reviewedAt: data.reviewedAt,
        reviewedByUserId: data.reviewedByUserId,
        publishedAt: data.publishedAt,
        version: education.version + 1,
      };
      return education;
    });
    prisma.diagnosisEducation.findFirst.mockImplementation(async () =>
      education.editorialStatus === DiagnosisEducationStatus.PUBLISHED
        ? {
            ...education,
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
          }
        : null,
    );

    await service.reviewEducation(
      'education-1',
      { status: DiagnosisEducationStatus.PUBLISHED },
      'admin-1',
    );

    const result = await service.getPublishedForUser({
      userId: 'user-1',
      diagnosisRegistryId: 'registry-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        diagnosisRegistryId: 'registry-1',
        title: 'Appendicitis',
      }),
    );
    expect(prisma.diagnosisEducation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        where: {
          diagnosisRegistryId: 'registry-1',
          editorialStatus: DiagnosisEducationStatus.PUBLISHED,
        },
      }),
    );
  });

  it('logs structured diagnostics when public education is still unavailable', async () => {
    const { prisma, service } = buildService();
    prisma.gameSession.findFirst.mockResolvedValue(null);
    prisma.diagnosisEducation.findMany.mockResolvedValue([
      buildEducation({
        editorialStatus: DiagnosisEducationStatus.APPROVED,
        publishedAt: null,
      }),
    ]);
    prisma.gameSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        caseId: 'case-1',
        status: 'active',
        completedAt: null,
        startedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.getPublishedForUser({
        userId: 'user-1',
        diagnosisRegistryId: 'registry-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.diagnosisEducation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { diagnosisRegistryId: 'registry-1' },
        select: expect.objectContaining({
          editorialStatus: true,
          publishedAt: true,
          reviewedAt: true,
        }) as unknown,
      }),
    );
    expect(prisma.gameSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          case: { diagnosisRegistryId: 'registry-1' },
        }) as unknown,
      }),
    );
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
          examPearls: [{ id: 'rovsing-sign', label: 'Rovsing sign' }],
        }),
      ),
    );

    await expect(
      service.generateDraft('registry-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns conflict for concurrent same-diagnosis generation', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_EDUCATION_GENERATION_ENABLED = 'true';
    resetEnvCacheForTests();
    const { prisma, tx, service } = buildService();
    const registryLookup =
      deferred<ReturnType<typeof buildRegistryForGeneration>>();
    prisma.diagnosisRegistry.findUnique.mockReturnValue(registryLookup.promise);
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
    mockOpenAiDraft(service, JSON.stringify(buildValidGeneratedDraft()));

    const firstGeneration = service.generateDraft('registry-1', 'admin-1');
    await expect(
      service.generateDraft('registry-1', 'admin-2'),
    ).rejects.toBeInstanceOf(ConflictException);

    registryLookup.resolve(buildRegistryForGeneration());
    await firstGeneration;
  });

  it('releases the same-diagnosis generation lock after success', async () => {
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
    await service.generateDraft('registry-1', 'admin-1');

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('releases the same-diagnosis generation lock after failure', async () => {
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
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"summary":' } }],
      })
      .mockResolvedValueOnce({
        choices: [
          { message: { content: JSON.stringify(buildValidGeneratedDraft()) } },
        ],
      });
    setMockOpenAiCreate(service, create);

    await expect(
      service.generateDraft('registry-1', 'admin-1'),
    ).rejects.toThrow('AI returned invalid education JSON');
    await service.generateDraft('registry-1', 'admin-1');

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('retries connection-level AI generation failure then succeeds', async () => {
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
    const create = jest
      .fn()
      .mockRejectedValueOnce(mockOpenAiError())
      .mockResolvedValueOnce({
        choices: [
          { message: { content: JSON.stringify(buildValidGeneratedDraft()) } },
        ],
      });
    setMockOpenAiCreate(service, create);
    const retryDelay = mockRetryDelay(service);

    const result = await service.generateDraft('registry-1', 'admin-1');

    expect(result).toEqual(savedEducation);
    expect(create).toHaveBeenCalledTimes(2);
    expect(retryDelay).toHaveBeenCalledWith(500);
  });

  it('returns 503 after persistent connection-level AI generation failures', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_EDUCATION_GENERATION_ENABLED = 'true';
    resetEnvCacheForTests();
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      buildRegistryForGeneration(),
    );
    prisma.diagnosisEducation.findUnique.mockResolvedValue(null);
    const create = jest.fn().mockRejectedValue(mockOpenAiError());
    setMockOpenAiCreate(service, create);
    const retryDelay = mockRetryDelay(service);

    await expect(
      service.generateDraft('registry-1', 'admin-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(create).toHaveBeenCalledTimes(2);
    expect(retryDelay).toHaveBeenNthCalledWith(1, 500);
    expect(retryDelay).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1]).toEqual(
      expect.objectContaining({ maxRetries: 0, timeout: 45_000 }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not retry OpenAI invalid request errors', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_EDUCATION_GENERATION_ENABLED = 'true';
    resetEnvCacheForTests();
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      buildRegistryForGeneration(),
    );
    prisma.diagnosisEducation.findUnique.mockResolvedValue(null);
    const invalidRequestError = Object.assign(new Error('Invalid schema'), {
      name: 'BadRequestError',
      status: 400,
      requestID: 'req_bad_schema',
    });
    const create = jest.fn().mockRejectedValue(invalidRequestError);
    setMockOpenAiCreate(service, create);
    const retryDelay = mockRetryDelay(service);

    await expect(service.generateDraft('registry-1', 'admin-1')).rejects.toBe(
      invalidRequestError,
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(retryDelay).not.toHaveBeenCalled();
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
              whyItMatters:
                'It supports peritoneal irritation and helps distinguish appendicitis from diffuse gastroenteritis.',
            },
          ],
        }),
      }),
    );
    expect(result).toEqual(savedEducation);
  });

  it('normalizes typed generated pearls with critique metadata', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_EDUCATION_GENERATION_ENABLED = 'true';
    resetEnvCacheForTests();
    const { prisma, tx, service } = buildService();
    const typedPearl = buildTypedPearl();
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
      JSON.stringify(
        buildValidGeneratedDraft({
          examPearls: [typedPearl],
        }),
      ),
    );

    await service.generateDraft('registry-1', 'admin-1');

    expect(tx.diagnosisEducation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          examPearls: [
            expect.objectContaining({
              id: 'dka-kussmaul-respirations',
              type: 'EXAM',
              title: 'Kussmaul respirations',
              content:
                'Deep, labored respirations support clinically significant metabolic acidosis rather than uncomplicated hyperglycemia.',
              critique: expect.objectContaining({
                warnings: expect.any(Array),
                operationalReasoningScore: expect.any(Number),
              }) as unknown,
            }),
          ],
        }),
      }),
    );
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
    expect(request.messages[1].content).toContain('clinicalPattern');
    expect(request.messages[1].content).toContain('differentials');
    expect(request.messages[1].content).toContain('typedPearlContract');
    expect(request.messages[1].content).toContain(
      'diagnosisSpecificGuidance',
    );
    expect(request.messages[1].content).toContain('expectedNamedSigns');
    expect(request.messages[1].content).toContain('expectedMimics');
    expect(request.messages[1].content).toContain('expectedPitfalls');
    expect(request.messages[1].content).toContain(
      'expectedManagementAnchors',
    );
    expect(request.messages[1].content).toContain('atomicityGuidance');
    expect(request.messages[1].content).toContain('HIGH_YIELD_DISCRIMINATOR');
    expect(request.messages[1].content).toContain(
      '18-45 words, max 2 sentences',
    );
    expect(request.messages[0].content).toContain('expected signs');
    expect(request.messages[0].content).toContain('senior clinician');
    expect(request.messages[0].content).toContain(
      'why it matters diagnostically',
    );
    expect(request.messages[0].content).toContain('probability shift');
    expect(request.messages[1].content).toContain('Avoid broad syndrome paragraphs');
    expect(request.messages[0].content).toContain('not trivia');
    expect(request.messages[0].content).toContain('Differentials must compare');
    expect(request.messages[1].content).toContain('McBurney point tenderness');
    expect(request.messages[1].content).toContain('Rovsing sign');
    expect(request.messages[1].content).toContain('psoas sign');
    expect(request.messages[1].content).toContain('obturator sign');
    expect(request.messages[1].content).toContain('rebound');
    expect(request.messages[1].content).toContain('MANTRELS');
    expect(request.messages[1].content).toContain('WHY_IT_MATTERS');
    expect(request.messages[1].content).toContain('Periumbilical pain migrated to RLQ');
    expect(request.messages[1].content).toContain('Rovsing sign is present');
    expect(request.messages[1].content).toContain('Mild leukocytosis');
    expect(request.messages[1].content).toContain(
      'Localized peritoneal signs argue against gastroenteritis.',
    );
    expect(request.messages[1].content).not.toContain(
      'RAW_FOURTH_CLUE_SHOULD_NOT_BE_SENT',
    );
    expect(request.messages[1].content).not.toContain(
      'FULL_RAW_CASE_PAYLOAD_SHOULD_NOT_BE_SENT',
    );
    expect(request.messages[1].content).not.toContain('badExamples');
    expect(create.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        timeout: 45_000,
        maxRetries: 0,
      }),
    );
  });

  it('generateDraft calls GenerationContextBuilder', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_EDUCATION_GENERATION_ENABLED = 'true';
    resetEnvCacheForTests();
    const generationContextBuilder = {
      build: jest.fn().mockResolvedValue({
        diagnosis: {
          id: 'registry-1',
          displayLabel: 'Appendicitis',
          canonicalName: 'appendicitis',
          specialty: 'General Surgery',
          category: 'Inflammatory',
          bodySystem: 'Gastrointestinal',
          clinicalSetting: 'EMERGENCY',
          difficultyBand: 'BASIC',
          aliases: ['Acute appendicitis'],
        },
        conciseClinicalContext: 'Appendicitis | General Surgery',
        learningGoals: ['Teach peritoneal irritation.'],
        mustInclude: ['McBurney point tenderness', 'Rovsing sign'],
        avoid: [],
        mimics: [{ diagnosis: 'gastroenteritis' }],
        discriminators: [
          {
            finding:
              'Localized peritoneal signs argue against gastroenteritis.',
            discriminatesFrom: 'gastroenteritis',
            rationale:
              'Unlike gastroenteritis, appendicitis causes focal peritonism.',
          },
        ],
        pitfalls: ['Normal early WBC'],
        investigations: ['CT abdomen'],
        scoringSystems: ['Alvarado score'],
        managementAnchors: ['surgical consultation'],
        difficultyGuidance: {
          baselineDifficulty: 'BASIC',
          targetDifficulty: null,
          targetSolveClue: null,
          forbiddenEarlyClues: [],
          keepAliveDifferentials: ['gastroenteritis'],
        },
        sourceSummary: {
          hasEducation: false,
          hasCases: false,
          hasRules: true,
          hasGraphFacts: false,
        },
      }),
    };
    const { prisma, tx, service } = buildService({
      generationContextBuilder,
    });
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

    expect(generationContextBuilder.build).toHaveBeenCalledWith({
      diagnosisRegistryId: 'registry-1',
      purpose: 'education',
    });
    const request = create.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(request.messages[1].content).toContain('generationContext');
    expect(request.messages[1].content).toContain(
      'McBurney point tenderness',
    );
    expect(request.messages[1].content).toContain(
      'Localized peritoneal signs argue against gastroenteritis.',
    );
  });

  it('logs compact generation context metrics', async () => {
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
    mockOpenAiDraft(service, JSON.stringify(buildValidGeneratedDraft()));
    const log = jest
      .spyOn(
        (
          service as unknown as {
            logger: { log: (message: string) => void };
          }
        ).logger,
        'log',
      )
      .mockImplementation(() => undefined);

    await service.generateDraft('registry-1', 'admin-1');

    const contextPayload = log.mock.calls
      .map(([message]) => JSON.parse(message) as Record<string, unknown>)
      .find(
        (payload) =>
          payload.event === 'diagnosis_education.generate.context_built',
      );
    expect(contextPayload).toEqual(
      expect.objectContaining({
        diagnosisRegistryId: 'registry-1',
        purpose: 'education',
        contextChars: expect.any(Number),
        learningGoalCount: expect.any(Number),
        mimicCount: expect.any(Number),
        discriminatorCount: expect.any(Number),
        sourceSummary: expect.objectContaining({
          hasRules: true,
        }) as unknown,
      }),
    );
  });

  it('sends an OpenAI strict-compatible structured output schema', async () => {
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
        json_schema?: { schema?: unknown };
      };
    };

    assertStrictOpenAiSchema(request.response_format.json_schema?.schema);
  });

  it('logs prompt metrics before the OpenAI draft call', async () => {
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
    mockOpenAiDraft(service, JSON.stringify(buildValidGeneratedDraft()));
    const log = jest
      .spyOn(
        (
          service as unknown as {
            logger: { log: (message: string) => void };
          }
        ).logger,
        'log',
      )
      .mockImplementation(() => undefined);

    await service.generateDraft('registry-1', 'admin-1');

    const promptMetricPayload = log.mock.calls
      .map(([message]) => JSON.parse(message) as Record<string, unknown>)
      .find(
        (payload) =>
          payload.event === 'diagnosis_education.generate.prompt_metrics',
      );
    expect(promptMetricPayload).toEqual(
      expect.objectContaining({
        diagnosisRegistryId: 'registry-1',
        model: 'gpt-4o-mini',
        timeoutMs: 45_000,
        promptCharacterCount: expect.any(Number),
        approximatePromptTokenCount: expect.any(Number),
        systemMessageLength: expect.any(Number),
        userMessageLength: expect.any(Number),
      }),
    );
  });

  it('collects quality warnings for generic low-density education', () => {
    const { service } = buildService();
    const warnings = (
      service as unknown as {
        collectEducationQualityWarnings: (
          draft: Record<string, unknown>,
        ) => string[];
      }
    ).collectEducationQualityWarnings({
      ...buildValidGeneratedDraft({
        clinicalPattern: ['Patients may present with a variety of symptoms.'],
        differentials: ['Gastroenteritis may present with abdominal pain.'],
        recallPrompts: [
          {
            id: 'trivia',
            type: 'SHORT_ANSWER',
            prompt: 'What is appendicitis?',
            answer: 'Appendix inflammation.',
            sourceSection: 'summary',
            difficulty: 'BASIC',
          },
        ],
      }),
    });

    expect(warnings).toContain('generic_filler_phrases_detected');
    expect(warnings).toContain('missing_why_it_matters_recall_prompt');
  });

  it('flags generic exam pearl why-layer prose', () => {
    const { service } = buildService();
    const warnings = (
      service as unknown as {
        collectEducationQualityWarnings: (
          draft: Record<string, unknown>,
        ) => string[];
      }
    ).collectEducationQualityWarnings({
      ...buildValidGeneratedDraft({
        examPearls: [
          {
            id: 'mental-status',
            label: 'Mental status',
            explanation: 'Assess for confusion or lethargy.',
            whyItMatters:
              'Critical for preventing deterioration during the management process.',
          },
        ],
      }),
    });

    expect(warnings).toContain('generic_exam_pearl_why_layer');
  });

  it('allows operational exam pearl why-layer prose', () => {
    const { service } = buildService();
    const warnings = (
      service as unknown as {
        collectEducationQualityWarnings: (
          draft: Record<string, unknown>,
        ) => string[];
      }
    ).collectEducationQualityWarnings({
      ...buildValidGeneratedDraft({
        examPearls: [
          {
            id: 'potassium-risk',
            label: 'Potassium risk',
            explanation:
              'Check potassium before insulin when DKA is suspected.',
            whyItMatters:
              'Hypokalemia risk changes insulin timing because treatment can shift potassium intracellularly and worsen instability.',
          },
        ],
      }),
    });

    expect(warnings).not.toContain('generic_exam_pearl_why_layer');
  });

  it('collects typed pearl warning codes from critique metadata', () => {
    const { service } = buildService();
    const warnings = (
      service as unknown as {
        collectEducationQualityWarnings: (
          draft: Record<string, unknown>,
        ) => string[];
      }
    ).collectEducationQualityWarnings({
      ...buildValidGeneratedDraft({
        examPearls: [
          buildTypedPearl({
            content: 'Important finding.',
            whyItMatters: '',
            discriminator: '',
            managementImplication: '',
            escalationImplication: '',
            trapAvoided: '',
          }),
        ],
      }),
    });

    expect(warnings).toContain('typed_pearl_too_short');
    expect(warnings).toContain('typed_pearl_missing_why_layer');
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
