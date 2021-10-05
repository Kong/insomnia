import React, { ButtonHTMLAttributes, PureComponent, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  noWrap?: boolean;
  className?: string;
}

// eslint-disable-next-line react/prefer-stateless-function -- Dropdown's implementation makes changing this to a function component tricky.
export class DropdownButton extends PureComponent<Props> {
  render() {
    const { children, noWrap, ...props } = this.props;

    if (noWrap) {
      return <>{children}</>;
    }

    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  }
}
