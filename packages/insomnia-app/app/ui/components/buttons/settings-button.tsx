import React, { FunctionComponent } from 'react';
import { CircleButton, SvgIcon, Tooltip } from 'insomnia-components';
import { showSettingsModal } from '../modals/settings-modal';
import type { Settings } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import { connect } from 'react-redux';
import Hotkey from '../hotkey';
import { hotKeyRefs } from '../../../common/hotkeys';

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
    }>
    <CircleButton className={className} onClick={showSettingsModal}>
      <SvgIcon icon="gear" />
    </CircleButton>
  </Tooltip>
);

export default connect((state, props) => ({
  // @ts-expect-error -- TSCONVERSION
  settings: selectSettings(state, props),
}))(SettingsButton);
