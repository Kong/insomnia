// @flow
import * as React from 'react';
import { select, withKnobs } from '@storybook/addon-knobs';
import { Button } from './index';
import styled from 'styled-components';
import SvgIcon, { IconEnum } from '../svg-icon';
import { ButtonSizeEnum, ButtonThemeEnum, ButtonVariantEnum } from './button';

export default {
  title: 'Buttons | Button',
  decorators: [withKnobs],
};

const Wrapper: React.ComponentType<any> = styled.div`
  display: flex;

  & > * {
    margin-right: 0.5rem;
    margin-top: 0.8rem;
  }
`;
Wrapper.displayName = '...';

const Padded: React.ComponentType<any> = styled.div`
  margin: 2rem auto;
`;
Padded.displayName = '...';

export const outlined = () => (
  <Button
    variant={select('Variant', ButtonVariantEnum)}
    size={select('Size', ButtonSizeEnum)}
    onClick={() => window.alert('Clicked!')}
    bg={select('Background', ButtonThemeEnum)}>
    Outlined
  </Button>
);

export const text = () => (
  <Button
    variant={select('Variant', ButtonVariantEnum, ButtonVariantEnum.Text)}
    onClick={() => window.alert('Clicked!')}
    bg={select('Background', ButtonThemeEnum)}>
    Text
  </Button>
);

export const contained = () => (
  <Button
    variant={select('Variant', ButtonVariantEnum, ButtonVariantEnum.Contained)}
    onClick={() => window.alert('Clicked!')}
    bg={select('Background', ButtonThemeEnum)}>
    Contained
  </Button>
);

export const disabled = () => (
  <Button
    onClick={() => window.alert('Clicked!')}
    bg={select('Background', ButtonThemeEnum)}
    disabled>
    Can't Touch This
  </Button>
);

export const withIcon = () => (
  <Button onClick={() => window.alert('Clicked!')} bg={select('Background', ButtonThemeEnum)}>
    Expand <SvgIcon icon={IconEnum.chevronDown} />
  </Button>
);

export const reference = () => (
  <React.Fragment>
    {Object.values(ButtonSizeEnum).map(s => (
      <Padded>
        <h2>
          <code>size={(s: any)}</code>
        </h2>
        {Object.values(ButtonVariantEnum).map(v => (
          <Wrapper>
            {Object.values(ButtonThemeEnum).map(b => (
              <Button bg={b} variant={v} size={s}>
                {b || 'Default'}
              </Button>
            ))}
          </Wrapper>
        ))}
      </Padded>
    ))}
  </React.Fragment>
);
