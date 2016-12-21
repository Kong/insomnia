import React from 'react';
import classnames from 'classnames';

const DropdownDivider = ({children}) => {
  const classes = classnames(
    'dropdown__divider',
    {'dropdown__divider--no-name': !children}
  );

  return (
    <li className={classes}>
      <span className="dropdown__divider__label">
        {children}
      </span>
    </li>
  )
};

DropdownDivider.propTypes = {};

export default DropdownDivider;
