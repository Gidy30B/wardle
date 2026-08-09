import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  CaseEditorialStatus,
  CaseSource,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  Prisma,
  ReviewDecision,
  ValidationOutcome,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import { CaseRevisionService } from '../case-validation/case-revision.service.js';
import { CaseValidationService } from '../case-validation/case-validation.service.js';
import { DiagnosisRegistryEditorialService } from '../diagnosis-registry/diagnosis-registry-editorial.service.js';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service.js';
import { normalizeDiagnosisTerm } from '../diagnosis-registry/diagnosis-term-normalizer.js';
import { EditorialMetricsService } from '../editorial/editorial-metrics.service.js';
import { DiagnosisGraphExtractionService } from '../diagnosis-graph/diagnosis-graph-extraction.service.js';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service.js';
import { getApprovalResetFields } from '../editorial/policies/approval-policy.js';
import { getCaseDiagnosisPublishReadiness } from '../editorial/policies/diagnosis-publish-readiness.policy.js';
import {
  canMoveToReadyToPublish,
  canStartEditorialReview,
  getEditorialStatusForReviewDecision,
  getEditorialStatusForValidationOutcome,
} from '../editorial/policies/editorial-transition.policy.js';
import {
  getEditorialStatusesForQueue,
  type EditorialQueueFilter,
} from '../editorial/policies/publish-policy.js';
import type { CreateAndLinkDiagnosisDto } from './dto/create-and-link-diagnosis.dto.js';
import type { CreateDiagnosisAliasDto } from './dto/create-diagnosis-alias.dto.js';
import type { CreateDiagnosisRegistryDto } from './dto/create-diagnosis-registry.dto.js';
import type { LinkCaseDiagnosisDto } from './dto/link-case-diagnosis.dto.js';
import type { ListEditorialCasesDto } from './dto/list-editorial-cases.dto.js';
import type { SearchDiagnosisRegistryDto } from './dto/search-diagnosis-registry.dto.js';
import type { SubmitCaseReviewDto } from './dto/submit-case-review.dto.js';
import type { UpdateCaseDiagnosisDto } from './dto/update-case-diagnosis.dto.js';
import type { UpdateDiagnosisRegistryMetadataDto } from './dto/update-diagnosis-registry-metadata.dto.js';
import { CaseQualityProjectionService } from './case-quality-projection.service.js';
import {
  resolveGovernedAuthority,
  type AuthorityTypeRegistry,
} from '../editorial-governance/authority-assignment/index.js';
import { stableStringify } from '../editorial-governance/governed-command/index.js';
import { EditorialAuthorityAssignmentRepository } from './editorial-authority-assignment.repository.js';
import {
  APP006_AUTHORITY_TYPE_REGISTRY,
  createApp006AuthorityTypeRegistry,
} from './app006-authority-registry.js';
import {
  APP006_ACTION,
  APP006_ENVELOPE_SCHEMA_VERSION,
  APP006_EXTENSION_SCHEMA_VERSION,
  APP006_EXTENSION_TYPE,
  buildApp006GovernanceDecisionEnvelope,
  validateApp006GovernanceDecisionEnvelope,
  type App006CompatibilityProjectionEffect,
} from './app006-case-revision-approval.decision.js';

type ReviewTransactionClient = Prisma.TransactionClient | PrismaClient;
type App006UniqueConflictTarget =
  | 'commandIdempotencyKey'
  | 'reviewId'
  | 'serializableWriteConflict'
  | 'unknown';

type App006ApprovalTestHooks = {
  beforeDecisionCreate?: () => Promise<void> | void;
  afterRollbackReplayLookup?: (input: {
    conflictTarget: App006UniqueConflictTarget;
  }) => Promise<void> | void;
};

const GOVERNED_CASE_REVISION_APPROVAL_ACTION = APP006_ACTION;
const GOVERNED_CASE_REVISION_APPROVAL_RECORD_ID = 'WEOS-AUTH-APP-006';
const GOVERNED_CASE_REVISION_APPROVAL_AUTHORITY_TYPE = 'CASE_REVISION_APPROVAL';
const GOVERNED_CASE_REVISION_APPROVAL_EXTENSION_TYPE = APP006_EXTENSION_TYPE;
const GOVERNED_CASE_REVISION_APPROVAL_ENVELOPE_SCHEMA_VERSION =
  APP006_ENVELOPE_SCHEMA_VERSION;
const GOVERNED_CASE_REVISION_APPROVAL_EXTENSION_SCHEMA_VERSION =
  APP006_EXTENSION_SCHEMA_VERSION;

const CASE_REVISION_MATERIAL_SELECT = {
  id: true,
  caseId: true,
  title: true,
  date: true,
  difficulty: true,
  history: true,
  symptoms: true,
  labs: true,
  clues: true,
  explanation: true,
  differentials: true,
  diagnosisId: true,
  diagnosisRegistryId: true,
  proposedDiagnosisText: true,
  diagnosisMappingStatus: true,
  diagnosisMappingMethod: true,
  diagnosisMappingConfidence: true,
  diagnosisEditorialNote: true,
} satisfies Prisma.CaseRevisionSelect;

const EDITORIAL_CASE_LIST_SELECT: Prisma.CaseSelect = {
  id: true,
  title: true,
  date: true,
  difficulty: true,
  editorialStatus: true,
  approvedAt: true,
  approvedByUserId: true,
  currentRevisionId: true,
  diagnosisRegistryId: true,
  proposedDiagnosisText: true,
  diagnosisMappingStatus: true,
  diagnosisMappingMethod: true,
  diagnosisMappingConfidence: true,
  diagnosisEditorialNote: true,
  diagnosis: {
    select: {
      id: true,
      name: true,
      system: true,
    },
  },
  diagnosisRegistry: {
    select: {
      id: true,
      displayLabel: true,
      canonicalName: true,
      status: true,
      category: true,
      specialty: true,
      bodySystem: true,
    },
  },
  currentRevision: {
    select: {
      id: true,
      revisionNumber: true,
      source: true,
      createdAt: true,
      diagnosisId: true,
      diagnosisRegistryId: true,
      proposedDiagnosisText: true,
      diagnosisMappingStatus: true,
      diagnosisMappingMethod: true,
      diagnosisMappingConfidence: true,
      diagnosisEditorialNote: true,
    },
  },
  validationRuns: {
    orderBy: [{ startedAt: 'desc' }],
    take: 1,
    select: {
      id: true,
      revisionId: true,
      source: true,
      outcome: true,
      validatorVersion: true,
      startedAt: true,
      completedAt: true,
      summary: true,
    },
  },
  reviews: {
    orderBy: [{ createdAt: 'desc' }],
    take: 1,
    select: {
      id: true,
      revisionId: true,
      reviewerUserId: true,
      decision: true,
      notes: true,
      createdAt: true,
      decidedAt: true,
    },
  },
};

const EDITORIAL_CASE_DETAIL_SELECT: Prisma.CaseSelect = {
  id: true,
  title: true,
  date: true,
  difficulty: true,
  history: true,
  symptoms: true,
  labs: true,
  clues: true,
  explanation: true,
  differentials: true,
  differentialLinks: {
    orderBy: [{ role: 'asc' }, { sourceText: 'asc' }],
    select: {
      id: true,
      role: true,
      confidence: true,
      sourceText: true,
      diagnosisRegistryId: true,
      diagnosisRegistry: {
        select: {
          id: true,
          displayLabel: true,
          canonicalName: true,
        },
      },
    },
  },
  diagnosisId: true,
  diagnosisRegistryId: true,
  proposedDiagnosisText: true,
  diagnosisMappingStatus: true,
  diagnosisMappingMethod: true,
  diagnosisMappingConfidence: true,
  diagnosisEditorialNote: true,
  editorialStatus: true,
  approvedAt: true,
  approvedByUserId: true,
  currentRevisionId: true,
  diagnosis: {
    select: {
      id: true,
      name: true,
      system: true,
    },
  },
  diagnosisRegistry: {
    select: {
      id: true,
      displayLabel: true,
      canonicalName: true,
      status: true,
      category: true,
      specialty: true,
      bodySystem: true,
    },
  },
  currentRevision: {
    select: {
      id: true,
      revisionNumber: true,
      source: true,
      createdByUserId: true,
      createdAt: true,
      title: true,
      date: true,
      difficulty: true,
      history: true,
      symptoms: true,
      labs: true,
      clues: true,
      explanation: true,
      differentials: true,
      diagnosisId: true,
      diagnosisRegistryId: true,
      proposedDiagnosisText: true,
      diagnosisMappingStatus: true,
      diagnosisMappingMethod: true,
      diagnosisMappingConfidence: true,
      diagnosisEditorialNote: true,
    },
  },
  validationRuns: {
    orderBy: [{ startedAt: 'desc' }],
    take: 1,
    select: {
      id: true,
      revisionId: true,
      source: true,
      publishTrack: true,
      outcome: true,
      validatorVersion: true,
      summary: true,
      findings: true,
      triggeredByUserId: true,
      startedAt: true,
      completedAt: true,
    },
  },
  reviews: {
    orderBy: [{ createdAt: 'desc' }],
    take: 1,
    select: {
      id: true,
      revisionId: true,
      reviewerUserId: true,
      decision: true,
      notes: true,
      source: true,
      publishTrack: true,
      createdAt: true,
      decidedAt: true,
    },
  },
};

