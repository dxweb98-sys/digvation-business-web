import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@digvation/pos-api': resolve(__dirname, 'apps/operational/src/compat/pos-api.ts'),
      '@digvation/pos-auth': resolve(__dirname, 'apps/operational/src/compat/pos-auth.ts'),
      '@digvation/pos-money': resolve(__dirname, 'apps/operational/src/compat/pos-money.ts'),
      '@digvation/pos-runtime': resolve(__dirname, 'apps/operational/src/compat/pos-runtime.ts'),
      '@digvation-labs/ui': resolve(__dirname, 'apps/operational/src/compat/digvation-labs-ui.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['packages/**/*.test.{ts,tsx}', 'apps/**/*.test.{ts,tsx}'],
    setupFiles: ['./tooling/testing/setup-tests.ts'],
  },
});
