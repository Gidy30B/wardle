import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  DiagnosisAliasKind,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { normalizeDiagnosisTerm } from '../diagnosis-registry/diagnosis-term-normalizer';
import { assertAliasValidWithClient } from '../diagnosis-registry/alias-validation.service';
import type { ListGraphCandidatesDto } from './dto/list-graph-candidates.dto';
import type {
  MergeGraphCandidateDto,
  RejectGraphCandidateDto,
  ResolveMimicCandidateDto,
} from './dto/review-graph-candidate.dto';
import { buildGraphDedupeKey } from './diagnosis-graph-normalization';
import { DifferentialRegistryResolutionService } from './differential-registry-resolution.service';

@Injectable()
export class DiagnosisGraphCandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly differentialRegistryResolutionService: DifferentialRegistryResolutionService,
  ) {}

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

  async listUnresolvedMimicCandidates() {
    const rows = await this.prisma.diagnosisGraphCandidate.findMany({
      where: {
        type: DiagnosisGraphCandidateType.MIMIC,
        status: DiagnosisGraphCandidateStatus.CANDIDATE,
        targetDiagnosisRegistryId: null,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      include: {
        diagnosisRegistry: {
          select: { id: true, displayLabel: true, canonicalName: true },
        },
        targetDiagnosisRegistry: {
          select: { id: true, displayLabel: true },
        },
      },
    });

    return Promise.all(
      rows.map(async (candidate) => {
        const payloadSuggestions =
          this.getResolutionSuggestions(candidate.payload) ?? [];
        const resolution =
          payloadSuggestions.length > 0
            ? null
            : await this.differentialRegistryResolutionService.resolve({
                rawText: candidate.unresolvedTargetText ?? candidate.rawText,
                contextDiagnosisRegistryId: candidate.diagnosisRegistryId,
              });

        return {
          id: candidate.id,
          rawText: candidate.rawText,
          normalizedText: candidate.normalizedText,
          contextDiagnosis: candidate.diagnosisRegistry,
          diagnosisRegistryId: candidate.diagnosisRegistryId,
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          sourcePath: candidate.sourcePath,
          payload: candidate.payload,
          suggestions: payloadSuggestions.length
            ? payloadSuggestions
            : (resolution?.suggestions ?? []),
          createdAt: candidate.createdAt,
          status: candidate.status,
        };
      }),
    );
  }

  async approveCandidate(id: string, reviewerUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.diagnosisGraphCandidate.findUnique({
        where: { id },
      });

      if (!candidate) {
        throw new NotFoundException('Diagnosis graph candidate not found');
      }

      this.assertCanPromoteCandidate(candidate);
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

  async resolveMimicCandidate(
    id: string,
    reviewerUserId: string,
    input: ResolveMimicCandidateDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.diagnosisGraphCandidate.findUnique({
        where: { id },
      });

      if (!candidate) {
        throw new NotFoundException('Diagnosis graph candidate not found');
      }

      if (candidate.type !== DiagnosisGraphCandidateType.MIMIC) {
        throw new BadRequestException('Only MIMIC candidates can be resolved');
      }

      if (input.action === 'reject') {
        return tx.diagnosisGraphCandidate.update({
          where: { id },
          data: {
            status: DiagnosisGraphCandidateStatus.REJECTED,
            reviewedByUserId: reviewerUserId,
            reviewedAt: new Date(),
            reviewNote: input.reason?.trim() || 'Rejected during mimic resolution',
          },
        });
      }

      const targetDiagnosisRegistryId = input.targetDiagnosisRegistryId;
      if (!targetDiagnosisRegistryId) {
        throw new BadRequestException('targetDiagnosisRegistryId is required');
      }

      const target = await tx.diagnosisRegistry.findUnique({
        where: { id: targetDiagnosisRegistryId },
        select: {
          id: true,
          canonicalNormalized: true,
          displayLabel: true,
          active: true,
        },
      });

      if (!target?.active) {
        throw new BadRequestException('Target diagnosis registry entry is not active');
      }

      if (target.id === candidate.diagnosisRegistryId) {
        throw new BadRequestException('Mimic target cannot be the source diagnosis');
      }

      if (input.action === 'add_alias_to_existing') {
        await this.addSafeAcceptedAlias(tx, {
          diagnosisRegistryId: target.id,
          aliasText: input.aliasText ?? candidate.unresolvedTargetText ?? candidate.rawText,
          targetCanonicalNormalized: target.canonicalNormalized,
        });
      }

      const resolution =
        await this.differentialRegistryResolutionService.resolve({
          rawText: candidate.unresolvedTargetText ?? candidate.rawText,
          contextDiagnosisRegistryId: candidate.diagnosisRegistryId,
        });

      return tx.diagnosisGraphCandidate.update({
        where: { id },
        data: {
          targetDiagnosisRegistryId: target.id,
          unresolvedTargetText: null,
          payload: this.toJsonInput(
            this.mergePayload(candidate.payload, {
              registryResolution: {
                rawText: resolution.rawText,
                normalizedText: resolution.normalizedText,
                status: 'resolved',
                resolvedRegistryId: target.id,
                resolvedDisplayLabel: target.displayLabel,
                matchType:
                  input.action === 'add_alias_to_existing'
                    ? 'alias'
                    : (resolution.matchType ?? 'canonical'),
                confidence: Math.max(resolution.confidence, 0.95),
                suggestions: resolution.suggestions,
                resolvedByAction: input.action,
              },
            }),
          ),
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
          reviewNote: input.reason?.trim() || null,
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

  private assertCanPromoteCandidate(candidate: {
    type: DiagnosisGraphCandidateType;
    targetDiagnosisRegistryId: string | null;
  }): void {
    if (
      candidate.type === DiagnosisGraphCandidateType.MIMIC &&
      !candidate.targetDiagnosisRegistryId
    ) {
      throw new BadRequestException(
        'Resolve this mimic to a diagnosis registry entry before approval.',
      );
    }
  }

  private async addSafeAcceptedAlias(
    tx: Prisma.TransactionClient,
    input: {
      diagnosisRegistryId: string;
      aliasText: string;
      targetCanonicalNormalized: string;
    },
  ): Promise<void> {
    const alias = input.aliasText.replace(/\s+/g, ' ').trim();
    const normalizedAlias = normalizeDiagnosisTerm(alias);
    if (!alias || !normalizedAlias) {
      throw new BadRequestException('Alias text is required');
    }

    if (normalizedAlias === input.targetCanonicalNormalized) {
      return;
    }

    await assertAliasValidWithClient(tx, {
      aliasText: alias,
      targetDiagnosisRegistryId: input.diagnosisRegistryId,
      acceptedForMatch: true,
    });

    await tx.diagnosisAlias.upsert({
      where: {
        diagnosisRegistryId_normalizedTerm: {
          diagnosisRegistryId: input.diagnosisRegistryId,
          normalizedTerm: normalizedAlias,
        },
      },
      update: {
        term: alias,
        kind: DiagnosisAliasKind.ACCEPTED,
        acceptedForMatch: true,
        rank: 10,
        active: true,
        source: 'editorial_mimic_resolution',
      },
      create: {
        diagnosisRegistryId: input.diagnosisRegistryId,
        term: alias,
        normalizedTerm: normalizedAlias,
        kind: DiagnosisAliasKind.ACCEPTED,
        acceptedForMatch: true,
        rank: 10,
        active: true,
        source: 'editorial_mimic_resolution',
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
    value: Prisma.JsonValue | Prisma.InputJsonValue | null,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    return value === null ? undefined : (value as Prisma.InputJsonValue);
  }

  private mergePayload(
    current: Prisma.JsonValue | null,
    next: Prisma.InputJsonObject,
  ): Prisma.InputJsonObject {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return next;
    }

    return {
      ...(current as Prisma.InputJsonObject),
      ...next,
    };
  }

  private getResolutionSuggestions(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const resolution = (value as Record<string, unknown>).registryResolution;
    if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution)) {
      return null;
    }

    const suggestions = (resolution as Record<string, unknown>).suggestions;
    return Array.isArray(suggestions) ? suggestions : null;
  }
}
