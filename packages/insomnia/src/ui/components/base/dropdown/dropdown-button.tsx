import React, { ButtonHTMLAttributes, forwardRef, ReactNode, useImperativeHandle, useRef } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  noWrap?: boolean;
  className?: string;
}
export const DROPDOWN_BUTTON_DISPLAY_NAME = 'DropdownButton';
export interface DropdownButtonHandle {
  blur(): void;
}
export const DropdownButton = forwardRef<DropdownButtonHandle, Props>(({ noWrap, children, ...otherProps }, ref) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useImperativeHandle(ref, () => ({
    blur(): void {
      buttonRef.current?.blur();
    },
  }), []);

  if (noWrap) {
    return <>{children}</>;
  }

  return (
    <button ref={buttonRef} type="button" {...otherProps}>
      {children}
    </button>
  );
});
DropdownButton.displayName = DROPDOWN_BUTTON_DISPLAY_NAME;
