import { useRootLoaderData } from '~/root';

import * as plugins from '../../plugins';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal } from '../components/modals';
import { SettingsModal } from '../components/modals/settings-modal';
import { useSettingsPatcher } from './use-request';

export const useGlobalKeyboardShortcuts = () => {
  const { settings } = useRootLoaderData()!;
  const patchSettings = useSettingsPatcher();

  useDocBodyKeyboardShortcuts({
    plugin_reload: () => plugins.reloadPlugins(),
    // TODO: move this to workspace route
    environment_showVariableSourceAndValue: () =>
      patchSettings({ showVariableSourceAndValue: !settings.showVariableSourceAndValue }),
    // TODO: move this to organization route
    preferences_showGeneral: () => showModal(SettingsModal),
    preferences_showKeyboardShortcuts: () => showModal(SettingsModal, { tab: 'keyboard' }),
  });
};
