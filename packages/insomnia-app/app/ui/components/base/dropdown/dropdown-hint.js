// @flow
import * as React from 'react';
import type { Hotkey as HotkeyType } from '../../../../common/hotkeys';
import Hotkey from '../../hotkey';

type Props = {
  hotkey: HotkeyType
};

class DropdownHint extends React.PureComponent<Props> {
  render() {
    const { hotkey } = this.props;
    return <Hotkey className="dropdown__hint" hotkey={hotkey} />;
  }
}

export default DropdownHint;
