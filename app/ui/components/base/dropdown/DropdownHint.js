import React, {PropTypes, PureComponent} from 'react';
import {MOD_SYM} from '../../../../common/constants';

class DropdownHint extends PureComponent {
  render () {
    const {char} = this.props;
    return (
      <span className="dropdown__hint">{MOD_SYM}{char}</span>
    );
  }
}

DropdownHint.propTypes = {
  char: PropTypes.string.isRequired
};

export default DropdownHint;
