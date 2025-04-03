/** @type { import('eslint').Linter.Config } */
module.exports = {
  settings: {
    react: {
      version: 'detect',
    },
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'import',
    'simple-import-sort',
  ],
  globals: {
    __DEV__: true,
    fail: true,
    NodeJS: true,
    HTMLDivElement: true,
    HTMLElement: true,
    HTMLInputElement: true,
    HTMLSelectElement: true,
    JSX: true,
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true,
  },
  overrides: [
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  rules: {
    'array-bracket-spacing': 'error',
    'block-spacing': 'error',
    'comma-dangle': ['error', 'always-multiline'],
    'comma-spacing': 'error',
    'curly': 'error',
    'default-case': 'error',
    'default-case-last': 'error',
    'eol-last': ['error', 'always'],
    'eqeqeq': ['error', 'smart'],
    'arrow-parens': ['error', 'as-needed'],
    'arrow-spacing': 'error',
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
    'space-in-parens': 'error',
    'spaced-comment': ['error', 'always', {
      exceptions: ['/', '*', '-', '* '], // for ASCII art :)
      markers: [
        '/', // for TypeScript directives, doxygen, vsdoc, etc. (which use `///`)
        '?', // for Quokka
      ],
    }],

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
    '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    '@typescript-eslint/no-redeclare': 'error',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-unused-expressions': 'off', // TODO: Enable this rule
    '@typescript-eslint/no-unused-vars': 'off', // TODO: Enable this rule

    'simple-import-sort/imports': 'error',
    '@typescript-eslint/no-use-before-define': 'off', // TODO: Enable this rule
    '@typescript-eslint/no-explicit-any': 'off', // TODO: Enable this rule
  },
};
