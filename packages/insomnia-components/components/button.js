// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  onClick?: (e: SyntheticEvent<HTMLButtonElement>) => any,
  bg?: 'success' | 'notice' | 'warning' | 'danger' | 'surprise' | 'info',
  variant?: 'outlined' | 'contained' | 'text',
};

const StyledButton: React.ComponentType<Props> = styled.button`
  color: ${({ bg }) => (bg ? `var(--color-${bg})` : 'var(--color-font)')};
  text-align: center;
  font-size: var(--font-size-sm);
  padding: 0 var(--padding-md);
  height: var(--line-height-xs);
  border-radius: 3px;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;

  border: ${({ variant }) => (variant !== 'outlined' ? '1px solid transparent' : '1px solid')};
  ${({ variant, bg }) => {
    if (variant !== 'contained') {
      return 'background-color: transparent;';
    }

    return `background: var(--color-${bg}); color: var(--color-font-${bg})`;
  }}}

  &:focus,
  &:hover {
    &:not(:disabled) {
      outline: 0;
      ${({ variant, bg }) => {
        if (variant === 'contained') {
          // kind of a hack, but using inset box shadow to darken the theme color
          return 'box-shadow: inset 0 0 99px rgba(0, 0, 0, 0.1)';
        }

        return `background-color: rgba(var(--color-${bg}-rgb), 0.1)`;
      }}
    }
  }

  &:active:not(:disabled) {
    ${({ variant, bg }) => {
      if (variant === 'contained') {
        // kind of a hack, but using inset box shadow to darken the theme color
        return 'box-shadow: inset 0 0 99px rgba(0, 0, 0, 0.2)';
      }

      return `background-color: rgba(var(--color-${bg}-rgb), 0.2)`;
    }}
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
    return (
      <StyledButton
        {...(this.props: Object)}
        variant={this.props.variant || 'outlined'}
        bg={this.props.bg || 'surprise'}
      />
    );
  }
}

export default Button;
