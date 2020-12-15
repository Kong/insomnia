// @flow
import * as React from 'react';
import { select, number, withKnobs } from '@storybook/addon-knobs';
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

const selectRadius = () => `${number('Radius (px)', 3)}px`;

export const outlined = () => (
  <Button
    variant={select('Variant', ButtonVariantEnum)}
    size={select('Size', ButtonSizeEnum)}
    radius={selectRadius()}
    onClick={() => window.alert('Clicked!')}
    bg={select('Background', ButtonThemeEnum)}>
    Outlined
  </Button>
);

export const text = () => (
  <Button
    variant={select('Variant', ButtonVariantEnum, ButtonVariantEnum.Text)}
    radius={selectRadius()}
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
    radius={selectRadius()}
    disabled>
    Can't Touch This
  </Button>
);

export const withIcon = () => (
  <Button
    onClick={() => window.alert('Clicked!')}
    bg={select('Background', ButtonThemeEnum)}
    radius={selectRadius()}>
    Expand <SvgIcon icon={IconEnum.chevronDown} />
  </Button>
);

export const reference = () => {
  const radius = selectRadius();

  return (
    <React.Fragment>
      {Object.values(ButtonSizeEnum).map(s => (
        <Padded>
          <h2>
            <code>size={(s: any)}</code>
          </h2>
          {Object.values(ButtonVariantEnum).map(v => (
            <Wrapper>
              {Object.values(ButtonThemeEnum).map(b => (
                <Button bg={b} variant={v} size={s} radius={radius}>
                  {b || 'Default'}
                </Button>
              ))}
            </Wrapper>
          ))}
        </Padded>
      ))}
    </React.Fragment>
  );
};
