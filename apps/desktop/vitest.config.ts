import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig } from 'vitest/config';
export default defineConfig({
  define: {
    __IS_RENDERER__: JSON.stringify(false),
  },
  test: {
    setupFiles: ['./setup-vitest.ts'],
    hideSkippedTests: true,
    env: {
      INSOMNIA_DATA_PATH: tmpdir(),
    },
    exclude: [
      'src/routes/**.*.tsx',
      '.react-router',
      'node_modules',
      // The isolated, exact-pinned install (M3 sandbox-vendored libs) has its own node_modules
      // whose dependencies ship their own test suites (e.g. ajv's) — not this repo's, and not
      // runnable here (no test-runner devDependencies installed in that isolated install).
      'src/templating/sandbox/vendored/pkg/**',
      // Large, per-lib regression suites (M3 sandbox-vendored libs) — run separately via
      // `npm run sandbox:vendored:test-regression`, path-gated in CI. See vitest.sandbox-vendored-regression.config.ts.
      'src/templating/sandbox/vendored/*.regression.test.ts',
    ],
    alias: {
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
