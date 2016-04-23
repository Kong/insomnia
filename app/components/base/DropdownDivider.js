import React from 'react'

const DropdownDivider = props => (
  <li className="dropdown__divider">
    <span className="dropdown__divider__label">{props.name}</span>
  </li>
);

DropdownDivider.propTypes = {};

export default DropdownDivider;
