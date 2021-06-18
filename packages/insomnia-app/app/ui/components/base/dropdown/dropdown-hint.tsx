import React, { PureComponent } from 'react';
import Hotkey from '../../hotkey';
import type { KeyBindings } from '../../../../common/hotkeys';

interface Props {
  keyBindings: KeyBindings;
}

class DropdownHint extends PureComponent<Props> {
  render() {
    const { keyBindings } = this.props;
    return <Hotkey className="dropdown__hint" keyBindings={keyBindings} />;
  }
}

export default DropdownHint;
