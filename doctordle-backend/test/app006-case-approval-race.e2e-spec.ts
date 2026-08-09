import { PrismaPg } from '@prisma/adapter-pg';
import {
  CaseEditorialStatus,
  CaseSource,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  Prisma,
  PrismaClient,
  ReviewDecision,
  ValidationOutcome,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { stableStringify } from '../src/modules/editorial-governance/governed-command';
import { createApp006AuthorityTypeRegistry } from '../src/modules/admin/app006-authority-registry';
import { CaseReviewService } from '../src/modules/admin/case-review.service';
import { EditorialAuthorityAssignmentRepository } from '../src/modules/admin/editorial-authority-assignment.repository';

jest.setTimeout(60_000);

type Fixture = {
  prefix: string;
  actorId: string;
  authorId: string;
  caseId: string;
  revisionId: string;
  reviewId: string;
  assignmentId: string;
};

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
    throw new Error('APP-006 integration tests require local PostgreSQL');
  }
  if (database !== EXPECTED_DATABASE) {
    throw new Error(`APP-006 integration tests require ${EXPECTED_DATABASE}`);
  }
  if (lowered.includes('railway') || lowered.includes('production')) {
    throw new Error('APP-006 integration tests refuse non-local database URLs');
  }
  if (process.env.DATABASE_URL) {
    const appUrl = new URL(process.env.DATABASE_URL);
    if (
      appUrl.hostname.toLowerCase() === host &&
      appUrl.port === parsed.port &&
      appUrl.pathname.replace(/^\//, '') === database
    ) {
      throw new Error(
        'APP-006 integration tests refuse to share the ordinary DATABASE_URL',
      );
    }
  }

  return connectionString;
};

const buildMaterialContextHash = (input: Record<string, unknown>) =>
  createHash('sha256')
    .update(
      stableStringify({
        title: input.title,
        date:
          input.date instanceof Date ? input.date.toISOString() : input.date,
        difficulty: input.difficulty,
        history: input.history,
        symptoms: input.symptoms,
        labs: input.labs,
        clues: input.clues,
        explanation: input.explanation,
        differentials: input.differentials,
        diagnosisId: input.diagnosisId,
        diagnosisRegistryId: input.diagnosisRegistryId,
        proposedDiagnosisText: input.proposedDiagnosisText,
        diagnosisMappingStatus: input.diagnosisMappingStatus,
        diagnosisMappingMethod: input.diagnosisMappingMethod,
        diagnosisMappingConfidence: input.diagnosisMappingConfidence,
        diagnosisEditorialNote: input.diagnosisEditorialNote,
      }),
    )
    .digest('hex');

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

