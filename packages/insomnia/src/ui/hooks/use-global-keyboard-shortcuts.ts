import { useRouteLoaderData } from 'react-router-dom';

import * as models from '../../models';
import * as plugins from '../../plugins';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal } from '../components/modals';
import { SettingsModal, TAB_INDEX_SHORTCUTS } from '../components/modals/settings-modal';
import { OrganizationLoaderData } from '../routes/organization';
import { WorkspaceLoaderData } from '../routes/workspace';
import { useSettingsPatcher } from './use-request';
export const useGlobalKeyboardShortcuts = () => {
  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | undefined;
  const {
    settings,
  } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const { activeWorkspaceMeta } = workspaceData || {};
  const patchSettings = useSettingsPatcher();

  useDocBodyKeyboardShortcuts({
    plugin_reload:
      () => plugins.reloadPlugins(),
    environment_showVariableSourceAndValue:
      () => patchSettings({ showVariableSourceAndValue: !settings.showVariableSourceAndValue }),
    preferences_showGeneral:
      () => showModal(SettingsModal),
    preferences_showKeyboardShortcuts:
      () => showModal(SettingsModal, { tab: TAB_INDEX_SHORTCUTS }),
    sidebar_toggle:
      () => {
        if (activeWorkspaceMeta) {
          models.workspaceMeta.update(activeWorkspaceMeta, { sidebarHidden: !activeWorkspaceMeta.sidebarHidden });
        }
      },
  });
};
