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
import {
  APP008A_ACTION,
  APP008A_AUTHORITY_RECORD_ID,
  APP008A_AUTHORITY_TYPE,
  createApp008aAuthorityTypeRegistry,
} from '../src/modules/admin/app008a-authority-registry';
import { CasePublicationGovernanceService } from '../src/modules/admin/case-publication-governance.service';
import { EditorialAuthorityAssignmentRepository } from '../src/modules/admin/editorial-authority-assignment.repository';
import { CaseAssignmentService } from '../src/modules/gameplay/case-assignment.service';

jest.setTimeout(60_000);

const EXPECTED_DATABASE = 'weos_integration';

function requireIntegrationDatabaseUrl() {
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
    throw new Error('APP-008B integration tests require local PostgreSQL');
  }
  if (database !== EXPECTED_DATABASE) {
    throw new Error(`APP-008B integration tests require ${EXPECTED_DATABASE}`);
  }
  if (lowered.includes('railway') || lowered.includes('production')) {
    throw new Error(
      'APP-008B integration tests refuse non-local database URLs',
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
        'APP-008B integration tests refuse to share the ordinary DATABASE_URL',
      );
    }
  }

  return connectionString;
}

describe('APP-008B PostgreSQL DailyCase revision publication binding', () => {
  let prisma: PrismaClient;
  let assignmentService: CaseAssignmentService;

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

    const eligibility = new CaseEligibilityPolicyService();
    const publicationService = new CasePublicationGovernanceService(
      prisma as never,
      eligibility,
      createApp008aAuthorityTypeRegistry(),
      new EditorialAuthorityAssignmentRepository(),
    );
    assignmentService = new CaseAssignmentService(
      prisma as never,
      eligibility,
      undefined,
      publicationService,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanup(prefix: string) {
    const [identity] = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database()
    `;
    expect(identity.current_database).toBe(EXPECTED_DATABASE);

    await prisma.dailyCase.deleteMany({
      where: { caseId: { startsWith: prefix } },
    });
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
  }

  async function createPublishedRevisionFixture() {
    const prefix = `app008b-${randomUUID()}`;
    const caseId = `${prefix}-case`;
    const revisionId = `${prefix}-revision`;
    const actorUserId = `${prefix}-actor`;
    const reviewId = `${prefix}-review`;
    const validationRunId = `${prefix}-validation`;
    const approvalDecisionId = `${prefix}-approval`;
    const publicationDecisionId = `${prefix}-publication`;
    const scheduleDate = new Date(Date.UTC(2037, 5, 3));
    const snapshot = {
      caseId,
      title: 'APP-008B scheduler case',
      date: scheduleDate,
      difficulty: 'medium',
      history: 'Cough and wheeze.',
      symptoms: ['cough', 'wheeze'],
      labs: null,
      clues: [
        {
          key: 'clue-1',
          type: 'history',
          value: 'Cough and wheeze',
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
    };
    const materialContextHash = buildCaseRevisionMaterialHash(snapshot);
    const { caseId: _caseId, ...caseMaterial } = snapshot;

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
        id: `${prefix}-authority`,
        assignmentSchemaVersion: '1.0.0',
        subjectType: 'USER',
        subjectId: actorUserId,
        authorityType: APP008A_AUTHORITY_TYPE,
        authorityTypeSchemaVersion: '1.0.0',
        status: 'ACTIVE',
        scopeMode: 'SCOPED',
        scope: { artifactIds: [caseId], artifactRevisionIds: [revisionId] },
        allowedDecisionTypes: [APP008A_ACTION],
        authorityEvidenceReference: `${prefix}:authority-evidence`,
        grantingAuthoritySnapshot: { approvalRecordId: APP008A_AUTHORITY_RECORD_ID },
        grantedByActorType: 'USER',
        grantedByActorId: actorUserId,
        grantingAuthorityAssignmentId: `${prefix}:grant`,
        grantedAt: new Date(),
        validFrom: new Date(Date.UTC(2020, 0, 1)),
        rationale: 'APP-008B publication fixture',
        humanAuthorityActorId: actorUserId,
      },
    });
    await prisma.diagnosisRegistry.create({
      data: {
        id: `${prefix}-registry`,
        canonicalName: `APP-008B asthma ${prefix}`,
        canonicalNormalized: `app_008b_asthma_${prefix.replaceAll('-', '_')}`,
        displayLabel: 'APP-008B asthma',
      },
    });
    await prisma.case.create({
      data: {
        id: caseId,
        ...caseMaterial,
        labs: Prisma.JsonNull,
        clues: snapshot.clues as Prisma.InputJsonValue,
        explanation: snapshot.explanation as Prisma.InputJsonValue,
        editorialStatus: CaseEditorialStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    const { caseId: _revisionCaseId, ...revisionMaterial } = snapshot;
    await prisma.caseRevision.create({
      data: {
        id: revisionId,
        caseId,
        revisionNumber: 1,
        source: CaseSource.ADMIN_EDIT,
        ...revisionMaterial,
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
        summary: { app008b: true },
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
        targetReferences: [{ artifactType: 'CASE_REVISION', caseId, revisionId }],
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
        rationale: 'APP-006 approval fixture for APP-008B',
        findings: [],
        reviewBasis: { materialContextHash },
        obligations: [],
        compatibilityProjection: { editorialStatus: 'APPROVED' },
      },
    });
    await prisma.caseRevisionPublicationDecision.create({
      data: {
        id: publicationDecisionId,
        commandAction: APP008A_ACTION,
        commandIdempotencyKey: `${prefix}-publication-command`,
        commandFingerprint: `${prefix}:publication:fingerprint`,
        caseId,
        caseRevisionId: revisionId,
        expectedRevisionId: revisionId,
        approvalDecisionId,
        expectedApprovalDecisionId: approvalDecisionId,
        materialContextHash,
        expectedMaterialContextHash: materialContextHash,
        validationRunId,
        expectedValidationRunId: validationRunId,
        reviewContextIdentity: `${prefix}:review-context`,
        actorUserId,
        approvalRecordId: APP008A_AUTHORITY_RECORD_ID,
        authorityAssignmentId: `${prefix}-authority`,
        authorityEvidenceReference: `${prefix}:authority-evidence`,
        authorityScopeSnapshot: { artifactRevisionIds: [revisionId] },
        authorityResolvedAt: new Date(),
        readinessResult: 'READY',
        readinessSnapshot: { app008b: true },
        contentBoundarySnapshot: { app008b: true },
        standing: CaseRevisionPublicationStanding.AUTHORIZED,
        decisionType: APP008A_ACTION,
        outcome: 'AUTHORIZED',
        effectiveAction: APP008A_ACTION,
        rationale: 'APP-008B scheduler fixture',
        findings: [],
        compatibilityProjection: { editorialStatus: 'PUBLISHED' },
      },
    });

    return { prefix, caseId, revisionId, publicationDecisionId, scheduleDate };
  }

  it('binds one DailyCase row to the exact authorized publication under concurrent scheduler calls', async () => {
    const fixture = await createPublishedRevisionFixture();

    try {
      const [first, second] = await Promise.all([
        assignmentService.ensureWindow({
          startDate: fixture.scheduleDate,
          days: 1,
          source: 'app008b-test-a',
        }),
        assignmentService.ensureWindow({
          startDate: fixture.scheduleDate,
          days: 1,
          source: 'app008b-test-b',
        }),
      ]);

      expect(first.createdCount + second.createdCount).toBe(1);

      const dailyCases = await prisma.dailyCase.findMany({
        where: { caseId: fixture.caseId },
        orderBy: [{ createdAt: 'asc' }],
      });

      expect(dailyCases).toHaveLength(1);
      expect(dailyCases[0]).toMatchObject({
        caseId: fixture.caseId,
        caseRevisionId: fixture.revisionId,
        publicationDecisionId: fixture.publicationDecisionId,
      });
    } finally {
      await cleanup(fixture.prefix);
    }
  });
});
