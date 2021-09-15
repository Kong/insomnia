import classnames from 'classnames';
import React, { PureComponent, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

// eslint-disable-next-line react/prefer-stateless-function -- Dropdown's implementation makes changing this to a function component tricky.
export class DropdownDivider extends PureComponent<Props> {
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
