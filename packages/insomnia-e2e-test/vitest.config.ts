import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 30000,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './'),
    },
  },
});

