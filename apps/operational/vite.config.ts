import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const compat = (file: string) => fileURLToPath(new URL(`./src/compat/${file}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@digvation/pos-api': compat('pos-api.ts'),
      '@digvation/pos-auth': compat('pos-auth.ts'),
      '@digvation/pos-money': compat('pos-money.ts'),
      '@digvation/pos-runtime': compat('pos-runtime.ts'),
      '@digvation-labs/ui': compat('digvation-labs-ui.ts'),
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    sourcemap: true,
  },
});
