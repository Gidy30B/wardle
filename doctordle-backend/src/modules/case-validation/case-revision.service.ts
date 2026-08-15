import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CaseEditorialStatus,
  CaseSource,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service.js';
import { EditorialMetricsService } from '../editorial/editorial-metrics.service.js';
import { getApprovalResetFields } from '../editorial/policies/approval-policy.js';
import { stableStringify } from '../editorial-governance/governed-command/index.js';
import type {
  CaseRevisionSnapshot,
  CreatedRevisionResult,
} from './case-validation.types.js';
import {
  buildCaseRevisionMaterialHash,
  canonicalizeRevisionClues,
  normalizeForMaterialHash,
  toMaterialHashInput,
} from './case-revision-material.js';

type RevisionTransactionClient = Prisma.TransactionClient | PrismaClient;

type App007RevisionTestHooks = {
  beforeCommandCreate?: () => void | Promise<void>;
};

export type CreateCaseRevisionCommandInput = {
  caseId: string;
  expectedRevisionId: string;
  commandIdempotencyKey: string;
  snapshot: CaseRevisionSnapshot;
  source: CaseSource;
  createdByUserId?: string;
  changeSummary: string;
  changeReason: string;
  materialChange?: Record<string, unknown>;
  editorialStatusAfterProjection?: CaseEditorialStatus;
};

export type ExecuteCreateCaseRevisionCommandOptions<T> = {
  input?: CreateCaseRevisionCommandInput;
  runInTransaction: (tx: Prisma.TransactionClient) => Promise<T>;
  getReplayInput?: () => CreateCaseRevisionCommandInput | undefined;
  replay?: (revision: CreatedRevisionResult) => Promise<T>;
};

@Injectable()
export class CaseRevisionService {
  private readonly logger = new Logger(CaseRevisionService.name);
  private app007RevisionTestHooks?: App007RevisionTestHooks;

  constructor(
    private readonly editorialMetrics: EditorialMetricsService,
    private readonly diagnosisRegistryLinkService: DiagnosisRegistryLinkService,
  ) {}

  setApp007RevisionTestHooksForTest(hooks?: App007RevisionTestHooks) {
    this.app007RevisionTestHooks = hooks;
  }

  async createRevisionForGeneratedCaseInTransaction(
    tx: RevisionTransactionClient,
    input: { caseId: string },
  ): Promise<CreatedRevisionResult> {
    const snapshot = await this.getCurrentCaseSnapshotInTransaction(tx, input.caseId);
    return this.createRevisionFromSnapshotInTransaction(tx, {
      caseId: input.caseId,
      snapshot,
      source: CaseSource.GENERATED,
    });
  }

  async getCurrentCaseSnapshotInTransaction(
    tx: RevisionTransactionClient,
    caseId: string,
  ): Promise<CaseRevisionSnapshot> {
    const caseRecord = await tx.case.findUnique({
      where: { id: caseId },
      select: {
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
        diagnosisId: true,
        diagnosisRegistryId: true,
        proposedDiagnosisText: true,
        diagnosisMappingStatus: true,
        diagnosisMappingMethod: true,
        diagnosisMappingConfidence: true,
        diagnosisEditorialNote: true,
      },
    });

    if (!caseRecord) {
      throw new NotFoundException(`Generated case not found: ${caseId}`);
    }

    const resolvedDiagnosisRegistryId =
      caseRecord.diagnosisRegistryId ??
      (
        await this.diagnosisRegistryLinkService.resolveForWrite(
          {
            diagnosisId: caseRecord.diagnosisId,
          },
          tx,
        )
      ).diagnosisRegistryId;

    if (caseRecord.diagnosisRegistryId !== resolvedDiagnosisRegistryId) {
      await tx.case.update({
        where: { id: caseId },
        data: {
          diagnosisRegistryId: resolvedDiagnosisRegistryId,
        },
      });
    }

    return this.toSnapshot({
      ...caseRecord,
      diagnosisRegistryId: resolvedDiagnosisRegistryId,
    });
  }

