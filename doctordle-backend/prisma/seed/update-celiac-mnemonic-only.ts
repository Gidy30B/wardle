// prisma/seed/update-celiac-mnemonic-only.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const registry = await prisma.diagnosisRegistry.findUnique({
    where: { canonicalNormalized: 'celiac disease' },
    select: { id: true, displayLabel: true },
  });

  if (!registry) throw new Error('Celiac Disease registry not found');

  const existing = await prisma.diagnosisEducation.findUnique({
    where: { diagnosisRegistryId: registry.id },
    select: { id: true },
  });

  if (!existing) {
    throw new Error(`DiagnosisEducation not found for ${registry.displayLabel}`);
  }

  const education = await prisma.diagnosisEducation.update({
    where: { diagnosisRegistryId: registry.id },
    data: {
      scoringSystems: [
        {
          type: 'mnemonic',
          name: 'CELIAC',
          use: 'High-yield mnemonic for celiac disease features',
          components: [
            'C - Chronic diarrhoea / steatorrhoea',
            'E - Extra-intestinal features',
            'L - Low iron, folate, B12',
            'I - IgA tTG — the key serological test',
            'A - Autoimmune associations',
            'C - Complications',
          ],
        },
      ],
      version: { increment: 1 },
      reviewedAt: new Date(),
      publishedAt: new Date(),
    },
    select: { id: true, version: true, scoringSystems: true },
  });

  console.log('Updated celiac mnemonic only:', education);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });