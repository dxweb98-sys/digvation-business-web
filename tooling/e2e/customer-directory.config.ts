import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'customer-directory.spec.ts',
  workers: 1,
  timeout: 60000,
  use: { trace: 'retain-on-failure', actionTimeout: 10000 },
  webServer: [
    {
      command: 'node node_modules/vite/bin/vite.js apps/operational --host 127.0.0.1 --port 5176',
      url: 'http://127.0.0.1:5176',
      reuseExistingServer: true,
      cwd: '../..',
    },
    {
      command: 'node node_modules/vite/bin/vite.js apps/backoffice --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: true,
      cwd: '../..',
    },
  ],
});
