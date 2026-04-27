import { Injectable } from '@nestjs/common';
import { DiagnosisAliasKind, DiagnosisRegistryStatus } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import { getDictionaryVisibleDiagnosisRegistryWhere } from './diagnosis-registry-status.js';

export type DiagnosisDictionaryItem = {
  id: string;
  label: string;
  aliases: string[];
  priority: number;
  category?: string;
};

export type DiagnosisDictionaryPayload = {
  version: string;
  generatedAt: string;
  items: DiagnosisDictionaryItem[];
};

type DictionaryRegistryRow = {
  id: string;
  displayLabel: string;
  searchPriority: number;
  category: string | null;
  aliases: Array<{
    term: string;
    normalizedTerm: string;
    rank: number;
  }>;
};

const PUBLIC_DICTIONARY_ALIAS_KINDS = [
  DiagnosisAliasKind.ACCEPTED,
  DiagnosisAliasKind.ABBREVIATION,
  DiagnosisAliasKind.SEARCH_ONLY,
] as const;

@Injectable()
export class DiagnosisRegistryDictionaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getDictionary(): Promise<DiagnosisDictionaryPayload> {
    const [versionSeed, items] = await Promise.all([
      this.buildVersionSeed(),
      this.loadItems(),
    ]);

    return {
      version: versionSeed.version,
      generatedAt: versionSeed.generatedAt.toISOString(),
      items,
    };
  }

  private async buildVersionSeed(): Promise<{
    version: string;
    generatedAt: Date;
  }> {
    const [diagnosisCount, aliasCount, latestDiagnosis, latestAlias] =
      await Promise.all([
        this.prisma.diagnosisRegistry.count({
          where: getDictionaryVisibleDiagnosisRegistryWhere(),
        }),
        this.prisma.diagnosisAlias.count({
          where: {
            active: true,
            kind: {
              in: [...PUBLIC_DICTIONARY_ALIAS_KINDS],
            },
            diagnosis: {
              status: DiagnosisRegistryStatus.ACTIVE,
            },
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
            kind: {
              in: [...PUBLIC_DICTIONARY_ALIAS_KINDS],
            },
            diagnosis: {
              status: DiagnosisRegistryStatus.ACTIVE,
            },
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

    return {
      version: [generatedAt.getTime(), diagnosisCount, aliasCount].join(':'),
      generatedAt,
    };
  }

  private async loadItems(): Promise<DiagnosisDictionaryItem[]> {
    const rows = (await this.prisma.diagnosisRegistry.findMany({
      where: getDictionaryVisibleDiagnosisRegistryWhere(),
      select: {
        id: true,
        displayLabel: true,
        searchPriority: true,
        category: true,
        aliases: {
          where: {
            active: true,
            kind: {
              in: [...PUBLIC_DICTIONARY_ALIAS_KINDS],
            },
          },
          orderBy: [{ rank: 'asc' }, { term: 'asc' }],
          select: {
            term: true,
            normalizedTerm: true,
            rank: true,
          },
        },
      },
      orderBy: [{ searchPriority: 'desc' }, { displayLabel: 'asc' }],
    })) as DictionaryRegistryRow[];

    return rows.map((row) => {
      const aliases = dedupeAliases(row.aliases);
      const category = row.category?.trim() || undefined;

      return {
        id: row.id,
        label: row.displayLabel,
        aliases,
        priority: row.searchPriority,
        ...(category ? { category } : {}),
      };
    });
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
}

function dedupeAliases(
  aliases: DictionaryRegistryRow['aliases'],
): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const alias of aliases) {
    if (seen.has(alias.normalizedTerm)) {
      continue;
    }

    seen.add(alias.normalizedTerm);
    items.push(alias.term);
  }

  return items;
}
