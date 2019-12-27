// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  onClick?: (e: SyntheticEvent<HTMLButtonElement>) => any,
  bg?: 'success' | 'notice' | 'warning' | 'danger' | 'surprise' | 'info';
};

const StyledButton: React.ComponentType<Props> = styled.button`
  text-align: center;
  color: ${({ bg }) => bg ? `var(--color-${bg})` : 'var(--color-font)'};
  padding: 0 var(--padding-md);
  height: var(--line-height-xs);
  line-height: var(--line-height-xs);
  opacity: 0.8;
  border-radius: 2px;

  border: ${({ noOutline }) => noOutline ? '0' : '1px solid'};

  &:focus,
  &:hover {
    outline: 0;
    background-color: var(--hl-xxs);
    opacity: 1;
  }

  &:active {
    background-color: var(--hl-xs);
  }

  svg {
    margin-left: 0.2em;
    vertical-align: center;
    height: 0.8em;
    max-width: 1em;
  }

  .icon-svg path {
    fill: var(--color-font);
  }
`;

class Button extends React.Component<Props> {
  render() {
    return <StyledButton {...this.props} />;
  }
}

export default Button;
