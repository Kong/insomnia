import { KeyBindings } from 'insomnia-common';
import React, { PureComponent } from 'react';

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
