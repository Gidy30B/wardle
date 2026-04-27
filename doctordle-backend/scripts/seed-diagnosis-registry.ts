import '../src/core/config/load-env.js';
import { PrismaClient } from '@prisma/client';
import { diagnosisRegistrySeedRecords } from '../src/modules/diagnosis-registry/data/diagnosis-registry.seed.js';
import { importDiagnosisRegistryRecords } from '../src/modules/diagnosis-registry/diagnosis-registry-import.service.js';

const prisma = new PrismaClient();

async function main() {
  const summary = await importDiagnosisRegistryRecords(
    prisma,
    diagnosisRegistrySeedRecords,
  );

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
