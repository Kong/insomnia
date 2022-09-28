import { FC } from 'react';
import { useSelector } from 'react-redux';

import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import * as models from '../../models';
import { isGrpcRequest } from '../../models/grpc-request';
import { getByParentId as getGrpcRequestMetaByParentId } from '../../models/grpc-request-meta';
import * as requestOperations from '../../models/helpers/request-operations';
import { getByParentId as getRequestMetaByParentId } from '../../models/request-meta';
import * as plugins from '../../plugins';
import { useGlobalKeyboardShortcuts } from '../components/keydown-binder';
import { showModal } from '../components/modals';
import { AskModal } from '../components/modals/ask-modal';
import { CookiesModal } from '../components/modals/cookies-modal';
import { GenerateCodeModal } from '../components/modals/generate-code-modal';
import { PromptModal } from '../components/modals/prompt-modal';
import { RequestSettingsModal } from '../components/modals/request-settings-modal';
import { RequestSwitcherModal } from '../components/modals/request-switcher-modal';
import { SettingsModal, TAB_INDEX_SHORTCUTS } from '../components/modals/settings-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { WorkspaceSettingsModal } from '../components/modals/workspace-settings-modal';
import { updateRequestMetaByParentId } from '../hooks/create-request';
import { createRequestGroup } from '../hooks/create-request-group';
import { useSettingsSideEffects } from '../hooks/use-settings-side-effects';
import { useSyncMigration } from '../hooks/use-sync-migration';
import { selectActiveRequest, selectActiveWorkspace, selectActiveWorkspaceMeta, selectSettings } from '../redux/selectors';

export const AppHooks: FC = () => {
  useSyncMigration();
  useSettingsSideEffects();
  const activeRequest = useSelector(selectActiveRequest);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const settings = useSelector(selectSettings);

  useGlobalKeyboardShortcuts({
    preferences_showGeneral:
      () => showModal(SettingsModal),
    preferences_showKeyboardShortcuts:
      () => showModal(SettingsModal, TAB_INDEX_SHORTCUTS),
    request_showRecent:
      () => showModal(RequestSwitcherModal, {
        disableInput: true,
        maxRequests: 10,
        maxWorkspaces: 0,
        selectOnKeyup: true,
        title: 'Recent Requests',
        hideNeverActiveRequests: true,
        // Add an open delay so the dialog won't show for quick presses
        openDelay: 150,
      }),
    workspace_showSettings:
      () => showModal(WorkspaceSettingsModal, activeWorkspace),
    request_showSettings:
      () => {
        if (activeRequest) {
          showModal(RequestSettingsModal, { request: activeRequest });
        }
      },
    request_quickSwitch:
      () => showModal(RequestSwitcherModal),
    environment_showEditor:
      () => showModal(WorkspaceEnvironmentsEditModal, activeWorkspace),
    showCookiesEditor:
      () => showModal(CookiesModal),
    request_createHTTP:
      async () => {
        if (activeWorkspace) {
          const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
          const request = await models.request.create({
            parentId,
            name: 'New Request',
          });
          if (activeWorkspaceMeta) {
            await models.workspaceMeta.update(activeWorkspaceMeta, { activeRequestId: request._id });
          }
          await updateRequestMetaByParentId(request._id, {
            lastActive: Date.now(),
          });
          models.stats.incrementCreatedRequests();
          trackSegmentEvent(SegmentEvent.requestCreate, { requestType: 'HTTP' });
        }
      },
    request_showDelete:
      () => {
        if (activeRequest) {
          showModal(AskModal, {
            title: 'Delete Request?',
            message: `Really delete ${activeRequest.name}?`,
            onDone: async (confirmed: boolean) => {
              if (confirmed) {
                await requestOperations.remove(activeRequest);
                models.stats.incrementDeletedRequests();
              }
            },
          });
        }
      },
    request_showCreateFolder:
      () => {
        if (activeWorkspace) {
          createRequestGroup(activeRequest ? activeRequest.parentId : activeWorkspace._id);
        }
      },
    request_showGenerateCodeEditor:
      () => showModal(GenerateCodeModal, activeRequest),
    request_showDuplicate:
      () => {
        if (activeRequest) {
          showModal(PromptModal, {
            title: 'Duplicate Request',
            defaultValue: activeRequest.name,
            submitName: 'Create',
            label: 'New Name',
            selectText: true,
            onComplete: async (name: string) => {
              const newRequest = await requestOperations.duplicate(activeRequest, {
                name,
              });
              if (activeWorkspaceMeta) {
                await models.workspaceMeta.update(activeWorkspaceMeta, { activeRequestId: newRequest._id });
              }
              await updateRequestMetaByParentId(newRequest._id, {
                lastActive: Date.now(),
              });
              models.stats.incrementCreatedRequests();
            },
          });
        }
      },
    request_togglePin:
      async () => {
        if (activeRequest) {
          const meta = isGrpcRequest(activeRequest) ? await getGrpcRequestMetaByParentId(activeRequest._id) : await getRequestMetaByParentId(activeRequest._id);
          updateRequestMetaByParentId(activeRequest._id, { pinned: !meta?.pinned });
        }
      },
    plugin_reload:
      () => plugins.reloadPlugins(),
    environment_showVariableSourceAndValue:
      () => models.settings.update(settings, { showVariableSourceAndValue: !settings.showVariableSourceAndValue }),
    sidebar_toggle:
      () => {
        if (activeWorkspaceMeta) {
          models.workspaceMeta.update(activeWorkspaceMeta, { sidebarHidden: !activeWorkspaceMeta.sidebarHidden });
        }
      },
  });

  return null;
};