@Injectable()
export class CaseReviewService {
  private readonly logger = new Logger(CaseReviewService.name);
  private app006ApprovalTestHooks?: App006ApprovalTestHooks;

  constructor(
    private readonly prisma: PrismaService,
    private readonly caseRevisionService: CaseRevisionService,
    private readonly caseValidationService: CaseValidationService,
    private readonly editorialMetrics: EditorialMetricsService,
    private readonly diagnosisRegistryLinkService: DiagnosisRegistryLinkService,
    private readonly diagnosisRegistryEditorialService: DiagnosisRegistryEditorialService,
    private readonly caseEligibilityPolicy: CaseEligibilityPolicyService,
    private readonly diagnosisGraphExtractionService?: DiagnosisGraphExtractionService,
    private readonly caseQualityProjectionService: CaseQualityProjectionService = new CaseQualityProjectionService(),
    @Inject(APP006_AUTHORITY_TYPE_REGISTRY)
    private readonly caseRevisionApprovalAuthorityTypeRegistry: AuthorityTypeRegistry = createApp006AuthorityTypeRegistry(),
    private readonly editorialAuthorityAssignmentRepository: EditorialAuthorityAssignmentRepository = new EditorialAuthorityAssignmentRepository(),
  ) {}

  setApp006ApprovalTestHooksForTest(hooks?: App006ApprovalTestHooks) {
    this.app006ApprovalTestHooks = hooks;
  }

