// @flow
import * as React from 'react';
import styled, { css } from 'styled-components';

export const ButtonSizeEnum = {
  Default: 'default',
  Small: 'small',
  Medium: 'medium',
};

export const ButtonVariantEnum = {
  Outlined: 'outlined',
  Contained: 'contained',
  Text: 'text',
};

export const ButtonThemeEnum = {
  Default: 'default',
  Surprise: 'surprise',
  Info: 'info',
  Success: 'success',
  Notice: 'notice',
  Warning: 'warning',
  Danger: 'danger',
};

export type ButtonProps = React.ElementProps<'button'> & {
  bg?: $Values<typeof ButtonThemeEnum>,
  variant?: $Values<typeof ButtonVariantEnum>,
  size?: $Values<typeof ButtonSizeEnum>,
  radius?: string,
};

const StyledButton: React.ComponentType<ButtonProps> = styled.button`
  color: ${({ bg }) => (bg ? `var(--color-${bg})` : 'var(--color-font)')};
  text-align: center;
  font-size: var(--font-size-sm);
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid transparent;

  ${({ radius }) => css`
    border-radius: ${radius};
  `};

  ${({ size }) => {
    switch (size) {
      case 'small':
        return css`
          padding: 0 calc(var(--padding-md) * 0.8);
          height: calc(var(--line-height-xs) * 0.8);
          font-size: var(--font-size-sm);
        `;
      case 'medium':
        return css`
          padding: 0 var(--padding-md);
          height: calc(var(--line-height-md) * 0.8);
          font-size: var(--font-size-md);
        `;
      default:
        return css`
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

export const Button = ({ variant, bg, size, radius, ...props }: ButtonProps) => (
  <StyledButton
    {...props}
    variant={variant || 'outlined'}
    bg={bg || 'default'}
    size={size || 'default'}
    radius={radius || '3px'}
  />
);
