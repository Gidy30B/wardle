import { Injectable } from '@nestjs/common';
import { getEnv } from '../../core/config/env.validation.js';
import { PrismaService } from '../../core/db/prisma.service.js';
import { getDictionaryVisibleDiagnosisRegistryWhere } from './diagnosis-registry-status.js';

export type DiagnosisRegistrySnapshotAlias = {
  id: string;
  term: string;
  normalizedTerm: string;
  rank: number;
  acceptedForMatch: boolean;
  matchKind: 'canonical' | 'accepted' | 'abbreviation' | 'search_only';
};

export type DiagnosisRegistrySnapshotEntry = {
  diagnosisId: string;
  canonicalName: string;
  canonicalNormalized: string;
  displayLabel: string;
  aliases: DiagnosisRegistrySnapshotAlias[];
};

export type DiagnosisRegistryVersionResponse = {
  version: string;
  generatedAt: string;
  diagnosisCount: number;
  aliasCount: number;
  selectionRequired: boolean;
  autocompleteEnabled: boolean;
};

export type DiagnosisRegistrySnapshotResponse = DiagnosisRegistryVersionResponse & {
  diagnoses: DiagnosisRegistrySnapshotEntry[];
};

type DiagnosisRegistryVersionSeed = {
  diagnosisCount: number;
  aliasCount: number;
  generatedAt: Date;
  selectionRequired: boolean;
  autocompleteEnabled: boolean;
  version: string;
};

type RegistryRow = {
  id: string;
  canonicalName: string;
  canonicalNormalized: string;
  displayLabel: string;
  aliases: Array<{
    id: string;
    term: string;
    normalizedTerm: string;
    rank: number;
    acceptedForMatch: boolean;
    kind: 'CANONICAL' | 'ACCEPTED' | 'ABBREVIATION' | 'SEARCH_ONLY';
  }>;
};

@Injectable()
export class DiagnosisRegistrySnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async getVersion(): Promise<DiagnosisRegistryVersionResponse> {
    const seed = await this.buildVersionSeed();

    return {
      version: seed.version,
      generatedAt: seed.generatedAt.toISOString(),
      diagnosisCount: seed.diagnosisCount,
      aliasCount: seed.aliasCount,
      selectionRequired: seed.selectionRequired,
      autocompleteEnabled: seed.autocompleteEnabled,
    };
  }

  async getSnapshot(): Promise<DiagnosisRegistrySnapshotResponse> {
    const [seed, diagnoses] = await Promise.all([
      this.buildVersionSeed(),
      this.loadDictionaryVisibleDiagnoses(),
    ]);

    return {
      version: seed.version,
      generatedAt: seed.generatedAt.toISOString(),
      diagnosisCount: seed.diagnosisCount,
      aliasCount: seed.aliasCount,
      selectionRequired: seed.selectionRequired,
      autocompleteEnabled: seed.autocompleteEnabled,
      diagnoses,
    };
  }

  private async buildVersionSeed(): Promise<DiagnosisRegistryVersionSeed> {
    const env = getEnv();
    const [diagnosisCount, aliasCount, latestDiagnosis, latestAlias] =
      await Promise.all([
        this.prisma.diagnosisRegistry.count({
          where: getDictionaryVisibleDiagnosisRegistryWhere(),
        }),
        this.prisma.diagnosisAlias.count({
          where: {
            active: true,
          },
        }),
        this.prisma.diagnosisRegistry.findFirst({
          where: getDictionaryVisibleDiagnosisRegistryWhere(),
          orderBy: {
            updatedAt: 'desc',
          },
          select: {
            updatedAt: true,
          },
        }),
        this.prisma.diagnosisAlias.findFirst({
          where: {
            active: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
          select: {
            updatedAt: true,
          },
        }),
      ]);

    const generatedAt = this.getGeneratedAt(
      latestDiagnosis?.updatedAt ?? null,
      latestAlias?.updatedAt ?? null,
    );
    const selectionRequired = env.SELECTION_FIRST_SUBMISSION_ENABLED;
    const autocompleteEnabled = env.DIAGNOSIS_AUTOCOMPLETE_ENABLED;

    return {
      diagnosisCount,
      aliasCount,
      generatedAt,
      selectionRequired,
      autocompleteEnabled,
      version: [
        generatedAt.getTime(),
        diagnosisCount,
        aliasCount,
        selectionRequired ? 1 : 0,
        autocompleteEnabled ? 1 : 0,
      ].join(':'),
    };
  }

  private async loadDictionaryVisibleDiagnoses(): Promise<DiagnosisRegistrySnapshotEntry[]> {
    const rows = (await this.prisma.diagnosisRegistry.findMany({
      where: getDictionaryVisibleDiagnosisRegistryWhere(),
      include: {
        aliases: {
          where: {
            active: true,
          },
          orderBy: [{ rank: 'asc' }, { term: 'asc' }],
          select: {
            id: true,
            term: true,
            normalizedTerm: true,
            rank: true,
            acceptedForMatch: true,
            kind: true,
          },
        },
      },
      orderBy: [{ displayLabel: 'asc' }],
    })) as RegistryRow[];

    return rows.map((row) => ({
      diagnosisId: row.id,
      canonicalName: row.canonicalName,
      canonicalNormalized: row.canonicalNormalized,
      displayLabel: row.displayLabel,
      aliases: row.aliases.map((alias) => ({
        id: alias.id,
        term: alias.term,
        normalizedTerm: alias.normalizedTerm,
        rank: alias.rank,
        acceptedForMatch: alias.acceptedForMatch,
        matchKind: this.mapAliasKind(alias.kind),
      })),
    }));
  }

  private getGeneratedAt(
    latestDiagnosisUpdatedAt: Date | null,
    latestAliasUpdatedAt: Date | null,
  ): Date {
    const timestamps = [latestDiagnosisUpdatedAt, latestAliasUpdatedAt]
      .filter((value): value is Date => value instanceof Date)
      .map((value) => value.getTime());

    if (timestamps.length === 0) {
      return new Date(0);
    }

    return new Date(Math.max(...timestamps));
  }

  private mapAliasKind(
    kind: RegistryRow['aliases'][number]['kind'],
  ): DiagnosisRegistrySnapshotAlias['matchKind'] {
    switch (kind) {
      case 'ABBREVIATION':
        return 'abbreviation';
      case 'SEARCH_ONLY':
        return 'search_only';
      case 'CANONICAL':
        return 'canonical';
      default:
        return 'accepted';
    }
  }
}
