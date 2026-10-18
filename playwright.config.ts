import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run db:migrate:test && npm run db:seed -- --test && npm run dev:api:test',
      url: 'http://127.0.0.1:8788/api/v1/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'npm run dev:web:test',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
