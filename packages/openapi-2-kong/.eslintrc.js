/** @type { import('eslint').Linter.Config } */
module.exports = {
  extends: '../../.eslintrc.js',
  rules: {
    camelcase: 'off',
    '@typescript-eslint/no-explicit-any': 'off', // TSCONVERSION
    '@typescript-eslint/no-empty-interface': 'off', // TSCONVERSION
    '@typescript-eslint/no-use-before-define': 'off', // TSCONVERSION
  },
};
