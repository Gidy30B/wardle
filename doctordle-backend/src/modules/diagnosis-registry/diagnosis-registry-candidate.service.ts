import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisRegistryCandidateStatus,
  DifferentialResolutionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer';

type CandidateSourceType =
  | 'case'
  | 'case_revision'
  | 'education'
  | 'education_revision';

type CreateRegistryCandidateInput = {
  mappingId: string;
  proposedCanonicalName?: string;
  proposedDisplayLabel?: string;
  proposedAliases?: string[];
};

export type ReviewRegistryCandidateAction =
  | {
      action: 'mark_needs_review';
      note?: string;
    }
  | {
      action: 'reject';
      note?: string;
    }
  | {
      action: 'merge_duplicate_candidate';
      duplicateCandidateId: string;
      note?: string;
    };

type MappingCandidateSource = {
  mappingId: string;
  rawText: string;
  normalizedText: string;
  status: DifferentialResolutionStatus;
  sourceType: CandidateSourceType;
  sourceId: string;
  contextDiagnosisRegistryId: string | null;
};

const PENDING_REGISTRY_CANDIDATE_STATUSES = [
  DiagnosisRegistryCandidateStatus.CANDIDATE,
  DiagnosisRegistryCandidateStatus.NEEDS_REVIEW,
  DiagnosisRegistryCandidateStatus.APPROVED_PENDING_CREATE,
];

const UNRESOLVED_DIFFERENTIAL_STATUSES = [
  DifferentialResolutionStatus.UNRESOLVED,
  DifferentialResolutionStatus.AMBIGUOUS,
];

@Injectable()
export class DiagnosisRegistryCandidateService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromDifferentialMapping(input: CreateRegistryCandidateInput) {
    const source = await this.getMappingCandidateSource(input.mappingId);

    if (
      source.status !== DifferentialResolutionStatus.UNRESOLVED &&
      source.status !== DifferentialResolutionStatus.AMBIGUOUS
    ) {
      throw new BadRequestException(
        'Only unresolved or ambiguous differential mappings can create registry candidates',
      );
    }

    const proposedCanonicalName =
      this.compact(input.proposedCanonicalName) ?? source.rawText;
    const proposedCanonicalNormalized = normalizeDiagnosisTerm(
      proposedCanonicalName,
    );
    if (!proposedCanonicalNormalized) {
      throw new BadRequestException('Proposed canonical name is required');
    }
    const proposedDisplayLabel =
      this.compact(input.proposedDisplayLabel) ?? proposedCanonicalName;
    const proposedAliases = this.normalizeAliases(input.proposedAliases);
    const duplicateSuggestions = await this.scanDuplicates(
      proposedCanonicalNormalized,
    );

    const existing = await this.prisma.diagnosisRegistryCandidate.findFirst({
      where: {
        sourceMappingId: source.mappingId,
        proposedCanonicalNormalized,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'A registry candidate already exists for this differential mapping',
      );
    }

    return this.prisma.diagnosisRegistryCandidate.create({
      data: {
        proposedCanonicalName,
        proposedCanonicalNormalized,
        proposedDisplayLabel,
        proposedAliases: proposedAliases as Prisma.InputJsonValue,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceMappingId: source.mappingId,
        sourceRawText: source.rawText,
        contextDiagnosisRegistryId: source.contextDiagnosisRegistryId,
        duplicateSuggestions: duplicateSuggestions as Prisma.InputJsonValue,
        status: DiagnosisRegistryCandidateStatus.CANDIDATE,
      },
      include: this.candidateInclude(),
    });
  }

