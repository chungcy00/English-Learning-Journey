import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function appUpdateServiceWorker(): Plugin {
  return {
    name: 'mine-english-app-update-service-worker',
    apply: 'build',
    generateBundle() {
      // A unique worker version on every Vercel build lets installed mobile and
      // tablet PWAs reliably detect that a new deployment is available.
      const appVersion = new Date().toISOString();
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const APP_VERSION = ${JSON.stringify(appVersion)};

self.addEventListener('install', () => {
  // Updates stay in the waiting state until the user taps "立即更新".
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'APP_VERSION', version: APP_VERSION });
  }
});
`,
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), appUpdateServiceWorker()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
