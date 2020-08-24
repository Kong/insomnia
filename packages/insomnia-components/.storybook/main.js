module.exports = {
  addons: [
    '@storybook/addon-knobs/register',
    'storybook-addon-designs/register',
    '@storybook/addon-toolbars',
  ],
  stories: ['../components/**/*.stories.js'],
};
