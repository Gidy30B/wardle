import {
  CaseEditorialStatus,
  CaseSource,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  ValidationOutcome,
} from '@prisma/client';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import type {
  AuthorityAssignment,
  AuthorityTypeRegistry,
} from '../editorial-governance/authority-assignment';
import { resolveGovernedAuthority } from '../editorial-governance/authority-assignment';
import { stableStringify } from '../editorial-governance/governed-command';
import { PrismaService } from '../../core/db/prisma.service';
import { CaseRevisionService } from '../case-validation/case-revision.service';
import { CaseValidationService } from '../case-validation/case-validation.service';
import { EditorialMetricsService } from '../editorial/editorial-metrics.service';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service';
import { DiagnosisRegistryEditorialService } from '../diagnosis-registry/diagnosis-registry-editorial.service';
import { DiagnosisGraphExtractionService } from '../diagnosis-graph/diagnosis-graph-extraction.service';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service';
import { CaseQualityProjectionService } from './case-quality-projection.service';
import {
  buildApp006GovernanceDecisionEnvelope,
  validateApp006GovernanceDecisionEnvelope,
  type App006EnvelopeFacts,
} from './app006-case-revision-approval.decision';
import {
  APP006_AUTHORITY_TYPE_REGISTRY,
  app006AuthorityTypeRegistryProvider,
} from './app006-authority-registry';
import { CaseReviewService } from './case-review.service';
import { EditorialAuthorityAssignmentRepository } from './editorial-authority-assignment.repository';

