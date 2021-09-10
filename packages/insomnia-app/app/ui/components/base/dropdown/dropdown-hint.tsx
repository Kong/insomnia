import React, { FC, memo } from 'react';

import type { KeyBindings } from '../../../../common/hotkeys';
import { Hotkey } from '../../hotkey';

interface Props {
  keyBindings: KeyBindings;
}

export const DropdownHint: FC<Props> = memo(({ keyBindings }) => (
  <Hotkey
    className="dropdown__hint"
    keyBindings={keyBindings}
  />
));

DropdownHint.displayName = 'DropdownHint';
