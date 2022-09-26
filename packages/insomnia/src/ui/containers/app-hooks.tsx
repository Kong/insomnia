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
    'PREFERENCES_SHOW_GENERAL':
      () => showModal(SettingsModal),
    'PREFERENCES_SHOW_KEYBOARD_SHORTCUTS':
      () => showModal(SettingsModal, TAB_INDEX_SHORTCUTS),
    'SHOW_RECENT_REQUESTS':
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
    'WORKSPACE_SHOW_SETTINGS':
      () => showModal(WorkspaceSettingsModal, activeWorkspace),
    'REQUEST_SHOW_SETTINGS':
      () => {
        if (activeRequest) {
          showModal(RequestSettingsModal, { request: activeRequest });
        }
      },
    'REQUEST_QUICK_SWITCH':
      () => showModal(RequestSwitcherModal),
    'ENVIRONMENT_SHOW_EDITOR':
      () => showModal(WorkspaceEnvironmentsEditModal, activeWorkspace),
    'SHOW_COOKIES_EDITOR':
      () => showModal(CookiesModal),
    'REQUEST_CREATE_HTTP':
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
    'REQUEST_SHOW_DELETE':
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
    'REQUEST_SHOW_CREATE_FOLDER':
      () => {
        if (activeWorkspace) {
          createRequestGroup(activeRequest ? activeRequest.parentId : activeWorkspace._id);
        }
      },
    'REQUEST_SHOW_GENERATE_CODE_EDITOR':
      () => showModal(GenerateCodeModal, activeRequest),
    'REQUEST_SHOW_DUPLICATE':
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
    'REQUEST_TOGGLE_PIN':
      async () => {
        if (activeRequest) {
          const meta = isGrpcRequest(activeRequest) ? await getGrpcRequestMetaByParentId(activeRequest._id) : await getRequestMetaByParentId(activeRequest._id);
          updateRequestMetaByParentId(activeRequest._id, { pinned: !meta?.pinned });
        }
      },
    'PLUGIN_RELOAD':
      () => plugins.reloadPlugins(),
    'ENVIRONMENT_SHOW_VARIABLE_SOURCE_AND_VALUE':
      () => models.settings.update(settings, { showVariableSourceAndValue: !settings.showVariableSourceAndValue }),
    'SIDEBAR_TOGGLE':
      () => {
        if (activeWorkspaceMeta) {
          models.workspaceMeta.update(activeWorkspaceMeta, { sidebarHidden: !activeWorkspaceMeta.sidebarHidden });
        }
      },
  });
  return null;
};
