import React, {PropTypes, PureComponent} from 'react';
import {ALT_SYM, isMac, joinHotKeys, MOD_SYM, SHIFT_SYM} from '../../common/constants';

class Hotkey extends PureComponent {
  render () {
    const {char, shift, alt, className} = this.props;
    const chars = [ ];

    alt && chars.push(ALT_SYM);
    shift && chars.push(SHIFT_SYM);
    chars.push(MOD_SYM);
    chars.push(char);

    return (
      <span className={`${isMac() ? 'font-normal' : ''} ${className}`}>
        {joinHotKeys(chars)}
      </span>
    );
  }
}

Hotkey.propTypes = {
  char: PropTypes.string.isRequired,

  // Optional
  alt: PropTypes.bool,
  shift: PropTypes.bool,
  className: PropTypes.string
};

export default Hotkey;
