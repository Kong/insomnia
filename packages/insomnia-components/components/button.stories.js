// @flow
import * as React from 'react';
import { select, withKnobs } from '@storybook/addon-knobs';
import Button from './button';
import styled from 'styled-components';
import SvgIcon, { IconEnum } from './svg-icon';

export default {
  title: 'Button',
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

const variants = {
  Outlined: 'outlined',
  Contained: 'contained',
  Text: 'text',
};

const themeColors = {
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
    onClick={() => window.alert('Clicked!')}
    bg={select('Background', themeColors)}>
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

export const colors = () => (
  <React.Fragment>
    <Wrapper>
      <Button bg="success" variant="contained">
        Success
      </Button>
      <Button bg="surprise" variant="contained">
        Surprise
      </Button>
      <Button bg="danger" variant="contained">
        Danger
      </Button>
      <Button bg="warning" variant="contained">
        Warning
      </Button>
      <Button bg="notice" variant="contained">
        Notice
      </Button>
      <Button bg="info" variant="contained">
        Info
      </Button>
    </Wrapper>
    <Wrapper>
      <Button bg="success" variant="outlined">
        Success
      </Button>
      <Button bg="surprise" variant="outlined">
        Surprise
      </Button>
      <Button bg="danger" variant="outlined">
        Danger
      </Button>
      <Button bg="warning" variant="outlined">
        Warning
      </Button>
      <Button bg="notice" variant="outlined">
        Notice
      </Button>
      <Button bg="info" variant="outlined">
        Info
      </Button>
    </Wrapper>
    <Wrapper>
      <Button bg="success" variant="text">
        Success
      </Button>
      <Button bg="surprise" variant="text">
        Surprise
      </Button>
      <Button bg="danger" variant="text">
        Danger
      </Button>
      <Button bg="warning" variant="text">
        Warning
      </Button>
      <Button bg="notice" variant="text">
        Notice
      </Button>
      <Button bg="info" variant="text">
        Info
      </Button>
    </Wrapper>
  </React.Fragment>
);
