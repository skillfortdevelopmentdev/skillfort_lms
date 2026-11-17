import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function isDatabaseWatchPath(watchPath: string): boolean {
  const base = path.basename(watchPath.replace(/\\/g, '/'));
  return base === 'db.json' || base === '.db_backup.json';
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              // JSON DB writes on every API call must not trigger full-page reload loops.
              ignored: [isDatabaseWatchPath],
            },
    },
  };
});
