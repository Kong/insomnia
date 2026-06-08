import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    '__IS_RENDERER__': JSON.stringify(false),
  },
  test: {
    hideSkippedTests: true,
    alias: {
      '~/': new URL('../insomnia/src/', import.meta.url).pathname,
    },
  },
});
