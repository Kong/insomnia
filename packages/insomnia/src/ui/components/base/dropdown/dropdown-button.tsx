
import { AriaButtonProps } from '@react-types/button';
import React, { CSSProperties, forwardRef, useRef } from 'react';
import { mergeProps, useButton, useFocusRing } from 'react-aria';
import styled from 'styled-components';

import { Button as ThemedButton, ButtonProps } from '../../themed-button';

interface StyledThemedButtonProps extends ButtonProps {
  removePaddings?: boolean;
  removeBorderRadius?: boolean;
  disableHoverBehavior?: boolean;
}

const StyledThemedButton = styled(ThemedButton).attrs((props: StyledThemedButtonProps) => ({
  variant: props.variant || 'text',
  size: props.size || 'small',
  radius: props.removeBorderRadius ? 0 : props.radius || '3px',
}))`
  height: 100%;
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  padding: ${({ removePaddings = true }) =>
    removePaddings ? 0 : 'var(--padding-xs) var(--padding-sm)'
};

  &:focus,
  &:hover {
    &:not(:disabled) {
      ${({ variant = 'text', bg, disableHoverBehavior = true }) => {
    if (!disableHoverBehavior) {
      return;
    }

    if (variant === 'contained') {
      return 'box-shadow: unset';
    }

    if (bg === 'default') {
      return 'background-color: unset';
    }

    return 'background-color: unset';
  }};
    }
  }

  &:active:not(:disabled) {
    ${({ variant, bg, disableHoverBehavior }) => {
    if (!disableHoverBehavior) {
      return;
    }

    if (variant === 'contained') {
      return 'box-shadow: unset';
    }

    if (bg === 'default') {
      return 'background-color: unset';
    }

    return 'background-color: unset';
  }}
  }
`;

type DropdownButtonProps = {
  className?: string;
  isPressed?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
  isDisabled?: boolean;
} & ButtonProps & AriaButtonProps & StyledThemedButtonProps;

export const DropdownButton = forwardRef<{}, DropdownButtonProps>((props: DropdownButtonProps, ref: any) => {
  const buttonRef = useRef(ref);
  const { buttonProps, isPressed } = useButton({ ...props, onPress: props.onClick }, buttonRef);
  const { focusProps } = useFocusRing();

  return (
    <StyledThemedButton
      ref={buttonRef}
      style={props.style}
      isPressed={isPressed || props.isPressed}
      variant={props.variant || 'text'}
      size={props.size || 'small'}
      {...mergeProps(buttonProps, focusProps, props)}
    >
      {props.children}
    </StyledThemedButton>
  );
});

DropdownButton.displayName = 'DropdownButton';
