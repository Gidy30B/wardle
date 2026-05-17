import type { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../core/db/prisma.service.js';
import {
  mapLegacySystemToRegistryTaxonomy,
  type LegacySystemTaxonomy,
} from './legacy-system-mapper.js';

type TaxonomyBackfillClient = PrismaService | PrismaClient;

export type RegistryTaxonomyBackfillMode = 'dry-run' | 'apply';

export type RegistryTaxonomyBackfillRow = {
  id: string;
  displayLabel: string;
  specialty: string | null;
  subspecialty: string | null;
  bodySystem: string | null;
  category: string | null;
  legacyDiagnosis: {
    id: string;
    name: string;
    system: string | null;
  } | null;
};

export type RegistryTaxonomyBackfillUpdate = {
  registryId: string;
  displayLabel: string;
  legacyDiagnosisId: string;
  legacyDiagnosisName: string;
  legacySystem: string;
  data: LegacySystemTaxonomy;
};

export type RegistryTaxonomyBackfillSkipped = {
  registryId: string;
  displayLabel: string;
  reason:
    | 'missing_legacy_diagnosis'
    | 'missing_legacy_system'
    | 'unmapped_system'
    | 'metadata_complete';
  legacySystem: string | null;
  normalizedSystem: string | null;
};

export type RegistryTaxonomyBackfillSummary = {
  mode: RegistryTaxonomyBackfillMode;
  scannedRows: number;
  updatedRows: RegistryTaxonomyBackfillUpdate[];
  skippedRows: RegistryTaxonomyBackfillSkipped[];
  unmappedSystems: Array<{
    legacySystem: string;
    normalizedSystem: string;
    count: number;
  }>;
};

export async function backfillRegistryTaxonomyFromLegacy(
  client: TaxonomyBackfillClient,
  mode: RegistryTaxonomyBackfillMode = 'dry-run',
): Promise<RegistryTaxonomyBackfillSummary> {
  const prisma = client as any;
  const rows = (await prisma.diagnosisRegistry.findMany({
    where: {
      legacyDiagnosisId: {
        not: null,
      },
    },
    select: {
      id: true,
      displayLabel: true,
      specialty: true,
      subspecialty: true,
      bodySystem: true,
      category: true,
      legacyDiagnosis: {
        select: {
          id: true,
          name: true,
          system: true,
        },
      },
    },
    orderBy: {
      displayLabel: 'asc',
    },
  })) as RegistryTaxonomyBackfillRow[];

  const updatedRows: RegistryTaxonomyBackfillUpdate[] = [];
  const skippedRows: RegistryTaxonomyBackfillSkipped[] = [];
  const unmappedSystemCounts = new Map<
    string,
    { legacySystem: string; normalizedSystem: string; count: number }
  >();

  for (const row of rows) {
    if (!row.legacyDiagnosis) {
      skippedRows.push({
        registryId: row.id,
        displayLabel: row.displayLabel,
        reason: 'missing_legacy_diagnosis',
        legacySystem: null,
        normalizedSystem: null,
      });
      continue;
    }

    const mapping = mapLegacySystemToRegistryTaxonomy(
      row.legacyDiagnosis.system,
    );

    if (!mapping.mapped) {
      const reason = mapping.legacySystem
        ? 'unmapped_system'
        : 'missing_legacy_system';
      skippedRows.push({
        registryId: row.id,
        displayLabel: row.displayLabel,
        reason,
        legacySystem: mapping.legacySystem,
        normalizedSystem: mapping.normalizedSystem,
      });

      if (reason === 'unmapped_system' && mapping.normalizedSystem) {
        const existing = unmappedSystemCounts.get(mapping.normalizedSystem) ?? {
          legacySystem: mapping.legacySystem ?? mapping.normalizedSystem,
          normalizedSystem: mapping.normalizedSystem,
          count: 0,
        };
        existing.count += 1;
        unmappedSystemCounts.set(mapping.normalizedSystem, existing);
      }
      continue;
    }

    const data = buildNullOnlyTaxonomyPatch(row, mapping.taxonomy);
    if (Object.keys(data).length === 0) {
      skippedRows.push({
        registryId: row.id,
        displayLabel: row.displayLabel,
        reason: 'metadata_complete',
        legacySystem: mapping.legacySystem,
        normalizedSystem: mapping.normalizedSystem,
      });
      continue;
    }

    const update = {
      registryId: row.id,
      displayLabel: row.displayLabel,
      legacyDiagnosisId: row.legacyDiagnosis.id,
      legacyDiagnosisName: row.legacyDiagnosis.name,
      legacySystem: mapping.legacySystem,
      data,
    };
    updatedRows.push(update);

    if (mode === 'apply') {
      await prisma.diagnosisRegistry.update({
        where: {
          id: row.id,
        },
        data,
      });
    }
  }

  return {
    mode,
    scannedRows: rows.length,
    updatedRows,
    skippedRows,
    unmappedSystems: Array.from(unmappedSystemCounts.values()).sort((a, b) =>
      a.normalizedSystem.localeCompare(b.normalizedSystem),
    ),
  };
}

export function buildNullOnlyTaxonomyPatch(
  existing: {
    specialty?: string | null;
    subspecialty?: string | null;
    bodySystem?: string | null;
    category?: string | null;
  },
  taxonomy: LegacySystemTaxonomy,
): LegacySystemTaxonomy {
  const patch: LegacySystemTaxonomy = {};

  assignIfEmpty(patch, existing, taxonomy, 'specialty');
  assignIfEmpty(patch, existing, taxonomy, 'subspecialty');
  assignIfEmpty(patch, existing, taxonomy, 'bodySystem');
  assignIfEmpty(patch, existing, taxonomy, 'category');

  return patch;
}

function assignIfEmpty<K extends keyof LegacySystemTaxonomy>(
  patch: LegacySystemTaxonomy,
  existing: Partial<Record<K, string | null | undefined>>,
  taxonomy: LegacySystemTaxonomy,
  key: K,
): void {
  const value = taxonomy[key];
  if (!value || hasText(existing[key])) {
    return;
  }

  patch[key] = value;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
