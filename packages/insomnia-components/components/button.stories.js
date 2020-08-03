// @flow
import * as React from 'react';
import { select, withKnobs } from '@storybook/addon-knobs';
import Button from './button';
import styled from 'styled-components';
import SvgIcon, { IconEnum } from './svg-icon';

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

const sizes = {
  Default: 'default',
  Small: 'small',
};

const variants = {
  Outlined: 'outlined',
  Contained: 'contained',
  Text: 'text',
};

const themeColors = {
  Default: null,
  Surprise: 'surprise',
  Info: 'info',
  Success: 'success',
  Notice: 'notice',
  Warning: 'warning',
  Danger: 'danger',
};

export const outlined = () => (
  <Button
    variant={select('Variant', variants, 'outlined')}
    size={select('Size', sizes, null)}
    onClick={() => window.alert('Clicked!')}
    bg={select('Background', themeColors, null)}>
    Outlined
  </Button>
);

export const text = () => (
  <Button
    variant={select('Variant', variants, 'text')}
    onClick={() => window.alert('Clicked!')}
    bg={select('Background', themeColors)}>
    Text
  </Button>
);

export const contained = () => (
  <Button
    variant={select('Variant', variants, 'contained')}
    onClick={() => window.alert('Clicked!')}
    bg={select('Background', themeColors)}>
    Contained
  </Button>
);

export const disabled = () => (
  <Button onClick={() => window.alert('Clicked!')} bg={select('Background', themeColors)} disabled>
    Can't Touch This
  </Button>
);

export const withIcon = () => (
  <Button onClick={() => window.alert('Clicked!')} bg={select('Background', themeColors)}>
    Expand <SvgIcon icon={IconEnum.chevronDown} />
  </Button>
);

export const reference = () => (
  <React.Fragment>
    {['default', 'small'].map(s => (
      <Padded>
        <h2>
          <code>size={s}</code>
        </h2>
        <Wrapper>
          <Button variant="contained" size={s}>
            Default
          </Button>
          <Button bg="success" variant="contained" size={s}>
            Success
          </Button>
          <Button bg="surprise" variant="contained" size={s}>
            Surprise
          </Button>
          <Button bg="danger" variant="contained" size={s}>
            Danger
          </Button>
          <Button bg="warning" variant="contained" size={s}>
            Warning
          </Button>
          <Button bg="notice" variant="contained" size={s}>
            Notice
          </Button>
          <Button bg="info" variant="contained" size={s}>
            Info
          </Button>
        </Wrapper>
        <Wrapper>
          <Button variant="outlined" size={s}>
            Default
          </Button>
          <Button bg="success" variant="outlined" size={s}>
            Success
          </Button>
          <Button bg="surprise" variant="outlined" size={s}>
            Surprise
          </Button>
          <Button bg="danger" variant="outlined" size={s}>
            Danger
          </Button>
          <Button bg="warning" variant="outlined" size={s}>
            Warning
          </Button>
          <Button bg="notice" variant="outlined" size={s}>
            Notice
          </Button>
          <Button bg="info" variant="outlined" size={s}>
            Info
          </Button>
        </Wrapper>
        <Wrapper>
          <Button variant="text" size={s}>
            Default
          </Button>
          <Button bg="success" variant="text" size={s}>
            Success
          </Button>
          <Button bg="surprise" variant="text" size={s}>
            Surprise
          </Button>
          <Button bg="danger" variant="text" size={s}>
            Danger
          </Button>
          <Button bg="warning" variant="text" size={s}>
            Warning
          </Button>
          <Button bg="notice" variant="text" size={s}>
            Notice
          </Button>
          <Button bg="info" variant="text" size={s}>
            Info
          </Button>
        </Wrapper>
      </Padded>
    ))}
  </React.Fragment>
);
