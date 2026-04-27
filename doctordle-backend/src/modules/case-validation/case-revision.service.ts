import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CaseSource, Prisma, type PrismaClient } from '@prisma/client';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service.js';
import { EditorialMetricsService } from '../editorial/editorial-metrics.service.js';
import type {
  CaseRevisionSnapshot,
  CreatedRevisionResult,
} from './case-validation.types.js';

type RevisionTransactionClient = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class CaseRevisionService {
  private readonly logger = new Logger(CaseRevisionService.name);

  constructor(
    private readonly editorialMetrics: EditorialMetricsService,
    private readonly diagnosisRegistryLinkService: DiagnosisRegistryLinkService,
  ) {}

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

    const resolvedDiagnosisLink =
      await this.diagnosisRegistryLinkService.resolveForWrite(
        {
          diagnosisId: caseRecord.diagnosisId,
          diagnosisRegistryId: caseRecord.diagnosisRegistryId,
        },
        tx,
      );

    if (caseRecord.diagnosisRegistryId !== resolvedDiagnosisLink.diagnosisRegistryId) {
      await tx.case.update({
        where: { id: caseId },
        data: {
          diagnosisRegistryId: resolvedDiagnosisLink.diagnosisRegistryId,
        },
      });
    }

    return this.toSnapshot({
      ...caseRecord,
      diagnosisRegistryId: resolvedDiagnosisLink.diagnosisRegistryId,
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
    diagnosisId: string;
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
