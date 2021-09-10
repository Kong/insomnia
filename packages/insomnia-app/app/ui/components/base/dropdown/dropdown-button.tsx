import React, { ButtonHTMLAttributes, FC, memo, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  noWrap?: boolean;
  className?: string;
}

export const DropdownButton: FC<Props> = memo(({ children, noWrap, ...props }) => {
  if (noWrap) {
    return <>{children}</>;
  }

  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
});

DropdownButton.displayName = 'DropdownButton';
