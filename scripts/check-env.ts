import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type EnvMap = Record<string, string>;

const ROOT_REQUIRED_ENV_KEYS = [
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'VITE_CLERK_PUBLISHABLE_KEY',
  'VITE_API_BASE_URL',
  'VITE_CLERK_JWT_AUDIENCE',
  'VITE_BACKEND_URL',
] as const;

const BACKEND_REQUIRED_ENV_KEYS = [
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
  'OPENAI_API_KEY',
  'INTERNAL_API_KEY',
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
  const backendDir = resolve(root, 'doctordle-backend');
  const backendEnvPath = resolve(backendDir, '.env');
  const backendEnvExamplePath = resolve(backendDir, '.env.example');

  assertFileExists(envPath);
  assertFileExists(envExamplePath);
  assertFileExists(backendEnvPath);
  assertFileExists(backendEnvExamplePath);

  const { env: rootEnv, duplicates: rootEnvDuplicates } = parseEnvFile(envPath);
  const { env: rootEnvExample, duplicates: rootEnvExampleDuplicates } =
    parseEnvFile(envExamplePath);
  const { env: backendEnv, duplicates: backendEnvDuplicates } =
    parseEnvFile(backendEnvPath);
  const { env: backendEnvExample, duplicates: backendEnvExampleDuplicates } =
    parseEnvFile(backendEnvExamplePath);

  const errors: string[] = [];

  for (const key of ROOT_REQUIRED_ENV_KEYS) {
    const value = rootEnv[key];
    if (value === undefined) {
      errors.push(`Missing ${key} in root .env`);
      continue;
    }
    if (value.trim() === '') {
      errors.push(`Empty ${key} in root .env`);
    }

    if (!(key in rootEnvExample)) {
      errors.push(`Missing ${key} in root .env.example`);
    }
  }

  for (const key of BACKEND_REQUIRED_ENV_KEYS) {
    const value = backendEnv[key];
    if (value === undefined) {
      errors.push(`Missing ${key} in doctordle-backend/.env`);
      continue;
    }
    if (value.trim() === '') {
      errors.push(`Empty ${key} in doctordle-backend/.env`);
    }

    if (!(key in backendEnvExample)) {
      errors.push(`Missing ${key} in doctordle-backend/.env.example`);
    }
  }

  if (backendEnv.CLERK_JWT_AUDIENCE !== rootEnv.VITE_CLERK_JWT_AUDIENCE) {
    errors.push(
      'Clerk audience mismatch: doctordle-backend/.env CLERK_JWT_AUDIENCE must exactly match root .env VITE_CLERK_JWT_AUDIENCE',
    );
  }

  const nextPublicKeys = Object.keys(rootEnv).filter((key) => key.startsWith('NEXT_PUBLIC_'));
  if (nextPublicKeys.length > 0) {
    errors.push(
      `Unsupported NEXT_PUBLIC_ variables in root .env: ${nextPublicKeys.join(', ')}`,
    );
  }

  const leakedFrontendKeys = Object.keys(rootEnv).filter((key) =>
    FORBIDDEN_FRONTEND_LEAK_PATTERNS.some((pattern) => pattern.test(key)),
  );
  if (leakedFrontendKeys.length > 0) {
    errors.push(
      `Potential secret leakage via root VITE_ keys: ${leakedFrontendKeys.join(', ')}`,
    );
  }

  if (rootEnvDuplicates.length > 0) {
    errors.push(
      `Duplicate keys in root .env: ${Array.from(new Set(rootEnvDuplicates)).join(', ')}`,
    );
  }

  if (rootEnvExampleDuplicates.length > 0) {
    errors.push(
      `Duplicate keys in root .env.example: ${Array.from(new Set(rootEnvExampleDuplicates)).join(', ')}`,
    );
  }

  if (backendEnvDuplicates.length > 0) {
    errors.push(
      `Duplicate keys in doctordle-backend/.env: ${Array.from(new Set(backendEnvDuplicates)).join(', ')}`,
    );
  }

  if (backendEnvExampleDuplicates.length > 0) {
    errors.push(
      `Duplicate keys in doctordle-backend/.env.example: ${Array.from(new Set(backendEnvExampleDuplicates)).join(', ')}`,
    );
  }

  if (errors.length > 0) {
    const message = `\nEnvironment validation failed:\n- ${errors.join('\n- ')}\n`;
    throw new Error(message);
  }

  console.log('Environment validation passed.');
}

main();
