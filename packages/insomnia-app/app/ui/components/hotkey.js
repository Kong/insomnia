// @flow
import * as React from 'react';
import classnames from 'classnames';
import { ALT_SYM, CTRL_SYM, isMac, joinHotKeys, META_SYM, SHIFT_SYM } from '../../common/constants';
import type { KeyBindings } from '../../common/hotkeys';
import * as hotkeys from '../../common/hotkeys';

type Props = {
  keyBindings: KeyBindings,

  // Optional
  className?: string,
};

class Hotkey extends React.PureComponent<Props> {
  render() {
    const { keyBindings, className } = this.props;

    const keyComb = hotkeys.getPlatformKeyCombinations(keyBindings)[0];
    const { ctrl, alt, shift, meta, keyCode } = keyComb;
    const chars = [];

    alt && chars.push(ALT_SYM);
    shift && chars.push(SHIFT_SYM);
    ctrl && chars.push(CTRL_SYM);
    meta && chars.push(META_SYM);

    chars.push(hotkeys.getChar(keyCode));

    return (
      <span className={classnames(className, { 'font-normal': isMac() })}>
        {joinHotKeys(chars)}
      </span>
    );
  }
}

export default Hotkey;
