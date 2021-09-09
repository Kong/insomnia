import classnames from 'classnames';
import React, { PureComponent, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

class DropdownRight extends PureComponent<Props> {
  render() {
    const { className, children, ...extraProps } = this.props;
    return (
      <span className={classnames('dropdown__right', className)} {...extraProps}>
        {children}
      </span>
    );
  }
}

export default DropdownRight;
