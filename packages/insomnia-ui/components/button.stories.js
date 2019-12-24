// @flow
import * as React from 'react';
import Button from './button';
import styled from 'styled-components';
import IcnChvDown from '../assets/icn-chevron-down.svg';

export default { title: 'Button' };

const Wrapper: React.ComponentType<any> = styled.div`
  button {
    margin-right: 0.2rem;
  }
`;

export const _default = () => <Button onClick={() => window.alert('Clicked!')}>Click Me</Button>;
export const withIcon = () => <Button onClick={() => window.alert('Clicked!')}>Expand <IcnChvDown/></Button>;

export const colors = () => (
  <Wrapper data-theme='default'>
    <Button>Default</Button>
    <Button bg='success'>Success</Button>
    <Button bg='surprise'>Surprise</Button>
    <Button bg='danger'>Danger</Button>
    <Button bg='warning'>Warning</Button>
    <Button bg='notice'>Notice</Button>
    <Button bg='info'>Info</Button>
  </Wrapper>
);