  async listCandidates(
    input: {
      status?: DiagnosisRegistryCandidateStatus;
      limit?: number;
    } = {},
  ) {
    const requestedLimit =
      typeof input.limit === 'number' && Number.isFinite(input.limit)
        ? input.limit
        : 200;

    return this.prisma.diagnosisRegistryCandidate.findMany({
      where: {
        status: input.status,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.max(1, Math.min(requestedLimit, 500)),
      include: this.candidateInclude(),
    });
  }

  async getQueueSummary() {
    const [
      registryCandidateCount,
      pendingRegistryCandidateCount,
      unresolvedCaseDifferentialCount,
      unresolvedEducationDifferentialCount,
    ] = await Promise.all([
      this.prisma.diagnosisRegistryCandidate.count(),
      this.prisma.diagnosisRegistryCandidate.count({
        where: { status: { in: PENDING_REGISTRY_CANDIDATE_STATUSES } },
      }),
      this.prisma.caseDifferentialMapping.count({
        where: { status: { in: UNRESOLVED_DIFFERENTIAL_STATUSES } },
      }),
      this.prisma.educationDifferentialMapping.count({
        where: { status: { in: UNRESOLVED_DIFFERENTIAL_STATUSES } },
      }),
    ]);

    return {
      registryCandidateCount,
      unresolvedDifferentialCount:
        unresolvedCaseDifferentialCount + unresolvedEducationDifferentialCount,
      pendingRegistryCandidateCount,
    };
  }

  async reviewCandidate(
    candidateId: string,
    reviewerUserId: string,
    payload: ReviewRegistryCandidateAction,
  ) {
    const candidate = await this.prisma.diagnosisRegistryCandidate.findUnique({
      where: { id: candidateId },
      select: { id: true },
    });

    if (!candidate) {
      throw new NotFoundException('Registry candidate not found');
    }

    if (payload.action === 'merge_duplicate_candidate') {
      if (
        !payload.duplicateCandidateId ||
        payload.duplicateCandidateId === candidateId
      ) {
        throw new BadRequestException(
          'A different duplicate candidate is required',
        );
      }
      const duplicate = await this.prisma.diagnosisRegistryCandidate.findUnique(
        {
          where: { id: payload.duplicateCandidateId },
          select: { id: true, proposedDisplayLabel: true },
        },
      );
      if (!duplicate) {
        throw new NotFoundException('Duplicate registry candidate not found');
      }

      return this.prisma.diagnosisRegistryCandidate.update({
        where: { id: candidateId },
        data: {
          status: DiagnosisRegistryCandidateStatus.MERGED,
          reviewerUserId,
          reviewedAt: new Date(),
          reviewNote:
            this.compact(payload.note) ??
            `Merged into duplicate candidate ${duplicate.id}`,
        },
        include: this.candidateInclude(),
      });
    }

    return this.prisma.diagnosisRegistryCandidate.update({
      where: { id: candidateId },
      data: {
        status:
          payload.action === 'reject'
            ? DiagnosisRegistryCandidateStatus.REJECTED
            : DiagnosisRegistryCandidateStatus.NEEDS_REVIEW,
        reviewerUserId,
        reviewedAt: new Date(),
        reviewNote: this.compact(payload.note),
      },
      include: this.candidateInclude(),
    });
  }

  private async getMappingCandidateSource(
    mappingId: string,
  ): Promise<MappingCandidateSource> {
    const caseMapping = await this.prisma.caseDifferentialMapping.findUnique({
      where: { id: mappingId },
      select: {
        id: true,
        rawText: true,
        normalizedText: true,
        status: true,
        caseId: true,
        revisionId: true,
        case: {
          select: {
            diagnosisRegistryId: true,
          },
        },
      },
    });

    if (caseMapping) {
      return {
        mappingId: caseMapping.id,
        rawText: caseMapping.rawText,
        normalizedText: caseMapping.normalizedText,
        status: caseMapping.status,
        sourceType: caseMapping.revisionId ? 'case_revision' : 'case',
        sourceId: caseMapping.revisionId ?? caseMapping.caseId,
        contextDiagnosisRegistryId: caseMapping.case.diagnosisRegistryId,
      };
    }

    const educationMapping =
      await this.prisma.educationDifferentialMapping.findUnique({
        where: { id: mappingId },
        select: {
          id: true,
          rawText: true,
          normalizedText: true,
          status: true,
          educationId: true,
          revisionId: true,
          diagnosisRegistryId: true,
        },
      });

    if (educationMapping) {
      return {
        mappingId: educationMapping.id,
        rawText: educationMapping.rawText,
        normalizedText: educationMapping.normalizedText,
        status: educationMapping.status,
        sourceType: educationMapping.revisionId
          ? 'education_revision'
          : 'education',
        sourceId: educationMapping.revisionId ?? educationMapping.educationId,
        contextDiagnosisRegistryId: educationMapping.diagnosisRegistryId,
      };
    }

    throw new NotFoundException('Differential mapping not found');
  }

  private async scanDuplicates(proposedCanonicalNormalized: string) {
    const [registryRows, aliasRows, candidateRows] = await Promise.all([
      this.prisma.diagnosisRegistry.findMany({
        where: { canonicalNormalized: proposedCanonicalNormalized },
        take: 10,
        select: {
          id: true,
          canonicalName: true,
          displayLabel: true,
          status: true,
        },
      }),
      this.prisma.diagnosisAlias.findMany({
        where: { normalizedTerm: proposedCanonicalNormalized },
        take: 10,
        select: {
          id: true,
          term: true,
          kind: true,
          diagnosis: {
            select: {
              id: true,
              canonicalName: true,
              displayLabel: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.diagnosisRegistryCandidate.findMany({
        where: { proposedCanonicalNormalized },
        take: 10,
        select: {
          id: true,
          proposedCanonicalName: true,
          proposedDisplayLabel: true,
          status: true,
        },
      }),
    ]);

    return {
      registryCanonicalMatches: registryRows,
      registryAliasMatches: aliasRows.map((row) => ({
        aliasId: row.id,
        aliasTerm: row.term,
        aliasKind: row.kind,
        registry: row.diagnosis,
      })),
      candidateMatches: candidateRows,
    };
  }

  private candidateInclude() {
    return {
      contextDiagnosisRegistry: {
        select: { id: true, displayLabel: true, canonicalName: true },
      },
      reviewerUser: {
        select: { id: true, email: true, username: true },
      },
      createdRegistry: {
        select: { id: true, displayLabel: true, canonicalName: true },
      },
    } satisfies Prisma.DiagnosisRegistryCandidateInclude;
  }

  private normalizeAliases(values: string[] | undefined): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    const seen = new Set<string>();
    const aliases: string[] = [];
    for (const value of values) {
      const compacted = this.compact(value);
      if (!compacted) continue;
      const normalized = normalizeDiagnosisTerm(compacted);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      aliases.push(compacted);
    }
    return aliases;
  }

  private compact(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const compacted = value.trim().replace(/\s+/g, ' ');
    return compacted || null;
  }
}
