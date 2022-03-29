import { CircleButton, SvgIcon, Tooltip } from 'insomnia-components';
import React, { FunctionComponent } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { hotKeyRefs } from '../../../common/hotkeys';
import { selectSettings } from '../../redux/selectors';
import { Hotkey } from '../hotkey';
import { showSettingsModal } from '../modals/settings-modal';

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
            <Hotkey keyBindings={hotKeyRegistry[hotKeyRefs.PREFERENCES_SHOW_GENERAL.id]} />)
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
