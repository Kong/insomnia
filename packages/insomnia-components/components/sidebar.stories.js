import React from 'react';
import Sidebar from './sidebar';
import { withKnobs } from '@storybook/addon-knobs';
import { withDesign } from 'storybook-addon-designs';

export default {
  title: '1st Party | Sidebar',
  decorators: [withKnobs, withDesign],
};

export const _default = () => <Sidebar />;

_default.story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/sS7oBbKmDvhtq5lXyTckVe/Style-Guide-Components?node-id=0%3A2',
    },
  },
};
