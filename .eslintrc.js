/** @type { import('eslint').Linter.Config } */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      './tsconfig.eslint.json',
      './packages/*/tsconfig.json',
      './plugins/*/tsconfig.json',
    ],
    tsconfigRootDir: __dirname,
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: [
    '@typescript-eslint',
    'react',
    'jest',
    'html',
    'json',
    'filenames',
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
    'jest/globals': true,
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
    'brace-style': 'off', // successor('@typescript-eslint/brace-style')
    'camelcase': ['error', { allow: ['__export_format', '__export_date', '__export_source'] }],
    'comma-dangle': ['error', 'always-multiline'],
    'comma-spacing': 'error',
    'default-case': 'error',
    'default-case-last': 'error',
    'filenames/match-exported': ['error', 'kebab'],
    'indent': ['error', 2, { SwitchCase: 1 }],
    'keyword-spacing': 'off', // successor('@typescript-eslint/keyword-spacing')
    'no-async-promise-executor': 'off',
    'no-case-declarations': 'off',
    'no-duplicate-imports': 'off',
    'no-prototype-builtins': 'off',
    'no-redeclare': 'off',
    'no-unused-vars': 'off',
    'no-use-before-define': 'off',
    'no-var': 'error',
    'object-curly-spacing': ['error', 'always'],
    'quotes': 'off',
    'semi': ['error', 'always'],
    'space-before-function-paren': ['error', { anonymous: 'never', named: 'never', asyncArrow: 'always' }],
    'space-in-parens': 'error',
    'spaced-comment': ['error', 'always', {
      exceptions: ['/', '*', '-', '* '], // for ASCII art :)
      markers: [
        '/', // for TypeScript directives, doxygen, vsdoc, etc. (which use `///`)
        '?', // for Quokka
      ],
    }],

    'filenames/match-exported': ['error', 'kebab'],

    'react/no-find-dom-node': 'off',
    'react/no-unescaped-entities': 'off', // TSCONVERSION
    'react/jsx-first-prop-new-line': ['error', 'multiline'],
    'react/jsx-max-props-per-line': ['error', { maximum: 1, when: 'multiline' }],
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
    'react/jsx-indent': ['error', 2],
    'react/jsx-indent-props': ['error', 2],
    'react/prop-types': 'off',
    'react/function-component-definition': ['error', {
      'namedComponents':  'arrow-function',
      'unnamedComponents': 'arrow-function',
    }],
    'react/jsx-max-props-per-line': ['error', { 'maximum': 1, 'when': 'multiline' }],
    'react/jsx-closing-bracket-location': ['error', 'line-aligned'],

    'react-hooks/exhaustive-deps': 'error',
    'react-hooks/rules-of-hooks': 'error',

    '@typescript-eslint/array-type': ['error', { default: 'array', readonly: 'array' }],
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/keyword-spacing': 'error',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    '@typescript-eslint/no-redeclare': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    '@typescript-eslint/no-use-before-define': 'error',
    '@typescript-eslint/quotes': ['error', 'single', { avoidEscape: true }],

    'simple-import-sort/imports': 'error',
  },
};
