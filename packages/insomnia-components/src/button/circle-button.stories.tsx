import { number, select, withKnobs } from '@storybook/addon-knobs';
import React from 'react';

import { IconEnum, SvgIcon } from '../svg-icon';
import { ButtonThemeEnum, ButtonVariantEnum } from './button';
import { CircleButton } from './circle-button';

export default {
  title: 'Buttons | Circle Button',
  decorators: [withKnobs],
};

const selectWidth = () => `${number('Width (px)', 32)}px`;

const selectHeight = () => `${number('Height (px)', 32)}px`;

export const disabled = () => (
  <CircleButton onClick={() => window.alert('Clicked!')} disabled>
    <SvgIcon icon={IconEnum.gear} />
  </CircleButton>
);

export const _default = () => {
  return (
    <CircleButton onClick={() => window.alert('Clicked!')}>
      <SvgIcon icon={IconEnum.gear} />
    </CircleButton>
  );
};

export const dimensions = () => {
  return (
    <CircleButton
      onClick={() => window.alert('Clicked!')}
      width={selectWidth()}
      height={selectHeight()}
      variant={select('Variant', ButtonVariantEnum, 'outlined')}
      bg={select('Background', ButtonThemeEnum, 'default')}
    >
      <SvgIcon icon={select('Icon', IconEnum, IconEnum.gear)} />
    </CircleButton>
  );
};
