import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hideSkippedTests: true,
    alias: {
      '~/': new URL('../insomnia/src/', import.meta.url).pathname,
    },
    env: {
      DEFAULT_APP_NAME: process.env.DEFAULT_APP_NAME || 'insomnia-app',
    },
    server: {
      deps: {
        inline: ['tinykeys'],
      },
    },
  },
});