  async createRevisionFromSnapshotInTransaction(
    tx: RevisionTransactionClient,
    input: {
      caseId: string;
      snapshot: CaseRevisionSnapshot;
      source: CaseSource;
      createdByUserId?: string;
    },
  ): Promise<CreatedRevisionResult> {
    const latestRevision = await tx.caseRevision.findFirst({
      where: { caseId: input.caseId },
      orderBy: {
        revisionNumber: 'desc',
      },
      select: {
        revisionNumber: true,
      },
    });

    const revisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;
    const revisionId = randomUUID();

    await tx.caseRevision.create({
      data: {
        id: revisionId,
        caseId: input.caseId,
        revisionNumber,
        source: input.source,
        title: input.snapshot.title,
        date: input.snapshot.date,
        difficulty: input.snapshot.difficulty,
        history: input.snapshot.history,
        symptoms: input.snapshot.symptoms,
        labs: this.toNullableJsonValue(input.snapshot.labs),
        clues: this.toNullableJsonValue(input.snapshot.clues),
        explanation: this.toNullableJsonValue(input.snapshot.explanation),
        differentials: input.snapshot.differentials,
        diagnosisId: input.snapshot.diagnosisId,
        diagnosisRegistryId: input.snapshot.diagnosisRegistryId,
        proposedDiagnosisText: input.snapshot.proposedDiagnosisText,
        diagnosisMappingStatus: input.snapshot.diagnosisMappingStatus,
        diagnosisMappingMethod: input.snapshot.diagnosisMappingMethod,
        diagnosisMappingConfidence: input.snapshot.diagnosisMappingConfidence,
        diagnosisEditorialNote: input.snapshot.diagnosisEditorialNote,
        createdByUserId: input.createdByUserId,
      },
    });

    await tx.case.update({
      where: {
        id: input.caseId,
      },
      data: {
        currentRevisionId: revisionId,
      },
    });

    this.editorialMetrics.recordRevisionCreated(input.source);
    this.logger.log(
      JSON.stringify({
        event: 'case.revision.created',
        caseId: input.caseId,
        revisionId,
        revisionNumber,
        source: input.source,
        createdByUserId: input.createdByUserId ?? null,
      }),
    );

    return {
      status: 'created',
      revisionId,
      revisionNumber,
      snapshot: input.snapshot,
    };
  }

