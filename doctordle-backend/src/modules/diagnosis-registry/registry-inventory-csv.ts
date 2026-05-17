import {
  DiagnosisAliasKind,
  DiagnosisRegistryStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import {
  DIAGNOSIS_AGE_GROUPS,
  DIAGNOSIS_CLINICAL_SETTINGS,
  DIAGNOSIS_DIFFICULTY_BANDS,
  DIAGNOSIS_RARITY_BANDS,
  DIAGNOSIS_URGENCY_LEVELS,
  type DiagnosisAgeGroupValue,
  type DiagnosisClinicalSettingValue,
  type DiagnosisDifficultyBandValue,
  type DiagnosisRarityBandValue,
  type DiagnosisUrgencyLevelValue,
} from './diagnosis-registry-taxonomy';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer';

type RegistryInventoryClient =
  | PrismaService
  | Prisma.TransactionClient
  | PrismaClient;

type RegistryInventoryMode = 'dry-run' | 'apply';

type ParsedInventoryRow = {
  rowNumber: number;
  displayLabel: string;
  canonicalName: string;
  specialty: string;
  subspecialty: string | null;
  bodySystem: string;
  organSystem: string | null;
  category: string | null;
  aliases: string[];
  difficultyBand: DiagnosisDifficultyBandValue | null;
  rarityBand: DiagnosisRarityBandValue | null;
  clinicalSetting: DiagnosisClinicalSettingValue | null;
  ageGroup: DiagnosisAgeGroupValue | null;
  urgencyLevel: DiagnosisUrgencyLevelValue | null;
  isPlayable: boolean | null;
  isGeneratable: boolean | null;
  searchPriority: number | null;
  isDescriptive: boolean | null;
  isCompositional: boolean | null;
  notes: string | null;
  canonicalNormalized: string;
};

type ExistingRegistryRow = {
  id: string;
  canonicalName: string;
  displayLabel: string;
  specialty: string | null;
  subspecialty: string | null;
  bodySystem: string | null;
  organSystem: string | null;
  category: string | null;
  difficultyBand: DiagnosisDifficultyBandValue | null;
  rarityBand: DiagnosisRarityBandValue | null;
  clinicalSetting: DiagnosisClinicalSettingValue | null;
  ageGroup: DiagnosisAgeGroupValue | null;
  urgencyLevel: DiagnosisUrgencyLevelValue | null;
  isPlayable: boolean;
  isGeneratable: boolean;
  searchPriority: number;
  isDescriptive: boolean;
  isCompositional: boolean;
  notes: string | null;
};

type ExistingAliasRow = {
  id: string;
  diagnosisRegistryId: string;
  normalizedTerm: string;
  term: string;
  kind: DiagnosisAliasKind;
  acceptedForMatch: boolean;
  active: boolean;
};

export type RegistryInventoryImportIssue = {
  rowNumber?: number;
  canonicalName?: string;
  reason: string;
};

export type RegistryInventoryImportSummary = {
  mode: RegistryInventoryMode;
  totalRows: number;
  validRows: number;
  created: number;
  updated: number;
  skipped: number;
  aliasesCreated: number;
  aliasesUpdated: number;
  duplicateAliases: number;
  invalidRows: RegistryInventoryImportIssue[];
  duplicateCanonicalNames: RegistryInventoryImportIssue[];
};

export type RegistryInventoryImportOptions = {
  mode?: RegistryInventoryMode;
};

const REQUIRED_HEADERS = [
  'displayLabel',
  'canonicalName',
  'specialty',
  'subspecialty',
  'bodySystem',
  'organSystem',
  'category',
  'aliases',
  'difficultyBand',
  'rarityBand',
  'clinicalSetting',
  'ageGroup',
  'urgencyLevel',
  'isPlayable',
  'isGeneratable',
  'searchPriority',
  'isDescriptive',
  'isCompositional',
  'notes',
] as const;

const REGISTRY_SELECT = {
  id: true,
  canonicalName: true,
  displayLabel: true,
  specialty: true,
  subspecialty: true,
  bodySystem: true,
  organSystem: true,
  category: true,
  difficultyBand: true,
  rarityBand: true,
  clinicalSetting: true,
  ageGroup: true,
  urgencyLevel: true,
  isPlayable: true,
  isGeneratable: true,
  searchPriority: true,
  isDescriptive: true,
  isCompositional: true,
  notes: true,
} as const;

const ALIAS_SELECT = {
  id: true,
  diagnosisRegistryId: true,
  normalizedTerm: true,
  term: true,
  kind: true,
  acceptedForMatch: true,
  active: true,
} as const;

export async function importDiagnosisRegistryCsv(
  client: RegistryInventoryClient,
  csvContent: string,
  options: RegistryInventoryImportOptions = {},
): Promise<RegistryInventoryImportSummary> {
  const mode = options.mode ?? 'dry-run';
  const parsed = parseRegistryInventoryCsv(csvContent);
  const summary: RegistryInventoryImportSummary = {
    mode,
    totalRows: parsed.totalRows,
    validRows: parsed.rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    aliasesCreated: 0,
    aliasesUpdated: 0,
    duplicateAliases: 0,
    invalidRows: [...parsed.invalidRows],
    duplicateCanonicalNames: [...parsed.duplicateCanonicalNames],
  };

  if (summary.invalidRows.length || summary.duplicateCanonicalNames.length) {
    return summary;
  }

  for (const row of parsed.rows) {
    const result = await importInventoryRow(client, row, mode);
    if (result.created) {
      summary.created += 1;
    } else if (result.updated) {
      summary.updated += 1;
    } else {
      summary.skipped += 1;
    }

    summary.aliasesCreated += result.aliasesCreated;
    summary.aliasesUpdated += result.aliasesUpdated;
    summary.duplicateAliases += result.duplicateAliases;
  }

  return summary;
}

function parseRegistryInventoryCsv(csvContent: string): {
  totalRows: number;
  rows: ParsedInventoryRow[];
  invalidRows: RegistryInventoryImportIssue[];
  duplicateCanonicalNames: RegistryInventoryImportIssue[];
} {
  const records = parseCsvRecords(csvContent);
  if (!records.length) {
    return {
      totalRows: 0,
      rows: [],
      invalidRows: [{ reason: 'CSV is empty' }],
      duplicateCanonicalNames: [],
    };
  }

  const headers = records[0].map((header) => header.trim());
  const invalidRows: RegistryInventoryImportIssue[] = [];
  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missingHeaders.length) {
    invalidRows.push({
      reason: `Missing required headers: ${missingHeaders.join(', ')}`,
    });
  }

  const headerIndexes = Object.fromEntries(
    headers.map((header, index) => [header, index]),
  );
  const rows: ParsedInventoryRow[] = [];
  const seenCanonicalNames = new Map<string, number>();
  const duplicateCanonicalNames: RegistryInventoryImportIssue[] = [];

  for (const [recordIndex, record] of records.slice(1).entries()) {
    const rowNumber = recordIndex + 2;
    if (record.every((value) => normalizeOptionalString(value) === null)) {
      continue;
    }

    const row = Object.fromEntries(
      REQUIRED_HEADERS.map((header) => [
        header,
        record[headerIndexes[header]] ?? '',
      ]),
    ) as Record<(typeof REQUIRED_HEADERS)[number], string>;
    const parsedRow = parseInventoryRow(row, rowNumber);

    if ('reason' in parsedRow) {
      invalidRows.push(parsedRow);
      continue;
    }

    const previousRowNumber = seenCanonicalNames.get(
      parsedRow.canonicalNormalized,
    );
    if (previousRowNumber) {
      duplicateCanonicalNames.push({
        rowNumber,
        canonicalName: parsedRow.canonicalName,
        reason: `Duplicate canonicalName also appears on row ${previousRowNumber}`,
      });
      continue;
    }

    seenCanonicalNames.set(parsedRow.canonicalNormalized, rowNumber);
    rows.push(parsedRow);
  }

  return {
    totalRows: records.length - 1,
    rows,
    invalidRows,
    duplicateCanonicalNames,
  };
}

