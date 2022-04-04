/** @type { import('eslint').Linter.Config } */
module.exports = {
  extends: '../../.eslintrc.js',
  settings: {
    react: {
      version: 'detect',
    },
  },
};
