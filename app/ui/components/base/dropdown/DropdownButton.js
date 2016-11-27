import React from 'react';

const DropdownButton = ({children, ...props}) => (
  <button type="button" {...props}>
    {children}
  </button>
);

DropdownButton.propTypes = {};

export default DropdownButton;
