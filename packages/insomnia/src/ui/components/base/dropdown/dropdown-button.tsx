
import { AriaButtonProps } from '@react-types/button';
import React, { CSSProperties, forwardRef, useRef } from 'react';
import { mergeProps, useButton, useFocusRing } from 'react-aria';
import styled from 'styled-components';

import { Button as ThemedButton, ButtonProps } from '../../themed-button';

interface StyledThemedButtonProps extends ButtonProps {
  removePaddings?: boolean;
  removeBorderRadius?: boolean;
  disableHoverBehavior?: boolean;
  isDisabled?: boolean;
}

const StyledThemedButton = styled(ThemedButton)(({ removePaddings, disableHoverBehavior, isDisabled }: StyledThemedButtonProps) => ({
  height: '100%',
  display: 'flex !important',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: removePaddings ? 0 : 'var(--padding-xs) var(--padding-sm)',
  cursor: isDisabled ? 'not-allowed' : 'pointer',

  '&:focus:not(:disabled)': {
    boxShadow: `${disableHoverBehavior && 'unset'}`,
    backgroundColor: `${disableHoverBehavior && 'unset'}`,
  },

  '&:hover:not(:disabled)': {
    boxShadow: `${disableHoverBehavior && 'unset'}`,
    backgroundColor: `${disableHoverBehavior && 'unset'}`,
  },

  '&:active:not(:disabled)': {
    boxShadow: `${disableHoverBehavior && 'unset'}`,
    backgroundColor: `${disableHoverBehavior && 'unset'}`,
  },
}));

type DropdownButtonProps = {
  className?: string;
  isPressed?: boolean;
  style?: CSSProperties;
  isDisabled?: boolean;
  onClick?: () => void;
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
      radius={props.removeBorderRadius ? '0' : props.radius || '3px'}
      removePaddings={props.removePaddings || true}
      disableHoverBehavior={props.disableHoverBehavior || true}
      isDisabled={props.isDisabled}
      {...mergeProps(buttonProps, focusProps, props)}
    >
      {props.children}
    </StyledThemedButton>
  );
});

DropdownButton.displayName = 'DropdownButton';
