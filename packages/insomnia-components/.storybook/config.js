import { configure, addDecorator } from '@storybook/react';
import { withInfo } from '@storybook/addon-info';

addDecorator(
  withInfo({
    inline: true,
  }),
);

configure(require.context('../components', true, /\.stories\.js$/), module);
