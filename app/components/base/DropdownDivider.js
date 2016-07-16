import React, {PropTypes} from 'react';

const DropdownDivider = props => (
  <li className="dropdown__divider">
    <span className="dropdown__divider__label">{props.name}</span>
  </li>
);

DropdownDivider.propTypes = {
  name: PropTypes.string.isRequired
};

export default DropdownDivider;
