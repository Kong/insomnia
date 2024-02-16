import { useRouteLoaderData } from 'react-router-dom';

import * as plugins from '../../plugins';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal } from '../components/modals';
import { SettingsModal, TAB_INDEX_SHORTCUTS } from '../components/modals/settings-modal';
import { useRootLoaderData } from '../routes/root';
import { WorkspaceLoaderData } from '../routes/workspace';
import { useSettingsPatcher, useWorkspaceMetaPatcher } from './use-request';
export const useGlobalKeyboardShortcuts = () => {
  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | undefined;
  const {
    settings,
  } = useRootLoaderData();
  const { activeWorkspaceMeta } = workspaceData || {};
  const patchSettings = useSettingsPatcher();
  const patchWorkspaceMeta = useWorkspaceMetaPatcher();

  useDocBodyKeyboardShortcuts({
    plugin_reload:
      () => plugins.reloadPlugins(),
    // TODO: move this to workspace route
    environment_showVariableSourceAndValue:
      () => patchSettings({ showVariableSourceAndValue: !settings.showVariableSourceAndValue }),
    // TODO: move this to organization route
    preferences_showGeneral:
      () => showModal(SettingsModal),
    preferences_showKeyboardShortcuts:
      () => showModal(SettingsModal, { tab: TAB_INDEX_SHORTCUTS }),
    // TODO: move this to workspace route
    sidebar_toggle:
      () => activeWorkspaceMeta && patchWorkspaceMeta(activeWorkspaceMeta.parentId, { sidebarHidden: !activeWorkspaceMeta.sidebarHidden }),
  });
};
