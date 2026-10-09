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
    // 127.0.0.1 keeps Operational same-site with the local Runtime and the /member proxy below.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Local review only: the Member Portal stays its own Vite app (5175); production routing is nginx's job.
    proxy: {
      '^/member(/|$)': { target: 'http://127.0.0.1:5175', ws: true },
    },
    allowedHosts: ['precious-powerpoint-transmitted-flashing.trycloudflare.com'],
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    sourcemap: true,
  },
});