function parseInventoryRow(
  row: Record<(typeof REQUIRED_HEADERS)[number], string>,
  rowNumber: number,
): ParsedInventoryRow | RegistryInventoryImportIssue {
  const displayLabel = normalizeOptionalString(row.displayLabel);
  const canonicalName = normalizeOptionalString(row.canonicalName);
  const specialty = normalizeOptionalString(row.specialty);
  const bodySystem = normalizeOptionalString(row.bodySystem);

  if (!displayLabel) {
    return { rowNumber, reason: 'displayLabel is required' };
  }

  if (!canonicalName) {
    return { rowNumber, reason: 'canonicalName is required' };
  }

  if (!specialty) {
    return { rowNumber, canonicalName, reason: 'specialty is required' };
  }

  if (!bodySystem) {
    return { rowNumber, canonicalName, reason: 'bodySystem is required' };
  }

  const canonicalNormalized = normalizeDiagnosisTerm(canonicalName);
  if (!canonicalNormalized) {
    return {
      rowNumber,
      canonicalName,
      reason: 'canonicalName must normalize to a non-empty identifier',
    };
  }

  const difficultyBand = parseOptionalEnum(
    row.difficultyBand,
    DIAGNOSIS_DIFFICULTY_BANDS,
    'difficultyBand',
    rowNumber,
    canonicalName,
  );
  if (isImportIssue(difficultyBand)) return difficultyBand;

  const rarityBand = parseOptionalEnum(
    row.rarityBand,
    DIAGNOSIS_RARITY_BANDS,
    'rarityBand',
    rowNumber,
    canonicalName,
  );
  if (isImportIssue(rarityBand)) return rarityBand;

  const clinicalSetting = parseOptionalEnum(
    row.clinicalSetting,
    DIAGNOSIS_CLINICAL_SETTINGS,
    'clinicalSetting',
    rowNumber,
    canonicalName,
  );
  if (isImportIssue(clinicalSetting)) return clinicalSetting;

  const ageGroup = parseOptionalEnum(
    row.ageGroup,
    DIAGNOSIS_AGE_GROUPS,
    'ageGroup',
    rowNumber,
    canonicalName,
  );
  if (isImportIssue(ageGroup)) return ageGroup;

  const urgencyLevel = parseOptionalEnum(
    row.urgencyLevel,
    DIAGNOSIS_URGENCY_LEVELS,
    'urgencyLevel',
    rowNumber,
    canonicalName,
  );
  if (isImportIssue(urgencyLevel)) return urgencyLevel;

  const isPlayable = parseOptionalBoolean(
    row.isPlayable,
    'isPlayable',
    rowNumber,
    canonicalName,
  );
  if (isImportIssue(isPlayable)) return isPlayable;

  const isGeneratable = parseOptionalBoolean(
    row.isGeneratable,
    'isGeneratable',
    rowNumber,
    canonicalName,
  );
  if (isImportIssue(isGeneratable)) return isGeneratable;

  const isDescriptive = parseOptionalBoolean(
    row.isDescriptive,
    'isDescriptive',
    rowNumber,
    canonicalName,
  );
  if (isImportIssue(isDescriptive)) return isDescriptive;

  const isCompositional = parseOptionalBoolean(
    row.isCompositional,
    'isCompositional',
    rowNumber,
    canonicalName,
  );
  if (isImportIssue(isCompositional)) return isCompositional;

  const searchPriority = parseOptionalInteger(
    row.searchPriority,
    'searchPriority',
    rowNumber,
    canonicalName,
  );
  if (isImportIssue(searchPriority)) return searchPriority;

  return {
    rowNumber,
    displayLabel,
    canonicalName,
    specialty,
    subspecialty: normalizeOptionalString(row.subspecialty),
    bodySystem,
    organSystem: normalizeOptionalString(row.organSystem),
    category: normalizeOptionalString(row.category),
    aliases: parseAliases(row.aliases),
    difficultyBand,
    rarityBand,
    clinicalSetting,
    ageGroup,
    urgencyLevel,
    isPlayable,
    isGeneratable,
    searchPriority,
    isDescriptive,
    isCompositional,
    notes: normalizeOptionalString(row.notes),
    canonicalNormalized,
  };
}

