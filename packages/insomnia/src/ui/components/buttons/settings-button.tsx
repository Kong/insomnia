import React, { FunctionComponent } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { selectSettings } from '../../redux/selectors';
import { Hotkey } from '../hotkey';
import { showSettingsModal } from '../modals/settings-modal';
import { SvgIcon } from '../svg-icon';
import { Button } from '../themed-button';
import { Tooltip } from '../tooltip';

const StatusButton = styled(Button).attrs({
  size: 'xs',
})({
  height: '30px',
  borderRadius: 0,
  gap: 'var(--padding-xs)',
});

export const SettingsButton: FunctionComponent = () => {
  const { hotKeyRegistry } = useSelector(selectSettings);
  return (
    <Tooltip
      delay={1000}
      position="bottom"
      message={
        <>
          Preferences (
          <Hotkey keyBindings={hotKeyRegistry.preferences_showGeneral} />)
        </>
      }
    >
      <StatusButton
        variant='text'
        data-testid="settings-button"
        onClick={showSettingsModal}
      >
        <SvgIcon icon="gear" /> Preferences
      </StatusButton>
    </Tooltip>
  );
};
