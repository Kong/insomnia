import React, { FC, Fragment, useEffect } from 'react';
import { useSelector } from 'react-redux';

import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import * as models from '../../models';
import { isGrpcRequest } from '../../models/grpc-request';
import { getByParentId as getGrpcRequestMetaByParentId } from '../../models/grpc-request-meta';
import * as requestOperations from '../../models/helpers/request-operations';
import { getByParentId as getRequestMetaByParentId } from '../../models/request-meta';
import { isWebSocketRequest } from '../../models/websocket-request';
import { EnvironmentsDropdown } from '../components/dropdowns/environments-dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal } from '../components/modals';
import { AskModal } from '../components/modals/ask-modal';
import { CookiesModal, showCookiesModal } from '../components/modals/cookies-modal';
import { GenerateCodeModal } from '../components/modals/generate-code-modal';
import { PromptModal } from '../components/modals/prompt-modal';
import { RequestSettingsModal } from '../components/modals/request-settings-modal';
import { RequestSwitcherModal } from '../components/modals/request-switcher-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { PageLayout } from '../components/page-layout';
import { GrpcRequestPane } from '../components/panes/grpc-request-pane';
import { GrpcResponsePane } from '../components/panes/grpc-response-pane';
import { PlaceholderRequestPane } from '../components/panes/placeholder-request-pane';
import { RequestPane } from '../components/panes/request-pane';
import { ResponsePane } from '../components/panes/response-pane';
import { SidebarChildren } from '../components/sidebar/sidebar-children';
import { SidebarFilter } from '../components/sidebar/sidebar-filter';
import { WebSocketRequestPane } from '../components/websockets/websocket-request-pane';
import { WebSocketResponsePane } from '../components/websockets/websocket-response-pane';
import { WorkspacePageHeader } from '../components/workspace-page-header';
import { updateRequestMetaByParentId } from '../hooks/create-request';
import { createRequestGroup } from '../hooks/create-request-group';
import {
  selectActiveEnvironment,
  selectActiveRequest,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectSettings,
} from '../redux/selectors';
import { selectSidebarFilter } from '../redux/sidebar-selectors';

export const WrapperDebug: FC = () => {
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeRequest = useSelector(selectActiveRequest);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const settings = useSelector(selectSettings);
  const sidebarFilter = useSelector(selectSidebarFilter);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);

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
        if (activeRequest) {
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
      () => showModal(GenerateCodeModal, { request: activeRequest }),
  });
  // Close all websocket connections when the active environment changes
  useEffect(() => {
    return () => {
      window.main.webSocket.closeAll();
    };
  }, [activeEnvironment?._id]);

  return (
    <PageLayout
      renderPageHeader={activeWorkspace ?
        <WorkspacePageHeader />
        : null}
      renderPageSidebar={activeWorkspace ? <Fragment>
        <div className="sidebar__menu">
          <EnvironmentsDropdown
            activeEnvironment={activeEnvironment}
            environmentHighlightColorStyle={settings.environmentHighlightColorStyle}
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
                environmentId={activeEnvironment ? activeEnvironment._id : ''}
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
                <ResponsePane request={activeRequest} />
              )
            )
          )}
        </ErrorBoundary>}
    />
  );
};

export default WrapperDebug;
