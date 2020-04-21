// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  onClick?: (e: SyntheticEvent<HTMLButtonElement>) => any,
  bg?: 'success' | 'notice' | 'warning' | 'danger' | 'surprise' | 'info',
};

const StyledButton: React.ComponentType<Props> = styled.button`
  color: ${({ bg }) => (bg ? `var(--color-${bg})` : 'var(--color-font)')};
  background-color: transparent;
  text-align: center;
  font-size: var(--font-size-sm);
  padding: 0 var(--padding-md);
  height: var(--line-height-xs);
  border-radius: 2px;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;

  border: ${({ noOutline }) => (noOutline ? '0' : '1px solid')};

  &:focus,
  &:hover {
    &:not(:disabled) {
      outline: 0;
      background-color: var(--hl-xxs);
      opacity: 0.9;
    }
  }

  &:active:not(:disabled) {
    background-color: var(--hl-xs);
  }

  &:disabled {
    opacity: 60%;
  }

  svg {
    display: inline-block !important;
    margin-left: 0.4em;
  }
`;

class Button extends React.Component<Props> {
  render() {
    return <StyledButton {...(this.props: Object)} />;
  }
}

export default Button;
