import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DiagnosisAliasKind,
  DifferentialResolutionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { normalizeDiagnosisTerm } from '../diagnosis-registry/diagnosis-term-normalizer';
import { assertAliasValidWithClient } from '../diagnosis-registry/alias-validation.service';
import {
  DifferentialRegistryResolutionService,
  type DifferentialRegistryResolutionResult,
} from './differential-registry-resolution.service';
import { DifferentialLinkService } from './differential-link.service';

type MappingSourceType = 'case' | 'case_revision' | 'education' | 'education_revision';

type ExtractedDifferential = {
  rawText: string;
  sourcePath: string;
};

type MappingCounters = {
  totalExtracted: number;
  resolved: number;
  ambiguous: number;
  unresolved: number;
  rejected: number;
  skipped: number;
  errors: number;
};

export type DifferentialMappingBackfillResult = {
  cases: MappingCounters;
  caseRevisions: MappingCounters;
  education: MappingCounters;
  educationRevisions: MappingCounters;
};

export type DifferentialMappingListFilters = {
  sourceType?: 'case' | 'education';
  diagnosisRegistryId?: string;
  status?: DifferentialResolutionStatus;
};

export type ResolveDifferentialMappingAction =
  | {
      action: 'link_existing';
      targetDiagnosisRegistryId?: string;
      reason?: string;
    }
  | {
      action: 'add_alias_to_existing';
      targetDiagnosisRegistryId?: string;
      aliasText?: string;
      reason?: string;
    }
  | {
      action: 'reject';
      reason?: string;
    };

const EMPTY_COUNTERS: MappingCounters = {
  totalExtracted: 0,
  resolved: 0,
  ambiguous: 0,
  unresolved: 0,
  rejected: 0,
  skipped: 0,
  errors: 0,
};

