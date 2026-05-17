import '../src/core/config/load-env';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { importDiagnosisRegistryCsv } from '../src/modules/diagnosis-registry/registry-inventory-csv';

const DEFAULT_CSV_PATH = 'docs/registry-inventory/top-100-diagnoses.csv';
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--apply') ? 'apply' : 'dry-run';
  const csvPathArg = args.find((arg) => arg.startsWith('--file='));
  const csvPath = resolve(csvPathArg?.slice('--file='.length) || DEFAULT_CSV_PATH);
  const csvContent = await readFile(csvPath, 'utf8');
  const summary = await importDiagnosisRegistryCsv(prisma, csvContent, {
    mode,
  });

  console.log(
    JSON.stringify(
      {
        event: 'diagnosis_registry_csv_import.completed',
        file: csvPath,
        ...summary,
      },
      null,
      2,
    ),
  );

  if (summary.invalidRows.length || summary.duplicateCanonicalNames.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
