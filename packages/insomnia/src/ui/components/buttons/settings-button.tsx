import React, { FunctionComponent } from 'react';
import { useSelector } from 'react-redux';

import { selectSettings } from '../../redux/selectors';
import { Hotkey } from '../hotkey';
import { showSettingsModal } from '../modals/settings-modal';
import { SvgIcon } from '../svg-icon';
import { Button } from '../themed-button';
import { Tooltip } from '../tooltip';

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
      <Button
        variant='text'
        data-testid="settings-button"
        onClick={showSettingsModal}
      >
        <SvgIcon icon="gear" />
      </Button>
    </Tooltip>
  );
};
