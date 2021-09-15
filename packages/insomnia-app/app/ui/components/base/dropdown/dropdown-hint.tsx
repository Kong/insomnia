import React, { PureComponent } from 'react';

import type { KeyBindings } from '../../../../common/hotkeys';
import { Hotkey } from '../../hotkey';

interface Props {
  keyBindings: KeyBindings;
}

// eslint-disable-next-line react/prefer-stateless-function -- Dropdown's implementation makes changing this to a function component tricky.
export class DropdownHint extends PureComponent<Props> {
  render() {
    const { keyBindings } = this.props;
    return <Hotkey className="dropdown__hint" keyBindings={keyBindings} />;
  }
}
