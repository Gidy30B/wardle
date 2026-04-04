import { PrismaClient } from '@prisma/client';
import { RedisCacheService } from '../src/core/cache/redis-cache.service.js';
import { MetricsService } from '../src/core/logger/metrics.service.js';
import { EmbeddingService } from '../src/infra/embedding/embedding.service.js';
import { normalize } from '../src/modules/diagnostics/pipeline/normalize.js';

type EmbeddingRow = {
  id: string;
  name: string;
  synonyms: Array<{ term: string }>;
};

const prisma = new PrismaClient();
const metricsService = new MetricsService();
const cacheService = new RedisCacheService();
const embeddingService = new EmbeddingService(cacheService, metricsService);

async function main(): Promise<void> {
  const diagnoses = await prisma.diagnosis.findMany({
    include: {
      synonyms: {
        select: { term: true },
      },
    },
  });

  for (const diagnosis of diagnoses as EmbeddingRow[]) {
    await prisma.$executeRawUnsafe(
      'DELETE FROM "DiagnosisEmbedding" WHERE "diagnosisId" = $1',
      diagnosis.id,
    );

    const payloads = dedupePayloads([
      { type: 'name' as const, text: diagnosis.name },
      ...diagnosis.synonyms.map((synonym) => ({
        type: 'synonym' as const,
        text: synonym.term,
      })),
    ]);

    for (const payload of payloads) {
      const embedding = await embeddingService.embed(payload.text);
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO "DiagnosisEmbedding" ("id", "diagnosisId", "vector", "type", "createdAt")
          VALUES (gen_random_uuid(), $1, $2::vector, $3, NOW())
        `,
        diagnosis.id,
        toVectorLiteral(embedding),
        payload.type,
      );
    }
  }

  console.info(`Embedded ${diagnoses.length} diagnoses`);
}

function dedupePayloads(
  payloads: Array<{ type: 'name' | 'synonym'; text: string }>,
): Array<{ type: 'name' | 'synonym'; text: string }> {
  const seen = new Set<string>();
  const deduped: Array<{ type: 'name' | 'synonym'; text: string }> = [];

  for (const payload of payloads) {
    const normalized = normalize(payload.text);
    const key = `${payload.type}:${normalized}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push({
      type: payload.type,
      text: normalized,
    });
  }

  return deduped;
}

function toVectorLiteral(values: number[]): string {
  return `[${values.map((value) => Number(value).toFixed(10)).join(',')}]`;
}

main()
  .catch((error: unknown) => {
    console.error('Embedding ingestion failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await cacheService.onModuleDestroy();
  });
