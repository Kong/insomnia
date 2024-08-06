import React from 'react';

import type { PlatformKeyCombinations } from '../../../../common/settings';
import { Hotkey } from '../../hotkey';

interface Props {
  keyBindings: PlatformKeyCombinations;
}

export const DropdownHint = (props: Props) => {
  return <Hotkey
    className='ml-auto text-[--hl-xl] pl-[--padding-lg]'
    keyBindings={props.keyBindings}
  />;
};
