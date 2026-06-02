import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaService } from '../src/core/db/prisma.service';
import { DifferentialLinkService } from '../src/modules/diagnosis-graph/differential-link.service';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prismaClient = new PrismaClient({ adapter });
  const prisma = prismaClient as unknown as PrismaService;
  const service = new DifferentialLinkService(prisma);

  try {
    const result = await service.backfill();
    console.log(
      JSON.stringify(
        {
          event: 'differential_links.backfill.completed',
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
      event: 'differential_links.backfill.failed',
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
