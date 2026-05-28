import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import type { ListGraphCandidatesDto } from './dto/list-graph-candidates.dto';
import type {
  MergeGraphCandidateDto,
  RejectGraphCandidateDto,
} from './dto/review-graph-candidate.dto';
import { buildGraphDedupeKey } from './diagnosis-graph-normalization';

@Injectable()
export class DiagnosisGraphCandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCandidates(filters: ListGraphCandidatesDto) {
    return this.prisma.diagnosisGraphCandidate.findMany({
      where: {
        diagnosisRegistryId: filters.diagnosisRegistryId,
        type: filters.type,
        status: filters.status,
        sourceType: filters.sourceType,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      include: {
        diagnosisRegistry: {
          select: { id: true, displayLabel: true },
        },
        targetDiagnosisRegistry: {
          select: { id: true, displayLabel: true },
        },
        promotedFact: {
          select: { id: true, status: true },
        },
      },
    });
  }

  async getCandidate(id: string) {
    const candidate = await this.prisma.diagnosisGraphCandidate.findUnique({
      where: { id },
      include: {
        diagnosisRegistry: {
          select: { id: true, displayLabel: true },
        },
        targetDiagnosisRegistry: {
          select: { id: true, displayLabel: true },
        },
        promotedFact: true,
        mergedInto: {
          select: { id: true, rawText: true, status: true },
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException('Diagnosis graph candidate not found');
    }

    return candidate;
  }

  async approveCandidate(id: string, reviewerUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.diagnosisGraphCandidate.findUnique({
        where: { id },
      });

      if (!candidate) {
        throw new NotFoundException('Diagnosis graph candidate not found');
      }

      const fact = await this.upsertFactForCandidate(tx, candidate);
      const reviewedAt = new Date();
      const updatedCandidate = await tx.diagnosisGraphCandidate.update({
        where: { id },
        data: {
          status: DiagnosisGraphCandidateStatus.APPROVED,
          reviewedByUserId: reviewerUserId,
          reviewedAt,
          promotedFactId: fact.id,
          reviewNote: null,
          mergedIntoId: null,
        },
      });

      return {
        candidate: updatedCandidate,
        fact,
      };
    });
  }

  async rejectCandidate(
    id: string,
    reviewerUserId: string,
    input: RejectGraphCandidateDto,
  ) {
    await this.assertCandidateExists(id);
    return this.prisma.diagnosisGraphCandidate.update({
      where: { id },
      data: {
        status: DiagnosisGraphCandidateStatus.REJECTED,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        reviewNote: input.note?.trim() || null,
      },
    });
  }

  async mergeCandidate(
    id: string,
    reviewerUserId: string,
    input: MergeGraphCandidateDto,
  ) {
    if (!input.targetCandidateId && !input.targetFactId) {
      throw new BadRequestException(
        'Merge requires targetCandidateId or targetFactId',
      );
    }

    if (input.targetCandidateId && input.targetFactId) {
      throw new BadRequestException(
        'Merge target must be either a candidate or a fact, not both',
      );
    }

    if (input.targetCandidateId === id) {
      throw new BadRequestException('Candidate cannot be merged into itself');
    }

    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.diagnosisGraphCandidate.findUnique({
        where: { id },
      });

      if (!candidate) {
        throw new NotFoundException('Diagnosis graph candidate not found');
      }

      if (input.targetCandidateId) {
        const targetCandidate = await tx.diagnosisGraphCandidate.findUnique({
          where: { id: input.targetCandidateId },
          select: { id: true },
        });

        if (!targetCandidate) {
          throw new NotFoundException('Target graph candidate not found');
        }
      }

      if (input.targetFactId) {
        const targetFact = await tx.diagnosisGraphFact.findUnique({
          where: { id: input.targetFactId },
          select: { id: true },
        });

        if (!targetFact) {
          throw new NotFoundException('Target graph fact not found');
        }
      }

      return tx.diagnosisGraphCandidate.update({
        where: { id },
        data: {
          status: DiagnosisGraphCandidateStatus.MERGED,
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
          reviewNote: input.note?.trim() || null,
          mergedIntoId: input.targetCandidateId ?? null,
          promotedFactId: input.targetFactId ?? null,
        },
      });
    });
  }

  async getActiveGraph(diagnosisRegistryId: string) {
    return this.prisma.diagnosisGraphFact.findMany({
      where: {
        diagnosisRegistryId,
        status: DiagnosisGraphFactStatus.ACTIVE,
      },
      orderBy: [{ type: 'asc' }, { label: 'asc' }],
      include: {
        targetDiagnosisRegistry: {
          select: { id: true, displayLabel: true },
        },
      },
    });
  }

  async getActiveFactsByType(
    diagnosisRegistryId: string,
    type: DiagnosisGraphCandidateType,
  ) {
    return this.prisma.diagnosisGraphFact.findMany({
      where: {
        diagnosisRegistryId,
        type,
        status: DiagnosisGraphFactStatus.ACTIVE,
      },
      orderBy: [{ label: 'asc' }],
      include: {
        targetDiagnosisRegistry: {
          select: { id: true, displayLabel: true },
        },
      },
    });
  }

  private async upsertFactForCandidate(
    tx: Prisma.TransactionClient,
    candidate: {
      id: string;
      diagnosisRegistryId: string;
      type: DiagnosisGraphCandidateType;
      rawText: string;
      normalizedText: string;
      unresolvedTargetText: string | null;
      payload: Prisma.JsonValue | null;
      targetDiagnosisRegistryId: string | null;
      sourceType: unknown;
      sourceId: string;
      sourceVersion: number | null;
      sourcePath: string;
    },
  ) {
    const dedupeKey = buildGraphDedupeKey([
      candidate.diagnosisRegistryId,
      candidate.type,
      candidate.normalizedText,
      candidate.targetDiagnosisRegistryId ?? candidate.unresolvedTargetText ?? '',
    ]);
    const existingFact = await tx.diagnosisGraphFact.findUnique({
      where: {
        dedupeKey,
      },
    });
    const provenance = this.buildProvenance(candidate, existingFact?.provenance);

    if (existingFact) {
      return tx.diagnosisGraphFact.update({
        where: { id: existingFact.id },
        data: {
          label: candidate.rawText,
          dedupeKey,
          payload: this.toJsonInput(candidate.payload),
          status: DiagnosisGraphFactStatus.ACTIVE,
          sourceCandidateId: existingFact.sourceCandidateId ?? candidate.id,
          provenance,
        },
      });
    }

    return tx.diagnosisGraphFact.create({
      data: {
        diagnosisRegistryId: candidate.diagnosisRegistryId,
        type: candidate.type,
        label: candidate.rawText,
        normalizedLabel: candidate.normalizedText,
        dedupeKey,
        payload: this.toJsonInput(candidate.payload),
        targetDiagnosisRegistryId: candidate.targetDiagnosisRegistryId,
        status: DiagnosisGraphFactStatus.ACTIVE,
        sourceCandidateId: candidate.id,
        provenance,
      },
    });
  }

  private buildProvenance(
    candidate: {
      id: string;
      sourceType: unknown;
      sourceId: string;
      sourceVersion: number | null;
      sourcePath: string;
    },
    existing: Prisma.JsonValue | null | undefined,
  ): Prisma.InputJsonObject {
    const previous =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : {};
    const sources = Array.isArray(previous.sources) ? previous.sources : [];

    return {
      ...previous,
      sources: [
        ...sources,
        {
          candidateId: candidate.id,
          sourceType: String(candidate.sourceType),
          sourceId: candidate.sourceId,
          sourceVersion: candidate.sourceVersion,
          sourcePath: candidate.sourcePath,
        },
      ],
    };
  }

  private async assertCandidateExists(id: string): Promise<void> {
    const candidate = await this.prisma.diagnosisGraphCandidate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!candidate) {
      throw new NotFoundException('Diagnosis graph candidate not found');
    }
  }

  private toJsonInput(
    value: Prisma.JsonValue | null,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    return value === null ? undefined : (value as Prisma.InputJsonValue);
  }
}
