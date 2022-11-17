import React, { PureComponent } from 'react';

import { PlatformKeyCombinations } from '../../../../common/settings';
import { Hotkey } from '../../hotkey';

interface Props {
  keyBindings: PlatformKeyCombinations;
}

// eslint-disable-next-line react/prefer-stateless-function -- Dropdown's implementation makes changing this to a function component tricky.
export class DropdownHint extends PureComponent<Props> {
  render() {
    const { keyBindings } = this.props;
    return <Hotkey className="dropdown__hint" keyBindings={keyBindings} />;
  }
}
