import '../core/config/load-env.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { SeedService } from '../core/db/seed.service.js';
import { CasesService } from '../modules/cases/cases.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const seedService = app.get(SeedService);
    const casesService = app.get(CasesService);
    await seedService.seedCases(casesService);
  } finally {
    await app.close();
  }
}

void bootstrap().catch((error: unknown) => {
  console.error(
    'Case seeding failed',
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exitCode = 1;
});