async function importInventoryRow(
  client: RegistryInventoryClient,
  row: ParsedInventoryRow,
  mode: RegistryInventoryMode,
): Promise<{
  created: boolean;
  updated: boolean;
  aliasesCreated: number;
  aliasesUpdated: number;
  duplicateAliases: number;
}> {
  const prisma = client as any;
  const existing = (await prisma.diagnosisRegistry.findUnique({
    where: { canonicalNormalized: row.canonicalNormalized },
    select: REGISTRY_SELECT,
  })) as ExistingRegistryRow | null;
  const mutation = buildRegistryMutation(row, existing);
  const hasChanges = existing ? hasRegistryChanges(existing, mutation) : true;
  const registryId =
    existing?.id ??
    (mode === 'apply'
      ? (
          (await prisma.diagnosisRegistry.create({
            data: mutation,
            select: { id: true },
          })) as { id: string }
        ).id
      : `dry-run:${row.canonicalNormalized}`);

  if (mode === 'apply' && existing && hasChanges) {
    await prisma.diagnosisRegistry.update({
      where: { id: existing.id },
      data: mutation,
      select: { id: true },
    });
  }

  const aliasResult = await importInventoryAliases(
    prisma,
    registryId,
    row,
    mode,
  );

  return {
    created: existing === null,
    updated: existing !== null && hasChanges,
    aliasesCreated: aliasResult.aliasesCreated,
    aliasesUpdated: aliasResult.aliasesUpdated,
    duplicateAliases: aliasResult.duplicateAliases,
  };
}