@Injectable()
export class DifferentialMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly differentialRegistryResolutionService: DifferentialRegistryResolutionService,
    private readonly differentialLinkService?: DifferentialLinkService,
  ) {}

  async mapCase(caseId: string): Promise<MappingCounters> {
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        diagnosisRegistryId: true,
        differentials: true,
      },
    });

    if (!caseRecord) {
      throw new NotFoundException('Case not found');
    }

    return this.mapCaseDifferentials({
      sourceType: 'case',
      caseId: caseRecord.id,
      revisionId: null,
      contextDiagnosisRegistryId: caseRecord.diagnosisRegistryId,
      differentials: caseRecord.differentials,
      sourcePathPrefix: 'case.differentials',
    });
  }

  async mapCaseRevision(revisionId: string): Promise<MappingCounters> {
    const revision = await this.prisma.caseRevision.findUnique({
      where: { id: revisionId },
      select: {
        id: true,
        caseId: true,
        diagnosisRegistryId: true,
        differentials: true,
      },
    });

    if (!revision) {
      throw new NotFoundException('Case revision not found');
    }

    return this.mapCaseDifferentials({
      sourceType: 'case_revision',
      caseId: revision.caseId,
      revisionId: revision.id,
      contextDiagnosisRegistryId: revision.diagnosisRegistryId,
      differentials: revision.differentials,
      sourcePathPrefix: 'caseRevision.differentials',
    });
  }

  async mapEducation(educationId: string): Promise<MappingCounters> {
    const education = await this.prisma.diagnosisEducation.findUnique({
      where: { id: educationId },
      select: {
        id: true,
        diagnosisRegistryId: true,
        differentials: true,
      },
    });

    if (!education) {
      throw new NotFoundException('Diagnosis education not found');
    }

    return this.mapEducationDifferentials({
      sourceType: 'education',
      educationId: education.id,
      revisionId: null,
      diagnosisRegistryId: education.diagnosisRegistryId,
      differentials: education.differentials,
      sourcePathPrefix: 'education.differentials',
    });
  }

  async mapEducationRevision(revisionId: string): Promise<MappingCounters> {
    const revision = await this.prisma.diagnosisEducationRevision.findUnique({
      where: { id: revisionId },
      select: {
        id: true,
        educationId: true,
        snapshot: true,
        education: {
          select: {
            diagnosisRegistryId: true,
          },
        },
      },
    });

    if (!revision) {
      throw new NotFoundException('Diagnosis education revision not found');
    }

    const snapshot = this.asRecord(revision.snapshot);
    const differentials =
      snapshot?.differentials ?? snapshot?.differentialDistinguishers ?? null;

    return this.mapEducationDifferentials({
      sourceType: 'education_revision',
      educationId: revision.educationId,
      revisionId: revision.id,
      diagnosisRegistryId: revision.education.diagnosisRegistryId,
      differentials,
      sourcePathPrefix: 'educationRevision.snapshot.differentials',
    });
  }

  async backfill(input: {
    includeEducationRevisions?: boolean;
  } = {}): Promise<DifferentialMappingBackfillResult> {
    const result: DifferentialMappingBackfillResult = {
      cases: this.counters(),
      caseRevisions: this.counters(),
      education: this.counters(),
      educationRevisions: this.counters(),
    };

    for (const row of await this.prisma.case.findMany({ select: { id: true } })) {
      this.addCounters(result.cases, await this.safely(() => this.mapCase(row.id)));
    }

    for (const row of await this.prisma.caseRevision.findMany({
      select: { id: true },
    })) {
      this.addCounters(
        result.caseRevisions,
        await this.safely(() => this.mapCaseRevision(row.id)),
      );
    }

    for (const row of await this.prisma.diagnosisEducation.findMany({
      select: { id: true },
    })) {
      this.addCounters(
        result.education,
        await this.safely(() => this.mapEducation(row.id)),
      );
    }

    if (input.includeEducationRevisions) {
      for (const row of await this.prisma.diagnosisEducationRevision.findMany({
        select: { id: true },
      })) {
        this.addCounters(
          result.educationRevisions,
          await this.safely(() => this.mapEducationRevision(row.id)),
        );
      }
    }

    return result;
  }

  async listUnresolved(filters: DifferentialMappingListFilters = {}) {
    const statuses = filters.status
      ? [filters.status]
      : [
          DifferentialResolutionStatus.AMBIGUOUS,
          DifferentialResolutionStatus.UNRESOLVED,
        ];
    const includeCase = filters.sourceType !== 'education';
    const includeEducation = filters.sourceType !== 'case';
    const rows: Array<Record<string, unknown>> = [];

    if (includeCase) {
      const caseRows = await this.prisma.caseDifferentialMapping.findMany({
        where: {
          status: { in: statuses },
          case: filters.diagnosisRegistryId
            ? { diagnosisRegistryId: filters.diagnosisRegistryId }
            : undefined,
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 100,
        include: {
          case: {
            select: {
              id: true,
              title: true,
              diagnosisRegistryId: true,
              diagnosisRegistry: { select: { id: true, displayLabel: true } },
            },
          },
          revision: { select: { id: true, revisionNumber: true } },
          resolvedDiagnosisRegistry: {
            select: { id: true, displayLabel: true, canonicalName: true },
          },
        },
      });
      rows.push(
        ...caseRows.map((row) => ({
          ...this.serializeMapping(row),
          sourceType: row.revisionId ? 'case_revision' : 'case',
          sourceId: row.revisionId ?? row.caseId,
          contextDiagnosis: row.case.diagnosisRegistry,
          sourceTitle: row.case.title,
          revisionNumber: row.revision?.revisionNumber ?? null,
        })),
      );
    }

    if (includeEducation) {
      const educationRows = await this.prisma.educationDifferentialMapping.findMany({
        where: {
          status: { in: statuses },
          diagnosisRegistryId: filters.diagnosisRegistryId,
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 100,
        include: {
          diagnosisRegistry: { select: { id: true, displayLabel: true } },
          education: { select: { id: true, title: true } },
          revision: { select: { id: true, version: true } },
          resolvedDiagnosisRegistry: {
            select: { id: true, displayLabel: true, canonicalName: true },
          },
        },
      });
      rows.push(
        ...educationRows.map((row) => ({
          ...this.serializeMapping(row),
          sourceType: row.revisionId ? 'education_revision' : 'education',
          sourceId: row.revisionId ?? row.educationId,
          contextDiagnosis: row.diagnosisRegistry,
          sourceTitle: row.education.title,
          revisionNumber: row.revision?.version ?? null,
        })),
      );
    }

    return rows.sort((left, right) =>
      String(right.updatedAt).localeCompare(String(left.updatedAt)),
    );
  }

  async resolveMapping(
    mappingId: string,
    userId: string,
    payload: ResolveDifferentialMappingAction,
  ) {
    const caseMapping = await this.prisma.caseDifferentialMapping.findUnique({
      where: { id: mappingId },
    });

    if (caseMapping) {
      return this.resolveCaseMapping(caseMapping.id, userId, payload);
    }

    const educationMapping =
      await this.prisma.educationDifferentialMapping.findUnique({
        where: { id: mappingId },
      });

    if (educationMapping) {
      return this.resolveEducationMapping(educationMapping.id, userId, payload);
    }

    throw new NotFoundException('Differential mapping not found');
  }

  private async resolveCaseMapping(
    id: string,
    userId: string,
    payload: ResolveDifferentialMappingAction,
  ) {
    const data = await this.resolutionUpdateData(payload, userId);
    const mapping = await this.prisma.caseDifferentialMapping.update({
      where: { id },
      data,
    });
    await this.differentialLinkService?.syncCaseMappingRow(mapping);
    return mapping;
  }

  private async resolveEducationMapping(
    id: string,
    userId: string,
    payload: ResolveDifferentialMappingAction,
  ) {
    const data = await this.resolutionUpdateData(payload, userId);
    const mapping = await this.prisma.educationDifferentialMapping.update({
      where: { id },
      data,
    });
    await this.differentialLinkService?.syncEducationMappingRow(mapping);
    return mapping;
  }

  private async resolutionUpdateData(
    payload: ResolveDifferentialMappingAction,
    userId: string,
  ): Promise<{
    status: DifferentialResolutionStatus;
    resolvedDiagnosisRegistryId?: string | null;
    reviewedByUserId: string;
    reviewedAt: Date;
    reviewNote?: string | null;
  }> {
    if (payload.action === 'reject') {
      return {
        status: DifferentialResolutionStatus.REJECTED,
        resolvedDiagnosisRegistryId: null,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewNote: payload.reason ?? null,
      };
    }

    if (!payload.targetDiagnosisRegistryId) {
      throw new NotFoundException('Target diagnosis registry is required');
    }

    const target = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: payload.targetDiagnosisRegistryId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Target diagnosis registry not found');
    }

    if (payload.action === 'add_alias_to_existing') {
      const aliasText = this.compact(payload.aliasText);
      if (!aliasText) {
        throw new NotFoundException('Alias text is required');
      }
      const normalizedAlias = normalizeDiagnosisTerm(aliasText);
      await assertAliasValidWithClient(this.prisma, {
        aliasText,
        targetDiagnosisRegistryId: target.id,
        acceptedForMatch: true,
      });
      await this.prisma.diagnosisAlias.upsert({
        where: {
          diagnosisRegistryId_normalizedTerm: {
            diagnosisRegistryId: target.id,
            normalizedTerm: normalizedAlias,
          },
        },
        update: {
          term: aliasText,
          active: true,
          acceptedForMatch: true,
          kind: DiagnosisAliasKind.ACCEPTED,
          source: 'differential_mapping_review',
        },
        create: {
          diagnosisRegistryId: target.id,
          term: aliasText,
          normalizedTerm: normalizedAlias,
          kind: DiagnosisAliasKind.ACCEPTED,
          acceptedForMatch: true,
          active: true,
          source: 'differential_mapping_review',
        },
      });
    }

    return {
      status: DifferentialResolutionStatus.RESOLVED,
      resolvedDiagnosisRegistryId: target.id,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      reviewNote: payload.reason ?? null,
    };
  }

  private async mapCaseDifferentials(input: {
    sourceType: MappingSourceType;
    caseId: string;
    revisionId: string | null;
    contextDiagnosisRegistryId: string | null;
    differentials: unknown;
    sourcePathPrefix: string;
  }): Promise<MappingCounters> {
    const counters = this.counters();
    const items = this.extractDifferentials(input.differentials, input.sourcePathPrefix);
    counters.totalExtracted = items.length;

    for (const item of items) {
      const resolution = await this.differentialRegistryResolutionService.resolve({
        rawText: item.rawText,
        contextDiagnosisRegistryId: input.contextDiagnosisRegistryId,
      });
      const persisted = await this.upsertCaseMapping(input, item, resolution);
      this.countStatus(counters, persisted);
    }

    return counters;
  }

  private async mapEducationDifferentials(input: {
    sourceType: MappingSourceType;
    educationId: string;
    revisionId: string | null;
    diagnosisRegistryId: string;
    differentials: unknown;
    sourcePathPrefix: string;
  }): Promise<MappingCounters> {
    const counters = this.counters();
    const items = this.extractDifferentials(input.differentials, input.sourcePathPrefix);
    counters.totalExtracted = items.length;

    for (const item of items) {
      const resolution = await this.differentialRegistryResolutionService.resolve({
        rawText: item.rawText,
        contextDiagnosisRegistryId: input.diagnosisRegistryId,
      });
      const persisted = await this.upsertEducationMapping(input, item, resolution);
      this.countStatus(counters, persisted);
    }

    return counters;
  }

  private async upsertCaseMapping(
    source: {
      sourceType: MappingSourceType;
      caseId: string;
      revisionId: string | null;
    },
    item: ExtractedDifferential,
    resolution: DifferentialRegistryResolutionResult,
  ): Promise<DifferentialResolutionStatus | 'skipped'> {
    const dedupeKey = this.dedupeKey({
      sourceType: source.sourceType,
      ownerId: source.caseId,
      revisionId: source.revisionId,
      sourcePath: item.sourcePath,
      normalizedText: resolution.normalizedText,
    });
    const existing = await this.prisma.caseDifferentialMapping.findUnique({
      where: { dedupeKey },
      select: { status: true },
    });
    if (existing?.status === DifferentialResolutionStatus.REJECTED) {
      return DifferentialResolutionStatus.REJECTED;
    }
    if (!resolution.normalizedText) {
      return 'skipped';
    }

    const data = this.mappingData(item, resolution);
    const saved = await this.prisma.caseDifferentialMapping.upsert({
      where: { dedupeKey },
      update: data,
      create: {
        ...data,
        dedupeKey,
        caseId: source.caseId,
        revisionId: source.revisionId,
      },
    });
    await this.differentialLinkService?.syncCaseMappingRow(saved);
    return saved.status;
  }

  private async upsertEducationMapping(
    source: {
      sourceType: MappingSourceType;
      educationId: string;
      revisionId: string | null;
      diagnosisRegistryId: string;
    },
    item: ExtractedDifferential,
    resolution: DifferentialRegistryResolutionResult,
  ): Promise<DifferentialResolutionStatus | 'skipped'> {
    const dedupeKey = this.dedupeKey({
      sourceType: source.sourceType,
      ownerId: source.educationId,
      revisionId: source.revisionId,
      sourcePath: item.sourcePath,
      normalizedText: resolution.normalizedText,
    });
    const existing = await this.prisma.educationDifferentialMapping.findUnique({
      where: { dedupeKey },
      select: { status: true },
    });
    if (existing?.status === DifferentialResolutionStatus.REJECTED) {
      return DifferentialResolutionStatus.REJECTED;
    }
    if (!resolution.normalizedText) {
      return 'skipped';
    }

    const data = this.mappingData(item, resolution);
    const saved = await this.prisma.educationDifferentialMapping.upsert({
      where: { dedupeKey },
      update: data,
      create: {
        ...data,
        dedupeKey,
        educationId: source.educationId,
        revisionId: source.revisionId,
        diagnosisRegistryId: source.diagnosisRegistryId,
      },
    });
    await this.differentialLinkService?.syncEducationMappingRow(saved);
    return saved.status;
  }

  private mappingData(
    item: ExtractedDifferential,
    resolution: DifferentialRegistryResolutionResult,
  ) {
    return {
      rawText: resolution.rawText,
      normalizedText: resolution.normalizedText,
      resolvedDiagnosisRegistryId: resolution.resolvedRegistryId ?? null,
      status: this.toResolutionStatus(resolution.status),
      matchType: resolution.matchType ?? null,
      confidence: resolution.confidence,
      suggestions: resolution.suggestions as unknown as Prisma.InputJsonValue,
      sourcePath: item.sourcePath,
    };
  }

  private extractDifferentials(
    value: unknown,
    sourcePathPrefix: string,
  ): ExtractedDifferential[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item, index) => {
        const rawText =
          typeof item === 'string'
            ? item
            : this.firstString(this.asRecord(item), [
                'diagnosis',
                'dx',
                'title',
                'name',
                'differential',
                'label',
              ]);
        const compacted = this.compact(rawText);
        if (!compacted) {
          return null;
        }
        return {
          rawText: compacted,
          sourcePath: `${sourcePathPrefix}[${index}]`,
        };
      })
      .filter((item): item is ExtractedDifferential => Boolean(item));
  }

  private serializeMapping(row: {
    id: string;
    rawText: string;
    normalizedText: string;
    resolvedDiagnosisRegistryId: string | null;
    status: DifferentialResolutionStatus;
    matchType: string | null;
    confidence: number | null;
    suggestions: Prisma.JsonValue | null;
    sourcePath: string | null;
    reviewedByUserId: string | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedDiagnosisRegistry?: unknown;
  }) {
    return {
      id: row.id,
      rawText: row.rawText,
      normalizedText: row.normalizedText,
      resolvedDiagnosisRegistryId: row.resolvedDiagnosisRegistryId,
      status: row.status,
      matchType: row.matchType,
      confidence: row.confidence,
      suggestions: row.suggestions,
      sourcePath: row.sourcePath,
      reviewedByUserId: row.reviewedByUserId,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewNote: row.reviewNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedDiagnosisRegistry: row.resolvedDiagnosisRegistry ?? null,
    };
  }

  private toResolutionStatus(
    status: DifferentialRegistryResolutionResult['status'],
  ): DifferentialResolutionStatus {
    if (status === 'resolved') return DifferentialResolutionStatus.RESOLVED;
    if (status === 'ambiguous') return DifferentialResolutionStatus.AMBIGUOUS;
    return DifferentialResolutionStatus.UNRESOLVED;
  }

  private countStatus(
    counters: MappingCounters,
    status: DifferentialResolutionStatus | 'skipped',
  ) {
    if (status === 'skipped') counters.skipped += 1;
    else if (status === DifferentialResolutionStatus.RESOLVED) counters.resolved += 1;
    else if (status === DifferentialResolutionStatus.AMBIGUOUS) counters.ambiguous += 1;
    else if (status === DifferentialResolutionStatus.UNRESOLVED) counters.unresolved += 1;
    else if (status === DifferentialResolutionStatus.REJECTED) counters.rejected += 1;
  }

  private counters(): MappingCounters {
    return { ...EMPTY_COUNTERS };
  }

  private addCounters(target: MappingCounters, source: MappingCounters) {
    target.totalExtracted += source.totalExtracted;
    target.resolved += source.resolved;
    target.ambiguous += source.ambiguous;
    target.unresolved += source.unresolved;
    target.rejected += source.rejected;
    target.skipped += source.skipped;
    target.errors += source.errors;
  }

  private async safely(run: () => Promise<MappingCounters>) {
    try {
      return await run();
    } catch {
      return { ...EMPTY_COUNTERS, errors: 1 };
    }
  }

  private dedupeKey(input: {
    sourceType: MappingSourceType;
    ownerId: string;
    revisionId: string | null;
    sourcePath: string;
    normalizedText: string;
  }) {
    return [
      input.sourceType,
      input.ownerId,
      input.revisionId ?? 'current',
      input.sourcePath,
      input.normalizedText,
    ].join(':');
  }

  private firstString(
    record: Record<string, unknown> | null,
    keys: string[],
  ): string | null {
    if (!record) return null;
    for (const key of keys) {
      if (typeof record[key] === 'string') {
        return record[key] as string;
      }
    }
    return null;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private compact(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const compacted = value.trim().replace(/\s+/g, ' ');
    return compacted || null;
  }
}
