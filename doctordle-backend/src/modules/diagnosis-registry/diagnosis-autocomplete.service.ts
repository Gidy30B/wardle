import { Injectable } from '@nestjs/common';
import { getEnv } from '../../core/config/env.validation.js';
import { PrismaService } from '../../core/db/prisma.service.js';
import {
  getDictionaryVisibleDiagnosisRegistryWhere,
} from './diagnosis-registry-status.js';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer.js';

export type DiagnosisAutocompleteSuggestion = {
  diagnosisId: string;
  displayLabel: string;
  aliasId: string | null;
  matchKind: 'canonical' | 'accepted' | 'abbreviation' | 'search_only';
};

type RankedSuggestion = DiagnosisAutocompleteSuggestion & {
  bucket: number;
  rank: number;
};

type RegistryAliasRow = {
  id: string;
  term: string;
  normalizedTerm: string;
  kind: string;
  rank: number;
};

type RegistryRow = {
  id: string;
  displayLabel: string;
  canonicalNormalized: string;
  aliases: RegistryAliasRow[];
};

type RankedAliasCandidate = {
  alias: RegistryAliasRow;
  bucket: number;
};

type MaybeRankedAliasCandidate = {
  alias: RegistryAliasRow;
  bucket: number | null;
};

@Injectable()
export class DiagnosisAutocompleteService {
  constructor(private readonly prisma: PrismaService) {}

  async search(input: {
    query: string;
    limit?: number;
  }): Promise<DiagnosisAutocompleteSuggestion[]> {
    const env = getEnv();
    if (!env.DIAGNOSIS_REGISTRY_ENABLED || !env.DIAGNOSIS_AUTOCOMPLETE_ENABLED) {
      return [];
    }

    const normalizedQuery = normalizeDiagnosisTerm(input.query);
    if (normalizedQuery.length < 2) {
      return [];
    }

    const limit = Math.max(1, Math.min(8, Math.floor(input.limit ?? 5)));
    const prisma = this.prisma as any;
    const registries = (await prisma.diagnosisRegistry.findMany({
      where: {
        ...getDictionaryVisibleDiagnosisRegistryWhere(),
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
      },
      include: {
        aliases: {
          where: {
            active: true,
            normalizedTerm: {
              contains: normalizedQuery,
            },
          },
          orderBy: [{ rank: 'asc' }, { term: 'asc' }],
          select: {
            id: true,
            term: true,
            normalizedTerm: true,
            kind: true,
            rank: true,
          },
        },
      },
      take: Math.max(limit * 5, 20),
      orderBy: [{ displayLabel: 'asc' }],
    })) as RegistryRow[];

    return registries
      .map((registry: RegistryRow) =>
        this.rankRegistrySuggestion({
          diagnosisId: registry.id,
          displayLabel: registry.displayLabel,
          canonicalNormalized: registry.canonicalNormalized,
          aliases: registry.aliases,
          normalizedQuery,
        }),
      )
      .filter((item: RankedSuggestion | null): item is RankedSuggestion => item !== null)
      .sort((left: RankedSuggestion, right: RankedSuggestion) => {
        if (left.bucket !== right.bucket) {
          return left.bucket - right.bucket;
        }

        if (left.rank !== right.rank) {
          return left.rank - right.rank;
        }

        return left.displayLabel.localeCompare(right.displayLabel);
      })
      .slice(0, limit)
      .map(({ bucket: _bucket, rank: _rank, ...suggestion }: RankedSuggestion) => suggestion);
  }

  private rankRegistrySuggestion(input: {
    diagnosisId: string;
    displayLabel: string;
    canonicalNormalized: string;
    aliases: RegistryAliasRow[];
    normalizedQuery: string;
  }): RankedSuggestion | null {
    const canonicalBucket = this.getCanonicalBucket(
      input.canonicalNormalized,
      input.normalizedQuery,
    );
    const aliasCandidate = input.aliases
      .map((alias): MaybeRankedAliasCandidate => ({
        alias,
        bucket: this.getAliasBucket(alias, input.normalizedQuery),
      }))
      .filter(
        (candidate: MaybeRankedAliasCandidate): candidate is RankedAliasCandidate =>
          candidate.bucket !== null,
      )
      .sort((left: RankedAliasCandidate, right: RankedAliasCandidate) => {
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
        diagnosisId: input.diagnosisId,
        displayLabel: input.displayLabel,
        aliasId: null,
        matchKind: 'canonical',
        bucket: canonicalBucket,
        rank: 0,
      };
    }

    return {
      diagnosisId: input.diagnosisId,
      displayLabel: input.displayLabel,
      aliasId: aliasCandidate!.alias.id,
      matchKind: this.mapAliasKind(aliasCandidate!.alias.kind),
      bucket: aliasCandidate!.bucket,
      rank: aliasCandidate!.alias.rank,
    };
  }

  private getCanonicalBucket(
    canonicalNormalized: string,
    normalizedQuery: string,
  ): number | null {
    if (canonicalNormalized.startsWith(normalizedQuery)) {
      return 0;
    }

    if (canonicalNormalized
      .split(' ')
      .some((token) => token.startsWith(normalizedQuery))) {
      return 2;
    }

    if (canonicalNormalized.includes(normalizedQuery)) {
      return 4;
    }

    return null;
  }

  private getAliasBucket(
    alias: {
      normalizedTerm: string;
      kind: string;
    },
    normalizedQuery: string,
  ): number | null {
    if (alias.normalizedTerm.startsWith(normalizedQuery)) {
      return alias.kind === 'SEARCH_ONLY' ? 3 : 1;
    }

    if (alias.normalizedTerm
      .split(' ')
      .some((token) => token.startsWith(normalizedQuery))) {
      return alias.kind === 'SEARCH_ONLY' ? 5 : 3;
    }

    if (alias.normalizedTerm.includes(normalizedQuery)) {
      return alias.kind === 'SEARCH_ONLY' ? 6 : 5;
    }

    return null;
  }

  private mapAliasKind(
    kind: string,
  ): DiagnosisAutocompleteSuggestion['matchKind'] {
    switch (kind) {
      case 'ABBREVIATION':
        return 'abbreviation';
      case 'SEARCH_ONLY':
        return 'search_only';
      default:
        return 'accepted';
    }
  }
}
