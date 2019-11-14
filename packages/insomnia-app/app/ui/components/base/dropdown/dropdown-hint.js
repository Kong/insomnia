// @flow
import * as React from 'react';
import Hotkey from '../../hotkey';
import type { KeyBindings } from '../../../../common/hotkeys';

type Props = {
  keyBindings: KeyBindings,
  styles: Object,
};

class DropdownHint extends React.PureComponent<Props> {
  render() {
    const { keyBindings, styles } = this.props;
    return <Hotkey styles={styles} className="dropdown__hint" keyBindings={keyBindings} />;
  }
}

export default DropdownHint;
