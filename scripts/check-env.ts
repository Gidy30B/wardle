import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type EnvMap = Record<string, string>;

const REQUIRED_ENV_KEYS = [
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'DATABASE_URL',
  'REDIS_URL',
  'CLERK_JWT_ISSUER',
  'CLERK_JWT_AUDIENCE',
  'NODE_ENV',
  'LOG_LEVEL',
  'HOST',
  'PORT',
  'EMBEDDING_MODEL',
  'EVALUATOR_VERSION',
  'SCORE_WEIGHT_EXACT',
  'SCORE_WEIGHT_SYNONYM',
  'SCORE_WEIGHT_FUZZY',
  'SCORE_WEIGHT_EMBEDDING',
  'SCORE_WEIGHT_ONTOLOGY',
  'VITE_CLERK_PUBLISHABLE_KEY',
  'VITE_API_BASE_URL',
  'VITE_CLERK_JWT_AUDIENCE',
  'VITE_BACKEND_URL',
] as const;

const FORBIDDEN_FRONTEND_LEAK_PATTERNS = [
  /VITE_.*SECRET/i,
  /VITE_.*OPENAI/i,
  /VITE_.*DATABASE/i,
  /VITE_.*REDIS/i,
] as const;

function parseEnvFile(filePath: string): { env: EnvMap; duplicates: string[] } {
  const env: EnvMap = {};
  const duplicates: string[] = [];
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    if (key in env) {
      duplicates.push(key);
    }
    env[key] = value;
  }

  return { env, duplicates };
}

function assertFileExists(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function main(): void {
  const root = process.cwd();
  const envPath = resolve(root, '.env');
  const envExamplePath = resolve(root, '.env.example');

  assertFileExists(envPath);
  assertFileExists(envExamplePath);

  const { env, duplicates: envDuplicates } = parseEnvFile(envPath);
  const { env: envExample, duplicates: envExampleDuplicates } = parseEnvFile(envExamplePath);

  const errors: string[] = [];

  for (const key of REQUIRED_ENV_KEYS) {
    const value = env[key];
    if (value === undefined) {
      errors.push(`Missing ${key} in .env`);
      continue;
    }
    if (value.trim() === '') {
      errors.push(`Empty ${key} in .env`);
    }

    if (!(key in envExample)) {
      errors.push(`Missing ${key} in .env.example`);
    }
  }

  if (env.CLERK_JWT_AUDIENCE !== env.VITE_CLERK_JWT_AUDIENCE) {
    errors.push(
      'Clerk audience mismatch: CLERK_JWT_AUDIENCE must exactly match VITE_CLERK_JWT_AUDIENCE',
    );
  }

  const nextPublicKeys = Object.keys(env).filter((key) => key.startsWith('NEXT_PUBLIC_'));
  if (nextPublicKeys.length > 0) {
    errors.push(`Unsupported NEXT_PUBLIC_ variables in .env: ${nextPublicKeys.join(', ')}`);
  }

  const leakedFrontendKeys = Object.keys(env).filter((key) =>
    FORBIDDEN_FRONTEND_LEAK_PATTERNS.some((pattern) => pattern.test(key)),
  );
  if (leakedFrontendKeys.length > 0) {
    errors.push(`Potential secret leakage via VITE_ keys: ${leakedFrontendKeys.join(', ')}`);
  }

  if (envDuplicates.length > 0) {
    errors.push(`Duplicate keys in .env: ${Array.from(new Set(envDuplicates)).join(', ')}`);
  }

  if (envExampleDuplicates.length > 0) {
    errors.push(
      `Duplicate keys in .env.example: ${Array.from(new Set(envExampleDuplicates)).join(', ')}`,
    );
  }

  if (errors.length > 0) {
    const message = `\nEnvironment validation failed:\n- ${errors.join('\n- ')}\n`;
    throw new Error(message);
  }

  console.log('Environment validation passed.');
}

main();
