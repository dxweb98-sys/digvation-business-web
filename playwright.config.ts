import { defineConfig } from '@playwright/test';

import { BACKOFFICE_URL, OPERATIONAL_URL } from './tooling/e2e/servers';

const preview = (filter: string, url: string) => ({
  command: `pnpm --filter ${filter} preview --host 127.0.0.1 --port ${new URL(url).port} --strictPort`,
  url,
  reuseExistingServer: !process.env.CI,
});

export default defineConfig({
  testDir: './tooling/e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: OPERATIONAL_URL,
    trace: 'retain-on-failure',
  },
  webServer: [
    preview('@digvation/business-operational-pos', OPERATIONAL_URL),
    preview('@digvation/business-backoffice', BACKOFFICE_URL),
  ],
});
