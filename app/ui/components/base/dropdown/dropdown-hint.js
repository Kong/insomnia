import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import Hotkey from '../../hotkey';

class DropdownHint extends PureComponent {
  render () {
    const {char, shift, alt} = this.props;
    return (
      <Hotkey
        className="dropdown__hint"
        char={char}
        alt={alt}
        shift={shift}
      />
    );
  }
}

DropdownHint.propTypes = {
  char: PropTypes.string.isRequired,

  // Optional
  alt: PropTypes.bool,
  shift: PropTypes.bool
};

export default DropdownHint;
