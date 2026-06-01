import { Injectable } from '@nestjs/common';
import { DiagnosisAliasKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import {
  getDiagnosisTermNormalizedCandidates,
  normalizeDiagnosisTerm,
} from '../diagnosis-registry/diagnosis-term-normalizer';

export type DifferentialResolutionMatchType =
  | 'canonical'
  | 'display_label'
  | 'alias'
  | 'parenthetical_variant';

export type DifferentialRegistryResolutionSuggestion = {
  diagnosisRegistryId: string;
  displayLabel: string;
  canonicalName: string;
  matchType: DifferentialResolutionMatchType;
  confidence: number;
};

export type DifferentialRegistryResolutionResult = {
  rawText: string;
  normalizedText: string;
  status: 'resolved' | 'ambiguous' | 'unresolved';
  resolvedRegistryId?: string;
  resolvedDisplayLabel?: string;
  matchType?: DifferentialResolutionMatchType;
  confidence: number;
  suggestions: DifferentialRegistryResolutionSuggestion[];
};

type RegistryResolutionRow = {
  id: string;
  displayLabel: string;
  canonicalName: string;
  canonicalNormalized: string;
  aliases: Array<{
    normalizedTerm: string;
    kind: DiagnosisAliasKind;
    acceptedForMatch: boolean;
  }>;
};

@Injectable()
export class DifferentialRegistryResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(input: {
    rawText: string;
    contextDiagnosisRegistryId?: string | null;
  }): Promise<DifferentialRegistryResolutionResult> {
    const rawText = this.compact(input.rawText);
    const normalizedText = normalizeDiagnosisTerm(rawText);

    if (!rawText || !normalizedText) {
      return {
        rawText,
        normalizedText,
        status: 'unresolved',
        confidence: 0,
        suggestions: [],
      };
    }

    const normalizedCandidates = [
      ...new Set(getDiagnosisTermNormalizedCandidates(rawText)),
    ].filter(Boolean);
    const variantCandidates = normalizedCandidates.filter(
      (candidate) => candidate !== normalizedText,
    );

    const rows = (await this.prisma.diagnosisRegistry.findMany({
      where: {
        active: true,
        ...(input.contextDiagnosisRegistryId
          ? { id: { not: input.contextDiagnosisRegistryId } }
          : {}),
        OR: [
          { displayLabel: { equals: rawText, mode: 'insensitive' } },
          { canonicalName: { equals: rawText, mode: 'insensitive' } },
          { canonicalNormalized: { in: normalizedCandidates } },
          {
            aliases: {
              some: {
                active: true,
                normalizedTerm: { in: normalizedCandidates },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        displayLabel: true,
        canonicalName: true,
        canonicalNormalized: true,
        aliases: {
          where: { active: true },
          select: {
            normalizedTerm: true,
            kind: true,
            acceptedForMatch: true,
          },
        },
      },
      take: 10,
    })) as RegistryResolutionRow[];

    const suggestions = rows
      .map((row) =>
        this.toSuggestion(row, rawText, normalizedText, variantCandidates),
      )
      .filter(
        (
          suggestion,
        ): suggestion is DifferentialRegistryResolutionSuggestion =>
          suggestion !== null,
      )
      .sort((left, right) => {
        if (left.confidence !== right.confidence) {
          return right.confidence - left.confidence;
        }

        return left.displayLabel.localeCompare(right.displayLabel);
      });

    if (!suggestions.length) {
      return {
        rawText,
        normalizedText,
        status: 'unresolved',
        confidence: 0,
        suggestions: [],
      };
    }

    const top = suggestions[0];
    const tiedTop = suggestions.filter(
      (suggestion) => suggestion.confidence === top.confidence,
    );

    if (tiedTop.length === 1) {
      return {
        rawText,
        normalizedText,
        status: 'resolved',
        resolvedRegistryId: top.diagnosisRegistryId,
        resolvedDisplayLabel: top.displayLabel,
        matchType: top.matchType,
        confidence: top.confidence,
        suggestions,
      };
    }

    return {
      rawText,
      normalizedText,
      status: 'ambiguous',
      confidence: top.confidence,
      suggestions,
    };
  }

  toPayload(
    result: DifferentialRegistryResolutionResult,
  ): Prisma.InputJsonObject {
    return {
      registryResolution: {
        rawText: result.rawText,
        normalizedText: result.normalizedText,
        status: result.status,
        resolvedRegistryId: result.resolvedRegistryId,
        resolvedDisplayLabel: result.resolvedDisplayLabel,
        matchType: result.matchType,
        confidence: result.confidence,
        suggestions: result.suggestions,
      },
    };
  }

  private toSuggestion(
    row: RegistryResolutionRow,
    rawText: string,
    normalizedText: string,
    variantCandidates: string[],
  ): DifferentialRegistryResolutionSuggestion | null {
    if (
      row.displayLabel.localeCompare(rawText, undefined, {
        sensitivity: 'base',
      }) === 0
    ) {
      return this.suggestion(row, 'display_label', 1);
    }

    if (row.canonicalNormalized === normalizedText) {
      return this.suggestion(row, 'canonical', 1);
    }

    const exactAlias = row.aliases.find(
      (alias) => alias.normalizedTerm === normalizedText,
    );
    if (exactAlias) {
      return this.suggestion(
        row,
        'alias',
        exactAlias.kind === DiagnosisAliasKind.SEARCH_ONLY ||
          !exactAlias.acceptedForMatch
          ? 0.9
          : 0.98,
      );
    }

    if (
      variantCandidates.includes(row.canonicalNormalized) ||
      row.aliases.some((alias) =>
        variantCandidates.includes(alias.normalizedTerm),
      )
    ) {
      return this.suggestion(row, 'parenthetical_variant', 0.88);
    }

    return null;
  }

  private suggestion(
    row: RegistryResolutionRow,
    matchType: DifferentialResolutionMatchType,
    confidence: number,
  ): DifferentialRegistryResolutionSuggestion {
    return {
      diagnosisRegistryId: row.id,
      displayLabel: row.displayLabel,
      canonicalName: row.canonicalName,
      matchType,
      confidence,
    };
  }

  private compact(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }
}
