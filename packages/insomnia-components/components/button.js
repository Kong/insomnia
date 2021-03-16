// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  onClick?: (e: SyntheticEvent<HTMLButtonElement>) => any,
  bg?: 'default' | 'success' | 'notice' | 'warning' | 'danger' | 'surprise' | 'info',
  variant?: 'outlined' | 'contained' | 'text',
  size?: 'default' | 'small',
};

const StyledButton: React.ComponentType<Props> = styled.button`
  color: ${({ bg }) => (bg ? `var(--color-${bg})` : 'var(--color-font)')};
  text-align: center;
  font-size: var(--font-size-sm);
  border-radius: 3px;
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: center !important;
  border: 1px solid transparent;

  ${({ size }) => {
    switch (size) {
      case 'small':
        return `
          padding: 0 calc(var(--padding-md) * 0.8);
          height: calc(var(--line-height-xs) * 0.8);
          font-size: var(--font-size-sm);
        `;
      default:
        return `
          padding: 0 var(--padding-md);
          height: var(--line-height-xs);
        `;
    }
  }}}

  ${({ variant, bg }) => {
    if (variant !== 'outlined') {
      return '';
    }

    // Inherit border color from text color for colored outlines
    if (bg === 'default') {
      return 'border-color: var(--hl-lg)';
    }

    // Colored borders inherit from button text color
    return 'border-color: inherit';
  }}}

  ${({ variant, bg }) => {
    if (variant !== 'contained') {
      return 'background-color: transparent;';
    }

    if (bg === 'default') {
      return 'background-color: var(--hl-xs)';
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

        if (bg === 'default') {
          return 'background-color: var(--hl-xs)';
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

      if (bg === 'default') {
        return 'background-color: var(--hl-sm)';
      }

      return `background-color: rgba(var(--color-${bg}-rgb), 0.2)`;
    }}
  }

  &:disabled {
    opacity: 60%;
  }
`;

const Button = ({ variant, bg, size, ...props }: Props) => (
  <StyledButton
    {...props}
    variant={variant || 'outlined'}
    bg={bg || 'default'}
    size={size || 'default'}
  />
);

export default Button;
