module.exports = /** @type { import('eslint').Linter.Config } */ {
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
    'semistandard',
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
  ],
  globals: {
    __DEV__: true,
    fail: true,
    NodeJS: true,
    HTMLDivElement: true,
    HTMLElement: true,
    HTMLInputElement: true,
    HTMLSelectElement: true,
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
    'comma-dangle': ['error', 'always-multiline'],
    indent: 'off',
    'no-var': 'error',
    'no-async-promise-executor': 'off',
    'no-case-declarations': 'off',
    'no-prototype-builtins': 'off',
    'no-duplicate-imports': 'off',
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
    'space-in-parens': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    camelcase: ['error', { allow: ['__export_format', '__export_date', '__export_source'] }],
    'space-before-function-paren': [
      'error',
      {
        anonymous: 'never',
        named: 'never',
        asyncArrow: 'always',
      },
    ],
    'filenames/match-exported': [
      'error',
      'kebab',
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    'spaced-comment': ['error', 'always', {
      exceptions: ['/', '*', '-', '* '], // for ASCII art :)
      markers: [
        '/', // for TypeScript directives, doxygen, vsdoc, etc. (which use `///`)
        '?', // for Quokka
      ],
    }],
  },
};
