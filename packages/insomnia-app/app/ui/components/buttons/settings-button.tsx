import { CircleButton, SvgIcon, Tooltip } from 'insomnia-components';
import React, { FunctionComponent } from 'react';
import { connect } from 'react-redux';

import { hotKeyRefs } from '../../../common/hotkeys';
import type { Settings } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import { Hotkey } from '../hotkey';
import { showSettingsModal } from '../modals/settings-modal';

interface Props {
  className?: string;
  settings: Settings;
}

const SettingsButton: FunctionComponent<Props> = ({ className, settings }) => (
  <Tooltip
    delay={1000}
    position="bottom"
    message={
      <>
        Preferences (
        <Hotkey keyBindings={settings.hotKeyRegistry[hotKeyRefs.PREFERENCES_SHOW_GENERAL.id]} />)
      </>
    }
  >
    <CircleButton className={className} onClick={showSettingsModal}>
      <SvgIcon icon="gear" />
    </CircleButton>
  </Tooltip>
);

export default connect((state, props) => ({
  // @ts-expect-error -- TSCONVERSION
  settings: selectSettings(state, props),
}))(SettingsButton);
