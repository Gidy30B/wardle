import '../src/core/config/load-env.js';
import { PrismaClient } from '@prisma/client';
import { seedLegacyDiagnosisTeachingRules } from '../src/modules/education/diagnosis-teaching-rule-seed.service.js';

const prisma = new PrismaClient();

async function main() {
  const summary = await seedLegacyDiagnosisTeachingRules(prisma);
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