function buildRegistryMutation(
  row: ParsedInventoryRow,
  existing: ExistingRegistryRow | null,
) {
  return {
    canonicalName: row.canonicalName,
    canonicalNormalized: row.canonicalNormalized,
    displayLabel: row.displayLabel,
    status: DiagnosisRegistryStatus.ACTIVE,
    active: true,
    specialty: row.specialty,
    subspecialty: resolveCsvValue(row.subspecialty, existing?.subspecialty),
    bodySystem: row.bodySystem,
    organSystem: resolveCsvValue(row.organSystem, existing?.organSystem),
    category: resolveCsvValue(row.category, existing?.category),
    difficultyBand: resolveCsvValue(
      row.difficultyBand,
      existing?.difficultyBand,
    ),
    rarityBand: resolveCsvValue(row.rarityBand, existing?.rarityBand),
    clinicalSetting: resolveCsvValue(
      row.clinicalSetting,
      existing?.clinicalSetting,
    ),
    ageGroup: resolveCsvValue(row.ageGroup, existing?.ageGroup),
    urgencyLevel: resolveCsvValue(row.urgencyLevel, existing?.urgencyLevel),
    isPlayable: resolveCsvValue(row.isPlayable, existing?.isPlayable) ?? true,
    isGeneratable:
      resolveCsvValue(row.isGeneratable, existing?.isGeneratable) ?? true,
    searchPriority:
      resolveCsvValue(row.searchPriority, existing?.searchPriority) ?? 0,
    isDescriptive:
      resolveCsvValue(row.isDescriptive, existing?.isDescriptive) ?? false,
    isCompositional:
      resolveCsvValue(row.isCompositional, existing?.isCompositional) ?? false,
    notes: resolveCsvValue(row.notes, existing?.notes),
  };
}

async function importInventoryAliases(
  prisma: any,
  diagnosisRegistryId: string,
  row: ParsedInventoryRow,
  mode: RegistryInventoryMode,
): Promise<{
  aliasesCreated: number;
  aliasesUpdated: number;
  duplicateAliases: number;
}> {
  const summary = {
    aliasesCreated: 0,
    aliasesUpdated: 0,
    duplicateAliases: 0,
  };
  const seen = new Set<string>();

  for (const alias of row.aliases) {
    const normalizedTerm = normalizeDiagnosisTerm(alias);
    if (!normalizedTerm || normalizedTerm === row.canonicalNormalized) {
      summary.duplicateAliases += 1;
      continue;
    }

    if (seen.has(normalizedTerm)) {
      summary.duplicateAliases += 1;
      continue;
    }
    seen.add(normalizedTerm);

    const existingForRegistry = diagnosisRegistryId.startsWith('dry-run:')
      ? null
      : ((await prisma.diagnosisAlias.findUnique({
          where: {
            diagnosisRegistryId_normalizedTerm: {
              diagnosisRegistryId,
              normalizedTerm,
            },
          },
          select: ALIAS_SELECT,
        })) as ExistingAliasRow | null);
    const conflictingAcceptedAlias = (await prisma.diagnosisAlias.findFirst({
      where: {
        diagnosisRegistryId: {
          not: diagnosisRegistryId,
        },
        normalizedTerm,
        active: true,
        acceptedForMatch: true,
      },
      select: { id: true },
    })) as { id: string } | null;

    if (conflictingAcceptedAlias) {
      summary.duplicateAliases += 1;
      continue;
    }

    const mutation = {
      term: alias,
      normalizedTerm,
      kind: DiagnosisAliasKind.ACCEPTED,
      acceptedForMatch: true,
      rank: 10,
      source: 'curated_csv',
      active: true,
    };

    if (!existingForRegistry) {
      summary.aliasesCreated += 1;
      if (mode === 'apply') {
        await prisma.diagnosisAlias.create({
          data: {
            diagnosisRegistryId,
            ...mutation,
          },
        });
      }
      continue;
    }

    if (hasAliasChanges(existingForRegistry, mutation)) {
      summary.aliasesUpdated += 1;
      if (mode === 'apply') {
        await prisma.diagnosisAlias.update({
          where: { id: existingForRegistry.id },
          data: mutation,
        });
      }
    } else {
      summary.duplicateAliases += 1;
    }
  }

  return summary;
}

