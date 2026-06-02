import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaService } from '../src/core/db/prisma.service';
import { DifferentialMappingService } from '../src/modules/diagnosis-graph/differential-mapping.service';
import { DifferentialRegistryResolutionService } from '../src/modules/diagnosis-graph/differential-registry-resolution.service';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const includeEducationRevisions =
    process.argv.includes('--include-education-revisions');
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prismaClient = new PrismaClient({ adapter });
  const prisma = prismaClient as unknown as PrismaService;
  const resolver = new DifferentialRegistryResolutionService(prisma);
  const service = new DifferentialMappingService(prisma, resolver);

  try {
    const result = await service.backfill({ includeEducationRevisions });
    console.log(
      JSON.stringify(
        {
          event: 'differential_mappings.backfill.completed',
          includeEducationRevisions,
          result,
        },
        null,
        2,
      ),
    );
  } finally {
    await prismaClient.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      event: 'differential_mappings.backfill.failed',
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
