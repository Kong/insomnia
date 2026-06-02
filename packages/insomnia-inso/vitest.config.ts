import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hideSkippedTests: true,
    alias: {
      '~/network/network-adapter': new URL('../insomnia/src/network/network-adapter.node.ts', import.meta.url).pathname,
      '~/templating/render-adapter': new URL('../insomnia/src/templating/render-adapter.node.ts', import.meta.url)
        .pathname,
      '~/': new URL('../insomnia/src/', import.meta.url).pathname,
      'insomnia-data': new URL('../insomnia/src/insomnia-data', import.meta.url).pathname,
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
