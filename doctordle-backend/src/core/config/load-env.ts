import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnvFile } from 'dotenv';

const backendRoot = resolve(__dirname, '../../../');
const envFiles = [
  resolve(backendRoot, '.env.local'),
  resolve(backendRoot, '.env'),
];

let didLoadEnv = false;

export function loadBackendEnv(): void {
  if (didLoadEnv) {
    return;
  }

  for (const envFile of envFiles) {
    if (existsSync(envFile)) {
      loadEnvFile({ path: envFile });
    }
  }

  didLoadEnv = true;
}

loadBackendEnv();
