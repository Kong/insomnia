const priorConfig = require('../../.eslintrc');

module.exports = {
  extends: '../../.eslintrc.js',
  rules: {
    '@typescript-eslint/no-use-before-define': 'off', // TSCONVERSION
    camelcase: [
      'error',
      {
        allow: [
          ...priorConfig.rules.camelcase[1].allow,
          '_postman_variable_scope',
        ],
      },
    ],
  },
};
