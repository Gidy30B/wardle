import { Injectable } from '@nestjs/common';
import {
  DiagnosisAliasKind,
  DiagnosisRegistryStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import { buildDiagnosisRegistryStatusPatch } from './diagnosis-registry-status.js';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer.js';

type DiagnosisRegistryImportClient =
  | PrismaService
  | Prisma.TransactionClient
  | PrismaClient;

type ExistingRegistryRecord = {
  id: string;
  canonicalName: string;
  canonicalNormalized: string;
  displayLabel: string;
  status: DiagnosisRegistryStatus;
  active: boolean;
  isDescriptive: boolean;
  isCompositional: boolean;
  searchPriority: number;
  icd10Code: string | null;
  icd11Code: string | null;
  category: string | null;
  specialty: string | null;
  notes: string | null;
};

type ExistingAliasRecord = {
  id: string;
  diagnosisRegistryId: string;
  term: string;
  normalizedTerm: string;
  kind: DiagnosisAliasKind;
  acceptedForMatch: boolean;
  rank: number;
  source: string | null;
  active: boolean;
};

type RegistryMutationInput = {
  canonicalName: string;
  canonicalNormalized: string;
  displayLabel: string;
  status: DiagnosisRegistryStatus;
  active: boolean;
  isDescriptive: boolean;
  isCompositional: boolean;
  searchPriority: number;
  icd10Code: string | null;
  icd11Code: string | null;
  category: string | null;
  specialty: string | null;
  notes: string | null;
};

type AliasMutationInput = {
  term: string;
  normalizedTerm: string;
  kind: DiagnosisAliasKind;
  acceptedForMatch: boolean;
  rank: number;
  source: string;
  active: boolean;
};

type ImportRecordResult = {
  diagnosisCreated: boolean;
  diagnosisUpdated: boolean;
  createdAliases: number;
  skippedAliases: number;
  collisions: number;
  errors: string[];
};

export type ImportedDiagnosisAliasRecord = {
  alias: string;
  kind?: Exclude<DiagnosisAliasKind, 'CANONICAL'>;
  isAcceptedForGameplay?: boolean;
};

export type ImportedDiagnosisRecord = {
  canonicalName: string;
  aliases?: ImportedDiagnosisAliasRecord[];
  status?: DiagnosisRegistryStatus;
  isDescriptive?: boolean;
  isCompositional?: boolean;
  searchPriority?: number;
  icd10Code?: string | null;
  icd11Code?: string | null;
  category?: string | null;
  specialty?: string | null;
  notes?: string | null;
};

export type DiagnosisRegistryImportSummary = {
  totalRecords: number;
  createdDiagnoses: number;
  reusedDiagnoses: number;
  updatedDiagnoses: number;
  createdAliases: number;
  skippedAliases: number;
  collisions: number;
  errors: Array<{ canonicalName: string; reason: string }>;
};

const REGISTRY_SELECT = {
  id: true,
  canonicalName: true,
  canonicalNormalized: true,
  displayLabel: true,
  status: true,
  active: true,
  isDescriptive: true,
  isCompositional: true,
  searchPriority: true,
  icd10Code: true,
  icd11Code: true,
  category: true,
  specialty: true,
  notes: true,
} as const;

const ALIAS_SELECT = {
  id: true,
  diagnosisRegistryId: true,
  term: true,
  normalizedTerm: true,
  kind: true,
  acceptedForMatch: true,
  rank: true,
  source: true,
  active: true,
} as const;

@Injectable()
export class DiagnosisRegistryImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importSeedRecords(
    records: ImportedDiagnosisRecord[],
    client: DiagnosisRegistryImportClient = this.prisma,
  ): Promise<DiagnosisRegistryImportSummary> {
    return importDiagnosisRegistryRecords(client, records);
  }
}

