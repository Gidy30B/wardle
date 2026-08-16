import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * REPAIR - Acute Cystitis specialty metadata
 *
 * Metadata-only correction for the already-seeded Acute Cystitis diagnosis
 * registry. This does not create or modify cases, revisions, education,
 * aliases, lifecycle state, playable flags, or DailyCase scheduling.
 *
 * Run:
 *   npx tsx prisma/repair/repair-acute-cystitis-specialty.ts
 *
 * Railway:
 *   railway run npx tsx prisma/repair/repair-acute-cystitis-specialty.ts
 */

const databaseUrl = resolvePgConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run the Acute Cystitis specialty repair.',
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 20_000,
  allowExitOnIdle: true,
  ssl:
    databaseUrl.includes('railway') ||
    databaseUrl.includes('proxy.rlwy.net') ||
    databaseUrl.includes('postgres.railway.internal')
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on('error', (error) => {
  console.error('[pg-pool] idle client error:', error);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const canonicalNormalized = 'acute cystitis';
const targetMetadata = {
  specialty: 'Infectious Disease',
  subspecialty: 'Urology',
  category: 'Lower Urinary Tract Infection',
  bodySystem: 'Genitourinary',
  organSystem: 'Urinary Bladder',
} as const;

function resolvePgConnectionString(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('prisma+postgres://')) return value;

  const parsed = new URL(value);
  const apiKey = parsed.searchParams.get('api_key');

  if (!apiKey) {
    throw new Error(
      'DATABASE_URL uses prisma+postgres:// but is missing api_key.',
    );
  }

  const payload = JSON.parse(
    Buffer.from(apiKey, 'base64url').toString('utf8'),
  ) as { databaseUrl?: unknown };

  if (typeof payload.databaseUrl !== 'string' || !payload.databaseUrl) {
    throw new Error(
      'DATABASE_URL uses prisma+postgres:// but api_key does not contain a databaseUrl.',
    );
  }

  return payload.databaseUrl;
}

type RegistryRow = {
  id: string;
  canonicalName: string;
  canonicalNormalized: string;
  displayLabel: string;
  specialty: string | null;
  subspecialty: string | null;
  category: string | null;
  bodySystem: string | null;
  organSystem: string | null;
};

const registrySelect = {
  id: true,
  canonicalName: true,
  canonicalNormalized: true,
  displayLabel: true,
  specialty: true,
  subspecialty: true,
  category: true,
  bodySystem: true,
  organSystem: true,
} as const;

async function findTargetRegistry(): Promise<RegistryRow> {
  const exactMatches = await prisma.diagnosisRegistry.findMany({
    where: { canonicalNormalized },
    select: registrySelect,
  });

  if (exactMatches.length > 1) {
    throw new Error(
      `Refusing to repair Acute Cystitis: found ${exactMatches.length} exact canonical registry rows.`,
    );
  }

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  const aliasMatches = await prisma.diagnosisRegistry.findMany({
    where: {
      aliases: {
        some: {
          normalizedTerm: canonicalNormalized,
          active: true,
          acceptedForMatch: true,
        },
      },
    },
    select: registrySelect,
  });

  if (aliasMatches.length !== 1) {
    throw new Error(
      `Refusing to repair Acute Cystitis: expected one active accepted alias fallback row, found ${aliasMatches.length}.`,
    );
  }

  return aliasMatches[0];
}

function assertPersisted(row: RegistryRow) {
  for (const [key, value] of Object.entries(targetMetadata)) {
    if (row[key as keyof typeof targetMetadata] !== value) {
      throw new Error(
        `Acute Cystitis specialty repair did not persist ${key}: expected "${value}", found "${row[key as keyof typeof targetMetadata]}".`,
      );
    }
  }
}

async function repairAcuteCystitisSpecialty() {
  const registry = await findTargetRegistry();

  console.log('Acute Cystitis registry before specialty repair:', {
    registryId: registry.id,
    canonicalName: registry.canonicalName,
    currentSpecialty: registry.specialty,
    currentSubspecialty: registry.subspecialty,
  });

  const alreadyCorrect = Object.entries(targetMetadata).every(
    ([key, value]) => registry[key as keyof typeof targetMetadata] === value,
  );

  if (alreadyCorrect) {
    console.log(
      'Acute Cystitis specialty metadata already correct; skipping.',
      {
        registryId: registry.id,
        canonicalName: registry.canonicalName,
        specialty: registry.specialty,
        subspecialty: registry.subspecialty,
      },
    );
    return;
  }

  await prisma.diagnosisRegistry.update({
    where: { id: registry.id },
    data: targetMetadata,
    select: { id: true },
  });

  const repaired = await prisma.diagnosisRegistry.findUnique({
    where: { id: registry.id },
    select: registrySelect,
  });

  if (!repaired) {
    throw new Error(
      `Acute Cystitis registry ${registry.id} disappeared after metadata repair.`,
    );
  }

  assertPersisted(repaired);

  console.log('Repaired Acute Cystitis specialty metadata:', {
    registryId: repaired.id,
    canonicalName: repaired.canonicalName,
    specialty: repaired.specialty,
    subspecialty: repaired.subspecialty,
    category: repaired.category,
    bodySystem: repaired.bodySystem,
    organSystem: repaired.organSystem,
  });
}

repairAcuteCystitisSpecialty()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
