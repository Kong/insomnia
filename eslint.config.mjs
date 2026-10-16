import { builtinModules } from 'node:module';

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import playwright from 'eslint-plugin-playwright';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const rendererBuiltinSpecifiers = [...builtinModules, ...builtinModules.map(moduleName => `node:${moduleName}`)];
const generalRestrictedImportPatterns = [
  // Shouldn't import packages by relative path
  {
    group: ['**/*/insomnia-api/**'],
    message: "Please use 'insomnia-api' instead of relative paths",
  },
  // Block relative paths to insomnia-data
  {
    group: ['./**/insomnia-data', './**/insomnia-data/**', '../**/insomnia-data', '../**/insomnia-data/**'],
    message: "Please use 'insomnia-data' instead of relative paths",
  },
  // Only allow supported insomnia-data entrypoints
  {
    regex: '^insomnia-data/(?!node($|/)|common($|/)).+',
    message: "Only 'insomnia-data', 'insomnia-data/node' and 'insomnia-data/common' are allowed",
  },
];
// Renderer-context code (ui/, routes/, common/, *.renderer) must not import
// Node built-ins. Tests run under jsdom/node and are exempt. No production
// files need an exemption: node-only modules live outside common/ (main/,
// network/) and genuinely isomorphic code uses userland or __IS_RENDERER__ forks.
const rendererNodeRestrictionIgnores = ['packages/insomnia/src/common/__tests__/**/*.{ts,tsx}'];
// Browser globals that must not appear in Node-context code (main process,
// UtilityProcess, node adapters) or in context-agnostic worker/isomorphic code.
const domRestrictedGlobals = [
  {
    name: 'window',
    message: '"window" is not available in this execution context.',
  },
  {
    name: 'document',
    message: '"document" is not available in this execution context.',
  },
];

