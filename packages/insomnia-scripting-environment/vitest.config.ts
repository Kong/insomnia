import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hideSkippedTests: true,
    alias: {
      '~/': new URL('../insomnia/src/', import.meta.url).pathname,
      'insomnia-data': new URL('../insomnia/src/insomnia-data', import.meta.url).pathname,
    },
  },
});
