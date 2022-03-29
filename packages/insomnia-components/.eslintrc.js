const { OFF, TYPESCRIPT_CONVERSION } = require('eslint-config-helpers');

/** @type { import('eslint').Linter.Config } */
module.exports = {
  extends: '../../.eslintrc.js',
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    '@typescript-eslint/no-explicit-any': OFF(TYPESCRIPT_CONVERSION),
    '@typescript-eslint/no-unnecessary-type-constraint': OFF('by an unfortunate quirk of how TypeScript differentiates between casts and JSX, this it is necessary for generic JSX to do extend unknown'),
  },
};
