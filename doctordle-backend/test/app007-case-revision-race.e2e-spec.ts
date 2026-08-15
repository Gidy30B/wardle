import { PrismaPg } from '@prisma/adapter-pg';
import {
  CaseEditorialStatus,
  CaseSource,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CaseRevisionService } from '../src/modules/case-validation/case-revision.service';
import type { CaseRevisionSnapshot } from '../src/modules/case-validation/case-validation.types';

jest.setTimeout(60_000);

const EXPECTED_DATABASE = 'weos_integration';

const requireIntegrationDatabaseUrl = () => {
  if (process.env.WEOS_INTEGRATION_TESTS !== '1') {
    throw new Error('WEOS_INTEGRATION_TESTS=1 is required');
  }

  const connectionString = process.env.WEOS_INTEGRATION_DATABASE_URL;
  if (!connectionString) {
    throw new Error('WEOS_INTEGRATION_DATABASE_URL is required');
  }

  const parsed = new URL(connectionString);
  const database = parsed.pathname.replace(/^\//, '');
  const host = parsed.hostname.toLowerCase();
  const lowered = connectionString.toLowerCase();

  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('APP-007 integration tests require local PostgreSQL');
  }
  if (database !== EXPECTED_DATABASE) {
    throw new Error(`APP-007 integration tests require ${EXPECTED_DATABASE}`);
  }
  if (lowered.includes('railway') || lowered.includes('production')) {
    throw new Error('APP-007 integration tests refuse non-local database URLs');
  }
  if (process.env.DATABASE_URL) {
    const appUrl = new URL(process.env.DATABASE_URL);
    if (
      appUrl.hostname.toLowerCase() === host &&
      appUrl.port === parsed.port &&
      appUrl.pathname.replace(/^\//, '') === database
    ) {
      throw new Error(
        'APP-007 integration tests refuse to share the ordinary DATABASE_URL',
      );
    }
  }

  return connectionString;
};

const createBarrier = (count: number) => {
  let arrivals = 0;
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  return async () => {
    arrivals += 1;
    if (arrivals === count) release();
    await released;
  };
};

describe('APP-007 PostgreSQL CREATE_CASE_REVISION races', () => {
  let prisma: PrismaClient;
  let service: CaseRevisionService;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: requireIntegrationDatabaseUrl(),
      }),
    });
    await prisma.$connect();

    const [identity] = await prisma.$queryRaw<
      Array<{ current_database: string; current_user: string }>
    >`SELECT current_database(), current_user`;
    expect(identity.current_database).toBe(EXPECTED_DATABASE);

    service = new CaseRevisionService(
      { recordRevisionCreated: jest.fn() } as never,
      {
        resolveForWrite: jest.fn().mockResolvedValue({
          diagnosisId: null,
          diagnosisRegistryId: 'registry-1',
        }),
      } as never,
    );
  });

  afterEach(() => {
    service.setApp007RevisionTestHooksForTest(undefined);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const cleanup = async (prefix: string) => {
    const [identity] = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database()
    `;
    expect(identity.current_database).toBe(EXPECTED_DATABASE);

    await prisma.caseRevisionCreationCommand.deleteMany({
      where: { caseId: { startsWith: prefix } },
    });
    await prisma.caseRevision.deleteMany({
      where: { caseId: { startsWith: prefix } },
    });
    await prisma.case.deleteMany({
      where: { id: { startsWith: prefix } },
    });
    await prisma.diagnosisRegistry.deleteMany({
      where: { id: { startsWith: prefix } },
    });
  };

  const baseSnapshot = (
    prefix: string,
    date = new Date(Date.UTC(2036, 0, 1, 0, 0, 0)),
  ): CaseRevisionSnapshot => ({
    caseId: `${prefix}-case`,
    title: 'APP-007 PostgreSQL race case',
    date,
    difficulty: 'medium',
    history: 'Wheeze after exertion.',
    symptoms: ['wheeze', 'cough'],
    labs: null,
    clues: [{ key: 'clue-1', type: 'history', value: 'Wheeze' }],
    explanation: { diagnosis: 'Asthma' },
    differentials: ['Asthma'],
    diagnosisId: null,
    diagnosisRegistryId: `${prefix}-registry`,
    proposedDiagnosisText: 'Asthma',
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote: 'Reviewed',
  });

  const createFixture = async () => {
    const prefix = `app007-race-${randomUUID()}`;
    const caseId = `${prefix}-case`;
    const revisionId = `${prefix}-revision-1`;
    const snapshot = baseSnapshot(
      prefix,
      new Date(Date.UTC(2036, 0, 1, 0, 0, Math.floor(Math.random() * 50_000))),
    );
    const { caseId: _snapshotCaseId, ...caseMaterial } = snapshot;

    await cleanup(prefix);
    await prisma.diagnosisRegistry.create({
      data: {
        id: `${prefix}-registry`,
        canonicalName: `APP-007 race asthma ${prefix}`,
        canonicalNormalized: `app_007_race_asthma_${prefix.replaceAll('-', '_')}`,
        displayLabel: 'APP-007 race asthma',
      },
    });
    await prisma.case.create({
      data: {
        id: caseId,
        ...caseMaterial,
        labs: Prisma.JsonNull,
        clues: snapshot.clues as Prisma.InputJsonValue,
        explanation: snapshot.explanation as Prisma.InputJsonValue,
        editorialStatus: CaseEditorialStatus.REVIEW,
      },
    });
    const { caseId: _revisionSnapshotCaseId, ...revisionSnapshot } = snapshot;
    await prisma.caseRevision.create({
      data: {
        id: revisionId,
        caseId,
        revisionNumber: 1,
        source: CaseSource.ADMIN_EDIT,
        ...revisionSnapshot,
        labs: Prisma.JsonNull,
        clues: snapshot.clues as Prisma.InputJsonValue,
        explanation: snapshot.explanation as Prisma.InputJsonValue,
      },
    });
    await prisma.case.update({
      where: { id: caseId },
      data: { currentRevisionId: revisionId },
    });

    return { prefix, caseId, revisionId, snapshot };
  };

  const executeCommand = async (
    input: Parameters<
      CaseRevisionService['createCaseRevisionCommandInTransaction']
    >[1],
  ) => {
    try {
      return await prisma.$transaction(
        (tx) => service.createCaseRevisionCommandInTransaction(tx, input),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!service.isApp007ReplayEligiblePersistenceError(error)) throw error;
      return service.resolveCreateCaseRevisionReplayAfterRollback(prisma, input);
    }
  };

  it('replays identical concurrent revision commands after a real PostgreSQL race', async () => {
    const fixture = await createFixture();
    service.setApp007RevisionTestHooksForTest({
      beforeCommandCreate: createBarrier(2),
    });

    try {
      const command = {
        caseId: fixture.caseId,
        expectedRevisionId: fixture.revisionId,
        commandIdempotencyKey: `${fixture.prefix}-command`,
        snapshot: {
          ...fixture.snapshot,
          title: 'APP-007 revised asthma case',
          clues: [
            ...(fixture.snapshot.clues as unknown[]),
            { type: 'exam', value: 'Prolonged expiratory phase' },
          ] as never,
        },
        source: CaseSource.ADMIN_EDIT,
        changeReason: 'Race test',
        changeSummary: 'Add exam clue',
      };

      const [first, second] = await Promise.all([
        executeCommand(command),
        executeCommand(command),
      ]);

      expect(first.revisionId).toBe(second.revisionId);
      expect(first.snapshot.clues).toEqual(second.snapshot.clues);

      const commandCount = await prisma.caseRevisionCreationCommand.count({
        where: { commandIdempotencyKey: command.commandIdempotencyKey },
      });
      const revisionCount = await prisma.caseRevision.count({
        where: { createdFromRevisionId: fixture.revisionId },
      });
      const currentCase = await prisma.case.findUniqueOrThrow({
        where: { id: fixture.caseId },
        select: { currentRevisionId: true, title: true, clues: true },
      });

      expect(commandCount).toBe(1);
      expect(revisionCount).toBe(1);
      expect(currentCase.currentRevisionId).toBe(first.revisionId);
      expect(currentCase.title).toBe('APP-007 revised asthma case');
      expect(currentCase.clues).toEqual(first.snapshot.clues);
    } finally {
      await cleanup(fixture.prefix);
    }
  });

  it('allows only one competing same-base edit to become current', async () => {
    const fixture = await createFixture();
    service.setApp007RevisionTestHooksForTest({
      beforeCommandCreate: createBarrier(2),
    });

    try {
      const base = {
        caseId: fixture.caseId,
        expectedRevisionId: fixture.revisionId,
        source: CaseSource.ADMIN_EDIT,
        changeReason: 'Race test',
      };
      const outcomes = await Promise.allSettled([
        executeCommand({
          ...base,
          commandIdempotencyKey: `${fixture.prefix}-command-a`,
          snapshot: { ...fixture.snapshot, title: 'Competing edit A' },
          changeSummary: 'A',
        }),
        executeCommand({
          ...base,
          commandIdempotencyKey: `${fixture.prefix}-command-b`,
          snapshot: { ...fixture.snapshot, title: 'Competing edit B' },
          changeSummary: 'B',
        }),
      ]);

      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.filter((outcome) => outcome.status === 'rejected'),
      ).toHaveLength(1);

      const revisionCount = await prisma.caseRevision.count({
        where: { createdFromRevisionId: fixture.revisionId },
      });
      const currentCase = await prisma.case.findUniqueOrThrow({
        where: { id: fixture.caseId },
        select: { currentRevisionId: true },
      });
      const successful = outcomes.find(
        (outcome): outcome is PromiseFulfilledResult<
          Awaited<ReturnType<typeof executeCommand>>
        > => outcome.status === 'fulfilled',
      );

      expect(revisionCount).toBe(1);
      expect(currentCase.currentRevisionId).toBe(successful?.value.revisionId);
    } finally {
      await cleanup(fixture.prefix);
    }
  });

  it('returns deterministic conflict for same-key fingerprint mismatch', async () => {
    const fixture = await createFixture();
    service.setApp007RevisionTestHooksForTest({
      beforeCommandCreate: createBarrier(2),
    });

    try {
      const base = {
        caseId: fixture.caseId,
        expectedRevisionId: fixture.revisionId,
        commandIdempotencyKey: `${fixture.prefix}-command`,
        source: CaseSource.ADMIN_EDIT,
        changeReason: 'Race test',
      };
      const outcomes = await Promise.allSettled([
        executeCommand({
          ...base,
          snapshot: { ...fixture.snapshot, title: 'Mismatch A' },
          changeSummary: 'A',
        }),
        executeCommand({
          ...base,
          snapshot: { ...fixture.snapshot, title: 'Mismatch B' },
          changeSummary: 'B',
        }),
      ]);

      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = outcomes.find(
        (outcome): outcome is PromiseRejectedResult =>
          outcome.status === 'rejected',
      );
      expect(rejected?.reason?.message).toContain(
        'idempotency key conflicts',
      );

      const commandCount = await prisma.caseRevisionCreationCommand.count({
        where: { commandIdempotencyKey: base.commandIdempotencyKey },
      });
      expect(commandCount).toBe(1);
    } finally {
      await cleanup(fixture.prefix);
    }
  });
});
