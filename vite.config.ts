import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'node:fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function rootActivitiesCsvPlugin(): Plugin {
  const csvPath = path.resolve(__dirname, 'data', 'activities.csv');

  return {
    name: 'root-activities-csv',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/data/activities.csv' || !existsSync(csvPath)) {
          next();
          return;
        }

        response.setHeader('Content-Type', 'text/csv; charset=utf-8');
        createReadStream(csvPath).pipe(response);
      });
    },
    closeBundle() {
      if (!existsSync(csvPath)) return;
      const outputDirectory = path.resolve(__dirname, 'dist', 'data');
      mkdirSync(outputDirectory, { recursive: true });
      copyFileSync(csvPath, path.resolve(outputDirectory, 'activities.csv'));
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), rootActivitiesCsvPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
