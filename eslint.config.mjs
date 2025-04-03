import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'simple-import-sort': simpleImportSortPlugin,
    },
    rules: {
      'default-case': 'error',
      'default-case-last': 'error',
      'eol-last': ['error', 'always'],
      'eqeqeq': ['error', 'smart'],
      'no-async-promise-executor': 'off',
      'no-else-return': 'error',
      'no-empty': ["error", { "allowEmptyCatch": true }],
      'no-var': 'error',
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 0 }],
      'no-inner-declarations': 'off',
      'no-useless-escape': 'off', // TODO: Enable this rule
      'object-curly-spacing': ['error', 'always'],
      'space-before-function-paren': ['error', { anonymous: 'ignore', named: 'ignore', asyncArrow: 'always' }],
      'space-unary-ops': 'error',
      'react/no-unescaped-entities': 'off', // TODO: Enable this rule
      'react/jsx-first-prop-new-line': ['error', 'multiline'],
      'react/jsx-max-props-per-line': ['error', { maximum: 1, when: 'multiline' }],
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/jsx-indent-props': ['error', 2],
      'react/prop-types': 'off',
      'react/function-component-definition': ['error', {
        'namedComponents': 'arrow-function',
        'unnamedComponents': 'arrow-function',
      }],
      'react/jsx-closing-bracket-location': ['error', 'line-aligned'],
      'react/prefer-stateless-function': 'error',
      'react/jsx-key': ['error', { 'checkFragmentShorthand': true }],
      'react/no-array-index-key': 'error',
      'react/self-closing-comp': 'error',

      'react-hooks/exhaustive-deps': ['error', {
        // From react-use https://github.com/streamich/react-use/issues/1703#issuecomment-770972824
        'additionalHooks': '^use(Async|AsyncFn|AsyncRetry|Debounce|UpdateEffect|IsomorphicLayoutEffect|DeepCompareEffect|ShallowCompareEffect)$',
      }],
      'react-hooks/rules-of-hooks': 'error',

      '@typescript-eslint/array-type': ['error', { default: 'array', readonly: 'array' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-empty-interface': ['error', { 'allowSingleExtends': true }],
      '@typescript-eslint/no-empty-object-type': 'off', // TODO: Enable this rule
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@typescript-eslint/no-redeclare': 'error',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off', // TODO: Enable this rule
      '@typescript-eslint/no-unused-vars': 'off', // TODO: Enable this rule

      'simple-import-sort/imports': 'error',
      '@typescript-eslint/no-use-before-define': 'off', // TODO: Enable this rule
      '@typescript-eslint/no-explicit-any': 'off', // TODO: Enable this rule
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-invalid-void-type': 'off',
    }
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
      '**/bin/*',
      '**/build/*',
      '**/coverage/*',
      '**/customSign.js',
      '**/dist/*',
      '**/docker/*',
      '**/electron/index.js',
      '**/fixtures',
      '**/hidden-window-preload.js',
      '**/node_modules/*',
      '**/preload.js',
      '**/svgr',
      '**/traces/*',
      '**/verify-pkg.js',
      '**/__mocks__/*',
    ]
  }
);
