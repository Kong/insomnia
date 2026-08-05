import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hideSkippedTests: true,
    alias: {
      '~/': new URL('../../apps/desktop/src/', import.meta.url).pathname,
    },
  },
});
