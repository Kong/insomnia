import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Separate config for the M3 sandbox-vendored per-lib regression suites (see vitest.config.ts's
// `exclude`, which keeps them out of the default `npm test` run). Path-gated in CI — see
// .github/workflows/test.yml — since they're intentionally larger and scoped to one library each.
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
    include: ['src/templating/sandbox/vendored/*.regression.test.ts'],
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
