import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './qa',
  timeout: 30_000,
  use: {
    baseURL: process.env.QA_DASHBOARD_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'edge',
      use: { ...devices['Desktop Chrome'], channel: 'msedge' },
    },
  ],
});
