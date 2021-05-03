module.exports = /** @type { import('eslint').Linter.Config } */ {
  extends: '../../.eslintrc.js',
  rules: {
    '@typescript-eslint/no-use-before-define': 'off', // TSCONVERSION
    // 'padding-line-between-statements': ['error', { blankLine: "always", prev: ["*"], next: "export"}],
  },
};
