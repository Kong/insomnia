import React, { PureComponent, ReactNode } from 'react';
import classnames from 'classnames';

interface Props {
  children?: ReactNode,
}

class DropdownDivider extends PureComponent<Props> {
  render() {
    const { children } = this.props;
    const classes = classnames('dropdown__divider', {
      'dropdown__divider--no-name': !children,
    });
    return (
      <div className={classes}>
        <span className="dropdown__divider__label">{children}</span>
      </div>
    );
  }
}

export default DropdownDivider;
