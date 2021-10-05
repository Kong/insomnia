module.exports = {
  addons: [
    '@storybook/addon-knobs/register',
    '@storybook/addon-contexts/register',
    'storybook-addon-designs/register',
  ],
  typescript: {
    check: false,
    checkOptions: {},
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
};
