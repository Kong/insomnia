import React from 'react';
import { AsyncButton } from './async-button';
import { select, withKnobs } from '@storybook/addon-knobs';
import { ButtonSizeEnum, ButtonThemeEnum, ButtonVariantEnum } from './button';

export default {
  title: 'Buttons | Async Button',
  decorators: [withKnobs],
};

export const _default = () => (
  <AsyncButton
    onClick={() => new Promise(resolve => setTimeout(resolve, 3000))}
    variant={select('Variant', ButtonVariantEnum, 'outlined')}
    size={select('Size', ButtonSizeEnum, 'default')}
    bg={select('Background', ButtonThemeEnum, 'default')}
  >
    Do stuff for 3 seconds
  </AsyncButton>
);

export const customLoader = () => (
  <AsyncButton
    onClick={() => new Promise(resolve => setTimeout(resolve, 3000))}
    variant={select('Variant', ButtonVariantEnum, 'outlined')}
    size={select('Size', ButtonSizeEnum, 'default')}
    bg={select('Background', ButtonThemeEnum, 'default')}
    loadingNode={'Doing stuff...'}
  >
    Do stuff for 3 seconds
  </AsyncButton>
);