export default defineConfig([
  // https://typescript-eslint.io/getting-started#additional-configs
  eslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  // Unicorn section
  eslintPluginUnicorn.configs.unopinionated,
  {
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
        },
      ],
      'unicorn/no-for-loop': 'error', //helps avoid off-by-one errors
      'unicorn/prefer-top-level-await': 'off', // no top level await in our build targets yet
      'unicorn/no-process-exit': 'off', // we have a CLI app
      'unicorn/switch-case-braces': 'error', // more explicit braces
      'unicorn/no-array-method-this-argument': 'off', //our nedb implementation uses this
      'unicorn/prefer-dom-node-text-content': 'off', // we use this in an e2e test
      'unicorn/prefer-response-static-json': 'off', // unsafe in our templating worker

      'unicorn/no-array-for-each': 'off', // TODO: delete me
      'unicorn/no-array-reverse': 'off', // TODO: delete me
      'unicorn/no-array-sort': 'off', // TODO: delete me
      'unicorn/no-negated-condition': 'off', // TODO: delete me
      'unicorn/no-object-as-default-parameter': 'off', // TODO: delete me
      'unicorn/no-this-assignment': 'off', // TODO: delete me
      'unicorn/no-zero-fractions': 'off', // TODO: delete me
      'unicorn/prefer-add-event-listener': 'off', // TODO: delete me
      'unicorn/prefer-array-some': 'off', // TODO: delete me
      'unicorn/prefer-at': 'off', // TODO: delete me -
      'unicorn/prefer-global-this': 'off', // TODO: delete me
      'unicorn/prefer-logical-operator-over-ternary': 'off', // TODO: delete me
      'unicorn/prefer-regexp-test': 'off', // TODO: delete me
      'unicorn/prefer-set-has': 'off', // TODO: delete me
      'unicorn/prefer-string-raw': 'off', // TODO: delete me
      'unicorn/prefer-string-replace-all': 'off', // TODO: delete me
      'unicorn/prefer-switch': 'off', // TODO: delete me
    },
  },
  // Playwright section
  {
    ...playwright.configs['flat/recommended'],
    files: ['packages/insomnia-smoke-test/tests/**/*.ts'],
    plugins: { playwright: playwright },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/expect-expect': 'off',
      'playwright/missing-playwright-await': 'warn',
      'playwright/require-soft-assertions': 'error',
      'playwright/prefer-native-locators': 'error',
      'playwright/prefer-to-be': 'error',
      'playwright/prefer-to-contain': 'error',
      'playwright/no-wait-for-timeout': 'error',
    },
  },
  // React hooks section
  {
    files: ['packages/insomnia/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooksPlugin },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      'react-hooks/refs': 'off', //TODO: delete me
      'react-hooks/set-state-in-effect': 'off', //TODO: delete me
      'react-hooks/immutability': 'off', //TODO: delete me
      'react-hooks/preserve-manual-memoization': 'off', //TODO: delete me
      'react-hooks/incompatible-library': 'off', //TODO(use react-aria virtualizer): delete me
    },
  },
  // React section
  {
    files: ['packages/insomnia/src/**/*.{ts,tsx}'],
    ...reactPlugin.configs.flat.recommended,
    ...reactPlugin.configs.flat['jsx-runtime'],
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react/jsx-first-prop-new-line': ['error', 'multiline'],
      'react/jsx-max-props-per-line': ['error', { maximum: 1, when: 'multiline' }],
      'react/jsx-indent-props': ['error', 2],
      'react/function-component-definition': [
        'error',
        {
          namedComponents: ['arrow-function', 'function-declaration'],
          unnamedComponents: 'arrow-function',
        },
      ],
      'react/jsx-closing-bracket-location': ['error', 'line-aligned'],
      'react/prefer-stateless-function': 'error',
      'react/jsx-key': ['error', { checkFragmentShorthand: true }],
      'react/self-closing-comp': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
      'react/prop-types': 'off',
      'react/no-array-index-key': 'error',
    },
  },
  // simple-import-sort section
  {
    plugins: {
      'simple-import-sort': simpleImportSortPlugin,
    },
    rules: {
      'simple-import-sort/imports': 'error',
    },
  },
  // General ESLint rules
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: generalRestrictedImportPatterns,
        },
      ],
    },
  },
  // ── Execution-context boundaries ────────────────────────────────────────
  // Context is enforced by file location AND by filename suffix, so a module's
  // runtime is legible from its path alone:
  //   *.renderer.{ts,tsx} → browser context (no Node built-ins)
  //   *.node.ts           → Node context    (no DOM globals)
  //   *.worker.ts         → web worker       (neither)
  // The folder rules (ui/, routes/, main/) carry the coarse process boundary;
  // the suffixes carry context for code that lives in a context-neutral place
  // (e.g. runtimes/ adapters). Note: `.client.ts`/`.server.ts` are React
  // Router's SSR-bundling suffixes, NOT context markers — with `ssr: false`
  // both run in the renderer, so they are intentionally absent here.

  // Browser/renderer context: DOM is available, Node built-ins are a bug.
  {
    files: [
      'packages/insomnia/src/ui/**/*.{ts,tsx}',
      'packages/insomnia/src/basic-components/**/*.{ts,tsx}',
      'packages/insomnia/src/routes/**/*.{ts,tsx}',
      'packages/insomnia/src/**/*.renderer.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: rendererBuiltinSpecifiers,
          patterns: generalRestrictedImportPatterns,
        },
      ],
    },
  },
  // Web worker context: neither DOM globals nor Node built-ins.
  // (suffix-based opt-in; the templating worker is named `.worker.ts`. Any other
  // workers still using folder/`-worker.ts` naming need renaming to opt in.)
  {
    files: ['packages/insomnia/src/**/*.worker.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: rendererBuiltinSpecifiers,
          patterns: generalRestrictedImportPatterns,
        },
      ],
      'no-restricted-globals': ['error', ...domRestrictedGlobals],
    },
  },
  // `common/` is the de-facto isomorphic bucket: imported by the renderer, the
  // main process, and the inso CLI, so it must not reach for DOM globals.
  // whose only remaining exemption is the `__tests__` glob.)
  {
    files: ['packages/insomnia/src/common/**/*.{ts,tsx}'],
    ignores: ['packages/insomnia/src/common/__tests__/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: rendererBuiltinSpecifiers,
          patterns: generalRestrictedImportPatterns,
        },
      ],
      'no-restricted-globals': ['error', ...domRestrictedGlobals],
    },
  },
  {
    rules: {
      'default-case': 'error',
      'default-case-last': 'error',
      'eqeqeq': ['error', 'smart'],
      'no-async-promise-executor': 'off',
      'no-else-return': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-var': 'error',
      'no-inner-declarations': 'off',
      'no-useless-escape': 'off', // TODO: delete me
    },
  },
  // TypeScript ESLint rules
  {
    rules: {
      '@typescript-eslint/array-type': ['error', { default: 'array', readonly: 'array' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-empty-object-type': 'off', // TODO: delete me
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@typescript-eslint/no-redeclare': 'error',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off', // TODO: delete me
      '@typescript-eslint/no-unused-vars': 'off', // TODO: delete me

      '@typescript-eslint/no-use-before-define': 'off', // TODO: delete me
      '@typescript-eslint/no-explicit-any': 'off', // TODO: delete me
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-invalid-void-type': 'off',
    },
  },
  eslintConfigPrettier,
  {
    ignores: [
      '*.md',
      '**/__fixtures__/*',
      '**/__snapshots__/*',
      '**/.cache/*',
      '**/.github/*',
      '**/.idea/*',
      '**/*.config.js',
      '**/*.d.ts',
      '**/*.min.js',
      '**/*.js.map',
      '**/bin/*',
      '**/build/*',
      '**/coverage/*',
      '**/customSign.js',
      '**/dist/*',
      '**/docker/*',
      '**/electron/index.js',
      '**/fixtures',
      '**/node_modules/*',
      '**/svgr',
      '**/traces/*',
      '**/verify-pkg.js',
      '**/__mocks__/*',
      '**/.react-router/*',
      'packages/insomnia/src/*.js',
    ],
  },
  // Node context: main process, UtilityProcess, and node adapters — no DOM globals.
  {
    files: ['packages/insomnia/src/main/**/*.{ts,tsx,js,mjs}', 'packages/insomnia/src/**/*.node.ts'],
    rules: {
      'no-restricted-globals': ['error', ...domRestrictedGlobals],
    },
  },
  // Test files ESLint rules
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
]);
