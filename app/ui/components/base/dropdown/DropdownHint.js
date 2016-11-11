import React, {PropTypes} from 'react';
import {MOD_SYM} from '../../../../common/constants';

const DropdownHint = ({char}) => (
  <div className="dropdown__hint">
    <span>{MOD_SYM}{char}</span>
  </div>
);

DropdownHint.propTypes = {
  char: PropTypes.string.isRequired
};

export default DropdownHint;
