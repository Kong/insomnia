import { useSelector } from 'react-redux';
import { useRouteLoaderData } from 'react-router-dom';

import * as models from '../../models';
import * as plugins from '../../plugins';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal } from '../components/modals';
import { SettingsModal, TAB_INDEX_SHORTCUTS } from '../components/modals/settings-modal';
import { WorkspaceSettingsModal } from '../components/modals/workspace-settings-modal';
import { selectSettings } from '../redux/selectors';
import { WorkspaceLoaderData } from '../routes/workspace';
export const useGlobalKeyboardShortcuts = () => {
  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | undefined;
  const settings = useSelector(selectSettings);
  const { activeWorkspace, activeWorkspaceMeta } = workspaceData || {};
  useDocBodyKeyboardShortcuts({
    workspace_showSettings:
      () => activeWorkspace && showModal(WorkspaceSettingsModal),
    plugin_reload:
      () => plugins.reloadPlugins(),
    environment_showVariableSourceAndValue:
      () => models.settings.update(settings, { showVariableSourceAndValue: !settings.showVariableSourceAndValue }),
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
