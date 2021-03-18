// @flow
import * as React from 'react';
import { number, select, withKnobs } from '@storybook/addon-knobs';
import SvgIcon, { IconEnum } from '../svg-icon';
import { CircleButton } from './circle-button';
import { ButtonThemeEnum, ButtonVariantEnum } from './button';

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
      variant={select('Variant', ButtonVariantEnum)}
      bg={select('Background', ButtonThemeEnum)}>
      <SvgIcon icon={select('Icon', IconEnum, IconEnum.gear)} />
    </CircleButton>
  );
};