function parseCsvRecords(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((row) =>
    row.some((field) => normalizeOptionalString(field) !== null),
  );
}

function parseOptionalEnum<T extends readonly string[]>(
  value: string,
  allowedValues: T,
  fieldName: string,
  rowNumber: number,
  canonicalName: string,
): T[number] | null | RegistryInventoryImportIssue {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }

  const upper = normalized.toUpperCase();
  if (!(allowedValues as readonly string[]).includes(upper)) {
    return {
      rowNumber,
      canonicalName,
      reason: `${fieldName} has invalid value "${normalized}"`,
    };
  }

  return upper as T[number];
}

function parseOptionalBoolean(
  value: string,
  fieldName: string,
  rowNumber: number,
  canonicalName: string,
): boolean | null | RegistryInventoryImportIssue {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return {
    rowNumber,
    canonicalName,
    reason: `${fieldName} must be true or false`,
  };
}

function parseOptionalInteger(
  value: string,
  fieldName: string,
  rowNumber: number,
  canonicalName: string,
): number | null | RegistryInventoryImportIssue {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) {
    return {
      rowNumber,
      canonicalName,
      reason: `${fieldName} must be an integer`,
    };
  }

  return parsed;
}

function parseAliases(value: string): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];

  for (const alias of value.split(';')) {
    const normalized = normalizeOptionalString(alias);
    if (!normalized) continue;

    const normalizedTerm = normalizeDiagnosisTerm(normalized);
    if (!normalizedTerm || seen.has(normalizedTerm)) continue;

    seen.add(normalizedTerm);
    aliases.push(normalized);
  }

  return aliases;
}

function hasRegistryChanges(
  existing: ExistingRegistryRow,
  mutation: ReturnType<typeof buildRegistryMutation>,
): boolean {
  return (
    existing.canonicalName !== mutation.canonicalName ||
    existing.displayLabel !== mutation.displayLabel ||
    existing.specialty !== mutation.specialty ||
    existing.subspecialty !== mutation.subspecialty ||
    existing.bodySystem !== mutation.bodySystem ||
    existing.organSystem !== mutation.organSystem ||
    existing.category !== mutation.category ||
    existing.difficultyBand !== mutation.difficultyBand ||
    existing.rarityBand !== mutation.rarityBand ||
    existing.clinicalSetting !== mutation.clinicalSetting ||
    existing.ageGroup !== mutation.ageGroup ||
    existing.urgencyLevel !== mutation.urgencyLevel ||
    existing.isPlayable !== mutation.isPlayable ||
    existing.isGeneratable !== mutation.isGeneratable ||
    existing.searchPriority !== mutation.searchPriority ||
    existing.isDescriptive !== mutation.isDescriptive ||
    existing.isCompositional !== mutation.isCompositional ||
    existing.notes !== mutation.notes
  );
}

function hasAliasChanges(
  existing: ExistingAliasRow,
  mutation: {
    term: string;
    kind: DiagnosisAliasKind;
    acceptedForMatch: boolean;
    active: boolean;
  },
): boolean {
  return (
    existing.term !== mutation.term ||
    existing.kind !== mutation.kind ||
    existing.acceptedForMatch !== mutation.acceptedForMatch ||
    existing.active !== mutation.active
  );
}

function resolveCsvValue<T>(csvValue: T | null, existingValue?: T | null) {
  return csvValue ?? existingValue ?? null;
}

function isImportIssue(
  value: unknown,
): value is RegistryInventoryImportIssue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'reason' in value &&
    typeof (value as { reason?: unknown }).reason === 'string'
  );
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}
