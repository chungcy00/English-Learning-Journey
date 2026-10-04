import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import { APP_VERSION } from './src/version';
import { buildAppWorker } from './src/utils/appWorker';

function appUpdateServiceWorker(): Plugin {
  return {
    name: 'mine-english-app-update-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // A unique worker version on every Vercel build lets installed mobile and
      // tablet PWAs reliably detect that a new deployment is available.
      const appBuildId = `${APP_VERSION}-${new Date().toISOString()}`;
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: buildAppWorker(APP_VERSION, appBuildId,
          Object.keys(bundle).filter(name => name.startsWith('assets/') && /\.(js|css)$/.test(name)).map(name => '/' + name),
          Object.values(bundle).find(item => item.type === 'chunk' && item.isEntry)?.fileName || ''),
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
