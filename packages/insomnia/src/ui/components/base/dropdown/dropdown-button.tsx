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
const DropdownButtonForwarded = forwardRef<DropdownButtonHandle, Props>(({ noWrap, children, ...otherProps }, ref) => {
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
DropdownButtonForwarded.displayName = DROPDOWN_BUTTON_DISPLAY_NAME;

export const DropdownButton = Object.assign(DropdownButtonForwarded, { name: DROPDOWN_BUTTON_DISPLAY_NAME });
