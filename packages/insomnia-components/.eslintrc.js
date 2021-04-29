module.exports = /** @type { import('eslint').Linter.Config } */ {
  extends: '../../.eslintrc.js',
  rules: {
    '@typescript-eslint/no-explicit-any': 'off', // TSCONVERSION
  },
};
