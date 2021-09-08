const { ERROR, OFF, TYPESCRIPT_CONVERSION } = require('eslint-config-helpers');

/** @type { import('eslint').Linter.Config } */
module.exports = {
  extends: '../../.eslintrc.js',
  rules: {
    '@typescript-eslint/no-use-before-define': OFF(TYPESCRIPT_CONVERSION),
    camelcase: [ERROR, { allow: ['__export_format', '__export_date', '__export_source', '_postman_variable_scope'] }],
  },
};
