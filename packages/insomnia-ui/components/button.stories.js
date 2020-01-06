// @flow
import * as React from 'react';
import Button from './button';
import styled from 'styled-components';
import SvgIcon from './svg-icon';

export default { title: 'Button' };

const Wrapper: React.ComponentType<any> = styled.div`
  display: flex;

  & > * {
    margin-right: 0.5rem;
  }
`;
Wrapper.displayName = '...';

export const _default = () => <Button onClick={() => window.alert('Clicked!')}>Click Me</Button>;

export const withIcon = () => (
  <Button onClick={() => window.alert('Clicked!')}>
    Expand <SvgIcon icon="chevron-down" />
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
