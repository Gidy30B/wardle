import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const backendDir = join(rootDir, 'doctordle-backend');
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? 'test',
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/doctordle_test',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379/15',
  CLERK_JWT_ISSUER:
    process.env.CLERK_JWT_ISSUER ?? 'https://clerk.test.local',
  CLERK_JWT_AUDIENCE: process.env.CLERK_JWT_AUDIENCE ?? 'doctordle-test',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'silent',
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  SCORE_WEIGHT_EXACT: process.env.SCORE_WEIGHT_EXACT ?? '1',
  SCORE_WEIGHT_SYNONYM: process.env.SCORE_WEIGHT_SYNONYM ?? '0.8',
  SCORE_WEIGHT_FUZZY: process.env.SCORE_WEIGHT_FUZZY ?? '0.6',
  SCORE_WEIGHT_EMBEDDING: process.env.SCORE_WEIGHT_EMBEDDING ?? '0.4',
  SCORE_WEIGHT_ONTOLOGY: process.env.SCORE_WEIGHT_ONTOLOGY ?? '0.2',
  EVALUATOR_VERSION: process.env.EVALUATOR_VERSION ?? 'test',
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env,
    stdio: 'inherit',
    shell: isWindows,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run('git', ['diff', '--check']);
run('git', ['diff', '--cached', '--check']);
run(npmCommand, ['exec', 'prisma', 'validate', '--', '--schema', 'prisma/schema.prisma'], {
  cwd: backendDir,
});
run(
  npmCommand,
  [
    'test',
    '--',
    '--runInBand',
    '--no-cache',
    'daily-cases.service.spec.ts',
    'session.service.spec.ts',
    'attempt.service.spec.ts',
    'case-review.service.spec.ts',
    'diagnosis-registry-lifecycle-policy.service.spec.ts',
    'diagnosis-education.service.spec.ts',
    'diagnosis-graph-candidates.service.spec.ts',
  ],
  { cwd: backendDir },
);
