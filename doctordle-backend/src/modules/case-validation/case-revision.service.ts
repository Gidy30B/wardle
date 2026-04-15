import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CaseSource, Prisma, type PrismaClient } from '@prisma/client';
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
      },
    });

    if (!caseRecord) {
      throw new NotFoundException(`Generated case not found: ${caseId}`);
    }

    return this.toSnapshot(caseRecord);
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
    };
  }

  private toNullableJsonValue(
    value: Prisma.JsonValue | null,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
  }
}
