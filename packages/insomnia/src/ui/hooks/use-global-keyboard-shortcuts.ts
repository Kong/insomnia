import { useRootLoaderData } from '~/root';
import { plugins } from '~/ui/plugins/renderer-bridge';
import { reload } from '~/ui/templating/renderer-safe';

import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal } from '../components/modals';
import { SettingsModal } from '../components/modals/settings-modal';
import { useSettingsPatcher } from './use-request';

export const useGlobalKeyboardShortcuts = () => {
  const { settings } = useRootLoaderData()!;
  const patchSettings = useSettingsPatcher();

  useDocBodyKeyboardShortcuts({
    // Route through the same path as Settings → Plugins reload: rescan plugins AND invalidate the
    // render worker's cached Liquid engine, so a plugin that failed once actually recovers (#10295).
    plugin_reload: async () => {
      await plugins.reloadPlugins();
      reload();
    },
    // TODO: move this to workspace route
    environment_showVariableSourceAndValue: () =>
      patchSettings({ showVariableSourceAndValue: !settings.showVariableSourceAndValue }),
    // TODO: move this to organization route
    preferences_showGeneral: () => showModal(SettingsModal),
    preferences_showKeyboardShortcuts: () => showModal(SettingsModal, { tab: 'keyboard' }),
  });
};
