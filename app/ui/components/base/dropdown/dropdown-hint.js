// @flow
import React, {PureComponent} from 'react';
import type {Hotkey as HotkeyType} from '../../../../common/hotkeys';
import Hotkey from '../../hotkey';

type Props = {
  hotkey: HotkeyType,
};

class DropdownHint extends PureComponent {
  props: Props;

  render () {
    const {hotkey} = this.props;
    return (
      <Hotkey className="dropdown__hint" hotkey={hotkey}/>
    );
  }
}

export default DropdownHint;
