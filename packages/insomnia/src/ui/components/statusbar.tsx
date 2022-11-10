import React, { FC } from 'react';
import styled from 'styled-components';

import { SettingsButton } from './buttons/settings-button';
import { SvgIcon } from './svg-icon';

const Bar = styled.div({
  position: 'relative',
  gridArea: 'Statusbar',
  borderTop: '1px solid var(--hl-md)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  overflow: 'hidden',
});

const KongLink = styled.a({
  '&&': {
    display: 'flex',
    alignItems: 'center',
    fontSize: 'var(--font-size-xs)',
    padding: '0 var(--padding-md)',
    justifyContent: 'flex-end',
    boxSizing: 'border-box',
    color: 'var(--color-font)',
  },
});

export const StatusBar: FC = () => {
  return <Bar>
    <SettingsButton />
    <KongLink className="made-with-love" href="https://konghq.com/">
      Made with&nbsp; <SvgIcon icon="heart" /> &nbsp;by Kong
    </KongLink>
  </Bar>;
};
