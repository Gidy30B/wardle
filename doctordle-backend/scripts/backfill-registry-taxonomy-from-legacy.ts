import '../src/core/config/load-env';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type RegistryTaxonomyBackfillMode = 'dry-run' | 'apply';

type LegacySystemTaxonomy = {
  specialty?: string;
  subspecialty?: string;
  bodySystem?: string;
  category?: string;
};

type RegistryRow = {
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

const LEGACY_SYSTEM_MAPPINGS: Record<string, LegacySystemTaxonomy> = {
  cardiology: {
    specialty: 'Cardiology',
    bodySystem: 'Cardiovascular',
  },
  cardiovascular: {
    specialty: 'Cardiology',
    bodySystem: 'Cardiovascular',
  },
  endocrine: {
    specialty: 'Endocrinology',
    bodySystem: 'Endocrine',
    category: 'Metabolic',
  },
  endocrinology: {
    specialty: 'Endocrinology',
    bodySystem: 'Endocrine',
    category: 'Metabolic',
  },
  gastroenterology: {
    specialty: 'Gastroenterology',
    bodySystem: 'Gastrointestinal',
  },
  gastrointestinal: {
    specialty: 'Gastroenterology',
    bodySystem: 'Gastrointestinal',
  },
  gi: {
    specialty: 'Gastroenterology',
    bodySystem: 'Gastrointestinal',
  },
  hematology: {
    specialty: 'Hematology',
    bodySystem: 'Hematologic',
  },
  infectious: {
    specialty: 'Infectious Disease',
    bodySystem: 'Multisystem',
    category: 'Infectious',
  },
  'infectious disease': {
    specialty: 'Infectious Disease',
    bodySystem: 'Multisystem',
    category: 'Infectious',
  },
  nephrology: {
    specialty: 'Nephrology',
    bodySystem: 'Renal',
  },
  renal: {
    specialty: 'Nephrology',
    bodySystem: 'Renal',
  },
  neurology: {
    specialty: 'Neurology',
    bodySystem: 'Nervous System',
  },
  neuro: {
    specialty: 'Neurology',
    bodySystem: 'Nervous System',
  },
  obstetrics: {
    specialty: 'Obstetrics and Gynecology',
    bodySystem: 'Reproductive',
  },
  gynecology: {
    specialty: 'Obstetrics and Gynecology',
    bodySystem: 'Reproductive',
  },
  'obstetrics & gynecology': {
    specialty: 'Obstetrics and Gynecology',
    bodySystem: 'Reproductive',
  },
  obgyn: {
    specialty: 'Obstetrics and Gynecology',
    bodySystem: 'Reproductive',
  },
  'ob/gyn': {
    specialty: 'Obstetrics and Gynecology',
    bodySystem: 'Reproductive',
  },
  psychiatry: {
    specialty: 'Psychiatry',
    bodySystem: 'Behavioral Health',
  },
  pulmonology: {
    specialty: 'Pulmonology',
    bodySystem: 'Respiratory',
  },
  respiratory: {
    specialty: 'Pulmonology',
    bodySystem: 'Respiratory',
  },
  rheumatology: {
    specialty: 'Rheumatology',
    bodySystem: 'Musculoskeletal',
    category: 'Autoimmune',
  },
  surgery: {
    specialty: 'Surgery',
    bodySystem: 'Multisystem',
  },
  trauma: {
    specialty: 'Emergency Medicine',
    bodySystem: 'Multisystem',
    category: 'Trauma',
  },
  urology: {
    specialty: 'Urology',
    bodySystem: 'Genitourinary',
  },
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const mode = getMode();
  const summary = await backfillRegistryTaxonomyFromLegacy(mode);

  console.log(
    JSON.stringify(
      {
        ...summary,
        updatedRowCount: summary.updatedRows.length,
        skippedRowCount: summary.skippedRows.length,
      },
      null,
      2,
    ),
  );
}

function getMode(): RegistryTaxonomyBackfillMode {
  if (process.argv.includes('--apply')) {
    return 'apply';
  }

  return 'dry-run';
}

async function backfillRegistryTaxonomyFromLegacy(
  mode: RegistryTaxonomyBackfillMode,
) {
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
  })) as RegistryRow[];

  const updatedRows: unknown[] = [];
  const skippedRows: unknown[] = [];
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

function mapLegacySystemToRegistryTaxonomy(
  legacySystem: string | null | undefined,
) {
  const normalizedSystem = normalizeLegacySystem(legacySystem);
  if (!normalizedSystem) {
    return {
      mapped: false as const,
      legacySystem: normalizeOriginalSystem(legacySystem),
      normalizedSystem: null,
    };
  }

  const taxonomy = LEGACY_SYSTEM_MAPPINGS[normalizedSystem];
  if (!taxonomy) {
    return {
      mapped: false as const,
      legacySystem: normalizeOriginalSystem(legacySystem),
      normalizedSystem,
    };
  }

  return {
    mapped: true as const,
    legacySystem: normalizeOriginalSystem(legacySystem) ?? normalizedSystem,
    normalizedSystem,
    taxonomy,
  };
}

function buildNullOnlyTaxonomyPatch(
  existing: RegistryRow,
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

function normalizeLegacySystem(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeOriginalSystem(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }

  return normalized
    .replace(/\band\b/g, '&')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeOriginalSystem(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
