import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {ALT_SYM, CTRL_SYM, isMac, joinHotKeys, MOD_SYM, SHIFT_SYM} from '../../common/constants';

class Hotkey extends PureComponent {
  render () {
    const {char, shift, alt, ctrl, className} = this.props;
    const chars = [ ];

    alt && chars.push(ALT_SYM);
    shift && chars.push(SHIFT_SYM);
    ctrl && chars.push(CTRL_SYM);
    !ctrl && chars.push(MOD_SYM);
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
  ctrl: PropTypes.bool,
  className: PropTypes.string
};

export default Hotkey;
