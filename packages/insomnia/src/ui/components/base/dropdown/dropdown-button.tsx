import React, { ButtonHTMLAttributes, createElement, forwardRef, ReactNode, useImperativeHandle, useRef } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  noWrap?: boolean;
  className?: string;
  buttonClass?: React.ElementType;
}
export const DROPDOWN_BUTTON_DISPLAY_NAME = 'DropdownButton';
export interface DropdownButtonHandle {
  blur(): void;
}

export const DropdownButton = forwardRef<DropdownButtonHandle, Props>(({ noWrap, children, buttonClass = 'button', ...otherProps }, ref) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useImperativeHandle(ref, () => ({
    blur(): void {
      buttonRef.current?.blur();
    },
  }), []);

  if (noWrap) {
    return <>{children}</>;
  }

  return createElement(buttonClass, {
    ref: buttonRef,
    type: 'button',
    ...otherProps,
  }, children);
});

DropdownButton.displayName = DROPDOWN_BUTTON_DISPLAY_NAME;
// @ts-expect-error -- This is currently a hack for dropdowns to recognize this component
DropdownButton.name = DROPDOWN_BUTTON_DISPLAY_NAME;
