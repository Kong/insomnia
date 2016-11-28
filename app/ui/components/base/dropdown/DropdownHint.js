import React, {PropTypes} from 'react';
import {MOD_SYM} from '../../../../common/constants';

const DropdownHint = ({char}) => (
  <span className="dropdown__hint">
    {MOD_SYM}{char}
  </span>
);

DropdownHint.propTypes = {
  char: PropTypes.string.isRequired
};

export default DropdownHint;
