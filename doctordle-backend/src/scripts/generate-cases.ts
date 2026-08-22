import { NestFactory } from '@nestjs/core';
import { CaseGeneratorService } from '../modules/case-generator/case-generator.service.js';
import type { GenerateBatchResult } from '../modules/case-generator/case-generator.types.js';

type CliOptions = {
  count: number;
  track?: string;
  bodySystem?: string;
  difficulty?: string;
};

async function bootstrap(): Promise<void> {
  const { AppModule } = await import('../app.module.js');
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
      rejectRetiredRegistryFirstFalse(arg.slice('--registryFirst='.length));
      continue;
    }

    if (arg.startsWith('--registry-first=')) {
      rejectRetiredRegistryFirstFalse(arg.slice('--registry-first='.length));
      continue;
    }

    if (arg === '--registry-first') {
      continue;
    }
  }

  return parsed;
}

export function buildGenerationSummary(
  _options: CliOptions,
  result: GenerateBatchResult,
) {
  return {
    event: 'generate_cases.completed',
    requested: result.requested,
    created: result.created,
    draftCreated: result.draftCreated,
    failed: result.failed,
    skipped: result.skipped,
    generationMode: 'registry_target',
    plannerDiagnostics: result.plannerDiagnostics,
    createdDrafts: result.results
      .filter((item) => item.status === 'draft_created')
      .map((item) => ({
        id: item.draftId,
        title: item.answer,
        reviewStatus: item.reviewStatus,
        validationStatus: item.validationStatus,
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

function rejectRetiredRegistryFirstFalse(value: string): void {
  if (value.trim().toLowerCase() === 'false') {
    throw new Error(
      '--registry-first=false is no longer supported; case generation is always registry-targeted',
    );
  }
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
