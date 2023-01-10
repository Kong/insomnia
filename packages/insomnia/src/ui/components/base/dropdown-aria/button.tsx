import { AriaButtonProps } from '@react-types/button';
import React, { CSSProperties, forwardRef, useRef } from 'react';
import { mergeProps, useButton, useFocusRing } from 'react-aria';

import { Button as ThemedButton, ButtonProps } from '../../themed-button';

type Props = {
  className?: string;
  isPressed?: boolean;
  style?: CSSProperties;
} & ButtonProps & AriaButtonProps;

export const Button = forwardRef<{}, Props>((props: Props, ref: any) => {
  const buttonRef = useRef(ref);
  const { buttonProps, isPressed } = useButton(props, buttonRef);
  const { focusProps } = useFocusRing();

  return (
    <ThemedButton
      ref={buttonRef}
      style={props.style}
      isPressed={isPressed || props.isPressed}
      {...mergeProps(buttonProps, focusProps, props)}
    >
      {props.children}
    </ThemedButton>
  );
});

Button.displayName = 'Button';
