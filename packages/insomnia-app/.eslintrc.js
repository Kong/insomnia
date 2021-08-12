const { ERROR, OFF, UNKNOWN, TYPESCRIPT_CONVERSION } = require('eslint-config-helpers');

/** @type { import('eslint').Linter.Config } */
module.exports = {
  extends: '../../.eslintrc.js',
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'filenames/match-exported': OFF(UNKNOWN),
    camelcase: OFF(UNKNOWN),
    '@typescript-eslint/no-use-before-define': OFF(TYPESCRIPT_CONVERSION),
    '@typescript-eslint/no-explicit-any': OFF(TYPESCRIPT_CONVERSION),
    'react/no-find-dom-node': OFF(UNKNOWN),
    'no-restricted-properties': [ERROR, {
      property: 'openExternal',
      message: 'use the `clickLink` function in `electron-helpers.ts` instead.  see https://security.stackexchange.com/questions/225799/dangers-of-electrons-shell-openexternal-on-untrusted-content for more information.',
    }],
  },
};