export async function importDiagnosisRegistryRecords(
  client: DiagnosisRegistryImportClient,
  records: ImportedDiagnosisRecord[],
): Promise<DiagnosisRegistryImportSummary> {
  const summary: DiagnosisRegistryImportSummary = {
    totalRecords: records.length,
    createdDiagnoses: 0,
    reusedDiagnoses: 0,
    updatedDiagnoses: 0,
    createdAliases: 0,
    skippedAliases: 0,
    collisions: 0,
    errors: [],
  };

  for (const record of records) {
    try {
      const result = await importDiagnosisRegistryRecord(client, record);

      if (result.diagnosisCreated) {
        summary.createdDiagnoses += 1;
      } else {
        summary.reusedDiagnoses += 1;
      }

      if (result.diagnosisUpdated) {
        summary.updatedDiagnoses += 1;
      }

      summary.createdAliases += result.createdAliases;
      summary.skippedAliases += result.skippedAliases;
      summary.collisions += result.collisions;
      summary.errors.push(
        ...result.errors.map((reason) => ({
          canonicalName: record.canonicalName,
          reason,
        })),
      );
    } catch (error) {
      summary.errors.push({
        canonicalName: record.canonicalName,
        reason: getImportErrorMessage(error),
      });
    }
  }

  return summary;
}

async function importDiagnosisRegistryRecord(
  client: DiagnosisRegistryImportClient,
  record: ImportedDiagnosisRecord,
): Promise<ImportRecordResult> {
  const prisma = client as any;
  const canonicalName = sanitizeTerm(record.canonicalName);
  if (!canonicalName) {
    throw new Error('Canonical name is required');
  }

  const canonicalNormalized = normalizeDiagnosisTerm(canonicalName);
  if (!canonicalNormalized) {
    throw new Error('Canonical name must normalize to a non-empty identifier');
  }

  const existingRegistry = (await prisma.diagnosisRegistry.findUnique({
    where: {
      canonicalNormalized,
    },
    select: REGISTRY_SELECT,
  })) as ExistingRegistryRecord | null;

  const mutation = buildRegistryMutationInput(
    record,
    existingRegistry,
    canonicalName,
    canonicalNormalized,
  );
  const ensuredRegistry = existingRegistry
    ? await updateRegistryIfNeeded(prisma, existingRegistry, mutation)
    : await createRegistryWithRecovery(prisma, mutation);
  const registryCreated = existingRegistry === null && ensuredRegistry.created;
  const diagnosisUpdated = ensuredRegistry.updated;

  await ensureCanonicalAlias(prisma, ensuredRegistry.record.id, canonicalName, canonicalNormalized);

  const aliasResult = await importAliasesForRegistry(
    prisma,
    ensuredRegistry.record.id,
    canonicalNormalized,
    record.aliases ?? [],
  );

  return {
    diagnosisCreated: registryCreated,
    diagnosisUpdated,
    createdAliases: aliasResult.createdAliases,
    skippedAliases: aliasResult.skippedAliases,
    collisions: aliasResult.collisions,
    errors: aliasResult.errors,
  };
}

function buildRegistryMutationInput(
  record: ImportedDiagnosisRecord,
  existing: ExistingRegistryRecord | null,
  canonicalName: string,
  canonicalNormalized: string,
): RegistryMutationInput {
  const status = record.status ?? existing?.status ?? DiagnosisRegistryStatus.ACTIVE;

  return {
    canonicalName,
    canonicalNormalized,
    displayLabel: canonicalName,
    ...buildDiagnosisRegistryStatusPatch(status),
    isDescriptive: record.isDescriptive ?? existing?.isDescriptive ?? false,
    isCompositional:
      record.isCompositional ?? existing?.isCompositional ?? false,
    searchPriority:
      typeof record.searchPriority === 'number' &&
      Number.isFinite(record.searchPriority)
        ? Math.trunc(record.searchPriority)
        : existing?.searchPriority ?? 0,
    icd10Code: resolveNullableString(record, 'icd10Code', existing?.icd10Code ?? null),
    icd11Code: resolveNullableString(record, 'icd11Code', existing?.icd11Code ?? null),
    category: resolveNullableString(record, 'category', existing?.category ?? null),
    specialty: resolveNullableString(record, 'specialty', existing?.specialty ?? null),
    notes: resolveNullableString(record, 'notes', existing?.notes ?? null),
  };
}

