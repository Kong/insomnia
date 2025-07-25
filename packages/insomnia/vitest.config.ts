import { tmpdir } from 'node:os';

import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    setupFiles: ['./setup-vitest.ts'],
    hideSkippedTests: true,
    env: {
      INSOMNIA_DATA_PATH: tmpdir(),
    },
    exclude: ['src/routes/**.*.tsx', '.react-router'],
    server: {
      deps: {
        inline: ['tinykeys'],
      },
    },
  },
});
