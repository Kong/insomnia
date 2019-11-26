import { configure, addDecorator } from '@storybook/react';
import { withInfo } from '@storybook/addon-info';

addDecorator(
  withInfo({
    inline: true,
  }),
);

configure(require.context('../app/ui', true, /\.stories\.js$/), module);
