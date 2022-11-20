import * as models from '@insomnia/models';
import { isGrpcRequest } from '@insomnia/models/grpc-request';
import { getByParentId as getGrpcRequestMetaByParentId } from '@insomnia/models/grpc-request-meta';
import * as requestOperations from '@insomnia/models/helpers/request-operations';
import { isRequest } from '@insomnia/models/request';
import { getByParentId as getRequestMetaByParentId } from '@insomnia/models/request-meta';
import { isWebSocketRequest } from '@insomnia/models/websocket-request';
import { SegmentEvent, trackSegmentEvent } from '@insomnia/ui/analytics';
import { EnvironmentsDropdown } from '@insomnia/ui/components/dropdowns/environments-dropdown';
import { ErrorBoundary } from '@insomnia/ui/components/error-boundary';
import { useDocBodyKeyboardShortcuts } from '@insomnia/ui/components/keydown-binder';
import { showModal } from '@insomnia/ui/components/modals';
import { AskModal } from '@insomnia/ui/components/modals/ask-modal';
import { CookiesModal, showCookiesModal } from '@insomnia/ui/components/modals/cookies-modal';
import { GenerateCodeModal } from '@insomnia/ui/components/modals/generate-code-modal';
import { PromptModal } from '@insomnia/ui/components/modals/prompt-modal';
import { RequestSettingsModal } from '@insomnia/ui/components/modals/request-settings-modal';
import { RequestSwitcherModal } from '@insomnia/ui/components/modals/request-switcher-modal';
import { WorkspaceEnvironmentsEditModal } from '@insomnia/ui/components/modals/workspace-environments-edit-modal';
import { GrpcRequestPane } from '@insomnia/ui/components/panes/grpc-request-pane';
import { GrpcResponsePane } from '@insomnia/ui/components/panes/grpc-response-pane';
import { PlaceholderRequestPane } from '@insomnia/ui/components/panes/placeholder-request-pane';
import { RequestPane } from '@insomnia/ui/components/panes/request-pane';
import { ResponsePane } from '@insomnia/ui/components/panes/response-pane';
import { SidebarChildren } from '@insomnia/ui/components/sidebar/sidebar-children';
import { SidebarFilter } from '@insomnia/ui/components/sidebar/sidebar-filter';
import { SidebarLayout } from '@insomnia/ui/components/sidebar-layout';
import { WebSocketRequestPane } from '@insomnia/ui/components/websockets/websocket-request-pane';
import { WebSocketResponsePane } from '@insomnia/ui/components/websockets/websocket-response-pane';
import { updateRequestMetaByParentId } from '@insomnia/ui/hooks/create-request';
import { createRequestGroup } from '@insomnia/ui/hooks/create-request-group';
import {
  selectActiveEnvironment,
  selectActiveRequest,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectSettings,
} from '@insomnia/ui/redux/selectors';
import { selectSidebarFilter } from '@insomnia/ui/redux/sidebar-selectors';
import { invariant } from '@remix-run/router';
import React, { FC, Fragment, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

const Debug: FC = () => {
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeRequest = useSelector(selectActiveRequest);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const settings = useSelector(selectSettings);
  const sidebarFilter = useSelector(selectSidebarFilter);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const [runningRequests, setRunningRequests] = useState({});
  const setLoading = (isLoading: boolean) => {
    invariant(activeRequest, 'No active request');
    setRunningRequests({
      ...runningRequests,
      [activeRequest._id]: isLoading ? true : false,
    });
  };

  useDocBodyKeyboardShortcuts({
    request_togglePin:
      async () => {
        if (activeRequest) {
          const meta = isGrpcRequest(activeRequest) ? await getGrpcRequestMetaByParentId(activeRequest._id) : await getRequestMetaByParentId(activeRequest._id);
          updateRequestMetaByParentId(activeRequest._id, { pinned: !meta?.pinned });
        }
      },
    request_showSettings:
      () => {
        if (activeRequest && isRequest(activeRequest)) {
          showModal(RequestSettingsModal, { request: activeRequest });
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
    request_showCreateFolder:
      () => {
        if (activeWorkspace) {
          createRequestGroup(activeRequest ? activeRequest.parentId : activeWorkspace._id);
        }
      },
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
    request_quickSwitch:
      () => showModal(RequestSwitcherModal),
    environment_showEditor:
      () => showModal(WorkspaceEnvironmentsEditModal),
    showCookiesEditor:
      () => showModal(CookiesModal),
    request_showGenerateCodeEditor:
      () => {
        if (activeRequest && isRequest(activeRequest)) {
          showModal(GenerateCodeModal, { request: activeRequest });
        }
      },
  });
  // Close all websocket connections when the active environment changes
  useEffect(() => {
    return () => {
      window.main.webSocket.closeAll();
    };
  }, [activeEnvironment?._id]);

  return (
    <SidebarLayout
      renderPageSidebar={activeWorkspace ? <Fragment>
        <div className="sidebar__menu">
          <EnvironmentsDropdown
            activeEnvironment={activeEnvironment}
            workspace={activeWorkspace}
          />
          <button className="btn btn--super-compact" onClick={showCookiesModal}>
            <div className="sidebar__menu__thing">
              <span>Cookies</span>
            </div>
          </button>
        </div>

        <SidebarFilter
          key={`${activeWorkspace._id}::filter`}
          filter={sidebarFilter || ''}
        />

        <SidebarChildren
          filter={sidebarFilter || ''}
        />
      </Fragment>
        : null}
      renderPaneOne={activeWorkspace ?
        <ErrorBoundary showAlert>
          {activeRequest && (
            isGrpcRequest(activeRequest) ? (
              <GrpcRequestPane
                activeRequest={activeRequest}
                workspaceId={activeWorkspace._id}
                settings={settings}
              />
            ) : (
              isWebSocketRequest(activeRequest) ? (
                <WebSocketRequestPane
                  request={activeRequest}
                  workspaceId={activeWorkspace._id}
                  environment={activeEnvironment}
                />
              ) : (
                <RequestPane
                  environmentId={activeEnvironment ? activeEnvironment._id : ''}
                  request={activeRequest}
                  settings={settings}
                  workspace={activeWorkspace}
                  setLoading={setLoading}
                />
              )
            )
          )}
          {!activeRequest && <PlaceholderRequestPane />}
        </ErrorBoundary>
        : null}
      renderPaneTwo={
        <ErrorBoundary showAlert>
          {activeRequest && (
            isGrpcRequest(activeRequest) ? (
              <GrpcResponsePane activeRequest={activeRequest} />
            ) : (
              isWebSocketRequest(activeRequest) ? (
                <WebSocketResponsePane requestId={activeRequest._id} />
              ) : (
                <ResponsePane request={activeRequest} runningRequests={runningRequests} />
              )
            )
          )}
        </ErrorBoundary>}
    />
  );
};

export default Debug;
