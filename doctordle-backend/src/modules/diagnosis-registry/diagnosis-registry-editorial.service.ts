import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisAliasKind,
  DiagnosisMappingMethod,
  DiagnosisRegistryStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import { importDiagnosisRegistryRecords } from './diagnosis-registry-import.service.js';
import { DiagnosisRegistryLinkService } from './diagnosis-registry-link.service.js';
import {
  isDiagnosisRegistryUsableStatus,
} from './diagnosis-registry-status.js';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer.js';

type DiagnosisRegistryEditorialClient =
  | PrismaService
  | Prisma.TransactionClient
  | PrismaClient;

type DiagnosisRegistryAliasRow = {
  id: string;
  term: string;
  normalizedTerm: string;
  kind: DiagnosisAliasKind;
  acceptedForMatch: boolean;
  rank: number;
};

type DiagnosisRegistryRow = {
  id: string;
  canonicalName: string;
  canonicalNormalized: string;
  status: DiagnosisRegistryStatus;
  category: string | null;
  specialty: string | null;
  searchPriority: number;
  isDescriptive: boolean;
  isCompositional: boolean;
  notes: string | null;
  legacyDiagnosisId: string | null;
  aliases: DiagnosisRegistryAliasRow[];
};

type RankedRegistrySearchItem = AdminDiagnosisRegistrySearchItem & {
  bucket: number;
};

const REGISTRY_EDITORIAL_SELECT: Prisma.DiagnosisRegistrySelect = {
  id: true,
  canonicalName: true,
  canonicalNormalized: true,
  status: true,
  category: true,
  specialty: true,
  searchPriority: true,
  isDescriptive: true,
  isCompositional: true,
  notes: true,
  legacyDiagnosisId: true,
  aliases: {
    where: {
      active: true,
    },
    orderBy: [{ rank: 'asc' }, { term: 'asc' }],
    select: {
      id: true,
      term: true,
      normalizedTerm: true,
      kind: true,
      acceptedForMatch: true,
      rank: true,
    },
  },
};

export type AdminDiagnosisRegistrySummary = {
  id: string;
  canonicalName: string;
  status: DiagnosisRegistryStatus;
  category: string | null;
  specialty: string | null;
  searchPriority: number;
  isDescriptive: boolean;
  isCompositional: boolean;
  notes: string | null;
  aliasPreview: string[];
};

export type AdminDiagnosisRegistrySearchItem = {
  id: string;
  canonicalName: string;
  status: DiagnosisRegistryStatus;
  category: string | null;
  specialty: string | null;
  searchPriority: number;
  aliasPreview: string[];
  matchSource: 'canonical' | 'accepted_alias' | 'abbreviation' | 'search_only';
};

export type CreateEditorialDiagnosisInput = {
  canonicalName: string;
  aliases?: string[];
  category?: string | null;
  specialty?: string | null;
  isDescriptive?: boolean;
  isCompositional?: boolean;
  notes?: string | null;
  searchPriority?: number;
};

export type CreateEditorialDiagnosisResult = {
  diagnosisId: string;
  diagnosisRegistryId: string;
  mappingMethod: 'MANUAL_CREATED';
  registry: AdminDiagnosisRegistrySummary;
};

export type CreateDiagnosisAliasInput = {
  alias: string;
  kind?: DiagnosisAliasKind;
  acceptedForMatch?: boolean;
};

export type DiagnosisRegistryLinkableResult = {
  diagnosisId: string;
  diagnosisRegistryId: string;
  registry: AdminDiagnosisRegistrySummary;
};

