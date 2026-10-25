import { defineConfig } from '@playwright/test';

import { BACKOFFICE_URL, OPERATIONAL_URL } from '../e2e/servers';

/**
 * Captures reference screenshots for the Figma redesign workflow (see docs/design/figma).
 * Kept apart from the e2e config so CI never runs it.
 */
const preview = (filter: string, url: string) => ({
  command: `pnpm --filter ${filter} preview --host 127.0.0.1 --port ${new URL(url).port} --strictPort`,
  url,
  reuseExistingServer: true,
});

export default defineConfig({
  testDir: '.',
  testMatch: 'capture-screens.spec.ts',
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  use: {
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    // Lets environments with a preinstalled Chromium skip `playwright install`.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined },
  },
  webServer: [
    preview('@digvation/business-operational-pos', OPERATIONAL_URL),
    preview('@digvation/business-backoffice', BACKOFFICE_URL),
  ],
});