  async createCaseRevisionCommandInTransaction(
    tx: RevisionTransactionClient,
    input: CreateCaseRevisionCommandInput,
  ): Promise<CreatedRevisionResult> {
    const commandFingerprint =
      this.buildCreateCaseRevisionCommandFingerprint(input);
    const caseRecord = await tx.case.findUnique({
      where: { id: input.caseId },
      select: {
        id: true,
        currentRevisionId: true,
        editorialStatus: true,
        dailyCases: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!caseRecord) {
      throw new NotFoundException(`Case not found: ${input.caseId}`);
    }
    if (!caseRecord.currentRevisionId) {
      throw new BadRequestException(
        'CREATE_CASE_REVISION requires an existing current revision',
      );
    }

    const priorCommand = await tx.caseRevisionCreationCommand.findUnique({
      where: {
        commandIdempotencyKey: input.commandIdempotencyKey,
      },
      select: {
        commandFingerprint: true,
        resultRevisionId: true,
        status: true,
      },
    });
    if (priorCommand) {
      return this.resolvePriorCreateCaseRevisionCommand(tx, {
        input,
        commandFingerprint,
        priorCommand,
      });
    }

    if (caseRecord.currentRevisionId !== input.expectedRevisionId) {
      throw new ConflictException(
        'Stale CREATE_CASE_REVISION command: expected revision does not match current revision',
      );
    }
    if (
      caseRecord.editorialStatus === CaseEditorialStatus.READY_TO_PUBLISH ||
      caseRecord.editorialStatus === CaseEditorialStatus.PUBLISHED ||
      caseRecord.dailyCases.length > 0
    ) {
      throw new ConflictException(
        'CREATE_CASE_REVISION is blocked for scheduled or learner-exposable cases until revision-targeted publication is implemented',
      );
    }

    const baseRevision = await tx.caseRevision.findFirst({
      where: {
        id: input.expectedRevisionId,
        caseId: input.caseId,
      },
      select: {
        id: true,
        clues: true,
      },
    });
    if (!baseRevision) {
      throw new ConflictException(
        'CREATE_CASE_REVISION base revision does not belong to the target case',
      );
    }

    const canonicalClues = canonicalizeRevisionClues({
      baseClues: baseRevision.clues,
      proposedClues: input.snapshot.clues,
    });
    const snapshot: CaseRevisionSnapshot = {
      ...input.snapshot,
      clues: canonicalClues.clues,
    };
    const contentHash = buildCaseRevisionMaterialHash({
      ...snapshot,
      source: input.source,
    });
    await this.app007RevisionTestHooks?.beforeCommandCreate?.();

    await tx.caseRevisionCreationCommand.create({
      data: {
        commandAction: 'CREATE_CASE_REVISION',
        commandIdempotencyKey: input.commandIdempotencyKey,
        commandFingerprint,
        caseId: input.caseId,
        expectedRevisionId: input.expectedRevisionId,
        status: 'PENDING',
      },
    });

    const latestRevision = await tx.caseRevision.findFirst({
      where: { caseId: input.caseId },
      orderBy: { revisionNumber: 'desc' },
      select: { revisionNumber: true },
    });
    const revisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;
    const revisionId = randomUUID();

    await tx.caseRevision.create({
      data: {
        id: revisionId,
        caseId: input.caseId,
        revisionNumber,
        contentHash,
        createdFromRevisionId: input.expectedRevisionId,
        changeSummary: input.changeSummary,
        changeReason: input.changeReason,
        materialChange: {
          ...(input.materialChange ?? {}),
          ...canonicalClues.materialChange,
        } as Prisma.InputJsonValue,
        source: input.source,
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
        createdByUserId: input.createdByUserId,
      },
    });

    const projection = await tx.case.updateMany({
      where: {
        id: input.caseId,
        currentRevisionId: input.expectedRevisionId,
      },
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
        currentRevisionId: revisionId,
        ...(input.editorialStatusAfterProjection
          ? { editorialStatus: input.editorialStatusAfterProjection }
          : {}),
        ...getApprovalResetFields(),
      },
    });

    if (projection.count !== 1) {
      throw new ConflictException(
        'Stale CREATE_CASE_REVISION command: current revision changed before projection',
      );
    }

    await tx.caseRevisionCreationCommand.update({
      where: {
        commandIdempotencyKey: input.commandIdempotencyKey,
      },
      data: {
        status: 'SUCCESS',
        resultRevisionId: revisionId,
        completedAt: new Date(),
      },
    });

    this.editorialMetrics.recordRevisionCreated(input.source);
    this.logger.log(
      JSON.stringify({
        event: 'case.revision.create_case_revision.completed',
        caseId: input.caseId,
        revisionId,
        revisionNumber,
        source: input.source,
        createdFromRevisionId: input.expectedRevisionId,
        contentHash,
        createdByUserId: input.createdByUserId ?? null,
      }),
    );

    return {
      status: 'created',
      revisionId,
      revisionNumber,
      contentHash,
      snapshot,
    };
  }

  async executeCreateCaseRevisionCommand<T>(
    client: PrismaClient,
    options: ExecuteCreateCaseRevisionCommandOptions<T>,
  ): Promise<T> {
    try {
      return await client.$transaction(
        (tx) => options.runInTransaction(tx),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!this.isApp007ReplayEligiblePersistenceError(error)) throw error;

      const replayInput = options.input ?? options.getReplayInput?.();
      if (!replayInput) throw error;

      const revision = await this.resolveCreateCaseRevisionReplayAfterRollback(
        client,
        replayInput,
      );
      if (options.replay) {
        return options.replay(revision);
      }
      return revision as T;
    }
  }

  buildCreateCaseRevisionCommandFingerprint(
    input: CreateCaseRevisionCommandInput,
  ): string {
    return stableStringify(
      normalizeForMaterialHash({
        action: 'CREATE_CASE_REVISION',
        artifactType: 'CLINICAL_CASE',
        artifactId: input.caseId,
        expectedRevisionId: input.expectedRevisionId,
        requestedEffect: {
          createRevision: true,
          updateCurrentRevisionProjection: true,
          resetApprovalProjection: true,
        },
        payloadHash: buildCaseRevisionMaterialHash({
          ...input.snapshot,
          source: input.source,
        }),
        payload: {
          material: toMaterialHashInput({
            ...input.snapshot,
            source: input.source,
          }),
          changeSummary: input.changeSummary,
          changeReason: input.changeReason,
        },
      }),
    );
  }

  async resolveCreateCaseRevisionReplayAfterRollback(
    client: RevisionTransactionClient,
    input: CreateCaseRevisionCommandInput,
  ): Promise<CreatedRevisionResult> {
    const commandFingerprint =
      this.buildCreateCaseRevisionCommandFingerprint(input);
    const priorCommand = await client.caseRevisionCreationCommand.findUnique({
      where: {
        commandIdempotencyKey: input.commandIdempotencyKey,
      },
      select: {
        commandFingerprint: true,
        resultRevisionId: true,
        status: true,
      },
    });
    if (!priorCommand) {
      throw new ConflictException(
        'CREATE_CASE_REVISION could not be replayed after concurrent persistence conflict',
      );
    }

    return this.resolvePriorCreateCaseRevisionCommand(client, {
      input,
      commandFingerprint,
      priorCommand,
    });
  }

  isApp007ReplayEligiblePersistenceError(error: unknown): boolean {
    if (this.isPrismaSerializableConflict(error)) return true;
    if (!this.isPrismaUniqueConflict(error)) return false;

    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    const values = Array.isArray(target)
      ? target.map(String)
      : typeof target === 'string'
        ? [target]
        : [];
    return values.some(
      (value) =>
        value.includes('commandIdempotencyKey') ||
        value.includes('caseId_revisionNumber'),
    );
  }

  private async resolvePriorCreateCaseRevisionCommand(
    client: RevisionTransactionClient,
    input: {
      input: CreateCaseRevisionCommandInput;
      commandFingerprint: string;
      priorCommand: {
        commandFingerprint: string;
        resultRevisionId: string | null;
        status: string;
      };
    },
  ): Promise<CreatedRevisionResult> {
    if (input.priorCommand.commandFingerprint !== input.commandFingerprint) {
      throw new ConflictException(
        'CREATE_CASE_REVISION idempotency key conflicts with a different command fingerprint',
      );
    }
    if (
      input.priorCommand.status !== 'SUCCESS' ||
      !input.priorCommand.resultRevisionId
    ) {
      throw new ConflictException(
        'CREATE_CASE_REVISION idempotency command is not yet replayable',
      );
    }

    const revision = await client.caseRevision.findFirst({
      where: {
        id: input.priorCommand.resultRevisionId,
        caseId: input.input.caseId,
      },
      select: {
        id: true,
        revisionNumber: true,
        contentHash: true,
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
      throw new ConflictException(
        'CREATE_CASE_REVISION idempotency result revision is missing',
      );
    }

    return {
      status: 'created',
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
      contentHash: revision.contentHash ?? undefined,
      snapshot: this.toSnapshot({
        ...revision,
        id: input.input.caseId,
        diagnosisRegistryId:
          revision.diagnosisRegistryId ?? input.input.snapshot.diagnosisRegistryId,
      }),
    };
  }

  private isPrismaUniqueConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  private isPrismaSerializableConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2034'
    );
  }

  private toSnapshot(caseRecord: {
    id: string;
    title: string;
    date: Date;
    difficulty: string;
    history: string;
    symptoms: string[];
    labs: Prisma.JsonValue | null;
    clues: Prisma.JsonValue | null;
    explanation: Prisma.JsonValue | null;
    differentials: string[];
    diagnosisId: string | null;
    diagnosisRegistryId: string;
    proposedDiagnosisText: string;
    diagnosisMappingStatus: CaseRevisionSnapshot['diagnosisMappingStatus'];
    diagnosisMappingMethod: CaseRevisionSnapshot['diagnosisMappingMethod'];
    diagnosisMappingConfidence: number | null;
    diagnosisEditorialNote: string | null;
  }): CaseRevisionSnapshot {
    return {
      caseId: caseRecord.id,
      title: caseRecord.title,
      date: caseRecord.date,
      difficulty: caseRecord.difficulty,
      history: caseRecord.history,
      symptoms: [...caseRecord.symptoms],
      labs: caseRecord.labs,
      clues: caseRecord.clues,
      explanation: caseRecord.explanation,
      differentials: [...caseRecord.differentials],
      diagnosisId: caseRecord.diagnosisId,
      diagnosisRegistryId: caseRecord.diagnosisRegistryId,
      proposedDiagnosisText: caseRecord.proposedDiagnosisText,
      diagnosisMappingStatus: caseRecord.diagnosisMappingStatus,
      diagnosisMappingMethod: caseRecord.diagnosisMappingMethod,
      diagnosisMappingConfidence: caseRecord.diagnosisMappingConfidence,
      diagnosisEditorialNote: caseRecord.diagnosisEditorialNote,
    };
  }

  private toNullableJsonValue(
    value: Prisma.JsonValue | null,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
  }
}
