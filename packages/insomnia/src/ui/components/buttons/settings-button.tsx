import React, { FunctionComponent } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { selectSettings } from '../../redux/selectors';
import { Hotkey } from '../hotkey';
import { showSettingsModal } from '../modals/settings-modal';
import { SvgIcon } from '../svg-icon';
import { CircleButton } from '../themed-button';
import { Tooltip } from '../tooltip';

const Wrapper = styled.div({
  marginLeft: 'var(--padding-md)',
});

export const SettingsButton: FunctionComponent = () => {
  const { hotKeyRegistry } = useSelector(selectSettings);
  return (
    <Wrapper>
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
        <CircleButton data-testid="settings-button" onClick={showSettingsModal}>
          <SvgIcon icon="gear" />
        </CircleButton>
      </Tooltip>
    </Wrapper>
  );
};
