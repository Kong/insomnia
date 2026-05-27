import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    setupFiles: ['./setup-vitest.ts'],
    hideSkippedTests: true,
    env: {
      INSOMNIA_DATA_PATH: tmpdir(),
    },
    exclude: ['src/routes/**.*.tsx', '.react-router', 'node_modules'],
    alias: {
      '~/network/network-adapter': path.resolve(__dirname, './src/network/network-adapter.renderer'),
      '~': path.resolve(__dirname, './src'),
      'electron/main': 'electron',
    },
    server: {
      deps: {
        inline: ['tinykeys'],
      },
    },
  },
});
