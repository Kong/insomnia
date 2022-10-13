import { useSelector } from 'react-redux';

import * as models from '../../models';
import * as plugins from '../../plugins';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal } from '../components/modals';
import { SettingsModal, TAB_INDEX_SHORTCUTS } from '../components/modals/settings-modal';
import { WorkspaceSettingsModal } from '../components/modals/workspace-settings-modal';
import { selectActiveWorkspace, selectActiveWorkspaceMeta, selectSettings } from '../redux/selectors';

export const useGlobalKeyboardShortcuts = () => {
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const settings = useSelector(selectSettings);

  useDocBodyKeyboardShortcuts({
    workspace_showSettings:
      () => showModal(WorkspaceSettingsModal, { workspace: activeWorkspace }),
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
