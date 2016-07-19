import React, {PropTypes} from 'react';

const DropdownDivider = ({name}) => (
  <li className="dropdown__divider">
    <span className="dropdown__divider__label">{name}</span>
  </li>
);

DropdownDivider.propTypes = {
  name: PropTypes.string.isRequired
};

export default DropdownDivider;
