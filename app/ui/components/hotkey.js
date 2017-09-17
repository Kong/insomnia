// @flow
import React from 'react';
import classnames from 'classnames';
import type {Hotkey as HotkeyType} from '../../common/hotkeys';
import {ALT_SYM, CTRL_SYM, isMac, joinHotKeys, MOD_SYM, SHIFT_SYM} from '../../common/constants';
import * as hotkeys from '../../common/hotkeys';

type Props = {
  hotkey: HotkeyType,

  // Optional
  className?: string
};

class Hotkey extends React.PureComponent {
  props: Props;

  render () {
    const {hotkey, className} = this.props;
    const {alt, shift, meta} = hotkey;
    const chars = [ ];

    alt && chars.push(ALT_SYM);
    shift && chars.push(SHIFT_SYM);

    if (meta) {
      chars.push(isMac() ? MOD_SYM : CTRL_SYM);
    }

    chars.push(hotkeys.getChar(hotkey));

    return (
      <span className={classnames(className, {'font-normal': isMac()})}>
        {joinHotKeys(chars)}
      </span>
    );
  }
}

export default Hotkey;
