/** @type { import('eslint').Linter.Config } */
module.exports = {
  extends: '../../.eslintrc.js',
  rules: {
    '@typescript-eslint/no-use-before-define': 'off', // TSCONVERSION
    camelcase: ['error', { allow: ['__export_format', '__export_date', '__export_source', '_postman_variable_scope'] }],
  },
};
