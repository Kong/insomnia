// @flow
import * as React from 'react';
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
    variant={select('Variant', ButtonVariantEnum)}
    size={select('Size', ButtonSizeEnum)}
    bg={select('Background', ButtonThemeEnum)}>
    Do stuff for 3 seconds
  </AsyncButton>
);

export const customLoader = () => (
  <AsyncButton
    onClick={() => new Promise(resolve => setTimeout(resolve, 3000))}
    variant={select('Variant', ButtonVariantEnum)}
    size={select('Size', ButtonSizeEnum)}
    bg={select('Background', ButtonThemeEnum)}
    loadingNode={'Doing stuff...'}>
    Do stuff for 3 seconds
  </AsyncButton>
);
