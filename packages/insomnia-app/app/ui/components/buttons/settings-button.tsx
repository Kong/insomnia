import React from 'react';
import { CircleButton, SvgIcon, Tooltip } from 'insomnia-components';
import { showSettingsModal } from '../modals/settings-modal';
import type { Settings } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import { connect } from 'react-redux';
import Hotkey from '../hotkey';
import { hotKeyRefs } from '../../../common/hotkeys';
type Props = {
  className?: string;
  settings: Settings;
};

const SettingsButton = ({ className, settings }: Props) => (
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

const mapStateToProps = (state, props) => {
  const settings = selectSettings(state, props);
  return {
    settings,
  };
};

export default connect(mapStateToProps)(SettingsButton);