async function updateRegistryIfNeeded(
  prisma: any,
  existing: ExistingRegistryRecord,
  mutation: RegistryMutationInput,
): Promise<{
  record: ExistingRegistryRecord;
  created: false;
  updated: boolean;
}> {
  if (!hasRegistryChanges(existing, mutation)) {
    return {
      record: existing,
      created: false,
      updated: false,
    };
  }

  const updated = (await prisma.diagnosisRegistry.update({
    where: {
      id: existing.id,
    },
    data: mutation,
    select: REGISTRY_SELECT,
  })) as ExistingRegistryRecord;

  return {
    record: updated,
    created: false,
    updated: true,
  };
}

async function createRegistryWithRecovery(
  prisma: any,
  mutation: RegistryMutationInput,
): Promise<{
  record: ExistingRegistryRecord;
  created: boolean;
  updated: boolean;
}> {
  try {
    const created = (await prisma.diagnosisRegistry.create({
      data: mutation,
      select: REGISTRY_SELECT,
    })) as ExistingRegistryRecord;

    return {
      record: created,
      created: true,
      updated: true,
    };
  } catch (error) {
    const maybePrismaError = error as { code?: string };
    if (maybePrismaError.code !== 'P2002') {
      throw error;
    }

    const recovered = (await prisma.diagnosisRegistry.findUnique({
      where: {
        canonicalNormalized: mutation.canonicalNormalized,
      },
      select: REGISTRY_SELECT,
    })) as ExistingRegistryRecord | null;

    if (!recovered) {
      throw error;
    }

    const updated = await updateRegistryIfNeeded(prisma, recovered, mutation);
    return {
      record: updated.record,
      created: false,
      updated: updated.updated,
    };
  }
}

function hasRegistryChanges(
  existing: ExistingRegistryRecord,
  mutation: RegistryMutationInput,
): boolean {
  return (
    existing.canonicalName !== mutation.canonicalName ||
    existing.canonicalNormalized !== mutation.canonicalNormalized ||
    existing.displayLabel !== mutation.displayLabel ||
    existing.status !== mutation.status ||
    existing.active !== mutation.active ||
    existing.isDescriptive !== mutation.isDescriptive ||
    existing.isCompositional !== mutation.isCompositional ||
    existing.searchPriority !== mutation.searchPriority ||
    existing.icd10Code !== mutation.icd10Code ||
    existing.icd11Code !== mutation.icd11Code ||
    existing.category !== mutation.category ||
    existing.specialty !== mutation.specialty ||
    existing.notes !== mutation.notes
  );
}

async function ensureCanonicalAlias(
  prisma: any,
  diagnosisRegistryId: string,
  canonicalName: string,
  canonicalNormalized: string,
): Promise<void> {
  await prisma.diagnosisAlias.upsert({
    where: {
      diagnosisRegistryId_normalizedTerm: {
        diagnosisRegistryId,
        normalizedTerm: canonicalNormalized,
      },
    },
    update: {
      term: canonicalName,
      kind: DiagnosisAliasKind.CANONICAL,
      acceptedForMatch: true,
      rank: 0,
      source: 'seed_import_canonical',
      active: true,
    },
    create: {
      diagnosisRegistryId,
      term: canonicalName,
      normalizedTerm: canonicalNormalized,
      kind: DiagnosisAliasKind.CANONICAL,
      acceptedForMatch: true,
      rank: 0,
      source: 'seed_import_canonical',
      active: true,
    },
  });
}

