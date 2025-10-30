import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    setupFiles: ['./setup-vitest.ts'],
    hideSkippedTests: true,
    env: {
      INSOMNIA_DATA_PATH: tmpdir(),
    },
    exclude: ['src/routes/**.*.tsx', '.react-router', 'node_modules'],
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
    server: {
      deps: {
        inline: ['tinykeys'],
      },
    },
  },
});
