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
    'consistent-return': OFF('found to be too many false positives'),
    'curly': ERROR,
    'default-case': ERROR,
    'default-case-last': ERROR,
    'eol-last': [ERROR, 'always'],
    'eqeqeq': [ERROR, 'smart'],
    'arrow-parens': [ERROR, 'as-needed'],
    'arrow-spacing': ERROR,
    'keyword-spacing': SUCCESSOR(TYPESCRIPT_EXTENSION),
    'no-async-promise-executor': OFF(UNKNOWN),
    'no-case-declarations': OFF(UNKNOWN),
    'no-duplicate-imports': OFF(UNKNOWN),
    'no-prototype-builtins': OFF(UNKNOWN),
    'no-redeclare': OFF(UNKNOWN),
    'no-unused-vars': OFF(UNKNOWN),
    'no-use-before-define': OFF(UNKNOWN),
    'no-var': ERROR,
    'no-trailing-spaces': ERROR,
    'no-multiple-empty-lines': [ERROR, { 'max': 1, 'maxEOF': 0 }],
    'object-curly-spacing': [ERROR, 'always'],
    'quotes': OFF(UNKNOWN),
    'semi': SUCCESSOR(TYPESCRIPT_EXTENSION),
    'space-before-blocks': ERROR, // TODO: use the @typescript-eslint/space-before-blocks once we typescript-eslint past 5.13
    'space-before-function-paren': [ERROR, { anonymous: 'never', named: 'never', asyncArrow: 'always' }],
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
    '@typescript-eslint/brace-style': [ERROR, '1tbs'],
    '@typescript-eslint/consistent-type-definitions': [ERROR, 'interface'],
    '@typescript-eslint/explicit-module-boundary-types': OFF(UNKNOWN),
    '@typescript-eslint/keyword-spacing': ERROR,
    '@typescript-eslint/member-delimiter-style': ERROR,
    '@typescript-eslint/no-empty-function': OFF(UNKNOWN),
    '@typescript-eslint/no-empty-interface': [ERROR, { 'allowSingleExtends': true }],
    '@typescript-eslint/no-namespace': [ERROR, { allowDeclarations: true }],
    '@typescript-eslint/no-redeclare': ERROR,
    '@typescript-eslint/no-unused-vars': [ERROR, { ignoreRestSiblings: true }],
    '@typescript-eslint/space-infix-ops': ERROR,
    '@typescript-eslint/semi': [ERROR, 'always'],
    '@typescript-eslint/quotes': [ERROR, 'single', { avoidEscape: true }],

    'simple-import-sort/imports': ERROR,
    'filenames/match-exported': OFF(UNKNOWN),
    camelcase: OFF(UNKNOWN),
    '@typescript-eslint/no-use-before-define': OFF(TYPESCRIPT_CONVERSION),
    '@typescript-eslint/no-explicit-any': OFF(TYPESCRIPT_CONVERSION),
    'react/no-find-dom-node': OFF(UNKNOWN),
    'no-restricted-properties': [ERROR, {
      property: 'openExternal',
      message: 'use the `window.main.openInBrowser` function instead.  see https://security.stackexchange.com/questions/225799/dangers-of-electrons-shell-openexternal-on-untrusted-content for more information.',
    }],
    'react/display-name': OFF(UNKNOWN),
  },
};
