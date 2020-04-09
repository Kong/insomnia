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
  }
`;
Wrapper.displayName = '...';

const themeColors = {
  default: null,
  Surprise: 'surprise',
  Info: 'info',
  Success: 'success',
  Notice: 'notice',
  Warning: 'warning',
  Danger: 'danger',
};

export const _default = () => (
  <Button onClick={() => window.alert('Clicked!')} bg={select('Background', themeColors)}>
    Click Me
  </Button>
);

export const withIcon = () => (
  <Button onClick={() => window.alert('Clicked!')} bg={select('Background', themeColors)}>
    Expand <SvgIcon icon={IconEnum.chevronDown} />
  </Button>
);

export const colors = () => (
  <Wrapper>
    <Button>Default</Button>
    <Button bg="success">Success</Button>
    <Button bg="surprise">Surprise</Button>
    <Button bg="danger">Danger</Button>
    <Button bg="warning">Warning</Button>
    <Button bg="notice">Notice</Button>
    <Button bg="info">Info</Button>
  </Wrapper>
);