@Injectable()
export class DiagnosisRegistryEditorialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosisRegistryLinkService: DiagnosisRegistryLinkService,
  ) {}

  async search(input: {
    query?: string;
    limit?: number;
    status?: DiagnosisRegistryStatus;
  }): Promise<AdminDiagnosisRegistrySearchItem[]> {
    const query = this.normalizeOptionalString(input.query);
    const normalizedQuery = query ? normalizeDiagnosisTerm(query) : '';
    const limit = Math.max(1, Math.min(25, Math.trunc(input.limit ?? 10)));
    const status = input.status ?? DiagnosisRegistryStatus.ACTIVE;

    const where: Prisma.DiagnosisRegistryWhereInput = {
      status,
      ...(normalizedQuery
        ? {
            OR: [
              {
                canonicalNormalized: {
                  contains: normalizedQuery,
                },
              },
              {
                aliases: {
                  some: {
                    active: true,
                    normalizedTerm: {
                      contains: normalizedQuery,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const rows = (await this.prisma.diagnosisRegistry.findMany({
      where,
      select: REGISTRY_EDITORIAL_SELECT,
      take: normalizedQuery ? Math.max(limit * 5, 25) : limit,
      orderBy: [{ searchPriority: 'desc' }, { canonicalName: 'asc' }],
    })) as DiagnosisRegistryRow[];

    if (!normalizedQuery) {
      return rows.slice(0, limit).map((row) => ({
        id: row.id,
        canonicalName: row.canonicalName,
        status: row.status,
        category: row.category,
        specialty: row.specialty,
        searchPriority: row.searchPriority,
        aliasPreview: this.buildAliasPreview(row.aliases),
        matchSource: 'canonical',
      }));
    }

    return rows
      .map((row) => this.rankSearchResult(row, normalizedQuery))
      .filter((row): row is RankedRegistrySearchItem => row !== null)
      .sort((left, right) => {
        if (left.bucket !== right.bucket) {
          return left.bucket - right.bucket;
        }

        if (left.searchPriority !== right.searchPriority) {
          return right.searchPriority - left.searchPriority;
        }

        return left.canonicalName.localeCompare(right.canonicalName);
      })
      .slice(0, limit)
      .map(({ bucket: _bucket, ...row }) => row);
  }

  async getLinkableDiagnosisRegistry(
    diagnosisRegistryId: string,
    client: DiagnosisRegistryEditorialClient = this.prisma,
  ): Promise<DiagnosisRegistryLinkableResult> {
    const registry = await this.getRegistryById(diagnosisRegistryId, client);

    if (!isDiagnosisRegistryUsableStatus(registry.status)) {
      throw new BadRequestException(
        `Diagnosis registry entry is not linkable for editorial use while status is ${registry.status}`,
      );
    }

    const resolvedLink = await this.diagnosisRegistryLinkService.resolveForWrite(
      {
        diagnosisRegistryId: registry.id,
      },
      client,
    );

    const refreshedRegistry = await this.getRegistryById(
      resolvedLink.diagnosisRegistryId,
      client,
    );

    return {
      diagnosisId: resolvedLink.diagnosisId,
      diagnosisRegistryId: resolvedLink.diagnosisRegistryId,
      registry: this.toRegistrySummary(refreshedRegistry),
    };
  }

  async createDiagnosis(
    input: CreateEditorialDiagnosisInput,
    client: DiagnosisRegistryEditorialClient = this.prisma,
  ): Promise<CreateEditorialDiagnosisResult> {
    const canonicalName = this.requireCanonicalName(input.canonicalName);
    const canonicalNormalized = normalizeDiagnosisTerm(canonicalName);
    const aliases = this.normalizeAliasTerms(input.aliases ?? [], canonicalNormalized);
    const prisma = client as PrismaService;

    await importDiagnosisRegistryRecords(prisma, [
      {
        canonicalName,
        aliases: aliases.map((alias) => ({
          alias,
        })),
        status: DiagnosisRegistryStatus.ACTIVE,
        category: this.normalizeOptionalString(input.category) ?? null,
        specialty: this.normalizeOptionalString(input.specialty) ?? null,
        isDescriptive: input.isDescriptive ?? false,
        isCompositional: input.isCompositional ?? false,
        notes: this.normalizeOptionalString(input.notes) ?? null,
        searchPriority: this.normalizeSearchPriority(input.searchPriority),
      },
    ]);

    const importedRegistry = await prisma.diagnosisRegistry.findUnique({
      where: {
        canonicalNormalized,
      },
      select: REGISTRY_EDITORIAL_SELECT,
    });

    if (!importedRegistry) {
      throw new NotFoundException(
        `Diagnosis registry entry not found after create for "${canonicalName}"`,
      );
    }

    let diagnosisId = importedRegistry.legacyDiagnosisId;
    if (!diagnosisId) {
      const existingDiagnosis = await prisma.diagnosis.findFirst({
        where: {
          name: {
            equals: canonicalName,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
        },
      });

      const diagnosis =
        existingDiagnosis ??
        (await prisma.diagnosis.create({
          data: {
            name: canonicalName,
          },
          select: {
            id: true,
          },
        }));

      diagnosisId = diagnosis.id;
    }

    const resolvedLink = await this.diagnosisRegistryLinkService.resolveForWrite(
      {
        diagnosisId,
        diagnosisRegistryId: importedRegistry.id,
      },
      client,
    );

    const registry = await this.getRegistryById(
      resolvedLink.diagnosisRegistryId,
      client,
    );

    return {
      diagnosisId: resolvedLink.diagnosisId,
      diagnosisRegistryId: resolvedLink.diagnosisRegistryId,
      mappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
      registry: this.toRegistrySummary(registry),
    };
  }

  async addAlias(
    diagnosisRegistryId: string,
    input: CreateDiagnosisAliasInput,
    client: DiagnosisRegistryEditorialClient = this.prisma,
  ): Promise<AdminDiagnosisRegistrySummary> {
    const registry = await this.getRegistryById(diagnosisRegistryId, client);
    const alias = this.normalizeAlias(input.alias);
    const normalizedAlias = normalizeDiagnosisTerm(alias);

    if (normalizedAlias === registry.canonicalNormalized) {
      throw new BadRequestException(
        'Alias duplicates the canonical diagnosis name',
      );
    }

    const kind = input.kind ?? DiagnosisAliasKind.ACCEPTED;
    const acceptedForMatch =
      kind === DiagnosisAliasKind.SEARCH_ONLY
        ? false
        : input.acceptedForMatch ?? true;
    const prisma = client as PrismaService;

    if (acceptedForMatch) {
      const conflictingAlias = await prisma.diagnosisAlias.findFirst({
        where: {
          diagnosisRegistryId: {
            not: diagnosisRegistryId,
          },
          normalizedTerm: normalizedAlias,
          active: true,
          acceptedForMatch: true,
        },
        select: {
          id: true,
        },
      });

      if (conflictingAlias) {
        throw new BadRequestException(
          `Accepted alias collision for "${alias}"`,
        );
      }
    }

    await prisma.diagnosisAlias.upsert({
      where: {
        diagnosisRegistryId_normalizedTerm: {
          diagnosisRegistryId,
          normalizedTerm: normalizedAlias,
        },
      },
      update: {
        term: alias,
        kind,
        acceptedForMatch,
        rank: this.getDefaultAliasRank(kind),
        active: true,
        source: acceptedForMatch
          ? 'editorial_admin_alias'
          : 'editorial_admin_alias_search_only',
      },
      create: {
        diagnosisRegistryId,
        term: alias,
        normalizedTerm: normalizedAlias,
        kind,
        acceptedForMatch,
        rank: this.getDefaultAliasRank(kind),
        active: true,
        source: acceptedForMatch
          ? 'editorial_admin_alias'
          : 'editorial_admin_alias_search_only',
      },
    });

    return this.toRegistrySummary(
      await this.getRegistryById(diagnosisRegistryId, client),
    );
  }

  async getRegistryDetail(
    diagnosisRegistryId: string,
    client: DiagnosisRegistryEditorialClient = this.prisma,
  ): Promise<AdminDiagnosisRegistrySummary> {
    return this.toRegistrySummary(
      await this.getRegistryById(diagnosisRegistryId, client),
    );
  }

  private async getRegistryById(
    diagnosisRegistryId: string,
    client: DiagnosisRegistryEditorialClient,
  ): Promise<DiagnosisRegistryRow> {
    const registry = (await (client as PrismaService).diagnosisRegistry.findUnique({
      where: {
        id: diagnosisRegistryId,
      },
      select: REGISTRY_EDITORIAL_SELECT,
    })) as DiagnosisRegistryRow | null;

    if (!registry) {
      throw new NotFoundException(
        `Diagnosis registry entry not found: ${diagnosisRegistryId}`,
      );
    }

    return registry;
  }

  private rankSearchResult(
    row: DiagnosisRegistryRow,
    normalizedQuery: string,
  ): RankedRegistrySearchItem | null {
    const canonicalBucket = this.getCanonicalBucket(
      row.canonicalNormalized,
      normalizedQuery,
    );
    const aliasCandidate = row.aliases
      .map((alias) => ({
        alias,
        bucket: this.getAliasBucket(alias, normalizedQuery),
      }))
      .filter(
        (
          candidate,
        ): candidate is { alias: DiagnosisRegistryAliasRow; bucket: number } =>
          candidate.bucket !== null,
      )
      .sort((left, right) => {
        if (left.bucket !== right.bucket) {
          return left.bucket - right.bucket;
        }

        if (left.alias.rank !== right.alias.rank) {
          return left.alias.rank - right.alias.rank;
        }

        return left.alias.term.localeCompare(right.alias.term);
      })[0];

    if (canonicalBucket === null && !aliasCandidate) {
      return null;
    }

    if (
      canonicalBucket !== null &&
      (!aliasCandidate || canonicalBucket <= aliasCandidate.bucket)
    ) {
      return {
        id: row.id,
        canonicalName: row.canonicalName,
        status: row.status,
        category: row.category,
        specialty: row.specialty,
        searchPriority: row.searchPriority,
        aliasPreview: this.buildAliasPreview(row.aliases),
        matchSource: 'canonical',
        bucket: canonicalBucket,
      };
    }

    return {
      id: row.id,
      canonicalName: row.canonicalName,
      status: row.status,
      category: row.category,
      specialty: row.specialty,
      searchPriority: row.searchPriority,
      aliasPreview: this.buildAliasPreview(row.aliases),
      matchSource: this.mapAliasMatchSource(aliasCandidate!.alias.kind),
      bucket: aliasCandidate!.bucket,
    };
  }

  private getCanonicalBucket(
    canonicalNormalized: string,
    normalizedQuery: string,
  ): number | null {
    if (canonicalNormalized === normalizedQuery) {
      return 0;
    }

    if (canonicalNormalized.startsWith(normalizedQuery)) {
      return 1;
    }

    if (
      canonicalNormalized
        .split(' ')
        .some((token) => token.startsWith(normalizedQuery))
    ) {
      return 3;
    }

    if (canonicalNormalized.includes(normalizedQuery)) {
      return 5;
    }

    return null;
  }

  private getAliasBucket(
    alias: DiagnosisRegistryAliasRow,
    normalizedQuery: string,
  ): number | null {
    if (alias.normalizedTerm === normalizedQuery) {
      return alias.kind === DiagnosisAliasKind.SEARCH_ONLY ? 4 : 2;
    }

    if (alias.normalizedTerm.startsWith(normalizedQuery)) {
      return alias.kind === DiagnosisAliasKind.SEARCH_ONLY ? 5 : 3;
    }

    if (
      alias.normalizedTerm
        .split(' ')
        .some((token) => token.startsWith(normalizedQuery))
    ) {
      return alias.kind === DiagnosisAliasKind.SEARCH_ONLY ? 6 : 4;
    }

    if (alias.normalizedTerm.includes(normalizedQuery)) {
      return alias.kind === DiagnosisAliasKind.SEARCH_ONLY ? 7 : 5;
    }

    return null;
  }

  private buildAliasPreview(aliases: DiagnosisRegistryAliasRow[]): string[] {
    const preview = aliases
      .filter((alias) => alias.kind !== DiagnosisAliasKind.CANONICAL)
      .slice(0, 3)
      .map((alias) => alias.term);

    return [...new Set(preview)];
  }

  private toRegistrySummary(
    registry: DiagnosisRegistryRow,
  ): AdminDiagnosisRegistrySummary {
    return {
      id: registry.id,
      canonicalName: registry.canonicalName,
      status: registry.status,
      category: registry.category,
      specialty: registry.specialty,
      searchPriority: registry.searchPriority,
      isDescriptive: registry.isDescriptive,
      isCompositional: registry.isCompositional,
      notes: registry.notes,
      aliasPreview: this.buildAliasPreview(registry.aliases),
    };
  }

  private normalizeOptionalString(value?: string | null): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.replace(/\s+/g, ' ').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private requireCanonicalName(value: string): string {
    const canonicalName = this.normalizeOptionalString(value);
    if (!canonicalName) {
      throw new BadRequestException('Canonical diagnosis name is required');
    }

    if (!normalizeDiagnosisTerm(canonicalName)) {
      throw new BadRequestException(
        'Canonical diagnosis name must normalize to a non-empty identifier',
      );
    }

    return canonicalName;
  }

  private normalizeAlias(value: string): string {
    const alias = this.normalizeOptionalString(value);
    if (!alias) {
      throw new BadRequestException('Alias text is required');
    }

    if (!normalizeDiagnosisTerm(alias)) {
      throw new BadRequestException(
        'Alias must normalize to a non-empty identifier',
      );
    }

    return alias;
  }

  private normalizeAliasTerms(
    values: string[],
    canonicalNormalized: string,
  ): string[] {
    const seen = new Set<string>();
    const aliases: string[] = [];

    for (const value of values) {
      const alias = this.normalizeOptionalString(value);
      if (!alias) {
        continue;
      }

      const normalized = normalizeDiagnosisTerm(alias);
      if (!normalized || normalized === canonicalNormalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      aliases.push(alias);
    }

    return aliases;
  }

  private normalizeSearchPriority(value?: number): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined;
    }

    return Math.trunc(value);
  }

  private getDefaultAliasRank(kind: DiagnosisAliasKind): number {
    switch (kind) {
      case DiagnosisAliasKind.ABBREVIATION:
        return 5;
      case DiagnosisAliasKind.ACCEPTED:
        return 10;
      case DiagnosisAliasKind.SEARCH_ONLY:
        return 20;
      default:
        return 0;
    }
  }

  private mapAliasMatchSource(
    kind: DiagnosisAliasKind,
  ): AdminDiagnosisRegistrySearchItem['matchSource'] {
    if (kind === DiagnosisAliasKind.ABBREVIATION) {
      return 'abbreviation';
    }

    if (kind === DiagnosisAliasKind.SEARCH_ONLY) {
      return 'search_only';
    }

    return 'accepted_alias';
  }
}
