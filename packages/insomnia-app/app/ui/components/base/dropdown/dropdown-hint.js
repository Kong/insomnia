// @flow
import * as React from 'react';
import Hotkey from '../../hotkey';
import type { KeyBindings } from '../../../../common/hotkeys';

type Props = {
  keyBindings: KeyBindings,
};

class DropdownHint extends React.PureComponent<Props> {
  render() {
    const { keyBindings } = this.props;
    return <Hotkey className="dropdown__hint" keyBindings={keyBindings} />;
  }
}

export default DropdownHint;
