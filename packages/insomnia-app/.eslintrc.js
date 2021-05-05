/** @type { import('eslint').Linter.Config } */
module.exports = {
  extends: '../../.eslintrc.js',
  rules: {
    'filenames/match-exported': 'off',
    camelcase: 'off',
    '@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
    '@typescript-eslint/no-use-before-define': 'off', // TSCONVERSION
    '@typescript-eslint/no-explicit-any': 'off', // TSCONVERSION
    // 'padding-line-between-statements': ['error', { blankLine: "always", prev: ["*"], next: "export"}],
  },
};
