import { addDecorator } from '@storybook/react';
import { withInfo } from '@storybook/addon-info';
import * as React from 'react';

addDecorator(withInfo({ inline: true }));

const ThemeProvider = props => {
  // Apply theme later because storybook adds its own `<body theme="...">` attribute too.
  // TODO: Eventually change ours to `insomnia-theme` or something more specific.
  setTimeout(() => document.body.setAttribute('theme', props.theme), 500);

  return props.children;
};

export const globalTypes = {
  theme: {
    name: 'theme',
    description: 'Themes',
    defaultValue: 'designer-light',
    toolbar: {
      icon: 'box',
      items: [
        { title: 'Designer Light', value: 'studio-light' },
        { title: 'Designer Dark', value: 'studio-colorful' },
      ]
    }
  }
}

const withThemeProvider = (Story,context) => (
  <ThemeProvider theme={context.globals.theme}>
    <Story {...context} />
  </ThemeProvider>
);

export const decorators = [withThemeProvider];
