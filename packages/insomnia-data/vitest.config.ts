import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    setupFiles: ['./setup-vitest.ts'],
    hideSkippedTests: true,
    exclude: ['node_modules'],
    server: {
      deps: {
        inline: ['tinykeys'],
      },
    },
  },
});
