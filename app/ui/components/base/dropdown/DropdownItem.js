import React, {PropTypes} from 'react';
import classnames from 'classnames';

const DropdownItem = ({buttonClass, children, className, ...props}) => {
  const inner = (
    <div className={classnames('dropdown__inner', className)}>
      <span className="dropdown__text">{children}</span>
    </div>
  );

  const button = React.createElement(buttonClass || 'button', props, inner);
  return (
    <li>{button}</li>
  )
};

DropdownItem.propTypes = {
  // Override default button class
  buttonClass: PropTypes.any
};

export default DropdownItem;
