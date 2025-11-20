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
export default defineConfig([
  eslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  eslintPluginUnicorn.configs.unopinionated,
  {
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
        },
      ],
      'unicorn/no-for-loop': 'error',
      'unicorn/prefer-top-level-await': 'off', // no top level await in our build targets yet
      'unicorn/switch-case-braces': 'error',
      'unicorn/no-array-method-this-argument': 'off',
      'unicorn/text-encoding-identifier-case': 'off', // TODO: delete me
      'unicorn/prefer-add-event-listener': 'off', // TODO: delete me
      'unicorn/no-object-as-default-parameter': 'off', // TODO: delete me
      'unicorn/prefer-array-some': 'off', // TODO: delete me
    },
  },
  {
    ...playwright.configs['flat/recommended'],
    files: ['packages/insomnia-smoke-test/tests/**/*.ts'],
    plugins: { playwright: playwright },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/expect-expect': 'off',
      'playwright/require-soft-assertions': 'error',
      'playwright/prefer-native-locators': 'error',
      'playwright/prefer-to-be': 'error',
      'playwright/prefer-to-contain': 'error',
      'playwright/no-wait-for-timeout': 'error',
    },
  },
  reactHooksPlugin.configs.flat.recommended,
  {
    rules: {
      'react-hooks/refs': 'off', //TODO: delete me
      'react-hooks/set-state-in-effect': 'off', //TODO: delete me
      'react-hooks/immutability': 'off', //TODO: delete me
      'react-hooks/preserve-manual-memoization': 'off', //TODO: delete me
      'react-hooks/incompatible-library': 'off', //TODO(use react-aria virtualizer): delete me
      'react-hooks/purity': 'off', //TODO(bingbing): delete me
    },
  },
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
  {
    plugins: {
      'simple-import-sort': simpleImportSortPlugin,
    },
    rules: {
      'simple-import-sort/imports': 'error',
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
    ],
  },
]);