async function importAliasesForRegistry(
  prisma: any,
  diagnosisRegistryId: string,
  canonicalNormalized: string,
  aliases: ImportedDiagnosisAliasRecord[],
): Promise<{
  createdAliases: number;
  skippedAliases: number;
  collisions: number;
  errors: string[];
}> {
  const summary = {
    createdAliases: 0,
    skippedAliases: 0,
    collisions: 0,
    errors: [] as string[],
  };
  const seenNormalizedTerms = new Set<string>();

  for (const aliasRecord of aliases) {
    const aliasTerm = sanitizeTerm(aliasRecord.alias);
    if (!aliasTerm) {
      summary.skippedAliases += 1;
      summary.errors.push('Skipped an empty alias');
      continue;
    }

    const normalizedTerm = normalizeDiagnosisTerm(aliasTerm);
    if (!normalizedTerm || normalizedTerm === canonicalNormalized) {
      summary.skippedAliases += 1;
      continue;
    }

    if (seenNormalizedTerms.has(normalizedTerm)) {
      summary.skippedAliases += 1;
      continue;
    }
    seenNormalizedTerms.add(normalizedTerm);

    const mutation = buildAliasMutationInput(aliasRecord, aliasTerm, normalizedTerm);
    const existingAlias = (await prisma.diagnosisAlias.findUnique({
      where: {
        diagnosisRegistryId_normalizedTerm: {
          diagnosisRegistryId,
          normalizedTerm,
        },
      },
      select: ALIAS_SELECT,
    })) as ExistingAliasRecord | null;

    if (mutation.acceptedForMatch) {
      const conflictingAlias = (await prisma.diagnosisAlias.findFirst({
        where: {
          diagnosisRegistryId: {
            not: diagnosisRegistryId,
          },
          normalizedTerm,
          active: true,
          acceptedForMatch: true,
        },
        select: ALIAS_SELECT,
      })) as ExistingAliasRecord | null;

      if (conflictingAlias) {
        summary.collisions += 1;
        summary.errors.push(
          `Accepted alias collision for "${aliasTerm}" (${normalizedTerm})`,
        );
        continue;
      }
    }

    if (!existingAlias) {
      await prisma.diagnosisAlias.create({
        data: {
          diagnosisRegistryId,
          ...mutation,
        },
      });
      summary.createdAliases += 1;
      continue;
    }

    if (!hasAliasChanges(existingAlias, mutation)) {
      summary.skippedAliases += 1;
      continue;
    }

    await prisma.diagnosisAlias.update({
      where: {
        id: existingAlias.id,
      },
      data: mutation,
    });
    summary.skippedAliases += 1;
  }

  return summary;
}

function buildAliasMutationInput(
  aliasRecord: ImportedDiagnosisAliasRecord,
  aliasTerm: string,
  normalizedTerm: string,
): AliasMutationInput {
  const kind =
    aliasRecord.kind ??
    (aliasRecord.isAcceptedForGameplay === false
      ? DiagnosisAliasKind.SEARCH_ONLY
      : DiagnosisAliasKind.ACCEPTED);
  const acceptedForMatch =
    kind === DiagnosisAliasKind.SEARCH_ONLY
      ? false
      : aliasRecord.isAcceptedForGameplay ?? true;

  return {
    term: aliasTerm,
    normalizedTerm,
    kind,
    acceptedForMatch,
    rank: getDefaultAliasRank(kind),
    source: acceptedForMatch ? 'seed_import' : 'seed_import_search_only',
    active: true,
  };
}

function getDefaultAliasRank(kind: DiagnosisAliasKind): number {
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

function hasAliasChanges(
  existing: ExistingAliasRecord,
  mutation: AliasMutationInput,
): boolean {
  return (
    existing.term !== mutation.term ||
    existing.kind !== mutation.kind ||
    existing.acceptedForMatch !== mutation.acceptedForMatch ||
    existing.rank !== mutation.rank ||
    existing.source !== mutation.source ||
    existing.active !== mutation.active
  );
}

function sanitizeTerm(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function resolveNullableString<T extends object>(
  source: T,
  key: keyof T,
  fallback: string | null,
): string | null {
  if (!Object.prototype.hasOwnProperty.call(source, key)) {
    return fallback;
  }

  const value = source[key];
  if (typeof value !== 'string') {
    return value == null ? null : fallback;
  }

  const normalized = sanitizeTerm(value);
  return normalized.length > 0 ? normalized : null;
}

function getImportErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unknown import error';
}