const createService = (prisma: PrismaClient) =>
  new CaseReviewService(
    prisma as never,
    {} as never,
    {} as never,
    {
      recordReviewOutcome: jest.fn(),
      recordValidationResult: jest.fn(),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    createApp006AuthorityTypeRegistry(),
    new EditorialAuthorityAssignmentRepository(),
  );

describe('APP-006 PostgreSQL idempotency races', () => {
  let prisma: PrismaClient;

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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const cleanup = async (fixture: Fixture) => {
    const [identity] = await prisma.$queryRaw<
      Array<{ current_database: string }>
    >`SELECT current_database()`;
    expect(identity.current_database).toBe(EXPECTED_DATABASE);

    await prisma.governedCaseRevisionApprovalDecision.deleteMany({
      where: { caseId: { startsWith: fixture.prefix } },
    });
    await prisma.caseReview.deleteMany({
      where: { caseId: { startsWith: fixture.prefix } },
    });
    await prisma.caseValidationRun.deleteMany({
      where: { caseId: { startsWith: fixture.prefix } },
    });
    await prisma.case.deleteMany({
      where: { id: { startsWith: fixture.prefix } },
    });
    await prisma.editorialAuthorityAssignment.deleteMany({
      where: { id: { startsWith: fixture.prefix } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [fixture.actorId, fixture.authorId] } },
    });
  };

  const createFixture = async (): Promise<Fixture> => {
    const prefix = `app006-race-${randomUUID()}`;
    const actorId = `${prefix}-actor`;
    const authorId = `${prefix}-author`;
    const caseId = `${prefix}-case`;
    const revisionId = `${prefix}-revision`;
    const reviewId = `${prefix}-review`;
    const assignmentId = `${prefix}-assignment`;
    const createdAt = new Date('2026-04-20T00:00:00.000Z');
    const caseDate = new Date(
      Date.UTC(2035, 0, 1, 0, 0, Math.floor(Math.random() * 50_000)),
    );
    const material = {
      title: 'APP-006 PostgreSQL race case',
      date: caseDate,
      difficulty: 'medium',
      history: 'Progressive wheeze after exertion.',
      symptoms: ['wheeze', 'cough'],
      labs: null,
      clues: [{ type: 'history', value: 'Wheeze', order: 0 }],
      explanation: { diagnosis: 'Asthma' },
      differentials: ['Asthma'],
      diagnosisId: null,
      diagnosisRegistryId: null,
      proposedDiagnosisText: 'Asthma',
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote: 'Reviewed',
    };
    const materialContextHash = buildMaterialContextHash(material);
    const reviewContextIdentity = `case-review-context:${revisionId}:${materialContextHash}`;

    await cleanup({
      prefix,
      actorId,
      authorId,
      caseId,
      revisionId,
      reviewId,
      assignmentId,
    });

    await prisma.user.createMany({
      data: [
        {
          id: actorId,
          email: `${actorId}@example.test`,
          role: 'senior_editor',
        },
        {
          id: authorId,
          email: `${authorId}@example.test`,
          role: 'editor',
        },
      ],
    });
    await prisma.case.create({
      data: {
        id: caseId,
        ...material,
        labs: Prisma.JsonNull,
        clues: material.clues,
        explanation: material.explanation,
        editorialStatus: CaseEditorialStatus.REVIEW,
      },
    });
    await prisma.caseRevision.create({
      data: {
        id: revisionId,
        caseId,
        revisionNumber: 1,
        source: CaseSource.ADMIN_EDIT,
        ...material,
        labs: Prisma.JsonNull,
        clues: material.clues,
        explanation: material.explanation,
        createdByUserId: authorId,
        createdAt,
      },
    });
    await prisma.case.update({
      where: { id: caseId },
      data: { currentRevisionId: revisionId },
    });
    await prisma.caseReview.create({
      data: {
        id: reviewId,
        caseId,
        revisionId,
        materialContextHash,
        reviewContextIdentity,
        reviewerUserId: actorId,
        createdAt,
      },
    });
    await prisma.caseValidationRun.create({
      data: {
        id: `${prefix}-validation`,
        caseId,
        revisionId,
        materialContextHash,
        reviewContextIdentity,
        source: CaseSource.ADMIN_EDIT,
        outcome: ValidationOutcome.PASSED,
        validatorVersion: 'app006-postgres-race-test',
        summary: {},
        findings: [{ severity: 'info', code: 'checked' }],
        triggeredByUserId: actorId,
        startedAt: createdAt,
        completedAt: createdAt,
      },
    });
    await prisma.editorialAuthorityAssignment.create({
      data: {
        id: assignmentId,
        assignmentSchemaVersion: '1.0.0',
        subjectType: 'USER',
        subjectId: actorId,
        authorityType: 'CASE_REVISION_APPROVAL',
        authorityTypeSchemaVersion: '1.0.0',
        status: 'ACTIVE',
        scopeMode: 'SCOPED',
        scope: {
          artifactTypes: ['CASE_REVISION'],
          artifactIds: [caseId],
          artifactRevisionIds: [revisionId],
          decisionTypes: ['APPROVE_CASE_REVISION'],
        },
        allowedDecisionTypes: ['APPROVE_CASE_REVISION'],
        authorityEvidenceReference:
          'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-006.json',
        grantingAuthoritySnapshot: {
          authorityRecordId: 'WEOS-AUTH-APP-006',
        },
        grantedByActorType: 'USER',
        grantedByActorId: 'app006-postgres-race-test',
        grantingAuthorityAssignmentId: `${prefix}-grant`,
        grantedAt: createdAt,
        validFrom: createdAt,
        rationale: 'APP-006 local PostgreSQL integration test authority.',
        delegationAllowed: false,
        maximumDelegationDepth: 0,
        humanAuthorityActorId: actorId,
      },
    });

    return {
      prefix,
      actorId,
      authorId,
      caseId,
      revisionId,
      reviewId,
      assignmentId,
    };
  };

  it('replays identical concurrent approval after a real PostgreSQL unique race', async () => {
    const fixture = await createFixture();
    const service = createService(prisma);
    let postRollbackReplays = 0;
    service.setApp006ApprovalTestHooksForTest({
      beforeDecisionCreate: createBarrier(2),
      afterRollbackReplayLookup: () => {
        postRollbackReplays += 1;
      },
    });

    try {
      const command = {
        decision: ReviewDecision.APPROVED,
        expectedRevisionId: fixture.revisionId,
        expectedReviewId: fixture.reviewId,
        commandIdempotencyKey: `${fixture.prefix}-command`,
        authorityAssignmentReferences: [fixture.assignmentId],
        notes: 'Approved for pilot',
      };

      const [first, second] = await Promise.all([
        service.submitReview(fixture.caseId, fixture.actorId, command),
        service.submitReview(fixture.caseId, fixture.actorId, command),
      ]);

      expect(first.case.editorialStatus).toBe(CaseEditorialStatus.APPROVED);
      expect(second.case.editorialStatus).toBe(CaseEditorialStatus.APPROVED);
      expect(postRollbackReplays).toBeGreaterThanOrEqual(1);

      const decisionCount =
        await prisma.governedCaseRevisionApprovalDecision.count({
          where: {
            caseId: fixture.caseId,
            reviewId: fixture.reviewId,
            commandIdempotencyKey: command.commandIdempotencyKey,
          },
        });
      const approvedCase = await prisma.case.findUniqueOrThrow({
        where: { id: fixture.caseId },
        select: {
          editorialStatus: true,
          approvedAt: true,
          approvedByUserId: true,
        },
      });

      expect(decisionCount).toBe(1);
      expect(approvedCase.editorialStatus).toBe(CaseEditorialStatus.APPROVED);
      expect(approvedCase.approvedByUserId).toBe(fixture.actorId);
      expect(approvedCase.approvedAt).not.toBeNull();
    } finally {
      await cleanup(fixture);
    }
  });

  it('returns a deterministic conflict for a real PostgreSQL fingerprint mismatch race', async () => {
    const fixture = await createFixture();
    const service = createService(prisma);
    service.setApp006ApprovalTestHooksForTest({
      beforeDecisionCreate: createBarrier(2),
    });

    try {
      const base = {
        decision: ReviewDecision.APPROVED,
        expectedRevisionId: fixture.revisionId,
        expectedReviewId: fixture.reviewId,
        commandIdempotencyKey: `${fixture.prefix}-command`,
        authorityAssignmentReferences: [fixture.assignmentId],
      };

      const outcomes = await Promise.allSettled([
        service.submitReview(fixture.caseId, fixture.actorId, {
          ...base,
          notes: 'Approved for pilot',
        }),
        service.submitReview(fixture.caseId, fixture.actorId, {
          ...base,
          notes: 'Different rationale',
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
        'Idempotency conflict for APPROVE_CASE_REVISION',
      );

      const decisionCount =
        await prisma.governedCaseRevisionApprovalDecision.count({
          where: {
            caseId: fixture.caseId,
            reviewId: fixture.reviewId,
            commandIdempotencyKey: base.commandIdempotencyKey,
          },
        });
      expect(decisionCount).toBe(1);
    } finally {
      await cleanup(fixture);
    }
  });
});