  async listEditorialCases(query: ListEditorialCasesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const queueStatuses = query.status
      ? undefined
      : getEditorialStatusesForQueue(query.queue);
    const where: Prisma.CaseWhereInput = query.status
      ? {
          editorialStatus: query.status,
        }
      : queueStatuses
        ? {
            editorialStatus: {
              in: [...queueStatuses],
            },
          }
        : {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.case.count({ where }),
      this.prisma.case.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: EDITORIAL_CASE_LIST_SELECT,
      }),
    ]);

    return {
      items: items.map((item) => this.attachDiagnosisEditorialSummary(item)),
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      filters: {
        status: query.status ?? null,
        queue: (query.status
          ? 'all'
          : (query.queue ?? 'all')) as EditorialQueueFilter,
      },
    };
  }

  async getCaseDetail(caseId: string) {
    return this.getCaseDetailRecord(this.prisma, caseId);
  }

  async searchDiagnosisRegistry(query: SearchDiagnosisRegistryDto) {
    return this.diagnosisRegistryEditorialService.search({
      query: query.q,
      limit: query.limit,
      status: query.status,
    });
  }

  async createDiagnosisRegistry(input: CreateDiagnosisRegistryDto) {
    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        (tx) =>
          this.diagnosisRegistryEditorialService.createDiagnosis(
            {
              canonicalName: input.canonicalName,
              aliases: input.aliases,
              category: input.category,
              specialty: input.specialty,
              subspecialty: input.subspecialty,
              bodySystem: input.bodySystem,
              organSystem: input.organSystem,
              difficultyBand: input.difficultyBand,
              rarityBand: input.rarityBand,
              clinicalSetting: input.clinicalSetting,
              ageGroup: input.ageGroup,
              urgencyLevel: input.urgencyLevel,
              isPlayable: input.isPlayable,
              isGeneratable: input.isGeneratable,
              preferredClueTypes: input.preferredClueTypes,
              excludedClueTypes: input.excludedClueTypes,
              isDescriptive: input.isDescriptive,
              isCompositional: input.isCompositional,
              notes: input.notes,
              searchPriority: input.searchPriority,
            },
            tx,
          ),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
  }

  async addDiagnosisAlias(
    diagnosisRegistryId: string,
    input: CreateDiagnosisAliasDto,
  ) {
    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        (tx) =>
          this.diagnosisRegistryEditorialService.addAlias(
            diagnosisRegistryId,
            input,
            tx,
          ),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
  }

  async updateDiagnosisRegistryMetadata(
    diagnosisRegistryId: string,
    input: UpdateDiagnosisRegistryMetadataDto,
  ) {
    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        (tx) =>
          this.diagnosisRegistryEditorialService.updateMetadata(
            diagnosisRegistryId,
            input,
            tx,
          ),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
  }

  async linkDiagnosisToCase(
    caseId: string,
    createdByUserId: string,
    input: LinkCaseDiagnosisDto,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.diagnosis_link.requested',
        caseId,
        createdByUserId,
        diagnosisRegistryId: input.diagnosisRegistryId,
      }),
    );

    const result = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) =>
          this.applyDiagnosisLinkInTransaction(tx, {
            caseId,
            createdByUserId,
            diagnosisRegistryId: input.diagnosisRegistryId,
            diagnosisEditorialNote: input.diagnosisEditorialNote,
            mappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
            eventName: 'admin.case.diagnosis_link.completed',
          }),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    this.editorialMetrics.recordValidationResult(
      CaseSource.ADMIN_EDIT,
      result.validationRun.outcome ?? ValidationOutcome.ERROR,
    );

    return result.case;
  }

  async updateCaseDiagnosis(
    caseId: string,
    createdByUserId: string,
    input: UpdateCaseDiagnosisDto,
  ) {
    const canonicalDiagnosis = this.requireCanonicalDiagnosis(
      input.canonicalDiagnosis,
    );

    this.logger.log(
      JSON.stringify({
        event: 'admin.case.diagnosis_update.requested',
        caseId,
        createdByUserId,
        canonicalDiagnosis,
      }),
    );

    const result = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const createdDiagnosis =
            await this.diagnosisRegistryEditorialService.createDiagnosis(
              {
                canonicalName: canonicalDiagnosis,
              },
              tx,
            );
          const linkResult = await this.applyDiagnosisLinkInTransaction(tx, {
            caseId,
            createdByUserId,
            diagnosisRegistryId: createdDiagnosis.diagnosisRegistryId,
            mappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
            eventName: 'admin.case.diagnosis_update.completed',
          });

          return {
            case: linkResult.case,
            validationRun: linkResult.validationRun,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    this.editorialMetrics.recordValidationResult(
      CaseSource.ADMIN_EDIT,
      result.validationRun.outcome ?? ValidationOutcome.ERROR,
    );

    return result.case;
  }

  async createAndLinkDiagnosis(
    caseId: string,
    createdByUserId: string,
    input: CreateAndLinkDiagnosisDto,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.diagnosis_create_and_link.requested',
        caseId,
        createdByUserId,
        canonicalName: input.canonicalName,
      }),
    );

    const result = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const createdDiagnosis =
            await this.diagnosisRegistryEditorialService.createDiagnosis(
              {
                canonicalName: input.canonicalName,
                aliases: input.aliases,
                category: input.category,
                specialty: input.specialty,
                subspecialty: input.subspecialty,
                bodySystem: input.bodySystem,
                organSystem: input.organSystem,
                difficultyBand: input.difficultyBand,
                rarityBand: input.rarityBand,
                clinicalSetting: input.clinicalSetting,
                ageGroup: input.ageGroup,
                urgencyLevel: input.urgencyLevel,
                isPlayable: input.isPlayable,
                isGeneratable: input.isGeneratable,
                preferredClueTypes: input.preferredClueTypes,
                excludedClueTypes: input.excludedClueTypes,
                isDescriptive: input.isDescriptive,
                isCompositional: input.isCompositional,
                notes: input.notes,
                searchPriority: input.searchPriority,
              },
              tx,
            );

          return this.applyDiagnosisLinkInTransaction(tx, {
            caseId,
            createdByUserId,
            diagnosisRegistryId: createdDiagnosis.diagnosisRegistryId,
            diagnosisEditorialNote: input.diagnosisEditorialNote,
            mappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
            eventName: 'admin.case.diagnosis_create_and_link.completed',
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    this.editorialMetrics.recordValidationResult(
      CaseSource.ADMIN_EDIT,
      result.validationRun.outcome ?? ValidationOutcome.ERROR,
    );

    return result.case;
  }

  async rerunValidation(caseId: string, triggeredByUserId: string) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.validation_rerun.started',
        caseId,
        triggeredByUserId,
      }),
    );

    const result = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const caseRecord = await tx.case.findUnique({
            where: { id: caseId },
            select: {
              id: true,
              editorialStatus: true,
              currentRevisionId: true,
            },
          });

          if (!caseRecord) {
            throw new NotFoundException(`Case not found: ${caseId}`);
          }

          const startedAt = new Date();
          const snapshot =
            await this.caseRevisionService.getCurrentCaseSnapshotInTransaction(
              tx,
              caseId,
            );

          let validationReport;
          try {
            validationReport =
              this.caseValidationService.validateSnapshot(snapshot);
          } catch (error) {
            validationReport =
              this.caseValidationService.buildExecutionErrorReport(error);
          }

          const persistencePayload =
            this.caseValidationService.buildPersistencePayload(
              validationReport,
            );

          const validationRun = await tx.caseValidationRun.create({
            data: {
              caseId,
              revisionId: caseRecord.currentRevisionId,
              materialContextHash: this.buildCaseMaterialContextHash(snapshot),
              reviewContextIdentity: this.buildReviewContextIdentity({
                revisionId: caseRecord.currentRevisionId,
                materialContextHash:
                  this.buildCaseMaterialContextHash(snapshot),
              }),
              source: CaseSource.ADMIN_EDIT,
              outcome: validationReport.outcome,
              validatorVersion: validationReport.validatorVersion,
              summary: persistencePayload.summary,
              findings: persistencePayload.findings,
              triggeredByUserId,
              startedAt,
              completedAt: new Date(),
            },
            select: {
              id: true,
              revisionId: true,
              materialContextHash: true,
              reviewContextIdentity: true,
              outcome: true,
              validatorVersion: true,
              summary: true,
              findings: true,
              startedAt: true,
              completedAt: true,
            },
          });

          const nextEditorialStatus = getEditorialStatusForValidationOutcome({
            currentStatus: caseRecord.editorialStatus,
            outcome: validationReport.outcome,
          });
          const caseUpdate: Prisma.CaseUncheckedUpdateInput =
            nextEditorialStatus
              ? {
                  editorialStatus: nextEditorialStatus,
                }
              : {};

          if (validationReport.outcome !== ValidationOutcome.PASSED) {
            Object.assign(caseUpdate, getApprovalResetFields());
          }

          const updatedCase = await tx.case.update({
            where: { id: caseId },
            data: caseUpdate,
            select: {
              id: true,
              editorialStatus: true,
              approvedAt: true,
              approvedByUserId: true,
              currentRevisionId: true,
            },
          });

          this.logger.log(
            JSON.stringify({
              event: 'admin.case.validation_rerun.completed',
              caseId,
              validationRunId: validationRun.id,
              revisionId: validationRun.revisionId,
              outcome: validationRun.outcome,
              editorialStatus: updatedCase.editorialStatus,
              triggeredByUserId,
            }),
          );

          return {
            case: updatedCase,
            validationRun,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    this.editorialMetrics.recordValidationResult(
      CaseSource.ADMIN_EDIT,
      result.validationRun.outcome ?? ValidationOutcome.ERROR,
    );

    return result;
  }

  async startReview(caseId: string, reviewerUserId: string) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.review.start_requested',
        caseId,
        reviewerUserId,
      }),
    );

    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const caseRecord = await tx.case.findUnique({
            where: { id: caseId },
            select: {
              id: true,
              editorialStatus: true,
              currentRevisionId: true,
            },
          });

          if (!caseRecord) {
            throw new NotFoundException(`Case not found: ${caseId}`);
          }

          if (!canStartEditorialReview(caseRecord.editorialStatus)) {
            throw new BadRequestException(
              'Published cases cannot be re-opened for review in Phase 4',
            );
          }

          const existingOpenReview = await tx.caseReview.findFirst({
            where: {
              caseId,
              revisionId: caseRecord.currentRevisionId,
              decision: null,
            },
            orderBy: [{ createdAt: 'desc' }],
            select: {
              id: true,
              revisionId: true,
              reviewerUserId: true,
              decision: true,
              notes: true,
              materialContextHash: true,
              reviewContextIdentity: true,
              createdAt: true,
              decidedAt: true,
            },
          });

          const materialContext =
            await this.getCaseRevisionMaterialContextInTransaction(tx, {
              caseId,
              revisionId: caseRecord.currentRevisionId,
            });

          const review = existingOpenReview
            ? await tx.caseReview.update({
                where: {
                  id: existingOpenReview.id,
                },
                data: {
                  reviewerUserId,
                  materialContextHash: materialContext.materialContextHash,
                  reviewContextIdentity: materialContext.reviewContextIdentity,
                },
                select: {
                  id: true,
                  revisionId: true,
                  reviewerUserId: true,
                  decision: true,
                  notes: true,
                  materialContextHash: true,
                  reviewContextIdentity: true,
                  createdAt: true,
                  decidedAt: true,
                },
              })
            : await tx.caseReview.create({
                data: {
                  caseId,
                  revisionId: caseRecord.currentRevisionId,
                  reviewerUserId,
                  materialContextHash: materialContext.materialContextHash,
                  reviewContextIdentity: materialContext.reviewContextIdentity,
                },
                select: {
                  id: true,
                  revisionId: true,
                  reviewerUserId: true,
                  decision: true,
                  notes: true,
                  materialContextHash: true,
                  reviewContextIdentity: true,
                  createdAt: true,
                  decidedAt: true,
                },
              });

          const updatedCase = await tx.case.update({
            where: { id: caseId },
            data: {
              editorialStatus: CaseEditorialStatus.REVIEW,
            },
            select: {
              id: true,
              editorialStatus: true,
              currentRevisionId: true,
              approvedAt: true,
              approvedByUserId: true,
            },
          });

          this.logger.log(
            JSON.stringify({
              event: 'admin.case.review.started',
              caseId,
              reviewId: review.id,
              revisionId: updatedCase.currentRevisionId,
              reviewerUserId,
            }),
          );

          return {
            case: updatedCase,
            review,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
  }

  async submitReview(
    caseId: string,
    reviewerUserId: string,
    input: SubmitCaseReviewDto,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.review.submit_requested',
        caseId,
        reviewerUserId,
        decision: input.decision,
      }),
    );

    let result;
    try {
      result = await this.withSerializableRetry(
        () =>
          this.prisma.$transaction(
            async (tx) => {
              const caseRecord = await tx.case.findUnique({
                where: { id: caseId },
                select: {
                  id: true,
                  editorialStatus: true,
                  currentRevisionId: true,
                },
              });

              if (!caseRecord) {
                throw new NotFoundException(`Case not found: ${caseId}`);
              }

              if (caseRecord.editorialStatus !== CaseEditorialStatus.REVIEW) {
                if (input.decision === ReviewDecision.APPROVED) {
                  const replay = await this.resolveApprovalIdempotencyReplay(
                    tx,
                    {
                      caseId,
                      reviewerUserId,
                      input,
                    },
                  );
                  if (replay) return replay;
                }

                throw new BadRequestException(
                  'Case must be in REVIEW before submitting a review',
                );
              }

              if (input.decision === ReviewDecision.APPROVED) {
                if (!this.normalizeOptionalString(input.expectedRevisionId)) {
                  throw new BadRequestException(
                    'APPROVE_CASE_REVISION requires explicit expectedRevisionId',
                  );
                }

                if (
                  !this.normalizeOptionalString(input.commandIdempotencyKey)
                ) {
                  throw new BadRequestException(
                    'APPROVE_CASE_REVISION requires commandIdempotencyKey',
                  );
                }

                const replay = await this.resolveApprovalIdempotencyReplay(tx, {
                  caseId,
                  reviewerUserId,
                  input,
                });
                if (replay) return replay;
              }

              const openReview = await tx.caseReview.findFirst({
                where: {
                  caseId,
                  revisionId: caseRecord.currentRevisionId,
                  decision: null,
                },
                orderBy: [{ createdAt: 'desc' }],
                select: {
                  id: true,
                  revisionId: true,
                  reviewerUserId: true,
                  materialContextHash: true,
                  reviewContextIdentity: true,
                  createdAt: true,
                },
              });

              if (!openReview) {
                throw new BadRequestException(
                  'No active review exists for the current revision',
                );
              }

              if (!caseRecord.currentRevisionId) {
                throw new BadRequestException(
                  'Cannot approve a case without a current revision',
                );
              }

              if (
                input.expectedRevisionId !== undefined &&
                input.expectedRevisionId !== caseRecord.currentRevisionId
              ) {
                throw new BadRequestException(
                  'Stale approval command: expected revision does not match current revision',
                );
              }

              if (
                input.expectedReviewId &&
                input.expectedReviewId !== openReview.id
              ) {
                throw new BadRequestException(
                  'Stale approval command: expected review does not match active review',
                );
              }

              if (openReview.revisionId !== caseRecord.currentRevisionId) {
                throw new BadRequestException(
                  'Stale review context: active review does not target current revision',
                );
              }

              if (
                openReview.reviewerUserId &&
                openReview.reviewerUserId !== reviewerUserId
              ) {
                throw new BadRequestException(
                  'Editorial approval authority does not cover this active review',
                );
              }

              if (input.decision === ReviewDecision.APPROVED) {
                return this.approveCaseRevisionThroughGovernedCommand(tx, {
                  caseId,
                  reviewerUserId,
                  input,
                  reviewId: openReview.id,
                  reviewCreatedAt: openReview.createdAt,
                  reviewMaterialContextHash: openReview.materialContextHash,
                  reviewContextIdentity: openReview.reviewContextIdentity,
                  targetRevisionId: caseRecord.currentRevisionId,
                });
              }

              const review = await tx.caseReview.update({
                where: { id: openReview.id },
                data: {
                  reviewerUserId,
                  decision: input.decision,
                  notes: this.normalizeOptionalString(input.notes) ?? null,
                  decidedAt: new Date(),
                },
                select: {
                  id: true,
                  revisionId: true,
                  reviewerUserId: true,
                  decision: true,
                  notes: true,
                  createdAt: true,
                  decidedAt: true,
                },
              });

              const nextEditorialStatus = getEditorialStatusForReviewDecision(
                input.decision,
              );
              const caseUpdate: Prisma.CaseUncheckedUpdateInput = {
                editorialStatus: nextEditorialStatus,
              };
              Object.assign(caseUpdate, getApprovalResetFields());

              const updatedCase = await tx.case.update({
                where: { id: caseId },
                data: caseUpdate,
                select: {
                  id: true,
                  editorialStatus: true,
                  approvedAt: true,
                  approvedByUserId: true,
                  currentRevisionId: true,
                },
              });

              this.logger.log(
                JSON.stringify({
                  event: 'admin.case.review.submitted',
                  caseId,
                  reviewId: review.id,
                  revisionId: updatedCase.currentRevisionId,
                  reviewerUserId,
                  decision: review.decision,
                  editorialStatus: updatedCase.editorialStatus,
                }),
              );

              return {
                case: updatedCase,
                review,
              };
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          ),
        input.decision === ReviewDecision.APPROVED ? 1 : undefined,
      );
    } catch (error) {
      const conflictTarget =
        this.getApp006ReplayEligibleUniqueConflict(error) ??
        (this.isPrismaSerializableConflict(error)
          ? 'serializableWriteConflict'
          : null);
      if (
        input.decision !== ReviewDecision.APPROVED ||
        conflictTarget === null
      ) {
        throw error;
      }

      result = await this.resolveApprovalIdempotencyReplayAfterRollback({
        caseId,
        reviewerUserId,
        input,
        conflictTarget,
      });
    }

    this.editorialMetrics.recordReviewOutcome(input.decision);

    if (input.decision === ReviewDecision.APPROVED) {
      await this.diagnosisGraphExtractionService
        ?.extractFromApprovedCase(caseId)
        .catch((error) => {
          this.logger.error(
            JSON.stringify({
              event: 'diagnosis_graph.case_extraction.failed',
              caseId,
              error: error instanceof Error ? error.message : String(error),
            }),
            error instanceof Error ? error.stack : undefined,
          );
        });
    }

    return result;
  }

  private buildApproveCaseRevisionCommandFingerprint(input: {
    caseId: string;
    reviewerUserId: string;
    reviewId?: string | null;
    command: SubmitCaseReviewDto;
  }): string {
    return stableStringify({
      commandAction: GOVERNED_CASE_REVISION_APPROVAL_ACTION,
      caseId: input.caseId,
      actorUserId: input.reviewerUserId,
      expectedRevisionId: input.command.expectedRevisionId,
      expectedReviewId:
        input.command.expectedReviewId ?? input.reviewId ?? null,
      decision: input.command.decision,
      rationale: this.normalizeOptionalString(input.command.notes) ?? null,
      authorityAssignmentReferences: [
        ...(input.command.authorityAssignmentReferences ?? []),
      ].sort(),
    });
  }

  private async resolveApprovalIdempotencyReplay(
    tx: ReviewTransactionClient,
    input: {
      caseId: string;
      reviewerUserId: string;
      input: SubmitCaseReviewDto;
    },
  ) {
    const commandIdempotencyKey = this.normalizeOptionalString(
      input.input.commandIdempotencyKey,
    );
    if (!commandIdempotencyKey) return null;

    const prior = await (
      tx as any
    ).governedCaseRevisionApprovalDecision.findUnique({
      where: { commandIdempotencyKey },
      select: {
        commandFingerprint: true,
        caseId: true,
        reviewId: true,
        targetRevisionId: true,
      },
    });
    if (!prior) return null;

    const fingerprint = this.buildApproveCaseRevisionCommandFingerprint({
      caseId: input.caseId,
      reviewerUserId: input.reviewerUserId,
      reviewId: prior.reviewId,
      command: input.input,
    });

    if (
      prior.caseId !== input.caseId ||
      prior.targetRevisionId !== input.input.expectedRevisionId ||
      prior.commandFingerprint !== fingerprint
    ) {
      throw new BadRequestException(
        'Idempotency conflict for APPROVE_CASE_REVISION',
      );
    }

    const [caseRecord, review] = await Promise.all([
      tx.case.findUnique({
        where: { id: prior.caseId },
        select: {
          id: true,
          editorialStatus: true,
          approvedAt: true,
          approvedByUserId: true,
          currentRevisionId: true,
        },
      }),
      tx.caseReview.findUnique({
        where: { id: prior.reviewId },
        select: {
          id: true,
          revisionId: true,
          reviewerUserId: true,
          decision: true,
          notes: true,
          createdAt: true,
          decidedAt: true,
        },
      }),
    ]);

    if (!caseRecord || !review) {
      throw new BadRequestException(
        'Idempotent approval replay could not reconstruct prior result',
      );
    }

    return {
      case: caseRecord,
      review,
    };
  }

  private async resolveApprovalIdempotencyReplayAfterRollback(input: {
    caseId: string;
    reviewerUserId: string;
    input: SubmitCaseReviewDto;
    conflictTarget: App006UniqueConflictTarget;
  }) {
    await this.app006ApprovalTestHooks?.afterRollbackReplayLookup?.({
      conflictTarget: input.conflictTarget,
    });

    const commandIdempotencyKey = this.normalizeOptionalString(
      input.input.commandIdempotencyKey,
    );
    const expectedReviewId = this.normalizeOptionalString(
      input.input.expectedReviewId,
    );

    const byIdempotencyKey = commandIdempotencyKey
      ? await (
          this.prisma as any
        ).governedCaseRevisionApprovalDecision.findUnique({
          where: { commandIdempotencyKey },
          select: {
            commandIdempotencyKey: true,
            commandFingerprint: true,
            caseId: true,
            reviewId: true,
            targetRevisionId: true,
          },
        })
      : null;

    const byReview =
      byIdempotencyKey || !expectedReviewId
        ? null
        : await (
            this.prisma as any
          ).governedCaseRevisionApprovalDecision.findUnique({
            where: { reviewId: expectedReviewId },
            select: {
              commandIdempotencyKey: true,
              commandFingerprint: true,
              caseId: true,
              reviewId: true,
              targetRevisionId: true,
            },
          });

    const prior = byIdempotencyKey ?? byReview;
    if (
      !prior ||
      !commandIdempotencyKey ||
      prior.commandIdempotencyKey !== commandIdempotencyKey
    ) {
      throw new BadRequestException(
        'Idempotency conflict for APPROVE_CASE_REVISION',
      );
    }

    const fingerprint = this.buildApproveCaseRevisionCommandFingerprint({
      caseId: input.caseId,
      reviewerUserId: input.reviewerUserId,
      reviewId: prior.reviewId,
      command: input.input,
    });

    if (
      prior.caseId !== input.caseId ||
      prior.targetRevisionId !== input.input.expectedRevisionId ||
      prior.commandFingerprint !== fingerprint
    ) {
      throw new BadRequestException(
        'Idempotency conflict for APPROVE_CASE_REVISION',
      );
    }

    const [caseRecord, review] = await Promise.all([
      this.prisma.case.findUnique({
        where: { id: prior.caseId },
        select: {
          id: true,
          editorialStatus: true,
          approvedAt: true,
          approvedByUserId: true,
          currentRevisionId: true,
        },
      }),
      this.prisma.caseReview.findUnique({
        where: { id: prior.reviewId },
        select: {
          id: true,
          revisionId: true,
          reviewerUserId: true,
          decision: true,
          notes: true,
          createdAt: true,
          decidedAt: true,
        },
      }),
    ]);

    if (!caseRecord || !review) {
      throw new BadRequestException(
        'Idempotent approval replay could not reconstruct prior result',
      );
    }

    return {
      case: caseRecord,
      review,
    };
  }

  private async approveCaseRevisionThroughGovernedCommand(
    tx: ReviewTransactionClient,
    input: {
      caseId: string;
      reviewerUserId: string;
      targetRevisionId: string;
      reviewId: string;
      reviewCreatedAt: Date;
      reviewMaterialContextHash: string | null;
      reviewContextIdentity: string | null;
      input: SubmitCaseReviewDto;
    },
  ) {
    const targetRevision = await tx.caseRevision.findFirst({
      where: {
        id: input.targetRevisionId,
        caseId: input.caseId,
      },
      select: {
        ...CASE_REVISION_MATERIAL_SELECT,
        createdByUserId: true,
      },
    });

    if (!targetRevision) {
      throw new NotFoundException(
        `Case revision not found: ${input.targetRevisionId}`,
      );
    }

    if (!targetRevision.createdByUserId) {
      throw new BadRequestException(
        'Case revision approval requires trusted authorship provenance',
      );
    }

    if (targetRevision.createdByUserId === input.reviewerUserId) {
      throw new BadRequestException(
        'Case revision approval requires separation of duties',
      );
    }

    const materialContextHash =
      this.buildCaseMaterialContextHash(targetRevision);
    const reviewContextIdentity = this.buildReviewContextIdentity({
      revisionId: input.targetRevisionId,
      materialContextHash,
    });

    if (
      !input.reviewMaterialContextHash ||
      !input.reviewContextIdentity ||
      input.reviewMaterialContextHash !== materialContextHash ||
      input.reviewContextIdentity !== reviewContextIdentity
    ) {
      throw new BadRequestException(
        'Stale review context: material review context does not match current revision',
      );
    }

    const actor = await tx.user.findUnique({
      where: { id: input.reviewerUserId },
      select: {
        id: true,
      },
    });

    if (!actor) {
      throw new BadRequestException(
        'Missing approval actor for APPROVE_CASE_REVISION',
      );
    }

    const authorityResolvedAt = new Date().toISOString();
    const persistedAuthorityAssignments =
      await this.editorialAuthorityAssignmentRepository.loadCandidatesForApproval(
        tx,
        {
          actorUserId: actor.id,
          authorityType: GOVERNED_CASE_REVISION_APPROVAL_AUTHORITY_TYPE,
          decisionType: GOVERNED_CASE_REVISION_APPROVAL_ACTION,
          assignmentReferences: input.input.authorityAssignmentReferences,
        },
      );
    const authorityResolution = resolveGovernedAuthority({
      actorContext: {
        actorType: 'USER',
        actorId: actor.id,
        runtimeRoles: [],
        organizationContextIds: [],
        specialtyContextIds: [],
        authorityAssignmentReferences:
          input.input.authorityAssignmentReferences ?? [],
        correlationId: input.input.commandIdempotencyKey ?? input.reviewId,
        causationId: input.reviewId,
        requestedAt: authorityResolvedAt,
      },
      assignments: persistedAuthorityAssignments,
      authorityTypeRegistry: this.caseRevisionApprovalAuthorityTypeRegistry,
      request: {
        authorityType: GOVERNED_CASE_REVISION_APPROVAL_AUTHORITY_TYPE,
        decisionType: GOVERNED_CASE_REVISION_APPROVAL_ACTION,
        artifactType: 'CASE_REVISION',
        artifactId: input.caseId,
        artifactRevisionId: input.targetRevisionId,
      },
      evaluatedAt: authorityResolvedAt,
      hasRequiredTechnicalAccess: true,
    });

    if (
      authorityResolution.status !== 'AUTHORIZED' ||
      !authorityResolution.assignment ||
      !authorityResolution.od018AuthorityEvidence
    ) {
      throw new BadRequestException(
        'Missing editorial approval authority for APPROVE_CASE_REVISION',
      );
    }

    const latestValidationRun = await tx.caseValidationRun.findFirst({
      where: {
        caseId: input.caseId,
        revisionId: input.targetRevisionId,
      },
      orderBy: [{ startedAt: 'desc' }],
      select: {
        id: true,
        revisionId: true,
        outcome: true,
        completedAt: true,
        findings: true,
        materialContextHash: true,
        reviewContextIdentity: true,
      },
    });

    if (!latestValidationRun || !latestValidationRun.completedAt) {
      throw new BadRequestException(
        'Stale review context: current revision has no completed validation run',
      );
    }

    if (latestValidationRun.outcome !== ValidationOutcome.PASSED) {
      throw new BadRequestException(
        'Case revision approval blocked by validation findings',
      );
    }

    if (
      latestValidationRun.revisionId !== input.targetRevisionId ||
      latestValidationRun.materialContextHash !== materialContextHash ||
      latestValidationRun.reviewContextIdentity !== reviewContextIdentity
    ) {
      throw new BadRequestException(
        'Stale review context: validation basis does not match reviewed material context',
      );
    }

    const decidedAt = new Date();
    const decidedAtIso = decidedAt.toISOString();
    const commandIdempotencyKey =
      this.normalizeOptionalString(input.input.commandIdempotencyKey) ??
      `${GOVERNED_CASE_REVISION_APPROVAL_ACTION}:${input.caseId}:${input.reviewId}:${input.targetRevisionId}`;
    const commandFingerprint = this.buildApproveCaseRevisionCommandFingerprint({
      caseId: input.caseId,
      reviewerUserId: input.reviewerUserId,
      reviewId: input.reviewId,
      command: input.input,
    });
    const compatibilityProjectionEffect: App006CompatibilityProjectionEffect = {
      owner: GOVERNED_CASE_REVISION_APPROVAL_ACTION,
      caseId: input.caseId,
      fields: [
        'Case.editorialStatus',
        'Case.approvedAt',
        'Case.approvedByUserId',
      ],
      editorialStatus: CaseEditorialStatus.APPROVED,
      approvedAt: decidedAtIso,
      approvedByUserId: input.reviewerUserId,
    };
    const reviewBasis = {
      reviewId: input.reviewId,
      caseRevisionId: input.targetRevisionId,
      validationRunId: latestValidationRun.id,
      validationOutcome: latestValidationRun.outcome,
      validationCompletedAt: latestValidationRun.completedAt.toISOString(),
      reviewCreatedAt: input.reviewCreatedAt.toISOString(),
      reviewContextIdentity,
      materialContextHash,
      blockingFindingsConsidered: latestValidationRun.findings ?? null,
    };
    const canonicalFindings = this.toCanonicalFindings(
      latestValidationRun.findings,
    );
    const rationale =
      this.normalizeOptionalString(input.input.notes) ??
      'Case revision approved through governed approval command.';
    const decisionId = randomUUID();
    const envelope = buildApp006GovernanceDecisionEnvelope({
      decisionId,
      caseId: input.caseId,
      caseRevisionId: input.targetRevisionId,
      reviewId: input.reviewId,
      validationRunId: latestValidationRun.id,
      reviewContextIdentity,
      materialContextHash,
      actorUserId: input.reviewerUserId,
      authority: authorityResolution.od018AuthorityEvidence,
      authorityAssignment: authorityResolution.assignment,
      commandFingerprint,
      rationale,
      findings: canonicalFindings,
      obligations: [],
      compatibilityProjectionEffect,
      occurredAt: decidedAtIso,
      createdAt: decidedAtIso,
    });
    const envelopeErrors = validateApp006GovernanceDecisionEnvelope(envelope, {
      decisionId,
      caseId: input.caseId,
      caseRevisionId: input.targetRevisionId,
      reviewId: input.reviewId,
      validationRunId: latestValidationRun.id,
      reviewContextIdentity,
      materialContextHash,
      actorUserId: input.reviewerUserId,
      authority: authorityResolution.od018AuthorityEvidence,
      authorityAssignment: authorityResolution.assignment,
      commandFingerprint,
      rationale,
      findings: canonicalFindings,
      obligations: [],
      compatibilityProjectionEffect,
      occurredAt: decidedAtIso,
      createdAt: decidedAtIso,
    });
    if (envelopeErrors.length > 0) {
      throw new BadRequestException(
        `Invalid APP-006 governance decision envelope: ${envelopeErrors.join('; ')}`,
      );
    }

    await this.app006ApprovalTestHooks?.beforeDecisionCreate?.();

    await (tx as any).governedCaseRevisionApprovalDecision.create({
      data: {
        id: decisionId,
        commandAction: GOVERNED_CASE_REVISION_APPROVAL_ACTION,
        commandIdempotencyKey,
        commandFingerprint,
        envelopeSchemaVersion:
          GOVERNED_CASE_REVISION_APPROVAL_ENVELOPE_SCHEMA_VERSION,
        extensionType: GOVERNED_CASE_REVISION_APPROVAL_EXTENSION_TYPE,
        extensionSchemaVersion:
          GOVERNED_CASE_REVISION_APPROVAL_EXTENSION_SCHEMA_VERSION,
        status: 'FINALIZED',
        validatedEnvelope: envelope,
        extensionPayload: envelope.extensionPayload,
        primaryTarget: envelope.primaryTarget,
        targetReferences: [...envelope.targetReferences],
        actorType: 'USER',
        approvalRecordId: GOVERNED_CASE_REVISION_APPROVAL_RECORD_ID,
        authorityAssignmentId:
          authorityResolution.od018AuthorityEvidence.authorityAssignmentId,
        authorityEvidenceReference:
          authorityResolution.od018AuthorityEvidence.authorityEvidenceReference,
        authorityScopeSnapshot:
          authorityResolution.od018AuthorityEvidence.authorityScopeSnapshot,
        authorityResolvedAt,
        actorUserId: input.reviewerUserId,
        caseId: input.caseId,
        targetRevisionId: input.targetRevisionId,
        expectedRevisionId: input.input.expectedRevisionId,
        reviewId: input.reviewId,
        decisionType: GOVERNED_CASE_REVISION_APPROVAL_ACTION,
        outcome: 'APPROVED',
        effectiveAction: GOVERNED_CASE_REVISION_APPROVAL_ACTION,
        rationale,
        findings: latestValidationRun.findings ?? [],
        reviewBasis,
        obligations: [],
        compatibilityProjection: compatibilityProjectionEffect,
        occurredAt: decidedAt,
      },
    });

    const review = await tx.caseReview.update({
      where: { id: input.reviewId },
      data: {
        reviewerUserId: input.reviewerUserId,
        decision: ReviewDecision.APPROVED,
        notes: this.normalizeOptionalString(input.input.notes) ?? null,
        decidedAt,
      },
      select: {
        id: true,
        revisionId: true,
        reviewerUserId: true,
        decision: true,
        notes: true,
        materialContextHash: true,
        reviewContextIdentity: true,
        createdAt: true,
        decidedAt: true,
      },
    });

    const updatedCase = await tx.case.update({
      where: { id: input.caseId },
      data: {
        editorialStatus: CaseEditorialStatus.APPROVED,
        approvedAt: decidedAt,
        approvedByUserId: input.reviewerUserId,
      },
      select: {
        id: true,
        editorialStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        currentRevisionId: true,
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'admin.case.review.governed_approval_completed',
        caseId: input.caseId,
        reviewId: review.id,
        revisionId: input.targetRevisionId,
        reviewerUserId: input.reviewerUserId,
        decision: review.decision,
        editorialStatus: updatedCase.editorialStatus,
        approvalRecordId: GOVERNED_CASE_REVISION_APPROVAL_RECORD_ID,
      }),
    );

    return {
      case: updatedCase,
      review,
    };
  }

  async listGovernedCaseRevisionApprovalHistory(caseId: string) {
    await this.assertCaseExists(caseId);

    return (this.prisma as any).governedCaseRevisionApprovalDecision.findMany({
      where: { caseId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
  }

  async listRevisions(caseId: string) {
    await this.assertCaseExists(caseId);

    return this.prisma.caseRevision.findMany({
      where: {
        caseId,
      },
      orderBy: [{ revisionNumber: 'desc' }],
      select: {
        id: true,
        revisionNumber: true,
        source: true,
        publishTrack: true,
        title: true,
        date: true,
        difficulty: true,
        history: true,
        symptoms: true,
        labs: true,
        clues: true,
        explanation: true,
        differentials: true,
        diagnosisId: true,
        diagnosisRegistryId: true,
        proposedDiagnosisText: true,
        diagnosisMappingStatus: true,
        diagnosisMappingMethod: true,
        diagnosisMappingConfidence: true,
        diagnosisEditorialNote: true,
        createdByUserId: true,
        createdAt: true,
        validationRuns: {
          orderBy: [{ startedAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            outcome: true,
            validatorVersion: true,
            source: true,
            triggeredByUserId: true,
            startedAt: true,
            completedAt: true,
          },
        },
        reviews: {
          orderBy: [{ createdAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            reviewerUserId: true,
            decision: true,
            notes: true,
            createdAt: true,
            decidedAt: true,
          },
        },
      },
    });
  }

  async restoreRevision(
    caseId: string,
    revisionId: string,
    createdByUserId: string,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.revision.restore_requested',
        caseId,
        revisionId,
        createdByUserId,
      }),
    );

    const result = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const caseRecord = await tx.case.findUnique({
            where: { id: caseId },
            select: {
              id: true,
              editorialStatus: true,
            },
          });

          if (!caseRecord) {
            throw new NotFoundException(`Case not found: ${caseId}`);
          }

          const revision = await tx.caseRevision.findFirst({
            where: {
              id: revisionId,
              caseId,
            },
            select: {
              id: true,
              revisionNumber: true,
              title: true,
              date: true,
              difficulty: true,
              history: true,
              symptoms: true,
              labs: true,
              clues: true,
              explanation: true,
              differentials: true,
              diagnosisId: true,
              diagnosisRegistryId: true,
              proposedDiagnosisText: true,
              diagnosisMappingStatus: true,
              diagnosisMappingMethod: true,
              diagnosisMappingConfidence: true,
              diagnosisEditorialNote: true,
            },
          });

          if (!revision) {
            throw new NotFoundException(
              `Revision ${revisionId} not found for case ${caseId}`,
            );
          }

          const resolvedDiagnosisLink =
            await this.diagnosisRegistryLinkService.resolveForWrite(
              {
                diagnosisId: revision.diagnosisId,
                diagnosisRegistryId: revision.diagnosisRegistryId,
              },
              tx,
            );

          const snapshot = {
            caseId,
            title: revision.title,
            date: revision.date,
            difficulty: revision.difficulty,
            history: revision.history,
            symptoms: [...revision.symptoms],
            labs: revision.labs,
            clues: revision.clues,
            explanation: revision.explanation,
            differentials: [...revision.differentials],
            diagnosisId: resolvedDiagnosisLink.diagnosisId,
            diagnosisRegistryId: resolvedDiagnosisLink.diagnosisRegistryId,
            proposedDiagnosisText: revision.proposedDiagnosisText,
            diagnosisMappingStatus: revision.diagnosisMappingStatus,
            diagnosisMappingMethod: revision.diagnosisMappingMethod,
            diagnosisMappingConfidence: revision.diagnosisMappingConfidence,
            diagnosisEditorialNote: revision.diagnosisEditorialNote,
          };

          await tx.case.update({
            where: { id: caseId },
            data: {
              title: snapshot.title,
              date: snapshot.date,
              difficulty: snapshot.difficulty,
              history: snapshot.history,
              symptoms: snapshot.symptoms,
              labs: this.toNullableJsonValue(snapshot.labs),
              clues: this.toNullableJsonValue(snapshot.clues),
              explanation: this.toNullableJsonValue(snapshot.explanation),
              differentials: snapshot.differentials,
              diagnosisId: snapshot.diagnosisId,
              diagnosisRegistryId: snapshot.diagnosisRegistryId,
              proposedDiagnosisText: snapshot.proposedDiagnosisText,
              diagnosisMappingStatus: snapshot.diagnosisMappingStatus,
              diagnosisMappingMethod: snapshot.diagnosisMappingMethod,
              diagnosisMappingConfidence: snapshot.diagnosisMappingConfidence,
              diagnosisEditorialNote: snapshot.diagnosisEditorialNote,
              ...getApprovalResetFields(),
            },
          });

          const restoredRevision =
            await this.caseRevisionService.createRevisionFromSnapshotInTransaction(
              tx,
              {
                caseId,
                snapshot,
                source: CaseSource.RESTORED,
                createdByUserId,
              },
            );

          let validationReport;
          try {
            validationReport =
              this.caseValidationService.validateSnapshot(snapshot);
          } catch (error) {
            validationReport =
              this.caseValidationService.buildExecutionErrorReport(error);
          }

          const persistencePayload =
            this.caseValidationService.buildPersistencePayload(
              validationReport,
            );

          const validationRun = await tx.caseValidationRun.create({
            data: {
              caseId,
              revisionId: restoredRevision.revisionId,
              source: CaseSource.RESTORED,
              outcome: validationReport.outcome,
              validatorVersion: validationReport.validatorVersion,
              summary: persistencePayload.summary,
              findings: persistencePayload.findings,
              triggeredByUserId: createdByUserId,
              startedAt: new Date(),
              completedAt: new Date(),
            },
            select: {
              id: true,
              outcome: true,
              validatorVersion: true,
              startedAt: true,
              completedAt: true,
            },
          });

          const updatedCase = await tx.case.update({
            where: { id: caseId },
            data: {
              editorialStatus:
                getEditorialStatusForValidationOutcome({
                  currentStatus: caseRecord.editorialStatus,
                  outcome: validationReport.outcome,
                }) ?? CaseEditorialStatus.VALIDATED,
              ...getApprovalResetFields(),
            },
            select: {
              id: true,
              editorialStatus: true,
              approvedAt: true,
              approvedByUserId: true,
              currentRevisionId: true,
            },
          });

          this.logger.log(
            JSON.stringify({
              event: 'admin.case.revision.restored',
              caseId,
              restoredFromRevisionId: revisionId,
              newRevisionId: restoredRevision.revisionId,
              newRevisionNumber: restoredRevision.revisionNumber,
              validationRunId: validationRun.id,
              validationOutcome: validationRun.outcome,
              previousEditorialStatus: caseRecord.editorialStatus,
              currentEditorialStatus: updatedCase.editorialStatus,
              createdByUserId,
            }),
          );

          return {
            case: updatedCase,
            restoredFromRevisionId: revisionId,
            revision: {
              id: restoredRevision.revisionId,
              revisionNumber: restoredRevision.revisionNumber,
              source: CaseSource.RESTORED,
              snapshot: restoredRevision.snapshot,
            },
            validationRun,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    this.editorialMetrics.recordValidationResult(
      CaseSource.RESTORED,
      result.validationRun.outcome ?? ValidationOutcome.ERROR,
    );

    return result;
  }

  async markReadyToPublish(caseId: string) {
    this.logger.log(
      JSON.stringify({
        event: 'admin.case.ready_to_publish.requested',
        caseId,
      }),
    );

    const result = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const caseRecord = await tx.case.findUnique({
            where: { id: caseId },
            select: {
              id: true,
              editorialStatus: true,
              approvedAt: true,
              approvedByUserId: true,
              diagnosisRegistryId: true,
              diagnosisMappingStatus: true,
              clues: true,
              diagnosisRegistry: {
                select: {
                  status: true,
                },
              },
            },
          });

          if (!caseRecord) {
            throw new NotFoundException(`Case not found: ${caseId}`);
          }

          if (!canMoveToReadyToPublish(caseRecord.editorialStatus)) {
            throw new BadRequestException(
              'Only APPROVED cases can be marked ready to publish',
            );
          }

          const diagnosisPublishReadiness = getCaseDiagnosisPublishReadiness({
            diagnosisRegistryId: caseRecord.diagnosisRegistryId,
            diagnosisMappingStatus: caseRecord.diagnosisMappingStatus,
            diagnosisRegistryStatus:
              caseRecord.diagnosisRegistry?.status ?? null,
          });

          if (!diagnosisPublishReadiness.ready) {
            throw new BadRequestException(
              `Case diagnosis is not ready for publish: ${diagnosisPublishReadiness.reason}`,
            );
          }

          const clueValidation =
            this.caseEligibilityPolicy.validatePlayableClues(caseRecord.clues, {
              caseId: caseRecord.id,
            });
          if (!clueValidation.valid) {
            throw new BadRequestException(
              `Case clues are not ready for publish: ${clueValidation.reasons.join(', ')}`,
            );
          }

          const updatedCase = await tx.case.update({
            where: { id: caseId },
            data: {
              editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
            },
            select: {
              id: true,
              editorialStatus: true,
              approvedAt: true,
              approvedByUserId: true,
              currentRevisionId: true,
            },
          });

          this.logger.log(
            JSON.stringify({
              event: 'admin.case.ready_to_publish.marked',
              caseId,
              approvedAt: updatedCase.approvedAt,
              approvedByUserId: updatedCase.approvedByUserId,
            }),
          );

          return updatedCase;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    this.editorialMetrics.recordReadyToPublishTransition();

    return result;
  }

  async getEditorialStatusSummary() {
    const statuses = Object.values(CaseEditorialStatus);
    const results = await this.prisma.$transaction([
      this.prisma.case.count({
        where: {
          editorialStatus: null,
        },
      }),
      ...statuses.map((status) =>
        this.prisma.case.count({
          where: {
            editorialStatus: status,
          },
        }),
      ),
    ]);

    const [nullStatusCount, ...statusCounts] = results;
    const counts = Object.fromEntries(
      statuses.map((status, index) => [status, statusCounts[index] ?? 0]),
    ) as Record<CaseEditorialStatus, number>;

    return {
      counts,
      nullStatusCount,
      totalCases:
        nullStatusCount + statusCounts.reduce((sum, count) => sum + count, 0),
    };
  }

  async getValidationOutcomeSummary() {
    const grouped = await this.prisma.caseValidationRun.groupBy({
      by: ['source', 'outcome'],
      _count: {
        id: true,
      },
      orderBy: [{ source: 'asc' }, { outcome: 'asc' }],
    });

    const counts = Object.fromEntries(
      Object.values(CaseSource).map((source) => [
        source,
        Object.fromEntries(
          Object.values(ValidationOutcome).map((outcome) => [outcome, 0]),
        ),
      ]),
    ) as Record<CaseSource, Record<ValidationOutcome, number>>;

    for (const row of grouped) {
      if (row.source && row.outcome) {
        counts[row.source][row.outcome] = row._count.id ?? 0;
      }
    }

    return counts;
  }

  async getPublishAssignmentSummary() {
    const [approvedCases, readyToPublishCases] = await this.prisma.$transaction(
      [
        this.prisma.case.count({
          where: {
            editorialStatus: CaseEditorialStatus.APPROVED,
          },
        }),
        this.prisma.case.count({
          where: {
            editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
          },
        }),
      ],
    );

    return {
      currentEligiblePool: {
        approvedCases,
        readyToPublishCases,
      },
      metrics: this.editorialMetrics.snapshot().assignments,
    };
  }

  // TODO(diagnosis-phase-7): Daily publish selection still accepts APPROVED cases
  // through broader editorial status checks. Reuse diagnosis publish readiness
  // there when Phase 7 turns this policy into an enforced publish gate.

  private async applyDiagnosisLinkInTransaction(
    tx: ReviewTransactionClient,
    input: {
      caseId: string;
      createdByUserId: string;
      diagnosisRegistryId: string;
      diagnosisEditorialNote?: string;
      mappingMethod: 'EDITOR_SELECTED' | 'MANUAL_CREATED';
      eventName: string;
    },
  ) {
    const caseRecord = await tx.case.findUnique({
      where: { id: input.caseId },
      select: {
        id: true,
        editorialStatus: true,
        proposedDiagnosisText: true,
        diagnosisEditorialNote: true,
      },
    });

    if (!caseRecord) {
      throw new NotFoundException(`Case not found: ${input.caseId}`);
    }

    if (caseRecord.editorialStatus === CaseEditorialStatus.PUBLISHED) {
      throw new BadRequestException(
        'Published cases cannot be re-linked through the editorial diagnosis workflow',
      );
    }

    const linkableDiagnosis =
      await this.diagnosisRegistryEditorialService.getLinkableDiagnosisRegistry(
        input.diagnosisRegistryId,
        tx,
      );
    const resolvedEditorialNote =
      this.normalizeOptionalString(input.diagnosisEditorialNote) ??
      caseRecord.diagnosisEditorialNote ??
      null;

    await tx.case.update({
      where: { id: input.caseId },
      data: {
        diagnosisId: linkableDiagnosis.diagnosisId,
        diagnosisRegistryId: linkableDiagnosis.diagnosisRegistryId,
        proposedDiagnosisText: caseRecord.proposedDiagnosisText,
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: input.mappingMethod,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: resolvedEditorialNote,
        ...getApprovalResetFields(),
      },
    });

    const snapshot =
      await this.caseRevisionService.getCurrentCaseSnapshotInTransaction(
        tx,
        input.caseId,
      );
    const revision =
      await this.caseRevisionService.createRevisionFromSnapshotInTransaction(
        tx,
        {
          caseId: input.caseId,
          snapshot,
          source: CaseSource.ADMIN_EDIT,
          createdByUserId: input.createdByUserId,
        },
      );
    const validationRun = await this.createValidationRunForSnapshot(tx, {
      caseId: input.caseId,
      revisionId: revision.revisionId,
      source: CaseSource.ADMIN_EDIT,
      triggeredByUserId: input.createdByUserId,
      snapshot,
    });

    const updatedCase = await tx.case.update({
      where: { id: input.caseId },
      data: {
        editorialStatus:
          validationRun.outcome === ValidationOutcome.PASSED
            ? CaseEditorialStatus.VALIDATED
            : CaseEditorialStatus.NEEDS_EDIT,
      },
      select: {
        id: true,
      },
    });

    const detail = await this.getCaseDetailRecord(tx, updatedCase.id);

    this.logger.log(
      JSON.stringify({
        event: input.eventName,
        caseId: input.caseId,
        revisionId: revision.revisionId,
        revisionNumber: revision.revisionNumber,
        diagnosisRegistryId: linkableDiagnosis.diagnosisRegistryId,
        diagnosisId: linkableDiagnosis.diagnosisId,
        mappingMethod: input.mappingMethod,
        validationOutcome: validationRun.outcome,
        editorialStatus: detail.editorialStatus,
        createdByUserId: input.createdByUserId,
      }),
    );

    return {
      case: detail,
      revision: {
        id: revision.revisionId,
        revisionNumber: revision.revisionNumber,
      },
      validationRun,
      diagnosisRegistry: linkableDiagnosis.registry,
    };
  }

  private async createValidationRunForSnapshot(
    tx: ReviewTransactionClient,
    input: {
      caseId: string;
      revisionId: string;
      source: CaseSource;
      triggeredByUserId: string;
      snapshot: Awaited<
        ReturnType<CaseRevisionService['getCurrentCaseSnapshotInTransaction']>
      >;
    },
  ) {
    let validationReport;
    try {
      validationReport = this.caseValidationService.validateSnapshot(
        input.snapshot,
      );
    } catch (error) {
      validationReport =
        this.caseValidationService.buildExecutionErrorReport(error);
    }

    const persistencePayload =
      this.caseValidationService.buildPersistencePayload(validationReport);
    const materialContextHash = this.buildCaseMaterialContextHash(
      input.snapshot,
    );

    return tx.caseValidationRun.create({
      data: {
        caseId: input.caseId,
        revisionId: input.revisionId,
        materialContextHash,
        reviewContextIdentity: this.buildReviewContextIdentity({
          revisionId: input.revisionId,
          materialContextHash,
        }),
        source: input.source,
        outcome: validationReport.outcome,
        validatorVersion: validationReport.validatorVersion,
        summary: persistencePayload.summary,
        findings: persistencePayload.findings,
        triggeredByUserId: input.triggeredByUserId,
        startedAt: new Date(),
        completedAt: new Date(),
      },
      select: {
        id: true,
        revisionId: true,
        materialContextHash: true,
        reviewContextIdentity: true,
        outcome: true,
        validatorVersion: true,
        summary: true,
        findings: true,
        startedAt: true,
        completedAt: true,
      },
    });
  }

  private async getCaseDetailRecord(
    client: ReviewTransactionClient | PrismaService,
    caseId: string,
  ) {
    const caseRecord = await (client as PrismaService).case.findUnique({
      where: { id: caseId },
      select: EDITORIAL_CASE_DETAIL_SELECT,
    });

    if (!caseRecord) {
      throw new NotFoundException(`Case not found: ${caseId}`);
    }

    return {
      ...this.attachDiagnosisEditorialSummary(caseRecord),
      linkedDifferentials: this.toStructuredDifferentialLinks(
        caseRecord.differentialLinks,
      ),
      qualityProjection:
        this.caseQualityProjectionService.buildProjection(caseRecord),
    };
  }

  private toStructuredDifferentialLinks(
    links: Array<{
      id: string;
      role: unknown;
      confidence: number | null;
      sourceText: string;
      diagnosisRegistryId: string;
      diagnosisRegistry?: {
        id: string;
        displayLabel: string;
        canonicalName: string;
      } | null;
    }> = [],
  ) {
    return links.map((link) => ({
      id: link.id,
      diagnosisRegistryId: link.diagnosisRegistryId,
      displayLabel: link.diagnosisRegistry?.displayLabel ?? link.sourceText,
      canonicalName: link.diagnosisRegistry?.canonicalName ?? link.sourceText,
      role: link.role,
      confidence: link.confidence,
      sourceText: link.sourceText,
    }));
  }

  private attachDiagnosisEditorialSummary<
    T extends {
      diagnosisRegistryId: string | null;
      diagnosisMappingStatus: DiagnosisMappingStatus;
      diagnosisMappingMethod: DiagnosisMappingMethod;
      diagnosisMappingConfidence: number | null;
      diagnosisEditorialNote: string | null;
      proposedDiagnosisText: string;
      diagnosisRegistry?: {
        id: string;
        displayLabel: string;
        canonicalName: string;
        status: unknown;
        category: string | null;
        specialty: string | null;
        bodySystem: string | null;
      } | null;
      currentRevision?: {
        diagnosisRegistryId?: string | null;
        diagnosisMappingStatus?: DiagnosisMappingStatus;
        diagnosisMappingMethod?: DiagnosisMappingMethod;
        diagnosisMappingConfidence?: number | null;
        diagnosisEditorialNote?: string | null;
        proposedDiagnosisText?: string;
      } | null;
    },
  >(caseRecord: T) {
    const diagnosisPublishReadiness = getCaseDiagnosisPublishReadiness({
      diagnosisRegistryId: caseRecord.diagnosisRegistryId,
      diagnosisMappingStatus: caseRecord.diagnosisMappingStatus,
      diagnosisRegistryStatus:
        (caseRecord.diagnosisRegistry?.status as
          | Parameters<
              typeof getCaseDiagnosisPublishReadiness
            >[0]['diagnosisRegistryStatus']
          | undefined) ?? null,
    });

    return {
      ...caseRecord,
      diagnosisRegistrySummary: caseRecord.diagnosisRegistry
        ? {
            id: caseRecord.diagnosisRegistry.id,
            displayLabel: caseRecord.diagnosisRegistry.displayLabel,
            canonicalName: caseRecord.diagnosisRegistry.canonicalName,
            status: caseRecord.diagnosisRegistry.status,
            category: caseRecord.diagnosisRegistry.category,
            specialty: caseRecord.diagnosisRegistry.specialty,
            bodySystem: caseRecord.diagnosisRegistry.bodySystem,
          }
        : null,
      diagnosisPublishReadiness,
    };
  }

  private async assertCaseExists(caseId: string): Promise<void> {
    const existing = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Case not found: ${caseId}`);
    }
  }

  private async getCaseRevisionMaterialContextInTransaction(
    tx: ReviewTransactionClient,
    input: { caseId: string; revisionId: string | null },
  ) {
    if (!input.revisionId) {
      throw new BadRequestException(
        'Cannot create review context without a current revision',
      );
    }

    const revision = await tx.caseRevision.findFirst({
      where: {
        id: input.revisionId,
        caseId: input.caseId,
      },
      select: CASE_REVISION_MATERIAL_SELECT,
    });

    if (!revision) {
      throw new NotFoundException(
        `Case revision not found: ${input.revisionId}`,
      );
    }

    const materialContextHash = this.buildCaseMaterialContextHash(revision);
    return {
      materialContextHash,
      reviewContextIdentity: this.buildReviewContextIdentity({
        revisionId: input.revisionId,
        materialContextHash,
      }),
    };
  }

  private buildReviewContextIdentity(input: {
    revisionId: string | null;
    materialContextHash: string;
  }): string {
    return `case-review-context:${input.revisionId ?? 'unknown'}:${input.materialContextHash}`;
  }

  private buildCaseMaterialContextHash(input: Record<string, unknown>): string {
    const material = {
      title: input.title,
      date: input.date,
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
    };
    return createHash('sha256')
      .update(stableStringify(this.normalizeForMaterialHash(material)))
      .digest('hex');
  }

  private normalizeForMaterialHash(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
      return value.map((entry) => this.normalizeForMaterialHash(entry));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          this.normalizeForMaterialHash(entry),
        ]),
      );
    }
    return value;
  }

  private toCanonicalFindings(value: unknown): string[] {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
      return value.map((entry) =>
        typeof entry === 'string' ? entry : stableStringify(entry),
      );
    }
    return [typeof value === 'string' ? value : stableStringify(value)];
  }

  private getApp006ReplayEligibleUniqueConflict(
    error: unknown,
  ): App006UniqueConflictTarget | null {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      (error as { code?: string }).code !== 'P2002'
    ) {
      return null;
    }

    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    const values = Array.isArray(target)
      ? target.map(String)
      : typeof target === 'string'
        ? [target]
        : [];
    if (values.some((value) => value.includes('commandIdempotencyKey'))) {
      return 'commandIdempotencyKey';
    }
    if (values.some((value) => value.includes('reviewId'))) {
      return 'reviewId';
    }
    return null;
  }

  private isPrismaSerializableConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2034'
    );
  }

  private normalizeOptionalString(value?: string): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private requireCanonicalDiagnosis(value: string): string {
    const canonicalDiagnosis = this.normalizeOptionalString(value);
    if (!canonicalDiagnosis) {
      throw new BadRequestException('Canonical diagnosis is required');
    }

    if (!normalizeDiagnosisTerm(canonicalDiagnosis)) {
      throw new BadRequestException(
        'Canonical diagnosis must normalize to a non-empty identifier',
      );
    }

    return canonicalDiagnosis;
  }

  private toNullableJsonValue(
    value: Prisma.JsonValue | null,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
  }

  private async withSerializableRetry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        attempt += 1;
        const maybePrismaError = error as { code?: string };
        if (maybePrismaError.code !== 'P2034' || attempt >= maxAttempts) {
          throw error;
        }
      }
    }
  }
}
