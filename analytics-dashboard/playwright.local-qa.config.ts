import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8080';
const skipWebServer =
  process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true' || process.env.CI === 'true';

export default defineConfig({
  testDir: './qa',
  globalSetup: './qa/global-setup.ts',
  timeout: 30_000,
  webServer: skipWebServer
    ? undefined
    : {
        command: 'docker compose -f ../docker-compose.yml up -d frontend',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'edge',
      use: { ...devices['Desktop Chrome'], channel: 'msedge' },
    },
  ],
});
