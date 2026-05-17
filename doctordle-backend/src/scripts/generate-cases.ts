import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { CaseGeneratorService } from '../modules/case-generator/case-generator.service.js';
import type { GenerateBatchResult } from '../modules/case-generator/case-generator.types.js';

type CliOptions = {
  count: number;
  track?: string;
  bodySystem?: string;
  difficulty?: string;
  registryFirst?: boolean;
};

async function bootstrap(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  writeJsonLine({
    event: 'generate_cases.started',
    options,
  });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const generator = app.get(CaseGeneratorService);
    const result = await generator.generateBatch(options);
    writeJsonLine(buildGenerationSummary(options, result));
  } finally {
    await app.close();
  }
}

export function parseArgs(args: string[]): CliOptions {
  const parsed: CliOptions = {
    count: 20,
    registryFirst: true,
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

    if (arg.startsWith('--bodySystem=')) {
      parsed.bodySystem = arg.slice('--bodySystem='.length).trim() || undefined;
      continue;
    }

    if (arg.startsWith('--difficulty=')) {
      parsed.difficulty =
        arg.slice('--difficulty='.length).trim() || undefined;
      continue;
    }

    if (arg.startsWith('--body-system=')) {
      parsed.bodySystem =
        arg.slice('--body-system='.length).trim() || undefined;
      continue;
    }

    if (arg.startsWith('--registryFirst=')) {
      parsed.registryFirst = parseBooleanArg(
        arg.slice('--registryFirst='.length),
      );
      continue;
    }

    if (arg.startsWith('--registry-first=')) {
      parsed.registryFirst = parseBooleanArg(
        arg.slice('--registry-first='.length),
      );
      continue;
    }

    if (arg === '--registry-first') {
      parsed.registryFirst = true;
    }
  }

  return parsed;
}

export function buildGenerationSummary(
  options: CliOptions,
  result: GenerateBatchResult,
) {
  return {
    event: 'generate_cases.completed',
    requested: result.requested,
    created: result.created,
    failed: result.failed,
    skipped: result.skipped,
    registryFirst: options.registryFirst !== false,
    plannerDiagnostics: result.plannerDiagnostics,
    createdCases: result.results
      .filter((item) => item.status === 'created')
      .map((item) => ({
        id: item.caseId,
        title: item.answer,
      })),
    errors: result.results
      .filter((item) => item.status === 'failed')
      .map((item) => ({
        index: item.index,
        error: item.error,
      })),
    skippedCases: result.results
      .filter((item) => item.status === 'skipped')
      .map((item) => ({
        index: item.index,
        reason: item.reason,
        title: item.answer,
      })),
    results: result.results,
  };
}

function parseBooleanArg(value: string): boolean {
  return value.trim().toLowerCase() === 'true';
}

function writeJsonLine(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function isGenerateCasesCliInvocation(argv: string[]): boolean {
  const scriptPath = argv[1] ?? '';
  return /(^|[\\/])generate-cases\.ts$/.test(scriptPath);
}

if (isGenerateCasesCliInvocation(process.argv) && !process.env.JEST_WORKER_ID) {
  void bootstrap().catch((error: unknown) => {
    console.error(
      'Case generation failed',
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
