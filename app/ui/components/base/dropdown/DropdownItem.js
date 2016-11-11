import React, {PropTypes} from 'react';
import classnames from 'classnames';

const DropdownItem = ({stayOpenAfterClick, buttonClass, onClick, children, className, ...props}) => {
  const inner = (
    <div className={classnames('dropdown__inner', className)}>
      <span className="dropdown__text">{children}</span>
    </div>
  );

  const buttonProps = {
    onClick: stayOpenAfterClick ? e => {e.stopPropagation(); onClick(e)} : onClick,
    ...props
  };

  const button = React.createElement(buttonClass || 'button', buttonProps, inner);
  return (
    <li>{button}</li>
  )
};

DropdownItem.propTypes = {
  buttonClass: PropTypes.any,
  stayOpenAfterClick: PropTypes.bool
};

export default DropdownItem;
