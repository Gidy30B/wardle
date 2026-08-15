import { PrismaPg } from '@prisma/adapter-pg';
import {
  CaseEditorialStatus,
  CaseRevisionPublicationStanding,
  CaseSource,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  Prisma,
  PrismaClient,
  ReviewDecision,
  ValidationOutcome,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CaseEligibilityPolicyService } from '../src/modules/cases/case-eligibility-policy.service';
import { buildCaseRevisionMaterialHash } from '../src/modules/case-validation/case-revision-material';
import type { CaseRevisionSnapshot } from '../src/modules/case-validation/case-validation.types';
import {
  APP008A_ACTION,
  APP008A_AUTHORITY_RECORD_ID,
  APP008A_AUTHORITY_TYPE,
  createApp008aAuthorityTypeRegistry,
} from '../src/modules/admin/app008a-authority-registry';
import { CasePublicationGovernanceService } from '../src/modules/admin/case-publication-governance.service';
import { EditorialAuthorityAssignmentRepository } from '../src/modules/admin/editorial-authority-assignment.repository';

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
    throw new Error('APP-008A integration tests require local PostgreSQL');
  }
  if (database !== EXPECTED_DATABASE) {
    throw new Error(`APP-008A integration tests require ${EXPECTED_DATABASE}`);
  }
  if (lowered.includes('railway') || lowered.includes('production')) {
    throw new Error(
      'APP-008A integration tests refuse non-local database URLs',
    );
  }
  if (process.env.DATABASE_URL) {
    const appUrl = new URL(process.env.DATABASE_URL);
    if (
      appUrl.hostname.toLowerCase() === host &&
      appUrl.port === parsed.port &&
      appUrl.pathname.replace(/^\//, '') === database
    ) {
      throw new Error(
        'APP-008A integration tests refuse to share the ordinary DATABASE_URL',
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

describe('APP-008A PostgreSQL AUTHORIZE_CASE_REVISION_PUBLICATION races', () => {
  let prisma: PrismaClient;
  let service: CasePublicationGovernanceService;

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

    service = new CasePublicationGovernanceService(
      prisma as never,
      new CaseEligibilityPolicyService(),
      createApp008aAuthorityTypeRegistry(),
      new EditorialAuthorityAssignmentRepository(),
    );
  });

  afterEach(() => {
    service.setApp008aPublicationTestHooksForTest(undefined);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const cleanup = async (prefix: string) => {
    const [identity] = await prisma.$queryRaw<
      Array<{ current_database: string }>
    >`
      SELECT current_database()
    `;
    expect(identity.current_database).toBe(EXPECTED_DATABASE);

    await prisma.caseRevisionPublicationDecision.deleteMany({
      where: { caseId: { startsWith: prefix } },
    });
    await prisma.caseRevisionPublicationCommand.deleteMany({
      where: { caseId: { startsWith: prefix } },
    });
    await prisma.governedCaseRevisionApprovalDecision.deleteMany({
      where: { caseId: { startsWith: prefix } },
    });
    await prisma.caseReview.deleteMany({
      where: { caseId: { startsWith: prefix } },
    });
    await prisma.caseValidationRun.deleteMany({
      where: { caseId: { startsWith: prefix } },
    });
    await prisma.caseRevision.deleteMany({
      where: { caseId: { startsWith: prefix } },
    });
    await prisma.case.deleteMany({
      where: { id: { startsWith: prefix } },
    });
    await prisma.editorialAuthorityAssignment.deleteMany({
      where: { id: { startsWith: prefix } },
    });
    await prisma.user.deleteMany({
      where: { id: { startsWith: prefix } },
    });
    await prisma.diagnosisRegistry.deleteMany({
      where: { id: { startsWith: prefix } },
    });
  };

  const baseSnapshot = (
    prefix: string,
    date = new Date(Date.UTC(2036, 1, 1, 0, 0, 0)),
  ): CaseRevisionSnapshot => ({
    caseId: `${prefix}-case`,
    title: 'APP-008A publication case',
    date,
    difficulty: 'medium',
    history: 'Wheeze after exertion.',
    symptoms: ['wheeze', 'cough'],
    labs: null,
    clues: [
      {
        key: 'clue-1',
        type: 'history',
        value: 'Wheeze after exertion',
        order: 0,
      },
    ],
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

  const createFixture = async (
    options: {
      editorialStatus?: CaseEditorialStatus;
      omitApproval?: boolean;
    } = {},
  ) => {
    const prefix = `app008a-race-${randomUUID()}`;
    const actorUserId = `${prefix}-actor`;
    const caseId = `${prefix}-case`;
    const revisionId = `${prefix}-revision-1`;
    const reviewId = `${prefix}-review-1`;
    const approvalDecisionId = `${prefix}-approval-1`;
    const validationRunId = `${prefix}-validation-1`;
    const authorityAssignmentId = `${prefix}-authority-1`;
    const snapshot = baseSnapshot(
      prefix,
      new Date(Date.UTC(2036, 1, 1, 0, 0, Math.floor(Math.random() * 50_000))),
    );
    const { caseId: _snapshotCaseId, ...caseMaterial } = snapshot;
    const materialContextHash = buildCaseRevisionMaterialHash(snapshot);

    await cleanup(prefix);
    await prisma.user.create({
      data: {
        id: actorUserId,
        email: `${prefix}@example.test`,
        role: 'senior_editor',
      },
    });
    await prisma.editorialAuthorityAssignment.create({
      data: {
        id: authorityAssignmentId,
        assignmentSchemaVersion: '1.0.0',
        subjectType: 'USER',
        subjectId: actorUserId,
        authorityType: APP008A_AUTHORITY_TYPE,
        authorityTypeSchemaVersion: '1.0.0',
        status: 'ACTIVE',
        scopeMode: 'SCOPED',
        scope: {
          artifactTypes: ['CASE_REVISION'],
          artifactIds: [caseId],
          artifactRevisionIds: [revisionId],
        },
        allowedDecisionTypes: [APP008A_ACTION],
        authorityEvidenceReference: `${prefix}:authority-evidence`,
        grantingAuthoritySnapshot: {
          approvalRecordId: APP008A_AUTHORITY_RECORD_ID,
        },
        grantedByActorType: 'USER',
        grantedByActorId: actorUserId,
        grantingAuthorityAssignmentId: `${prefix}:grant`,
        grantedAt: new Date(),
        validFrom: new Date(Date.UTC(2020, 0, 1)),
        rationale: 'APP-008A publication authority test fixture',
        humanAuthorityActorId: actorUserId,
      },
    });
    await prisma.diagnosisRegistry.create({
      data: {
        id: `${prefix}-registry`,
        canonicalName: `APP-008A race asthma ${prefix}`,
        canonicalNormalized: `app_008a_race_asthma_${prefix.replaceAll('-', '_')}`,
        displayLabel: 'APP-008A race asthma',
      },
    });
    await prisma.case.create({
      data: {
        id: caseId,
        ...caseMaterial,
        labs: Prisma.JsonNull,
        clues: snapshot.clues as Prisma.InputJsonValue,
        explanation: snapshot.explanation as Prisma.InputJsonValue,
        editorialStatus: options.editorialStatus ?? CaseEditorialStatus.REVIEW,
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
        contentHash: materialContextHash,
      },
    });
    await prisma.case.update({
      where: { id: caseId },
      data: { currentRevisionId: revisionId },
    });
    await prisma.caseValidationRun.create({
      data: {
        id: validationRunId,
        caseId,
        revisionId,
        materialContextHash,
        reviewContextIdentity: `${prefix}:review-context`,
        source: CaseSource.ADMIN_EDIT,
        outcome: ValidationOutcome.PASSED,
        completedAt: new Date(),
        findings: [],
        summary: { app008a: true },
        triggeredByUserId: actorUserId,
      },
    });
    await prisma.caseReview.create({
      data: {
        id: reviewId,
        caseId,
        revisionId,
        materialContextHash,
        reviewContextIdentity: `${prefix}:review-context`,
        reviewerUserId: actorUserId,
        decision: ReviewDecision.APPROVED,
        decidedAt: new Date(),
      },
    });
    if (!options.omitApproval) {
      await prisma.governedCaseRevisionApprovalDecision.create({
        data: {
          id: approvalDecisionId,
          commandAction: 'APPROVE_CASE_REVISION',
          commandIdempotencyKey: `${prefix}-approval-command`,
          commandFingerprint: `${prefix}:approval:fingerprint`,
          envelopeSchemaVersion: '1.0.0',
          extensionType: 'CASE_REVISION_APPROVAL',
          extensionSchemaVersion: '1.0.0',
          status: 'RECORDED',
          validatedEnvelope: { app006: true },
          extensionPayload: { app006: true },
          primaryTarget: { caseId, revisionId },
          targetReferences: [
            { artifactType: 'CASE_REVISION', caseId, revisionId },
          ],
          actorType: 'USER',
          approvalRecordId: 'WEOS-AUTH-APP-006',
          authorityAssignmentId: `${prefix}:app006-authority`,
          authorityEvidenceReference: `${prefix}:app006-evidence`,
          authorityScopeSnapshot: { artifactRevisionIds: [revisionId] },
          authorityResolvedAt: new Date(),
          actorUserId,
          caseId,
          targetRevisionId: revisionId,
          expectedRevisionId: revisionId,
          reviewId,
          decisionType: 'APPROVE_CASE_REVISION',
          outcome: 'APPROVED',
          effectiveAction: 'APPROVE_CASE_REVISION',
          rationale: 'APP-006 approval fixture for APP-008A',
          findings: [],
          reviewBasis: { materialContextHash },
          obligations: [],
          compatibilityProjection: { editorialStatus: 'APPROVED' },
        },
      });
    }

    return {
      prefix,
      actorUserId,
      caseId,
      revisionId,
      approvalDecisionId,
      validationRunId,
      materialContextHash,
      authorityAssignmentId,
    };
  };

  const commandFor = (fixture: Awaited<ReturnType<typeof createFixture>>) => ({
    expectedRevisionId: fixture.revisionId,
    expectedApprovalDecisionId: fixture.approvalDecisionId,
    expectedMaterialContextHash: fixture.materialContextHash,
    expectedValidationRunId: fixture.validationRunId,
    commandIdempotencyKey: `${fixture.prefix}-publish-command`,
    authorityAssignmentReferences: [fixture.authorityAssignmentId],
    rationale: 'Publish exact APP-006 approved revision.',
  });

  it('does not treat legacy PUBLISHED status as canonical publication authority', async () => {
    const fixture = await createFixture({
      editorialStatus: CaseEditorialStatus.PUBLISHED,
      omitApproval: true,
    });

    try {
      const readiness = await service.getRevisionPublicationReadiness(
        fixture.caseId,
        fixture.revisionId,
      );

      expect(readiness.result).toBe('BLOCKED');
      expect(readiness.publicationAuthorized).toBe(false);
      expect(readiness.blockers.map((blocker) => blocker.code)).toContain(
        'APP006_APPROVAL_REQUIRED',
      );
      expect(readiness.warnings.map((warning) => warning.code)).toContain(
        'LEGACY_PUBLISHED_STATUS_IS_PROJECTION_ONLY',
      );
    } finally {
      await cleanup(fixture.prefix);
    }
  });

  it('authorizes an exact approved revision and replays identical concurrent commands', async () => {
    const fixture = await createFixture();
    service.setApp008aPublicationTestHooksForTest({
      beforeDecisionCreate: createBarrier(2),
    });

    try {
      const command = commandFor(fixture);
      const [first, second] = await Promise.all([
        service.authorizeRevisionPublication(
          fixture.caseId,
          fixture.revisionId,
          fixture.actorUserId,
          command,
        ),
        service.authorizeRevisionPublication(
          fixture.caseId,
          fixture.revisionId,
          fixture.actorUserId,
          command,
        ),
      ]);

      expect(first.id).toBe(second.id);
      expect(first.caseRevisionId).toBe(fixture.revisionId);
      expect(first.approvalDecisionId).toBe(fixture.approvalDecisionId);
      expect(first.materialContextHash).toBe(fixture.materialContextHash);
      expect(first.standing).toBe(CaseRevisionPublicationStanding.AUTHORIZED);

      const decisionCount = await prisma.caseRevisionPublicationDecision.count({
        where: { caseId: fixture.caseId },
      });
      const commandCount = await prisma.caseRevisionPublicationCommand.count({
        where: { caseId: fixture.caseId },
      });
      const currentCase = await prisma.case.findUniqueOrThrow({
        where: { id: fixture.caseId },
        select: { editorialStatus: true, publishedAt: true },
      });

      expect(decisionCount).toBe(1);
      expect(commandCount).toBe(1);
      expect(currentCase.editorialStatus).toBe(CaseEditorialStatus.PUBLISHED);
      expect(currentCase.publishedAt).toBeInstanceOf(Date);
    } finally {
      await cleanup(fixture.prefix);
    }
  });

  it('allows only one competing publication command to authorize a revision', async () => {
    const fixture = await createFixture();
    service.setApp008aPublicationTestHooksForTest({
      beforeDecisionCreate: createBarrier(2),
    });

    try {
      const base = commandFor(fixture);
      const outcomes = await Promise.allSettled([
        service.authorizeRevisionPublication(
          fixture.caseId,
          fixture.revisionId,
          fixture.actorUserId,
          { ...base, commandIdempotencyKey: `${fixture.prefix}-publish-a` },
        ),
        service.authorizeRevisionPublication(
          fixture.caseId,
          fixture.revisionId,
          fixture.actorUserId,
          { ...base, commandIdempotencyKey: `${fixture.prefix}-publish-b` },
        ),
      ]);

      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.filter((outcome) => outcome.status === 'rejected'),
      ).toHaveLength(1);

      const decisionCount = await prisma.caseRevisionPublicationDecision.count({
        where: { caseId: fixture.caseId },
      });
      const activeCount = await prisma.caseRevisionPublicationDecision.count({
        where: {
          caseId: fixture.caseId,
          standing: CaseRevisionPublicationStanding.AUTHORIZED,
        },
      });

      expect(decisionCount).toBe(1);
      expect(activeCount).toBe(1);
    } finally {
      await cleanup(fixture.prefix);
    }
  });

  it('rejects stale expected approval evidence without partial persistence', async () => {
    const fixture = await createFixture();

    try {
      await expect(
        service.authorizeRevisionPublication(
          fixture.caseId,
          fixture.revisionId,
          fixture.actorUserId,
          {
            ...commandFor(fixture),
            expectedApprovalDecisionId: `${fixture.prefix}-stale-approval`,
          },
        ),
      ).rejects.toThrow('expected approval decision does not match');

      const decisionCount = await prisma.caseRevisionPublicationDecision.count({
        where: { caseId: fixture.caseId },
      });
      const commandCount = await prisma.caseRevisionPublicationCommand.count({
        where: { caseId: fixture.caseId },
      });

      expect(decisionCount).toBe(0);
      expect(commandCount).toBe(0);
    } finally {
      await cleanup(fixture.prefix);
    }
  });
});
