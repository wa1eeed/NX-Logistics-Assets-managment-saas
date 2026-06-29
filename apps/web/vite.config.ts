import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const apiProxyTarget = process.env.VITE_API_PROXY ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Consume the shared package's TS source so the bundler can statically
      // analyze its ESM exports (the CJS dist build is for the NestJS API).
      '@nx-lam/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  build: {
    // Emit hashed assets under /static (NOT /assets) so they don't collide with the
    // app's own "/assets" route — otherwise nginx 301-redirects the SPA route to the dir.
    assetsDir: 'static',
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
