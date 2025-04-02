const {
  ERROR,
  OFF,
  SUCCESSOR,
  TYPESCRIPT_CONVERSION,
  TYPESCRIPT_EXTENSION,
  UNKNOWN,
} = require('eslint-config-helpers');

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
    'plugin:@typescript-eslint/eslint-recommended',
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
        '@typescript-eslint/no-var-requires': OFF(UNKNOWN),
      },
    },
  ],
  rules: {
    'array-bracket-spacing': ERROR,
    'brace-style': SUCCESSOR(TYPESCRIPT_EXTENSION),
    'block-spacing': ERROR,
    'comma-dangle': [ERROR, 'always-multiline'],
    'comma-spacing': ERROR,
    'curly': ERROR,
    'default-case': ERROR,
    'default-case-last': ERROR,
    'eol-last': [ERROR, 'always'],
    'eqeqeq': [ERROR, 'smart'],
    'arrow-parens': [ERROR, 'as-needed'],
    'arrow-spacing': ERROR,
    'keyword-spacing': SUCCESSOR(TYPESCRIPT_EXTENSION),
    'no-else-return': ERROR,
    'no-var': ERROR,
    'no-trailing-spaces': ERROR,
    'no-multiple-empty-lines': [ERROR, { 'max': 1, 'maxEOF': 0 }],
    'object-curly-spacing': [ERROR, 'always'],
    'semi': SUCCESSOR(TYPESCRIPT_EXTENSION),
    'space-before-function-paren': [ERROR, { anonymous: 'ignore', named: 'ignore', asyncArrow: 'always' }],
    'space-infix-ops': SUCCESSOR(TYPESCRIPT_EXTENSION),
    'space-unary-ops': ERROR,
    'space-in-parens': ERROR,
    'spaced-comment': [ERROR, 'always', {
      exceptions: ['/', '*', '-', '* '], // for ASCII art :)
      markers: [
        '/', // for TypeScript directives, doxygen, vsdoc, etc. (which use `///`)
        '?', // for Quokka
      ],
    }],

    'react/no-unescaped-entities': OFF(TYPESCRIPT_CONVERSION),
    'react/jsx-first-prop-new-line': [ERROR, 'multiline'],
    'react/jsx-max-props-per-line': [ERROR, { maximum: 1, when: 'multiline' }],
    'react/jsx-uses-react': ERROR,
    'react/jsx-uses-vars': ERROR,
    'react/jsx-indent-props': [ERROR, 2],
    'react/prop-types': OFF(UNKNOWN),
    'react/function-component-definition': [ERROR, {
      'namedComponents': 'arrow-function',
      'unnamedComponents': 'arrow-function',
    }],
    'react/jsx-closing-bracket-location': [ERROR, 'line-aligned'],
    'react/prefer-stateless-function': ERROR,
    'react/jsx-key': [ERROR, { 'checkFragmentShorthand': true }],
    'react/no-array-index-key': ERROR,
    'react/self-closing-comp': ERROR,

    'react-hooks/exhaustive-deps': [ERROR, {
      // From react-use https://github.com/streamich/react-use/issues/1703#issuecomment-770972824
      'additionalHooks': '^use(Async|AsyncFn|AsyncRetry|Debounce|UpdateEffect|IsomorphicLayoutEffect|DeepCompareEffect|ShallowCompareEffect)$',
    }],
    'react-hooks/rules-of-hooks': ERROR,

    '@typescript-eslint/array-type': [ERROR, { default: 'array', readonly: 'array' }],
    '@typescript-eslint/ban-types': OFF(UNKNOWN),
    '@typescript-eslint/consistent-type-definitions': [ERROR, 'interface'],
    '@typescript-eslint/no-empty-interface': [ERROR, { 'allowSingleExtends': true }],
    '@typescript-eslint/no-empty-object-type': OFF(TYPESCRIPT_CONVERSION),
    '@typescript-eslint/no-namespace': [ERROR, { allowDeclarations: true }],
    '@typescript-eslint/no-redeclare': ERROR,
    '@typescript-eslint/no-require-imports': OFF(UNKNOWN),
    '@typescript-eslint/no-wrapper-object-types': OFF(TYPESCRIPT_CONVERSION),
    '@typescript-eslint/no-unsafe-function-type': OFF(TYPESCRIPT_CONVERSION),
    '@typescript-eslint/no-unused-expressions': OFF(TYPESCRIPT_CONVERSION),
    '@typescript-eslint/no-unused-vars': OFF(TYPESCRIPT_CONVERSION),

    'simple-import-sort/imports': ERROR,
    '@typescript-eslint/no-use-before-define': OFF(TYPESCRIPT_CONVERSION),
    '@typescript-eslint/no-explicit-any': OFF(TYPESCRIPT_CONVERSION),
  },
};
