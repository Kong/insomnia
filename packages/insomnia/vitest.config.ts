import { tmpdir } from 'os';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    setupFiles: ['./setup-vitest.ts'],
    hideSkippedTests: true,
    env: {
      INSOMNIA_DATA_PATH: tmpdir(),
    },
    server: {
      deps: {
        inline: [
          'tinykeys',
        ],
      },
    },
  },
});
