import React from 'react';

const DropdownButton = ({children, ...props}) => (
  <button {...props}>
    {children}
  </button>
);

DropdownButton.propTypes = {};

export default DropdownButton;
