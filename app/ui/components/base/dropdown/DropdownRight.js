import React, {PropTypes} from 'react';
import classnames from 'classnames';

const DropdownRight = ({className, children, ...extraProps}) => (
  <span className={classnames('dropdown__right', className)} {...extraProps}>
    {children}
  </span>
);

DropdownRight.propTypes = {};

export default DropdownRight;
