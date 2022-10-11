import React, { ButtonHTMLAttributes, FunctionComponent } from 'react';
import styled, { css } from 'styled-components';
import { ValueOf } from 'type-fest';

export const ButtonSizeEnum = {
  Default: 'default',
  Small: 'small',
  Medium: 'medium',
} as const;

// These variants determine how the `bg` color variable is handled
// Outlined sets the `bg` color as an outline
// Contained sets the `bg` color as the background color
// Text sets the `bg` color as the text color
export const ButtonVariantEnum = {
  Outlined: 'outlined',
  Contained: 'contained',
  Text: 'text',
} as const;

// Sets the `bg` color to a themed color
export const ButtonThemeEnum = {
  Default: 'default',
  Surprise: 'surprise',
  Info: 'info',
  Success: 'success',
  Notice: 'notice',
  Warning: 'warning',
  Danger: 'danger',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  bg?: ValueOf<typeof ButtonThemeEnum>;
  variant?: ValueOf<typeof ButtonVariantEnum>;
  size?: ValueOf<typeof ButtonSizeEnum>;
  radius?: string;
  margin?: string;
}

const getColorVar = (theme?: ValueOf<typeof ButtonThemeEnum>) => {
  if (!theme || theme === ButtonThemeEnum.Default) {
    return 'var(--color-font)';
  }

  return `var(--color-${theme})`;
};

const getFontColorVar = (theme?: ValueOf<typeof ButtonThemeEnum>) => {
  if (!theme || theme === ButtonThemeEnum.Default) {
    return 'var(--color-font)';
  }

  return `var(--color-font-${theme})`;
};

const StyledButton = styled.button<ButtonProps>`
  color: ${({ bg }) => getColorVar(bg)};
  margin: ${({ margin }) => (margin || 0)};
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

    return `background: var(--color-${bg}); color: ${getFontColorVar(bg)}`;
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

export const Button: FunctionComponent<ButtonProps> = ({
  variant = 'outlined',
  bg = 'default',
  size = 'default',
  radius = '3px',
  ...props
}) => (
  <StyledButton
    {...props}
    variant={variant}
    bg={bg}
    size={size}
    radius={radius}
  />
);
