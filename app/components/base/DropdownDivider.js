import React, {PropTypes} from 'react';
import classnames from 'classnames';

const DropdownDivider = ({name}) => {
  const classes = classnames(
    'dropdown__divider',
    {'dropdown__divider--no-name': !name}
  );

  return (
    <li className={classes}>
      <span className="dropdown__divider__label">
        {name}
      </span>
    </li>
  )
};

DropdownDivider.propTypes = {
  name: PropTypes.string
};

export default DropdownDivider;
