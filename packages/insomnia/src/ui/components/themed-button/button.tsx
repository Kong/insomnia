import type { ButtonHTMLAttributes } from 'react';
import React from 'react';
import type { ValueOf } from 'type-fest';
export const ButtonSizeEnum = {
  Default: 'default',
  Small: 'small',
  Medium: 'medium',
  xs: 'xs',
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
  removeBorderRadius?: boolean;
  isDisabled?: boolean;
  disableHoverBehavior?: boolean;
  isPressed?: boolean;
  removePaddings?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  bg = 'default',
  radius = '3px',
  size = 'default',
  variant = 'outlined',
  margin,
  children,
  removeBorderRadius,
  isDisabled,
  disableHoverBehavior,
  isPressed,
  removePaddings,
  ...props
}) => {
  const getButtonStyles = () => {
    let buttonStyles: any = {
      color: bg ? `var(--color-font-${bg})` : 'var(--color-font)',
      margin: margin || 0,
      textAlign: 'center',
      fontSize: 'var(--font-size-sm)',
      display: 'inline-flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid transparent',
    };
    if (removeBorderRadius) {
      buttonStyles = {
        ...buttonStyles,
        borderRadius: 0,
      };
    } else if (radius) {
      buttonStyles = {
        ...buttonStyles,
        borderRadius: radius,
      };
    }

    const sizeStyles = {
      xs: {
        padding: '0 calc(var(--padding-md) * 0.5)',
        height: 'calc(var(--line-height-xs) * 0.5)',
        fontSize: 'var(--font-size-xs)',
      },
      small: {
        padding: '0 calc(var(--padding-md) * 0.8)',
        height: 'calc(var(--line-height-xs) * 0.8)',
        fontSize: 'var(--font-size-sm)',
      },
      medium: {
        padding: '0 var(--padding-md)',
        height: 'calc(var(--line-height-md) * 0.8)',
        fontSize: 'var(--font-size-md)',
      },
      default: {
        padding: '0 var(--padding-md)',
        height: 'var(--line-height-xs)',
      },
    };

    if (size) {
      buttonStyles = {
        ...buttonStyles,
        ...sizeStyles[size],
      };
    }

    if (variant === 'outlined') {
      if (bg === 'default') {
        buttonStyles = {
          ...buttonStyles,
          borderColor: 'var(--hl-lg)',
        };
      } else {
        buttonStyles = {
          ...buttonStyles,
          borderColor: 'inherit',
        };
      }
    }

    if (variant === 'contained') {
      if (bg === 'default') {
        buttonStyles = {
          ...buttonStyles,
          backgroundColor: 'var(--hl-xs)',
          color: `var(--color-font-${bg})`,
        };
      } else {
        buttonStyles = {
          ...buttonStyles,
          background: `var(--color-${bg})`,
          color: `var(--color-font-${bg})`,
        };
      }
    }

    return buttonStyles;
  };

  return (
    <button style={getButtonStyles()} disabled={isDisabled} {...props}>
      {children}
    </button>
  );
};
