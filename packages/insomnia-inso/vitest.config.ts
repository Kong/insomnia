import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DEFAULT_APP_NAME: process.env.DEFAULT_APP_NAME || 'insomnia-app',
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
