import classnames from 'classnames';
import React, { PureComponent, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

// eslint-disable-next-line react/prefer-stateless-function -- Dropdown's implementation makes changing this to a function component tricky.
export class DropdownRight extends PureComponent<Props> {
  render() {
    const { className, children, ...extraProps } = this.props;
    return (
      <span className={classnames('dropdown__right', className)} {...extraProps}>
        {children}
      </span>
    );
  }
}
