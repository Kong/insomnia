import React from 'react';
import styled from 'styled-components';

import { PlatformKeyCombinations } from '../../../../common/settings';
import { Hotkey } from '../../hotkey';

const StyledHotkey = styled(Hotkey)({
  color: 'var(--hl-xl)',
  marginLeft: 'auto',
  paddingLeft: 'var(--padding-lg)',
});

interface Props {
  keyBindings: PlatformKeyCombinations;
}

export const DropdownHint = (props: Props) => {
  return <StyledHotkey keyBindings={props.keyBindings} />;
};
