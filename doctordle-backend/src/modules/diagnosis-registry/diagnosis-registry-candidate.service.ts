import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisAliasKind,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisRegistryCandidateStatus,
  DiagnosisRegistryStatus,
  DifferentialResolutionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { DifferentialLinkService } from '../diagnosis-graph/differential-link.service';
import { assertAliasValidWithClient } from './alias-validation.service';
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

type AliasCreationResult = {
  term: string;
  normalizedTerm: string;
  aliasId: string;
};

type RejectedAliasResult = {
  term: string;
  reason: string;
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

const REGISTRY_CREATION_ALLOWED_STATUSES: DiagnosisRegistryCandidateStatus[] = [
  DiagnosisRegistryCandidateStatus.CANDIDATE,
  DiagnosisRegistryCandidateStatus.NEEDS_REVIEW,
  DiagnosisRegistryCandidateStatus.APPROVED_PENDING_CREATE,
];

@Injectable()
export class DiagnosisRegistryCandidateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly differentialLinkService?: DifferentialLinkService,
  ) {}

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

  async getCandidate(candidateId: string) {
    const candidate = await this.prisma.diagnosisRegistryCandidate.findUnique({
      where: { id: candidateId },
      include: this.candidateInclude(),
    });

    if (!candidate) {
      throw new NotFoundException('Registry candidate not found');
    }

    return {
      ...candidate,
      sourceMapping: await this.getCandidateSourceMapping(
        candidate.sourceMappingId,
      ),
    };
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
          mergeTargetCandidateId: duplicate.id,
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

  async createRegistryFromCandidate(
    candidateId: string,
    approvedByUserId: string,
  ) {
    const createdAliases: AliasCreationResult[] = [];
    const rejectedAliases: RejectedAliasResult[] = [];
    let mappingsResolvedCount = 0;
    let structuredLinksUpdatedCount = 0;

    const result = await this.prisma.$transaction(
      async (tx) => {
        const candidate = await tx.diagnosisRegistryCandidate.findUnique({
          where: { id: candidateId },
        });

        if (!candidate) {
          throw new NotFoundException('Registry candidate not found');
        }

        if (candidate.createdRegistryId) {
          throw new ConflictException(
            'A registry entry has already been created from this candidate',
          );
        }

        if (!REGISTRY_CREATION_ALLOWED_STATUSES.includes(candidate.status)) {
          throw new BadRequestException(
            `Cannot create a registry entry from candidate status ${candidate.status}`,
          );
        }

        const canonicalName = this.compact(candidate.proposedCanonicalName);
        const displayLabel = this.compact(candidate.proposedDisplayLabel);
        const canonicalNormalized = normalizeDiagnosisTerm(canonicalName ?? '');
        if (!canonicalName || !displayLabel || !canonicalNormalized) {
          throw new BadRequestException(
            'Candidate canonical name and display label are required',
          );
        }

        const duplicateSuggestions = await this.scanDuplicatesWithClient(
          tx,
          canonicalNormalized,
          candidate.id,
        );
        if (duplicateSuggestions.registryCanonicalMatches.length) {
          throw new ConflictException(
            'Canonical diagnosis already exists in the registry',
          );
        }
        if (duplicateSuggestions.registryAliasMatches.length) {
          throw new ConflictException(
            'Proposed canonical diagnosis collides with an existing active alias',
          );
        }

        const registry = await tx.diagnosisRegistry.create({
          data: {
            canonicalName,
            canonicalNormalized,
            displayLabel,
            status: DiagnosisRegistryStatus.DRAFT,
            active: false,
            onboardingStatus: DiagnosisEditorialOnboardingStatus.NEW,
            onboardingStartedAt: new Date(),
            isPlayable: false,
            isGeneratable: false,
            notes: `Created from registry candidate ${candidate.id}. Source text: ${candidate.sourceRawText}`,
          },
          select: {
            id: true,
            canonicalName: true,
            canonicalNormalized: true,
            displayLabel: true,
            status: true,
            active: true,
            onboardingStatus: true,
            onboardingStartedAt: true,
            isPlayable: true,
            isGeneratable: true,
          },
        });

        for (const aliasText of this.getCandidateAliases(
          candidate.proposedAliases,
        )) {
          const normalizedAlias = normalizeDiagnosisTerm(aliasText);
          try {
            if (normalizedAlias === canonicalNormalized) {
              rejectedAliases.push({
                term: aliasText,
                reason: 'Alias duplicates the candidate canonical name',
              });
              continue;
            }

            await assertAliasValidWithClient(tx, {
              aliasText,
              targetDiagnosisRegistryId: registry.id,
              acceptedForMatch: true,
            });

            const alias = await tx.diagnosisAlias.upsert({
              where: {
                diagnosisRegistryId_normalizedTerm: {
                  diagnosisRegistryId: registry.id,
                  normalizedTerm: normalizedAlias,
                },
              },
              update: {
                term: aliasText,
                kind: DiagnosisAliasKind.ACCEPTED,
                acceptedForMatch: true,
                active: true,
                source: 'registry_candidate_creation',
              },
              create: {
                diagnosisRegistryId: registry.id,
                term: aliasText,
                normalizedTerm: normalizedAlias,
                kind: DiagnosisAliasKind.ACCEPTED,
                acceptedForMatch: true,
                active: true,
                rank: 10,
                source: 'registry_candidate_creation',
              },
              select: { id: true, term: true, normalizedTerm: true },
            });

            createdAliases.push({
              aliasId: alias.id,
              term: alias.term,
              normalizedTerm: alias.normalizedTerm,
            });
          } catch (error) {
            rejectedAliases.push({
              term: aliasText,
              reason: error instanceof Error ? error.message : 'Alias rejected',
            });
          }
        }

        const resolvedMapping = await this.resolveSourceMapping(tx, {
          candidate,
          registryId: registry.id,
          approvedByUserId,
        });
        mappingsResolvedCount = resolvedMapping ? 1 : 0;

        const creationSnapshot = {
          registry,
          aliases: {
            created: createdAliases,
            rejected: rejectedAliases,
          },
          sourceMappingResolved: Boolean(resolvedMapping),
          createdAt: new Date().toISOString(),
        };

        const finalizedCandidate = await tx.diagnosisRegistryCandidate.update({
          where: { id: candidate.id },
          data: {
            status: DiagnosisRegistryCandidateStatus.CREATED,
            createdRegistryId: registry.id,
            approvedByUserId,
            approvedAt: new Date(),
            reviewerUserId: approvedByUserId,
            reviewedAt: new Date(),
            duplicateSuggestions:
              duplicateSuggestions as unknown as Prisma.InputJsonValue,
            creationSnapshot: creationSnapshot as Prisma.InputJsonValue,
          },
          include: this.candidateInclude(),
        });

        return {
          candidate: finalizedCandidate,
          sourceMappingId: candidate.sourceMappingId,
          registry,
          createdAliases,
          rejectedAliases,
          mappingsResolvedCount,
          structuredLinksUpdatedCount,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.sourceMappingId) {
      const synced = await this.syncSourceMappingLink({
        sourceMappingId: result.sourceMappingId,
      });
      structuredLinksUpdatedCount = synced ? 1 : 0;
    }

    return {
      ...result,
      structuredLinksUpdatedCount,
    };
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
    return this.scanDuplicatesWithClient(
      this.prisma,
      proposedCanonicalNormalized,
    );
  }

  private async scanDuplicatesWithClient(
    client: PrismaService | Prisma.TransactionClient,
    proposedCanonicalNormalized: string,
    ignoreCandidateId?: string,
  ) {
    const [registryRows, aliasRows, candidateRows] = await Promise.all([
      client.diagnosisRegistry.findMany({
        where: { canonicalNormalized: proposedCanonicalNormalized },
        take: 10,
        select: {
          id: true,
          canonicalName: true,
          displayLabel: true,
          status: true,
        },
      }),
      client.diagnosisAlias.findMany({
        where: {
          normalizedTerm: proposedCanonicalNormalized,
          active: true,
        },
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
      client.diagnosisRegistryCandidate.findMany({
        where: {
          proposedCanonicalNormalized,
          ...(ignoreCandidateId ? { id: { not: ignoreCandidateId } } : {}),
        },
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
      approvedByUser: {
        select: { id: true, email: true, username: true },
      },
      mergeTargetCandidate: {
        select: {
          id: true,
          proposedDisplayLabel: true,
          status: true,
        },
      },
    } satisfies Prisma.DiagnosisRegistryCandidateInclude;
  }

  private getCandidateAliases(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];
    return this.normalizeAliases(
      value.filter((item): item is string => typeof item === 'string'),
    );
  }

  private async getCandidateSourceMapping(sourceMappingId: string | null) {
    if (!sourceMappingId) {
      return null;
    }

    const caseMapping = await this.prisma.caseDifferentialMapping.findUnique({
      where: { id: sourceMappingId },
      select: {
        id: true,
        rawText: true,
        normalizedText: true,
        status: true,
        resolvedDiagnosisRegistryId: true,
        sourcePath: true,
        caseId: true,
        revisionId: true,
      },
    });
    if (caseMapping) {
      return { sourceType: 'case' as const, ...caseMapping };
    }

    const educationMapping =
      await this.prisma.educationDifferentialMapping.findUnique({
        where: { id: sourceMappingId },
        select: {
          id: true,
          rawText: true,
          normalizedText: true,
          status: true,
          resolvedDiagnosisRegistryId: true,
          sourcePath: true,
          educationId: true,
          revisionId: true,
          diagnosisRegistryId: true,
        },
      });
    if (educationMapping) {
      return { sourceType: 'education' as const, ...educationMapping };
    }

    return null;
  }

  private async resolveSourceMapping(
    tx: Prisma.TransactionClient,
    input: {
      candidate: {
        sourceMappingId: string | null;
      };
      registryId: string;
      approvedByUserId: string;
    },
  ) {
    if (!input.candidate.sourceMappingId) {
      return null;
    }

    const updateData = {
      status: DifferentialResolutionStatus.RESOLVED,
      resolvedDiagnosisRegistryId: input.registryId,
      reviewedByUserId: input.approvedByUserId,
      reviewedAt: new Date(),
      reviewNote: 'Resolved by registry candidate creation',
    };

    const caseMapping = await tx.caseDifferentialMapping.findUnique({
      where: { id: input.candidate.sourceMappingId },
      select: { id: true },
    });
    if (caseMapping) {
      return tx.caseDifferentialMapping.update({
        where: { id: caseMapping.id },
        data: updateData,
      });
    }

    const educationMapping = await tx.educationDifferentialMapping.findUnique({
      where: { id: input.candidate.sourceMappingId },
      select: { id: true },
    });
    if (educationMapping) {
      return tx.educationDifferentialMapping.update({
        where: { id: educationMapping.id },
        data: updateData,
      });
    }

    return null;
  }

  private async syncSourceMappingLink(candidate: {
    sourceMappingId: string | null;
  }) {
    if (!candidate.sourceMappingId || !this.differentialLinkService) {
      return false;
    }

    const caseMapping = await this.prisma.caseDifferentialMapping.findUnique({
      where: { id: candidate.sourceMappingId },
    });
    if (caseMapping) {
      await this.differentialLinkService.syncCaseMappingRow(caseMapping);
      return true;
    }

    const educationMapping =
      await this.prisma.educationDifferentialMapping.findUnique({
        where: { id: candidate.sourceMappingId },
      });
    if (educationMapping) {
      await this.differentialLinkService.syncEducationMappingRow(
        educationMapping,
      );
      return true;
    }

    return false;
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
