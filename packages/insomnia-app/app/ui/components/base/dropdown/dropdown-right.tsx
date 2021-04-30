import React, { PureComponent } from 'react';
import classnames from 'classnames';

interface Props {
  children: React.ReactNode,
  className?: string,
};

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
