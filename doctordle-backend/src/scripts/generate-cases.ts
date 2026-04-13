import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { CaseGeneratorService } from '../modules/case-generator/case-generator.service.js';

type CliOptions = {
  count: number;
  track?: string;
  difficulty?: string;
};

async function bootstrap(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const generator = app.get(CaseGeneratorService);
    const result = await generator.generateBatch(options);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

function parseArgs(args: string[]): CliOptions {
  const parsed: CliOptions = {
    count: 20,
  };

  for (const arg of args) {
    if (arg.startsWith('--count=')) {
      const value = Number.parseInt(arg.slice('--count='.length), 10);
      if (Number.isFinite(value)) {
        parsed.count = value;
      }
      continue;
    }

    if (arg.startsWith('--track=')) {
      parsed.track = arg.slice('--track='.length).trim() || undefined;
      continue;
    }

    if (arg.startsWith('--difficulty=')) {
      parsed.difficulty =
        arg.slice('--difficulty='.length).trim() || undefined;
    }
  }

  return parsed;
}

void bootstrap().catch((error: unknown) => {
  console.error(
    'Case generation failed',
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exitCode = 1;
});
