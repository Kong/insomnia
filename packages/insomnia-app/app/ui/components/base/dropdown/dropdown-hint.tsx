import React, { PureComponent } from 'react';

import type { KeyBindings } from '../../../../common/hotkeys';
import Hotkey from '../../hotkey';

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
