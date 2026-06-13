import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DiagnosisAliasKind,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer';

export type AliasConflictType =
  | 'canonical_name'
  | 'display_label'
  | 'accepted_alias'
  | 'search_alias'
  | 'registry_duplicate';

export type AliasValidationConflict = {
  type: AliasConflictType;
  diagnosisRegistryId: string;
  diagnosisDisplayLabel: string;
};

export type AliasValidationResult = {
  valid: boolean;
  normalizedAlias: string;
  conflicts: AliasValidationConflict[];
  warnings: string[];
};

export type AliasValidationClient =
  | PrismaService
  | Prisma.TransactionClient
  | PrismaClient;

export type AliasValidationInput = {
  aliasText: string;
  targetDiagnosisRegistryId: string;
  acceptedForMatch?: boolean;
  ignoreAliasId?: string;
  ignoredDiagnosisRegistryIds?: string[];
  allowTargetCanonicalAlias?: boolean;
};

type RegistryCollisionRow = {
  id: string;
  canonicalName: string;
  canonicalNormalized: string;
  displayLabel: string;
};

type AliasCollisionRow = {
  id: string;
  diagnosisRegistryId: string;
  term: string;
  normalizedTerm: string;
  kind: DiagnosisAliasKind;
  acceptedForMatch: boolean;
  diagnosis: {
    id: string;
    displayLabel: string;
  };
};

@Injectable()
export class AliasValidationService {
  constructor(private readonly prisma: PrismaService) {}

  validateAlias(input: AliasValidationInput): Promise<AliasValidationResult> {
    return validateAliasWithClient(this.prisma, input);
  }

  async assertAliasValid(input: AliasValidationInput): Promise<AliasValidationResult> {
    return assertAliasValidWithClient(this.prisma, input);
  }
}

export async function assertAliasValidWithClient(
  client: AliasValidationClient,
  input: AliasValidationInput,
): Promise<AliasValidationResult> {
  const result = await validateAliasWithClient(client, input);
  if (!result.valid) {
    throw new BadRequestException(formatAliasValidationFailure(result));
  }

  return result;
}

export async function validateAliasWithClient(
  client: AliasValidationClient,
  input: AliasValidationInput,
): Promise<AliasValidationResult> {
  const alias = compactAlias(input.aliasText);
  const normalizedAlias = normalizeDiagnosisTerm(alias);
  const warnings: string[] = [];

  if (!alias || !normalizedAlias) {
    return {
      valid: false,
      normalizedAlias,
      conflicts: [],
      warnings: ['Alias text must normalize to a non-empty identifier.'],
    };
  }

  const prisma = client as PrismaService;
  const target = await prisma.diagnosisRegistry.findUnique({
    where: { id: input.targetDiagnosisRegistryId },
    select: {
      id: true,
      displayLabel: true,
      canonicalNormalized: true,
    },
  });

  if (!target) {
    throw new BadRequestException('Target diagnosis registry entry not found');
  }

  const conflicts: AliasValidationConflict[] = [];

  if (
    target.canonicalNormalized === normalizedAlias &&
    !input.allowTargetCanonicalAlias
  ) {
    conflicts.push({
      type: 'registry_duplicate',
      diagnosisRegistryId: target.id,
      diagnosisDisplayLabel: target.displayLabel,
    });
  }

  const registryCollisions = (await prisma.diagnosisRegistry.findMany({
    where: {
      id: {
        notIn: [
          input.targetDiagnosisRegistryId,
          ...(input.ignoredDiagnosisRegistryIds ?? []),
        ],
      },
      OR: [
        { canonicalNormalized: normalizedAlias },
        { canonicalName: { equals: alias, mode: 'insensitive' } },
        { displayLabel: { equals: alias, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      canonicalName: true,
      canonicalNormalized: true,
      displayLabel: true,
    },
    take: 10,
  })) as RegistryCollisionRow[];

  for (const row of registryCollisions) {
    if (row.canonicalNormalized === normalizedAlias) {
      conflicts.push(thisConflict('canonical_name', row));
      continue;
    }

    if (
      normalizeDiagnosisTerm(row.canonicalName) === normalizedAlias ||
      row.canonicalName.localeCompare(alias, undefined, { sensitivity: 'base' }) ===
        0
    ) {
      conflicts.push(thisConflict('canonical_name', row));
      continue;
    }

    conflicts.push(thisConflict('display_label', row));
  }

  const aliasCollisions = (await prisma.diagnosisAlias.findMany({
    where: {
      normalizedTerm: normalizedAlias,
      active: true,
      diagnosisRegistryId: {
        notIn: input.ignoredDiagnosisRegistryIds ?? [],
      },
      ...(input.ignoreAliasId ? { id: { not: input.ignoreAliasId } } : {}),
    },
    select: {
      id: true,
      diagnosisRegistryId: true,
      term: true,
      normalizedTerm: true,
      kind: true,
      acceptedForMatch: true,
      diagnosis: {
        select: {
          id: true,
          displayLabel: true,
        },
      },
    },
    take: 20,
  })) as AliasCollisionRow[];

  for (const row of aliasCollisions) {
    if (row.diagnosisRegistryId === input.targetDiagnosisRegistryId) {
      if (
        input.acceptedForMatch !== false &&
        (!row.acceptedForMatch || row.kind === DiagnosisAliasKind.SEARCH_ONLY)
      ) {
        warnings.push(
          `Alias "${alias}" already exists as a search-only alias and would require explicit review before promotion.`,
        );
      }
      conflicts.push({
        type: 'registry_duplicate',
        diagnosisRegistryId: row.diagnosisRegistryId,
        diagnosisDisplayLabel: row.diagnosis.displayLabel,
      });
      continue;
    }

    conflicts.push({
      type: row.acceptedForMatch ? 'accepted_alias' : 'search_alias',
      diagnosisRegistryId: row.diagnosisRegistryId,
      diagnosisDisplayLabel: row.diagnosis.displayLabel,
    });
  }

  return {
    valid: conflicts.length === 0,
    normalizedAlias,
    conflicts: dedupeConflicts(conflicts),
    warnings,
  };
}

export function formatAliasValidationFailure(result: AliasValidationResult): string {
  if (!result.conflicts.length) {
    return result.warnings[0] ?? 'Alias validation failed';
  }

  const conflicts = result.conflicts
    .map(
      (conflict) =>
        `${conflict.type} with "${conflict.diagnosisDisplayLabel}" (${conflict.diagnosisRegistryId})`,
    )
    .join('; ');

  return `Alias validation failed: ${conflicts}`;
}

function compactAlias(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function thisConflict(
  type: AliasConflictType,
  row: RegistryCollisionRow,
): AliasValidationConflict {
  return {
    type,
    diagnosisRegistryId: row.id,
    diagnosisDisplayLabel: row.displayLabel,
  };
}

function dedupeConflicts(
  conflicts: AliasValidationConflict[],
): AliasValidationConflict[] {
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    const key = `${conflict.type}:${conflict.diagnosisRegistryId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
