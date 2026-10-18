import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Vite serves only `/member/` under a base path; make the canonical `/member` entry work too (nginx does natively).
const canonicalMemberEntry: Plugin = {
  name: 'canonical-member-entry',
  configureServer: (server) => {
    server.middlewares.use((request, response, next) => {
      if (request.url !== '/member') return next();
      response.writeHead(302, { location: '/member/' });
      response.end();
    });
  },
  configurePreviewServer: (server) => {
    server.middlewares.use((request, response, next) => {
      if (request.url !== '/member') return next();
      response.writeHead(302, { location: '/member/' });
      response.end();
    });
  },
};

// The customer-facing entry is the generic Business route `/member`; there is no member-specific path.
export default defineConfig({
  base: '/member/',
  plugins: [react(), canonicalMemberEntry],
  server: {
    // 127.0.0.1 keeps the portal same-site with the local Runtime (127.0.0.1:4003) so the session cookie is sent.
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4175,
    strictPort: true,
  },
});