describe('CaseReviewService', () => {
  const materialRevision = {
    id: 'revision-3',
    caseId: 'case-1',
    title: 'Case title',
    date: new Date('2026-04-20T00:00:00.000Z'),
    difficulty: 'medium',
    history: 'History',
    symptoms: ['cough'],
    labs: null,
    clues: [],
    explanation: {},
    differentials: [],
    diagnosisId: 'diagnosis-1',
    diagnosisRegistryId: 'registry-1',
    proposedDiagnosisText: 'Asthma',
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote: 'Reviewed by editor',
  };
  const normalizeForHash = (value: unknown): unknown => {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(normalizeForHash);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          normalizeForHash(entry),
        ]),
      );
    }
    return value;
  };
  const materialHash = (overrides: Record<string, unknown> = {}) =>
    createHash('sha256')
      .update(
        stableStringify(
          normalizeForHash({
            title: materialRevision.title,
            date: materialRevision.date,
            difficulty: materialRevision.difficulty,
            history: materialRevision.history,
            symptoms: materialRevision.symptoms,
            labs: materialRevision.labs,
            clues: materialRevision.clues,
            explanation: materialRevision.explanation,
            differentials: materialRevision.differentials,
            diagnosisId: materialRevision.diagnosisId,
            diagnosisRegistryId: materialRevision.diagnosisRegistryId,
            proposedDiagnosisText: materialRevision.proposedDiagnosisText,
            diagnosisMappingStatus: materialRevision.diagnosisMappingStatus,
            diagnosisMappingMethod: materialRevision.diagnosisMappingMethod,
            diagnosisMappingConfidence:
              materialRevision.diagnosisMappingConfidence,
            diagnosisEditorialNote: materialRevision.diagnosisEditorialNote,
            ...overrides,
          }),
        ),
      )
      .digest('hex');
  const reviewContextIdentity = (hash = materialHash()) =>
    `case-review-context:revision-3:${hash}`;
  const authorityTypeRegistry: AuthorityTypeRegistry = {
    definitions: [
      {
        authorityType: 'CASE_REVISION_APPROVAL',
        authorityTypeSchemaVersion: '1.0.0',
        status: 'APPROVED',
        allowedDecisionTypes: ['APPROVE_CASE_REVISION'],
        requiredScopeDimensions: ['artifactTypes', 'artifactRevisionIds'],
        permitsGlobalScope: false,
        requiresHumanAuthority: true,
        permittedSubjectTypes: ['USER'],
        permitsDelegation: false,
        maximumDelegationDepth: 0,
        grantableAuthorityTypes: [],
        requiresEnhancedGrantEvidence: false,
        separationOfDutiesRules: ['AUTHOR_CANNOT_BE_SOLE_FINAL_APPROVER'],
      },
    ],
  };

  const scopedAssignment = (
    overrides: Partial<AuthorityAssignment> = {},
  ): AuthorityAssignment => ({
    assignmentId: 'aa-case-revision-approval-1',
    assignmentSchemaVersion: '1.0.0',
    subjectType: 'USER',
    subjectId: 'senior-1',
    authorityType: 'CASE_REVISION_APPROVAL',
    authorityTypeSchemaVersion: '1.0.0',
    status: 'ACTIVE',
    scopeMode: 'SCOPED',
    scope: {
      artifactTypes: ['CASE_REVISION'],
      artifactIds: ['case-1'],
      artifactRevisionIds: ['revision-3'],
      decisionTypes: ['APPROVE_CASE_REVISION'],
    },
    allowedDecisionTypes: ['APPROVE_CASE_REVISION'],
    authorityEvidenceReference:
      'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-006.json',
    grantingAuthoritySnapshot: {
      authorityRecordId: 'WEOS-AUTH-APP-006',
    },
    grantedByActorType: 'USER',
    grantedByActorId: 'architecture-authority',
    grantingAuthorityAssignmentId: 'aa-bootstrap-app-006',
    grantedAt: '2026-08-08T00:00:00.000Z',
    validFrom: '2026-08-08T00:00:00.000Z',
    rationale: 'APP-006 case revision approval pilot authority.',
    delegationAllowed: false,
    maximumDelegationDepth: 0,
    humanAuthorityActorId: 'senior-1',
    ...overrides,
  });

  const app006EnvelopeFacts = (
    overrides: Partial<App006EnvelopeFacts> = {},
  ): App006EnvelopeFacts => {
    const assignment = scopedAssignment();
    return {
      decisionId: 'decision-1',
      caseId: 'case-1',
      caseRevisionId: 'revision-3',
      reviewId: 'review-1',
      validationRunId: 'validation-1',
      reviewContextIdentity: reviewContextIdentity(),
      materialContextHash: materialHash(),
      actorUserId: 'senior-1',
      authority: {
        authorityAssignmentId: assignment.assignmentId,
        authorityEvidenceReference: assignment.authorityEvidenceReference,
        authorityScopeSnapshot: assignment.scope,
        authorityResolvedAt: '2026-04-20T00:00:01.000Z',
      },
      authorityAssignment: assignment,
      commandFingerprint: 'canonical-command-fingerprint',
      rationale: 'Approved for pilot',
      findings: ['{"code":"checked","severity":"info"}'],
      obligations: [],
      compatibilityProjectionEffect: {
        owner: 'APPROVE_CASE_REVISION',
        caseId: 'case-1',
        fields: [
          'Case.editorialStatus',
          'Case.approvedAt',
          'Case.approvedByUserId',
        ],
        editorialStatus: CaseEditorialStatus.APPROVED,
        approvedAt: '2026-04-20T00:00:01.000Z',
        approvedByUserId: 'senior-1',
      },
      occurredAt: '2026-04-20T00:00:01.000Z',
      createdAt: '2026-04-20T00:00:01.000Z',
      ...overrides,
    };
  };

  function createFixture(
    options: {
      authorityRegistry?: AuthorityTypeRegistry;
      authorityAssignments?: AuthorityAssignment[];
    } = {},
  ) {
    const prisma: any = {
      case: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      diagnosis: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      diagnosisRegistry: {
        findUnique: jest.fn(),
      },
      caseRevision: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      caseReview: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      caseValidationRun: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      governedCaseRevisionApprovalDecision: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
      },
      editorialAuthorityAssignment: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(
        async (handler: ((tx: any) => unknown) | unknown[]) => {
          if (Array.isArray(handler)) {
            return Promise.all(handler);
          }

          return handler(prisma);
        },
      ),
    };

    const caseRevisionService = {
      getCurrentCaseSnapshotInTransaction: jest.fn().mockResolvedValue({
        caseId: 'case-1',
        title: 'Case title',
        date: new Date('2026-04-20T00:00:00.000Z'),
        difficulty: 'medium',
        history: 'History',
        symptoms: ['cough'],
        labs: null,
        clues: [],
        explanation: {},
        differentials: [],
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: 'registry-1',
        proposedDiagnosisText: 'Asthma',
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: 'Reviewed by editor',
      }),
      createRevisionFromSnapshotInTransaction: jest.fn().mockResolvedValue({
        revisionId: 'revision-new',
        revisionNumber: 4,
        snapshot: {
          caseId: 'case-1',
        },
      }),
      createCaseRevisionCommandInTransaction: jest.fn().mockResolvedValue({
        revisionId: 'revision-new',
        revisionNumber: 4,
        snapshot: {
          caseId: 'case-1',
        },
      }),
      executeCreateCaseRevisionCommand: jest.fn(
        async (_client, options) => options.runInTransaction(prisma),
      ),
    };
    const caseValidationService = {
      validateSnapshot: jest.fn().mockReturnValue({
        outcome: ValidationOutcome.PASSED,
        validatorVersion: 'shadow:v1',
      }),
      buildExecutionErrorReport: jest.fn(),
      buildPersistencePayload: jest.fn().mockReturnValue({
        summary: { summary: true },
        findings: { findings: true },
      }),
    };
    const editorialMetrics = {
      recordValidationResult: jest.fn(),
      recordReviewOutcome: jest.fn(),
      recordReadyToPublishTransition: jest.fn(),
      snapshot: jest.fn().mockReturnValue({
        assignments: {
          explicit: {
            accepted: 0,
            rejected: 0,
            rejectedByEditorialStatus: {},
          },
          lazy: {
            accepted: 0,
            rejected: 0,
            rejectedByEditorialStatus: {},
            noEligibleCaseMisses: 0,
          },
          readyToPublishTransitions: 0,
        },
      }),
    };
    const diagnosisRegistryLinkService = {
      resolveForWrite: jest.fn().mockResolvedValue({
        diagnosisId: 'diagnosis-1',
        diagnosisName: 'Asthma',
        diagnosisRegistryId: 'registry-1',
      }),
    };
    const diagnosisRegistryEditorialService = {
      search: jest.fn(),
      createDiagnosis: jest.fn().mockResolvedValue({
        diagnosisId: null,
        diagnosisRegistryId: 'registry-new',
        mappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
        registry: {
          id: 'registry-new',
          canonicalName: 'Granulomatosis with polyangiitis',
          status: 'ACTIVE',
          category: null,
          specialty: null,
          searchPriority: 0,
          aliasPreview: [],
        },
      }),
      addAlias: jest.fn(),
      getLinkableDiagnosisRegistry: jest.fn().mockResolvedValue({
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: 'registry-1',
        registry: {
          id: 'registry-1',
          canonicalName: 'Asthma',
          status: 'ACTIVE',
          category: 'Pulmonology',
          specialty: null,
          searchPriority: 0,
          aliasPreview: [],
        },
      }),
    };
    const editorialAuthorityAssignmentRepository = {
      loadCandidatesForApproval: jest
        .fn()
        .mockResolvedValue(options.authorityAssignments ?? []),
    };

    return {
      prisma,
      caseRevisionService,
      caseValidationService,
      editorialMetrics,
      diagnosisRegistryLinkService,
      diagnosisRegistryEditorialService,
      editorialAuthorityAssignmentRepository,
      service: new CaseReviewService(
        prisma as never,
        caseRevisionService as never,
        caseValidationService as never,
        editorialMetrics as never,
        diagnosisRegistryLinkService as never,
        diagnosisRegistryEditorialService as never,
        new CaseEligibilityPolicyService(),
        undefined,
        undefined,
        options.authorityRegistry,
        editorialAuthorityAssignmentRepository as never,
      ),
    };
  }

  it('exposes diagnosis review fields and readiness on case detail payloads', async () => {
    const fixture = createFixture();
    fixture.prisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      title: 'Case title',
      date: new Date('2026-04-20T00:00:00.000Z'),
      difficulty: 'medium',
      history: 'History',
      symptoms: ['wheezing'],
      labs: null,
      clues: [],
      explanation: {},
      differentials: [],
      diagnosisId: 'diagnosis-1',
      diagnosisRegistryId: 'registry-1',
      proposedDiagnosisText: 'Acute asthma',
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote: 'Confirmed with registry',
      editorialStatus: CaseEditorialStatus.REVIEW,
      approvedAt: null,
      approvedByUserId: null,
      currentRevisionId: 'revision-3',
      diagnosis: {
        id: 'diagnosis-1',
        name: 'Asthma',
        system: 'legacy',
      },
      diagnosisRegistry: {
        id: 'registry-1',
        canonicalName: 'Asthma',
        status: 'ACTIVE',
        category: 'Pulmonology',
        specialty: null,
      },
      currentRevision: null,
      validationRuns: [],
      reviews: [],
    });

    const detail = await fixture.service.getCaseDetail('case-1');

    expect(detail).toEqual(
      expect.objectContaining({
        proposedDiagnosisText: 'Acute asthma',
        diagnosisRegistryId: 'registry-1',
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: 'Confirmed with registry',
        diagnosisRegistrySummary: {
          id: 'registry-1',
          canonicalName: 'Asthma',
          status: 'ACTIVE',
          category: 'Pulmonology',
          specialty: null,
        },
        diagnosisPublishReadiness: {
          ready: true,
        },
      }),
    );
  });

  it('links an existing diagnosis to a case and preserves diagnosis provenance', async () => {
    const fixture = createFixture();
    fixture.prisma.case.findUnique
      .mockResolvedValueOnce({
        id: 'case-1',
        editorialStatus: CaseEditorialStatus.REVIEW,
        proposedDiagnosisText: 'Acute asthma',
        diagnosisEditorialNote: 'Prior note',
      })
      .mockResolvedValueOnce({
        id: 'case-1',
        title: 'Case title',
        date: new Date('2026-04-20T00:00:00.000Z'),
        difficulty: 'medium',
        history: 'History',
        symptoms: ['cough'],
        labs: null,
        clues: [],
        explanation: {},
        differentials: [],
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: 'registry-1',
        proposedDiagnosisText: 'Acute asthma',
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: 'Linked by editor',
        editorialStatus: CaseEditorialStatus.VALIDATED,
        approvedAt: null,
        approvedByUserId: null,
        currentRevisionId: 'revision-new',
        diagnosis: {
          id: 'diagnosis-1',
          name: 'Asthma',
          system: 'legacy',
        },
        diagnosisRegistry: {
          id: 'registry-1',
          canonicalName: 'Asthma',
          status: 'ACTIVE',
          category: 'Pulmonology',
          specialty: null,
        },
        currentRevision: null,
        validationRuns: [],
        reviews: [],
      });
    fixture.prisma.case.update
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'case-1' });
    fixture.prisma.caseValidationRun.create.mockResolvedValue({
      id: 'validation-1',
      revisionId: 'revision-new',
      outcome: ValidationOutcome.PASSED,
      validatorVersion: 'shadow:v1',
      summary: { summary: true },
      findings: { findings: true },
      startedAt: new Date('2026-04-20T00:00:00.000Z'),
      completedAt: new Date('2026-04-20T00:00:01.000Z'),
    });

    const result = await fixture.service.linkDiagnosisToCase(
      'case-1',
      'user-1',
      {
        diagnosisRegistryId: 'registry-1',
        diagnosisEditorialNote: 'Linked by editor',
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'create-revision-diagnosis-link',
        changeReason: 'Link diagnosis during review',
        changeSummary: 'Linked registry diagnosis',
      },
    );

    expect(
      fixture.diagnosisRegistryEditorialService.getLinkableDiagnosisRegistry,
    ).toHaveBeenCalledWith('registry-1', fixture.prisma);
    expect(
      fixture.caseRevisionService.createCaseRevisionCommandInTransaction,
    ).toHaveBeenCalledWith(
      fixture.prisma,
      expect.objectContaining({
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'create-revision-diagnosis-link',
        changeReason: 'Link diagnosis during review',
        changeSummary: 'Linked registry diagnosis',
        source: CaseSource.ADMIN_EDIT,
        createdByUserId: 'user-1',
        snapshot: expect.objectContaining({
          diagnosisId: 'diagnosis-1',
          diagnosisRegistryId: 'registry-1',
          proposedDiagnosisText: 'Acute asthma',
          diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
          diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
          diagnosisMappingConfidence: 1,
          diagnosisEditorialNote: 'Linked by editor',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        diagnosisRegistryId: 'registry-1',
        proposedDiagnosisText: 'Acute asthma',
        diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      }),
    );
  });

  it('creates a diagnosis and links it with manual-created mapping metadata', async () => {
    const fixture = createFixture();
    fixture.diagnosisRegistryEditorialService.createDiagnosis.mockResolvedValue(
      {
        diagnosisId: 'diagnosis-9',
        diagnosisRegistryId: 'registry-9',
        mappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
        registry: {
          id: 'registry-9',
          canonicalName: 'Granulomatosis with polyangiitis',
          status: 'ACTIVE',
          category: 'Rheumatology',
          specialty: null,
          searchPriority: 0,
          aliasPreview: ['Wegener granulomatosis'],
        },
      },
    );
    fixture.diagnosisRegistryEditorialService.getLinkableDiagnosisRegistry.mockResolvedValue(
      {
        diagnosisId: 'diagnosis-9',
        diagnosisRegistryId: 'registry-9',
        registry: {
          id: 'registry-9',
          canonicalName: 'Granulomatosis with polyangiitis',
          status: 'ACTIVE',
          category: 'Rheumatology',
          specialty: null,
          searchPriority: 0,
          aliasPreview: ['Wegener granulomatosis'],
        },
      },
    );
    fixture.prisma.case.findUnique
      .mockResolvedValueOnce({
        id: 'case-1',
        editorialStatus: CaseEditorialStatus.NEEDS_EDIT,
        proposedDiagnosisText: 'Wegener granulomatosis',
        diagnosisEditorialNote: null,
      })
      .mockResolvedValueOnce({
        id: 'case-1',
        title: 'Case title',
        date: new Date('2026-04-20T00:00:00.000Z'),
        difficulty: 'medium',
        history: 'History',
        symptoms: ['epistaxis'],
        labs: null,
        clues: [],
        explanation: {},
        differentials: [],
        diagnosisId: 'diagnosis-9',
        diagnosisRegistryId: 'registry-9',
        proposedDiagnosisText: 'Wegener granulomatosis',
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: 'Created while reviewing case',
        editorialStatus: CaseEditorialStatus.VALIDATED,
        approvedAt: null,
        approvedByUserId: null,
        currentRevisionId: 'revision-new',
        diagnosis: {
          id: 'diagnosis-9',
          name: 'Granulomatosis with polyangiitis',
          system: 'legacy',
        },
        diagnosisRegistry: {
          id: 'registry-9',
          canonicalName: 'Granulomatosis with polyangiitis',
          status: 'ACTIVE',
          category: 'Rheumatology',
          specialty: null,
        },
        currentRevision: null,
        validationRuns: [],
        reviews: [],
      });
    fixture.prisma.case.update
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'case-1' });
    fixture.prisma.caseValidationRun.create.mockResolvedValue({
      id: 'validation-1',
      revisionId: 'revision-new',
      outcome: ValidationOutcome.PASSED,
      validatorVersion: 'shadow:v1',
      summary: { summary: true },
      findings: { findings: true },
      startedAt: new Date('2026-04-20T00:00:00.000Z'),
      completedAt: new Date('2026-04-20T00:00:01.000Z'),
    });

    const result = await fixture.service.createAndLinkDiagnosis(
      'case-1',
      'user-1',
      {
        canonicalName: 'Granulomatosis with polyangiitis',
        aliases: ['Wegener granulomatosis'],
        category: 'Rheumatology',
        diagnosisEditorialNote: 'Created while reviewing case',
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'create-revision-create-link',
        changeReason: 'Create diagnosis while reviewing case',
        changeSummary: 'Created and linked diagnosis',
      },
    );

    expect(
      fixture.diagnosisRegistryEditorialService.createDiagnosis,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalName: 'Granulomatosis with polyangiitis',
        aliases: ['Wegener granulomatosis'],
        category: 'Rheumatology',
      }),
      fixture.prisma,
    );
    expect(
      fixture.caseRevisionService.createCaseRevisionCommandInTransaction,
    ).toHaveBeenCalledWith(
      fixture.prisma,
      expect.objectContaining({
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'create-revision-create-link',
        snapshot: expect.objectContaining({
          diagnosisMappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
          diagnosisRegistryId: 'registry-9',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        diagnosisRegistryId: 'registry-9',
        diagnosisMappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
      }),
    );
  });

  it('updates the case canonical diagnosis and creates a fresh admin revision', async () => {
    const fixture = createFixture();
    fixture.prisma.case.findUnique
      .mockResolvedValueOnce({
        id: 'case-1',
        editorialStatus: CaseEditorialStatus.REVIEW,
        diagnosisId: 'diagnosis-old',
        diagnosisRegistryId: 'registry-old',
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.LEGACY_BACKFILL,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: 'Needs canonical cleanup',
      })
      .mockResolvedValueOnce({
        id: 'case-1',
        title: 'Case title',
        date: new Date('2026-04-20T00:00:00.000Z'),
        difficulty: 'medium',
        history: 'History',
        symptoms: ['cough'],
        labs: null,
        clues: [],
        explanation: {},
        differentials: [],
        diagnosisId: null,
        diagnosisRegistryId: 'registry-new',
        proposedDiagnosisText: 'Granulomatosis with polyangiitis',
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: 'Needs canonical cleanup',
        editorialStatus: CaseEditorialStatus.VALIDATED,
        approvedAt: null,
        approvedByUserId: null,
        currentRevisionId: 'revision-new',
        diagnosis: null,
        diagnosisRegistry: {
          id: 'registry-new',
          canonicalName: 'Granulomatosis with polyangiitis',
          status: 'ACTIVE',
          category: null,
          specialty: null,
        },
        currentRevision: null,
        validationRuns: [],
        reviews: [],
      });
    fixture.prisma.case.update
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'case-1' });
    fixture.prisma.caseValidationRun.create.mockResolvedValue({
      id: 'validation-1',
      revisionId: 'revision-new',
      outcome: ValidationOutcome.PASSED,
      validatorVersion: 'shadow:v1',
      summary: { summary: true },
      findings: { findings: true },
      startedAt: new Date('2026-04-20T00:00:00.000Z'),
      completedAt: new Date('2026-04-20T00:00:01.000Z'),
    });
    fixture.diagnosisRegistryEditorialService.getLinkableDiagnosisRegistry.mockResolvedValueOnce(
      {
        diagnosisId: null,
        diagnosisRegistryId: 'registry-new',
        registry: {
          id: 'registry-new',
          canonicalName: 'Granulomatosis with polyangiitis',
          status: 'ACTIVE',
          category: null,
          specialty: null,
          searchPriority: 0,
          aliasPreview: [],
        },
      },
    );

    const result = await fixture.service.updateCaseDiagnosis(
      'case-1',
      'user-1',
      {
        canonicalDiagnosis: 'Granulomatosis with polyangiitis',
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'create-revision-diagnosis-update',
        changeReason: 'Update canonical diagnosis',
        changeSummary: 'Updated case diagnosis',
      },
    );

    expect(
      fixture.diagnosisRegistryEditorialService.createDiagnosis,
    ).toHaveBeenCalledWith(
      {
        canonicalName: 'Granulomatosis with polyangiitis',
      },
      fixture.prisma,
    );
    expect(
      fixture.caseRevisionService.createCaseRevisionCommandInTransaction,
    ).toHaveBeenCalledWith(
      fixture.prisma,
      expect.objectContaining({
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'create-revision-diagnosis-update',
        source: CaseSource.ADMIN_EDIT,
        createdByUserId: 'user-1',
        snapshot: expect.objectContaining({
          diagnosisId: null,
          diagnosisRegistryId: 'registry-new',
          diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
          diagnosisMappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
          diagnosisMappingConfidence: 1,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        diagnosisId: null,
        diagnosisRegistryId: 'registry-new',
        proposedDiagnosisText: 'Granulomatosis with polyangiitis',
      }),
    );
  });

  it('restoring a revision keeps diagnosis and diagnosisRegistry linkage synchronized', async () => {
    const fixture = createFixture();
    fixture.prisma.case.findUnique.mockResolvedValueOnce({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.REVIEW,
    });
    fixture.prisma.caseRevision.findFirst.mockResolvedValue({
      id: 'revision-old',
      revisionNumber: 3,
      title: 'Restored case',
      date: new Date('2026-04-20T00:00:00.000Z'),
      difficulty: 'medium',
      history: 'History',
      symptoms: ['cough'],
      labs: null,
      clues: [],
      explanation: {},
      differentials: [],
      diagnosisId: 'diagnosis-1',
      diagnosisRegistryId: null,
      proposedDiagnosisText: 'Asthma',
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.LEGACY_BACKFILL,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote: null,
    });
    fixture.prisma.case.update
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: 'case-1',
        editorialStatus: CaseEditorialStatus.VALIDATED,
        approvedAt: null,
        approvedByUserId: null,
        currentRevisionId: 'revision-new',
      });
    fixture.prisma.case.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.VALIDATED,
      approvedAt: null,
      approvedByUserId: null,
      currentRevisionId: 'revision-new',
    });
    fixture.prisma.caseValidationRun.create.mockResolvedValue({
      id: 'validation-1',
      outcome: ValidationOutcome.PASSED,
      validatorVersion: 'shadow:v1',
      startedAt: new Date('2026-04-20T00:00:00.000Z'),
      completedAt: new Date('2026-04-20T00:00:01.000Z'),
    });

    await fixture.service.restoreRevision('case-1', 'revision-old', 'user-1', {
      expectedRevisionId: 'revision-3',
      commandIdempotencyKey: 'create-revision-restore',
      changeReason: 'Restore historical revision',
      changeSummary: 'Restored prior revision',
    });

    expect(
      fixture.diagnosisRegistryLinkService.resolveForWrite,
    ).toHaveBeenCalledWith(
      {
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: null,
      },
      fixture.prisma,
    );
    expect(
      fixture.caseRevisionService.createCaseRevisionCommandInTransaction,
    ).toHaveBeenCalledWith(
      fixture.prisma,
      expect.objectContaining({
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'create-revision-restore',
        source: CaseSource.RESTORED,
        snapshot: expect.objectContaining({
          diagnosisId: 'diagnosis-1',
          diagnosisRegistryId: 'registry-1',
          proposedDiagnosisText: 'Asthma',
          diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
          diagnosisMappingMethod: DiagnosisMappingMethod.LEGACY_BACKFILL,
          diagnosisMappingConfidence: 1,
          diagnosisEditorialNote: null,
        }),
      }),
    );
    expect(fixture.prisma.caseValidationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revisionId: 'revision-new',
          materialContextHash: expect.any(String),
          reviewContextIdentity: expect.stringContaining(
            'case-review-context:revision-new:',
          ),
          source: CaseSource.RESTORED,
        }),
      }),
    );
  });

  function prepareGovernedApprovalFixture(
    options: {
      authorityAssignments?: AuthorityAssignment[];
    } = { authorityAssignments: [scopedAssignment()] },
  ) {
    const fixture = createFixture({
      authorityRegistry: authorityTypeRegistry,
      authorityAssignments: options.authorityAssignments,
    });
    fixture.prisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.REVIEW,
      currentRevisionId: 'revision-3',
    });
    fixture.prisma.caseReview.findFirst.mockResolvedValue({
      id: 'review-1',
      revisionId: 'revision-3',
      reviewerUserId: 'senior-1',
      materialContextHash: materialHash(),
      reviewContextIdentity: reviewContextIdentity(),
      createdAt: new Date('2026-04-20T00:00:00.500Z'),
    });
    fixture.prisma.caseRevision.findFirst.mockResolvedValue({
      ...materialRevision,
      createdByUserId: 'author-1',
    });
    fixture.prisma.user.findUnique.mockResolvedValue({
      id: 'senior-1',
      role: 'senior_editor',
    });
    fixture.prisma.caseValidationRun.findFirst.mockResolvedValue({
      id: 'validation-1',
      revisionId: 'revision-3',
      outcome: ValidationOutcome.PASSED,
      completedAt: new Date('2026-04-20T00:00:00.000Z'),
      findings: [{ severity: 'info', code: 'checked' }],
      materialContextHash: materialHash(),
      reviewContextIdentity: reviewContextIdentity(),
    });
    fixture.prisma.caseReview.update.mockResolvedValue({
      id: 'review-1',
      revisionId: 'revision-3',
      reviewerUserId: 'senior-1',
      decision: 'APPROVED',
      notes: 'Approved for pilot',
      materialContextHash: materialHash(),
      reviewContextIdentity: reviewContextIdentity(),
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      decidedAt: new Date('2026-04-20T00:00:01.000Z'),
    });
    fixture.prisma.governedCaseRevisionApprovalDecision.create.mockResolvedValue(
      {
        id: 'governance-decision-1',
      },
    );
    fixture.prisma.case.update.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.APPROVED,
      approvedAt: new Date('2026-04-20T00:00:01.000Z'),
      approvedByUserId: 'senior-1',
      currentRevisionId: 'revision-3',
    });

    return fixture;
  }

  it('approves an exact case revision through the governed command path', async () => {
    const fixture = prepareGovernedApprovalFixture();

    const result = await fixture.service.submitReview('case-1', 'senior-1', {
      decision: 'APPROVED' as any,
      expectedRevisionId: 'revision-3',
      expectedReviewId: 'review-1',
      commandIdempotencyKey: 'approve-case-1-revision-3',
      authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      notes: 'Approved for pilot',
    });

    expect(result.case.editorialStatus).toBe(CaseEditorialStatus.APPROVED);
    expect(
      fixture.prisma.governedCaseRevisionApprovalDecision.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commandAction: 'APPROVE_CASE_REVISION',
          commandIdempotencyKey: 'approve-case-1-revision-3',
          commandFingerprint: expect.any(String),
          envelopeSchemaVersion: '1.0.0',
          extensionType: 'CASE_REVISION_APPROVAL',
          extensionSchemaVersion: '1.0.0',
          status: 'FINALIZED',
          validatedEnvelope: expect.objectContaining({
            decisionType: 'APPROVE_CASE_REVISION',
            extensionPayload: expect.objectContaining({
              caseId: 'case-1',
              caseRevisionId: 'revision-3',
              reviewId: 'review-1',
              validationRunId: 'validation-1',
              materialContextHash: materialHash(),
            }),
          }),
          extensionPayload: expect.objectContaining({
            compatibilityProjectionEffect: expect.objectContaining({
              owner: 'APPROVE_CASE_REVISION',
              caseId: 'case-1',
              approvedByUserId: 'senior-1',
            }),
          }),
          actorType: 'USER',
          approvalRecordId: 'WEOS-AUTH-APP-006',
          authorityAssignmentId: 'aa-case-revision-approval-1',
          authorityResolvedAt: expect.any(String),
          actorUserId: 'senior-1',
          caseId: 'case-1',
          targetRevisionId: 'revision-3',
          expectedRevisionId: 'revision-3',
          reviewId: 'review-1',
          outcome: 'APPROVED',
          reviewBasis: expect.objectContaining({
            reviewId: 'review-1',
            caseRevisionId: 'revision-3',
            validationRunId: 'validation-1',
            validationOutcome: ValidationOutcome.PASSED,
            materialContextHash: materialHash(),
            reviewContextIdentity: reviewContextIdentity(),
          }),
          findings: [{ severity: 'info', code: 'checked' }],
          compatibilityProjection: expect.objectContaining({
            owner: 'APPROVE_CASE_REVISION',
            caseId: 'case-1',
            approvedByUserId: 'senior-1',
          }),
        }),
      }),
    );
    expect(fixture.prisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          editorialStatus: CaseEditorialStatus.APPROVED,
          approvedByUserId: 'senior-1',
        }),
      }),
    );
  });

  it('selects every open-review field required by runtime approval checks', async () => {
    const fixture = prepareGovernedApprovalFixture();

    await fixture.service.submitReview('case-1', 'senior-1', {
      decision: 'APPROVED' as any,
      expectedRevisionId: 'revision-3',
      commandIdempotencyKey: 'review-select-integrity',
      authorityAssignmentReferences: ['aa-case-revision-approval-1'],
    });

    expect(fixture.prisma.caseReview.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          revisionId: true,
          reviewerUserId: true,
          createdAt: true,
        }),
      }),
    );
  });

  it('rejects approval without an explicit expected revision', async () => {
    const fixture = prepareGovernedApprovalFixture();

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        commandIdempotencyKey: 'missing-revision',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('requires explicit expectedRevisionId');

    expect(fixture.prisma.caseReview.findFirst).not.toHaveBeenCalled();
  });

  it('rejects stale revision approval commands without mutation', async () => {
    const fixture = prepareGovernedApprovalFixture();

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-old',
        commandIdempotencyKey: 'stale-revision',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('expected revision does not match current revision');

    expect(
      fixture.prisma.governedCaseRevisionApprovalDecision.create,
    ).not.toHaveBeenCalled();
    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects senior editor role when no authority assignment resolves', async () => {
    const fixture = prepareGovernedApprovalFixture({
      authorityAssignments: [],
    });

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'senior-without-assignment',
      }),
    ).rejects.toThrow('Missing editorial approval authority');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects admin role when no authority assignment resolves', async () => {
    const fixture = prepareGovernedApprovalFixture({
      authorityAssignments: [],
    });
    fixture.prisma.caseReview.findFirst.mockResolvedValue({
      id: 'review-1',
      revisionId: 'revision-3',
      reviewerUserId: 'admin-1',
      materialContextHash: materialHash(),
      reviewContextIdentity: reviewContextIdentity(),
      createdAt: new Date('2026-04-20T00:00:00.500Z'),
    });

    await expect(
      fixture.service.submitReview('case-1', 'admin-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'admin-without-assignment',
      }),
    ).rejects.toThrow('Missing editorial approval authority');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects approval outside the active review authority scope', async () => {
    const fixture = prepareGovernedApprovalFixture({
      authorityAssignments: [
        scopedAssignment({
          scope: {
            artifactTypes: ['CASE_REVISION'],
            artifactIds: ['case-1'],
            artifactRevisionIds: ['revision-other'],
            decisionTypes: ['APPROVE_CASE_REVISION'],
          },
        }),
      ],
    });

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'out-of-scope-assignment',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('Missing editorial approval authority');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects approval when separation of duties is violated', async () => {
    const fixture = prepareGovernedApprovalFixture();
    fixture.prisma.caseRevision.findFirst.mockResolvedValue({
      ...materialRevision,
      createdByUserId: 'senior-1',
    });

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'same-author',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('separation of duties');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects approval when authorship provenance is unknown', async () => {
    const fixture = prepareGovernedApprovalFixture();
    fixture.prisma.caseRevision.findFirst.mockResolvedValue({
      ...materialRevision,
      createdByUserId: null,
    });

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'unknown-author',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('trusted authorship provenance');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects stale review context', async () => {
    const fixture = prepareGovernedApprovalFixture();
    fixture.prisma.caseReview.findFirst.mockResolvedValue({
      id: 'review-1',
      revisionId: 'revision-2',
      reviewerUserId: 'senior-1',
    });

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'stale-review-context',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('active review does not target current revision');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects blocking validation findings', async () => {
    const fixture = prepareGovernedApprovalFixture();
    fixture.prisma.caseValidationRun.findFirst.mockResolvedValue({
      id: 'validation-1',
      outcome: ValidationOutcome.FAILED,
      completedAt: new Date('2026-04-20T00:00:00.000Z'),
      findings: [{ code: 'blocking' }],
    });

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'blocking-validation',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('blocked by validation findings');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('does not update compatibility projections if decision creation fails', async () => {
    const fixture = prepareGovernedApprovalFixture();
    fixture.prisma.governedCaseRevisionApprovalDecision.create.mockRejectedValue(
      new Error('decision write failed'),
    );

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'rollback-before-projection',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('decision write failed');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('replays identical idempotent approval without creating a duplicate decision', async () => {
    const fixture = prepareGovernedApprovalFixture();
    fixture.prisma.case.findUnique
      .mockResolvedValueOnce({
        id: 'case-1',
        editorialStatus: CaseEditorialStatus.APPROVED,
        currentRevisionId: 'revision-3',
      })
      .mockResolvedValueOnce({
        id: 'case-1',
        editorialStatus: CaseEditorialStatus.APPROVED,
        approvedAt: new Date('2026-04-20T00:00:01.000Z'),
        approvedByUserId: 'senior-1',
        currentRevisionId: 'revision-3',
      });
    fixture.prisma.governedCaseRevisionApprovalDecision.findUnique.mockResolvedValue(
      {
        commandFingerprint:
          '{"actorUserId":"senior-1","authorityAssignmentReferences":["aa-case-revision-approval-1"],"caseId":"case-1","commandAction":"APPROVE_CASE_REVISION","decision":"APPROVED","expectedReviewId":"review-1","expectedRevisionId":"revision-3","rationale":null}',
        caseId: 'case-1',
        reviewId: 'review-1',
        targetRevisionId: 'revision-3',
      },
    );
    fixture.prisma.caseReview.findUnique.mockResolvedValue({
      id: 'review-1',
      revisionId: 'revision-3',
      reviewerUserId: 'senior-1',
      decision: 'APPROVED',
      notes: null,
      createdAt: new Date('2026-04-20T00:00:00.500Z'),
      decidedAt: new Date('2026-04-20T00:00:01.000Z'),
    });

    const result = await fixture.service.submitReview('case-1', 'senior-1', {
      decision: 'APPROVED' as any,
      expectedRevisionId: 'revision-3',
      expectedReviewId: 'review-1',
      commandIdempotencyKey: 'already-approved',
      authorityAssignmentReferences: ['aa-case-revision-approval-1'],
    });

    expect(result.case.editorialStatus).toBe(CaseEditorialStatus.APPROVED);
    expect(
      fixture.prisma.governedCaseRevisionApprovalDecision.create,
    ).not.toHaveBeenCalled();
    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects idempotency key reuse with a different revision', async () => {
    const fixture = prepareGovernedApprovalFixture();
    fixture.prisma.governedCaseRevisionApprovalDecision.findUnique.mockResolvedValue(
      {
        commandFingerprint: 'prior-fingerprint',
        caseId: 'case-1',
        reviewId: 'review-1',
        targetRevisionId: 'revision-3',
      },
    );

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-other',
        commandIdempotencyKey: 'already-approved',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('Idempotency conflict');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects idempotency key reuse with a different actor', async () => {
    const fixture = prepareGovernedApprovalFixture();
    fixture.prisma.governedCaseRevisionApprovalDecision.findUnique.mockResolvedValue(
      {
        commandFingerprint:
          '{"actorUserId":"senior-1","authorityAssignmentReferences":["aa-case-revision-approval-1"],"caseId":"case-1","commandAction":"APPROVE_CASE_REVISION","decision":"APPROVED","expectedReviewId":"review-1","expectedRevisionId":"revision-3","rationale":null}',
        caseId: 'case-1',
        reviewId: 'review-1',
        targetRevisionId: 'revision-3',
      },
    );

    await expect(
      fixture.service.submitReview('case-1', 'senior-2', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        expectedReviewId: 'review-1',
        commandIdempotencyKey: 'already-approved',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('Idempotency conflict');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('loads persisted active authority through the repository boundary', async () => {
    const repository = new EditorialAuthorityAssignmentRepository();
    const prisma: any = {
      editorialAuthorityAssignment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'aa-case-revision-approval-1',
            assignmentSchemaVersion: '1.0.0',
            subjectType: 'USER',
            subjectId: 'senior-1',
            authorityType: 'CASE_REVISION_APPROVAL',
            authorityTypeSchemaVersion: '1.0.0',
            status: 'ACTIVE',
            scopeMode: 'SCOPED',
            scope: scopedAssignment().scope,
            allowedDecisionTypes: ['APPROVE_CASE_REVISION'],
            authorityEvidenceReference:
              'docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-006.json',
            grantingAuthoritySnapshot: {
              authorityRecordId: 'WEOS-AUTH-APP-006',
            },
            grantedByActorType: 'USER',
            grantedByActorId: 'architecture-authority',
            grantingAuthorityAssignmentId: 'aa-bootstrap-app-006',
            grantedAt: new Date('2026-08-08T00:00:00.000Z'),
            validFrom: new Date('2026-08-08T00:00:00.000Z'),
            validUntil: null,
            reviewDueAt: null,
            rationale: 'APP-006 case revision approval pilot authority.',
            delegationAllowed: false,
            maximumDelegationDepth: 0,
            parentAssignmentId: null,
            humanAuthorityActorId: 'senior-1',
            suspendedAt: null,
            revokedAt: null,
            revokedByActorId: null,
            supersededByAssignmentId: null,
          },
        ]),
      },
    };

    const assignments = await repository.loadCandidatesForApproval(prisma, {
      actorUserId: 'senior-1',
      authorityType: 'CASE_REVISION_APPROVAL',
      decisionType: 'APPROVE_CASE_REVISION',
      assignmentReferences: ['aa-case-revision-approval-1'],
    });

    expect(prisma.editorialAuthorityAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subjectType: 'USER',
          subjectId: 'senior-1',
          authorityType: 'CASE_REVISION_APPROVAL',
          allowedDecisionTypes: { has: 'APPROVE_CASE_REVISION' },
          id: { in: ['aa-case-revision-approval-1'] },
        }),
      }),
    );
    expect(assignments).toEqual([scopedAssignment()]);
  });

  it('rejects expired persisted authority assignments', async () => {
    const fixture = prepareGovernedApprovalFixture({
      authorityAssignments: [
        scopedAssignment({
          validUntil: '2026-01-01T00:00:00.000Z',
        }),
      ],
    });

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'expired-assignment',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('Missing editorial approval authority');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects revoked persisted authority assignments', async () => {
    const fixture = prepareGovernedApprovalFixture({
      authorityAssignments: [
        scopedAssignment({
          status: 'REVOKED',
          revokedAt: '2026-04-01T00:00:00.000Z',
          revokedByActorId: 'architecture-authority',
        }),
      ],
    });

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'revoked-assignment',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('Missing editorial approval authority');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects material review-context hash mismatches', async () => {
    const fixture = prepareGovernedApprovalFixture();
    fixture.prisma.caseReview.findFirst.mockResolvedValue({
      id: 'review-1',
      revisionId: 'revision-3',
      reviewerUserId: 'senior-1',
      materialContextHash: materialHash({ history: 'Earlier history' }),
      reviewContextIdentity: reviewContextIdentity(
        materialHash({ history: 'Earlier history' }),
      ),
      createdAt: new Date('2026-04-20T00:00:00.500Z'),
    });

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'material-context-mismatch',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('material review context does not match');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('rejects validation basis mismatches for the reviewed material context', async () => {
    const fixture = prepareGovernedApprovalFixture();
    fixture.prisma.caseValidationRun.findFirst.mockResolvedValue({
      id: 'validation-1',
      revisionId: 'revision-3',
      outcome: ValidationOutcome.PASSED,
      completedAt: new Date('2026-04-20T00:00:00.000Z'),
      findings: [{ severity: 'info', code: 'checked' }],
      materialContextHash: materialHash({ symptoms: ['cough', 'fever'] }),
      reviewContextIdentity: reviewContextIdentity(
        materialHash({ symptoms: ['cough', 'fever'] }),
      ),
    });

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        commandIdempotencyKey: 'validation-context-mismatch',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('validation basis does not match');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('validates a complete APP-006 OD-018 decision envelope', () => {
    const facts = app006EnvelopeFacts();
    const envelope = buildApp006GovernanceDecisionEnvelope(facts);

    expect(validateApp006GovernanceDecisionEnvelope(envelope, facts)).toEqual(
      [],
    );
  });

  it('rejects APP-006 envelopes with invalid target references', () => {
    const facts = app006EnvelopeFacts();
    const envelope = buildApp006GovernanceDecisionEnvelope(facts);

    expect(
      validateApp006GovernanceDecisionEnvelope(
        {
          ...envelope,
          targetReferences: envelope.targetReferences.map((target) =>
            target.artifactType === 'CASE_REVIEW'
              ? { ...target, artifactRevisionId: 'revision-other' }
              : target,
          ),
        },
        facts,
      ),
    ).toEqual(
      expect.arrayContaining([
        'CASE_REVIEW target reference is missing or stale.',
      ]),
    );
  });

  it('rejects APP-006 envelopes with authority evidence mismatch', () => {
    const facts = app006EnvelopeFacts();
    const envelope = buildApp006GovernanceDecisionEnvelope(facts);

    expect(
      validateApp006GovernanceDecisionEnvelope(
        {
          ...envelope,
          authority: {
            ...envelope.authority,
            authorityAssignmentId: 'aa-other',
          },
        },
        facts,
      ),
    ).toEqual(
      expect.arrayContaining([
        'authority evidence does not match resolved assignment.',
      ]),
    );
  });

  it('rejects APP-006 envelopes with non-empty obligations', () => {
    const facts = app006EnvelopeFacts();
    const envelope = buildApp006GovernanceDecisionEnvelope(facts);

    expect(
      validateApp006GovernanceDecisionEnvelope(
        {
          ...envelope,
          obligations: ['Do more work'],
        },
        facts,
      ),
    ).toEqual(
      expect.arrayContaining([
        'APP-006 approval requires empty remaining obligations.',
      ]),
    );
  });

  it('rejects APP-006 envelopes with false projection metadata', () => {
    const facts = app006EnvelopeFacts();
    const envelope = buildApp006GovernanceDecisionEnvelope(facts);

    expect(
      validateApp006GovernanceDecisionEnvelope(
        {
          ...envelope,
          extensionPayload: {
            ...envelope.extensionPayload,
            compatibilityProjectionEffect: {
              ...facts.compatibilityProjectionEffect,
              approvedByUserId: 'other-user',
            },
          },
        },
        facts,
      ),
    ).toEqual(
      expect.arrayContaining([
        'compatibility projection metadata does not match effect.',
      ]),
    );
  });

  it('semantically rejects malformed APP-006 OD-018 envelopes', () => {
    const facts = app006EnvelopeFacts();
    const envelope = buildApp006GovernanceDecisionEnvelope(facts);

    const cases = [
      {
        envelope: { ...envelope, envelopeSchemaVersion: '9.9.9' },
        message: 'envelopeSchemaVersion is not supported for APP-006.',
      },
      {
        envelope: { ...envelope, status: 'DRAFT' as const },
        message: 'APP-006 approval decision status must be FINALIZED.',
      },
      {
        envelope: {
          ...envelope,
          actor: { ...envelope.actor, actorType: 'SYSTEM' },
        },
        message: 'APP-006 approval actor type must be USER.',
      },
      {
        envelope: { ...envelope, occurredAt: 'not-a-date' },
        message: 'occurredAt must be an ISO date-time.',
      },
      {
        envelope: {
          ...envelope,
          authority: {
            ...envelope.authority,
            authorityResolvedAt: '2026-04-20T00:00:02.000Z',
          },
        },
        message: 'authorityResolvedAt cannot be after approval decision time.',
      },
      {
        envelope: { ...envelope, rationale: '' },
        message: 'APP-006 approval rationale is required.',
      },
      {
        envelope: {
          ...envelope,
          targetReferences: [
            ...envelope.targetReferences,
            {
              artifactType: 'DAILY_CASE',
              artifactId: 'daily-1',
              artifactRevisionId: 'revision-3',
              targetScope: 'EXACT_REVISION',
            },
          ],
        },
        message: 'Unsupported APP-006 target reference type: DAILY_CASE.',
      },
      {
        envelope: {
          ...envelope,
          targetReferences: [
            ...envelope.targetReferences,
            envelope.targetReferences[0],
          ],
        },
        message: 'APP-006 targetReferences must not contain duplicates.',
      },
      {
        envelope: {
          ...envelope,
          targetReferences: envelope.targetReferences.map((target) =>
            target.artifactType === 'CASE_REVIEW'
              ? { ...target, artifactRevisionId: 'revision-other' }
              : target,
          ),
        },
        message: 'CASE_REVIEW target reference is unsupported or stale.',
      },
      {
        envelope: {
          ...envelope,
          targetReferences: envelope.targetReferences.map((target) =>
            target.artifactType === 'CASE_VALIDATION_RUN'
              ? { ...target, artifactId: 'validation-other' }
              : target,
          ),
        },
        message:
          'CASE_VALIDATION_RUN target reference is unsupported or stale.',
      },
    ];

    for (const scenario of cases) {
      expect(
        validateApp006GovernanceDecisionEnvelope(
          scenario.envelope as ReturnType<
            typeof buildApp006GovernanceDecisionEnvelope
          >,
          facts,
        ),
      ).toEqual(expect.arrayContaining([scenario.message]));
    }
  });

  it('wires the APP-006 authority registry through Nest providers', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        app006AuthorityTypeRegistryProvider,
        CaseReviewService,
        EditorialAuthorityAssignmentRepository,
        { provide: PrismaService, useValue: {} },
        { provide: CaseRevisionService, useValue: {} },
        { provide: CaseValidationService, useValue: {} },
        { provide: EditorialMetricsService, useValue: {} },
        { provide: DiagnosisRegistryLinkService, useValue: {} },
        { provide: DiagnosisRegistryEditorialService, useValue: {} },
        { provide: CaseEligibilityPolicyService, useValue: {} },
        { provide: DiagnosisGraphExtractionService, useValue: undefined },
        { provide: CaseQualityProjectionService, useValue: {} },
      ],
    }).compile();

    expect(moduleRef.get(CaseReviewService)).toBeInstanceOf(CaseReviewService);
    const registry = moduleRef.get<AuthorityTypeRegistry>(
      APP006_AUTHORITY_TYPE_REGISTRY,
    );
    expect(registry.definitions).toEqual([
      expect.objectContaining({
        authorityType: 'CASE_REVISION_APPROVAL',
        authorityTypeSchemaVersion: '1.0.0',
        status: 'APPROVED',
        allowedDecisionTypes: ['APPROVE_CASE_REVISION'],
      }),
    ]);

    const authorized = resolveGovernedAuthority({
      actorContext: {
        actorType: 'USER',
        actorId: 'senior-1',
        runtimeRoles: [],
        organizationContextIds: [],
        specialtyContextIds: [],
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
        correlationId: 'approval-1',
        causationId: 'review-1',
        requestedAt: '2026-08-09T00:00:00.000Z',
      },
      assignments: [scopedAssignment()],
      authorityTypeRegistry: registry,
      request: {
        authorityType: 'CASE_REVISION_APPROVAL',
        decisionType: 'APPROVE_CASE_REVISION',
        artifactType: 'CASE_REVISION',
        artifactId: 'case-1',
        artifactRevisionId: 'revision-3',
      },
      evaluatedAt: '2026-08-09T00:00:00.000Z',
      hasRequiredTechnicalAccess: true,
    });
    expect(authorized.status).toBe('AUTHORIZED');

    const unregistered = resolveGovernedAuthority({
      actorContext: {
        actorType: 'USER',
        actorId: 'senior-1',
        runtimeRoles: ['senior_editor'],
        organizationContextIds: [],
        specialtyContextIds: [],
        authorityAssignmentReferences: [],
        correlationId: 'approval-2',
        causationId: 'review-1',
        requestedAt: '2026-04-20T00:00:00.000Z',
      },
      assignments: [
        scopedAssignment({
          assignmentId: 'aa-unregistered',
          authorityType: 'UNREGISTERED_AUTHORITY',
        }),
      ],
      authorityTypeRegistry: registry,
      request: {
        authorityType: 'UNREGISTERED_AUTHORITY',
        decisionType: 'APPROVE_CASE_REVISION',
        artifactType: 'CASE_REVISION',
        artifactId: 'case-1',
        artifactRevisionId: 'revision-3',
      },
      evaluatedAt: '2026-04-20T00:00:00.000Z',
      hasRequiredTechnicalAccess: true,
    });
    expect(unregistered.status).toBe('DENIED');
    expect(unregistered.reasons).toContain('UNREGISTERED_AUTHORITY_TYPE');

    const roleOnly = resolveGovernedAuthority({
      actorContext: {
        actorType: 'USER',
        actorId: 'senior-1',
        runtimeRoles: ['senior_editor'],
        organizationContextIds: [],
        specialtyContextIds: [],
        authorityAssignmentReferences: [],
        correlationId: 'approval-3',
        causationId: 'review-1',
        requestedAt: '2026-04-20T00:00:00.000Z',
      },
      assignments: [],
      authorityTypeRegistry: registry,
      request: {
        authorityType: 'CASE_REVISION_APPROVAL',
        decisionType: 'APPROVE_CASE_REVISION',
        artifactType: 'CASE_REVISION',
        artifactId: 'case-1',
        artifactRevisionId: 'revision-3',
      },
      evaluatedAt: '2026-04-20T00:00:00.000Z',
      hasRequiredTechnicalAccess: true,
    });
    expect(roleOnly.status).toBe('DENIED');
    expect(roleOnly.reasons).toContain('MISSING_AUTHORITY_ASSIGNMENT');
  });

  it('replays an identical approval after a concurrent idempotency uniqueness race', async () => {
    const fixture = prepareGovernedApprovalFixture();
    const commandFingerprint =
      '{"actorUserId":"senior-1","authorityAssignmentReferences":["aa-case-revision-approval-1"],"caseId":"case-1","commandAction":"APPROVE_CASE_REVISION","decision":"APPROVED","expectedReviewId":"review-1","expectedRevisionId":"revision-3","rationale":null}';
    const transactionDecisionLookup = jest.fn().mockResolvedValue(null);
    const transactionCreate = jest.fn().mockRejectedValue({
      code: 'P2002',
      meta: { target: ['commandIdempotencyKey'] },
    });
    fixture.prisma.$transaction.mockImplementationOnce(async (handler: any) =>
      handler({
        ...fixture.prisma,
        case: {
          ...fixture.prisma.case,
          findUnique: jest.fn().mockResolvedValue({
            id: 'case-1',
            editorialStatus: CaseEditorialStatus.REVIEW,
            currentRevisionId: 'revision-3',
          }),
        },
        governedCaseRevisionApprovalDecision: {
          ...fixture.prisma.governedCaseRevisionApprovalDecision,
          findUnique: transactionDecisionLookup,
          create: transactionCreate,
        },
      }),
    );
    fixture.prisma.governedCaseRevisionApprovalDecision.findUnique.mockResolvedValue(
      {
        commandIdempotencyKey: 'race-replay',
        commandFingerprint,
        caseId: 'case-1',
        reviewId: 'review-1',
        targetRevisionId: 'revision-3',
      },
    );
    fixture.prisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.APPROVED,
      approvedAt: new Date('2026-04-20T00:00:01.000Z'),
      approvedByUserId: 'senior-1',
      currentRevisionId: 'revision-3',
    });
    fixture.prisma.caseReview.findUnique.mockResolvedValue({
      id: 'review-1',
      revisionId: 'revision-3',
      reviewerUserId: 'senior-1',
      decision: 'APPROVED',
      notes: null,
      createdAt: new Date('2026-04-20T00:00:00.500Z'),
      decidedAt: new Date('2026-04-20T00:00:01.000Z'),
    });

    const result = await fixture.service.submitReview('case-1', 'senior-1', {
      decision: 'APPROVED' as any,
      expectedRevisionId: 'revision-3',
      expectedReviewId: 'review-1',
      commandIdempotencyKey: 'race-replay',
      authorityAssignmentReferences: ['aa-case-revision-approval-1'],
    });

    expect(result.case.editorialStatus).toBe(CaseEditorialStatus.APPROVED);
    expect(transactionDecisionLookup).toHaveBeenCalledTimes(1);
    expect(transactionCreate).toHaveBeenCalledTimes(1);
    expect(
      fixture.prisma.governedCaseRevisionApprovalDecision.findUnique,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { commandIdempotencyKey: 'race-replay' },
      }),
    );
    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('returns deterministic conflict after a concurrent idempotency fingerprint mismatch', async () => {
    const fixture = prepareGovernedApprovalFixture();
    fixture.prisma.governedCaseRevisionApprovalDecision.findUnique.mockResolvedValue(
      {
        commandIdempotencyKey: 'race-conflict',
        commandFingerprint: 'different-command',
        caseId: 'case-1',
        reviewId: 'review-1',
        targetRevisionId: 'revision-3',
      },
    );
    fixture.prisma.governedCaseRevisionApprovalDecision.create.mockRejectedValue(
      {
        code: 'P2002',
        meta: { target: ['commandIdempotencyKey'] },
      },
    );

    await expect(
      fixture.service.submitReview('case-1', 'senior-1', {
        decision: 'APPROVED' as any,
        expectedRevisionId: 'revision-3',
        expectedReviewId: 'review-1',
        commandIdempotencyKey: 'race-conflict',
        authorityAssignmentReferences: ['aa-case-revision-approval-1'],
      }),
    ).rejects.toThrow('Idempotency conflict');

    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });

  it('marks an approved diagnosis-ready case as ready to publish', async () => {
    const fixture = createFixture();
    fixture.prisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.APPROVED,
      approvedAt: new Date('2026-04-20T00:00:00.000Z'),
      approvedByUserId: 'reviewer-1',
      diagnosisRegistryId: 'registry-1',
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      clues: [{ type: 'history', value: 'Wheeze', order: 0 }],
      diagnosisRegistry: {
        status: 'ACTIVE',
      },
    });
    fixture.prisma.case.update.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      approvedAt: new Date('2026-04-20T00:00:00.000Z'),
      approvedByUserId: 'reviewer-1',
      currentRevisionId: 'revision-1',
    });

    const result = await fixture.service.markReadyToPublish('case-1');

    expect(result.editorialStatus).toBe(CaseEditorialStatus.READY_TO_PUBLISH);
    expect(fixture.prisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-1' },
        data: {
          editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        },
      }),
    );
  });

  it('blocks ready-to-publish when diagnosis readiness is unresolved', async () => {
    const fixture = createFixture();
    fixture.prisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.APPROVED,
      approvedAt: new Date('2026-04-20T00:00:00.000Z'),
      approvedByUserId: 'reviewer-1',
      diagnosisRegistryId: null,
      diagnosisMappingStatus: DiagnosisMappingStatus.UNRESOLVED,
      clues: [{ type: 'history', value: 'Wheeze', order: 0 }],
      diagnosisRegistry: null,
    });

    await expect(fixture.service.markReadyToPublish('case-1')).rejects.toThrow(
      'Case diagnosis is not ready for publish: missing_registry_link',
    );
    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });
});
