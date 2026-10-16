import { defineConfig } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import globals from 'globals';

import rootConfig from '../../eslint.config.mjs';

export default defineConfig([
  ...rootConfig,
  // insomnia-test also writes Playwright specs/fixtures, so it needs the
  // same base recommended config (notably `no-empty-pattern: 'off'`, which
  // would otherwise be flagged on every fixture that doesn't depend on other
  // fixtures) — but not smoke-test's extra opinionated overrides.
  {
    ...playwright.configs['flat/recommended'],
    files: ['**/*.ts'],
    plugins: { playwright },
  },
  // Standalone CommonJS mock servers/fixtures, run directly with `node`
  // (see package.json scripts) rather than bundled.
  {
    files: ['misc/*.js', 'tests/**/*-main.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'unicorn/prefer-module': 'off',
    },
  },
]);
