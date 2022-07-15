import React, { FC, Fragment, ReactNode, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { SortOrder } from '../../common/constants';
import type { WebSocketRequest } from '../../main/ipc/main';
import { isGrpcRequest } from '../../models/grpc-request';
import { isRemoteProject } from '../../models/project';
import {
  Request,
  RequestAuthentication,
  RequestBody,
  RequestHeader,
  RequestParameter,
} from '../../models/request';
import { Settings } from '../../models/settings';
import { isCollection, isDesign } from '../../models/workspace';
import {
  selectActiveEnvironment,
  selectActiveRequest,
  selectActiveRequestResponses,
  selectActiveResponse,
  selectActiveUnitTestResult,
  selectActiveWorkspace,
  selectEnvironments,
  selectLoadStartTime,
  selectRequestVersions,
  selectResponseDownloadPath,
  selectResponseFilter,
  selectResponseFilterHistory,
  selectResponsePreviewMode,
  selectSettings,
} from '../redux/selectors';
import {
  selectSidebarChildren,
  selectSidebarFilter,
} from '../redux/sidebar-selectors';
import { SplitButton } from './base/split-button';
import { EnvironmentsDropdown } from './dropdowns/environments-dropdown';
import { SyncDropdown } from './dropdowns/sync-dropdown';
import { ErrorBoundary } from './error-boundary';
import { showCookiesModal } from './modals/cookies-modal';
import { PageLayout } from './page-layout';
import { GrpcRequestPane } from './panes/grpc-request-pane';
import { GrpcResponsePane } from './panes/grpc-response-pane';
import { Pane, PaneHeader } from './panes/pane';
import { RequestPane } from './panes/request-pane';
import { ResponsePane } from './panes/response-pane';
import { SidebarChildren } from './sidebar/sidebar-children';
import { SidebarFilter } from './sidebar/sidebar-filter';
import { WorkspacePageHeader } from './workspace-page-header';
import type { HandleActivityChange, WrapperProps } from './wrapper';

// TODO: create request process
// TODO: request list
// TODO: make a codeeditor
// TODO: make a table
// TODO: url bar

function usePoorMansWebSocketRequests(workspaceId: string) {
  const [requests, setRequests] = useState<WebSocketRequest[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function syncWebSocketRequests() {
      const r = await window.main.getWebSocketRequestsByParentId({ workspaceId });
      isMounted && setRequests(r);
    }

    syncWebSocketRequests();
    const timeoutId = setInterval(() => syncWebSocketRequests(), 500);

    return () => {
      isMounted = false;
      clearInterval(timeoutId);
    };
  }, [workspaceId]);

  return requests;
}

interface Props {
  forceRefreshKey: number;
  gitSyncDropdown: ReactNode;
  handleActivityChange: HandleActivityChange;
  handleChangeEnvironment: Function;
  handleDeleteResponse: Function;
  handleDeleteResponses: Function;
  handleForceUpdateRequest: (
    r: Request,
    patch: Partial<Request>
  ) => Promise<Request>;
  handleForceUpdateRequestHeaders: (
    r: Request,
    headers: RequestHeader[]
  ) => Promise<Request>;
  handleImport: Function;
  handleSendAndDownloadRequestWithActiveEnvironment: (
    filepath?: string
  ) => Promise<void>;
  handleSendRequestWithActiveEnvironment: () => void;
  handleSetActiveResponse: Function;
  handleSetPreviewMode: Function;
  handleSetResponseFilter: (filter: string) => void;
  handleShowRequestSettingsModal: Function;
  handleSidebarSort: (sortOrder: SortOrder) => void;
  handleUpdateRequestAuthentication: (
    r: Request,
    auth: RequestAuthentication
  ) => Promise<Request>;
  handleUpdateRequestBody: (r: Request, body: RequestBody) => Promise<Request>;
  handleUpdateRequestHeaders: (
    r: Request,
    headers: RequestHeader[]
  ) => Promise<Request>;
  handleUpdateRequestMethod: (r: Request, method: string) => Promise<Request>;
  handleUpdateRequestParameters: (
    r: Request,
    params: RequestParameter[]
  ) => Promise<Request>;
  handleUpdateRequestUrl: (r: Request, url: string) => Promise<Request>;
  handleUpdateSettingsUseBulkHeaderEditor: Function;
  handleUpdateSettingsUseBulkParametersEditor: (
    useBulkParametersEditor: boolean
  ) => Promise<Settings>;
  wrapperProps: WrapperProps;
}
export const WrapperDebug: FC<Props> = ({
  forceRefreshKey,
  gitSyncDropdown,
  handleActivityChange,
  handleChangeEnvironment,
  handleDeleteResponse,
  handleDeleteResponses,
  handleForceUpdateRequest,
  handleForceUpdateRequestHeaders,
  handleImport,
  handleSendAndDownloadRequestWithActiveEnvironment,
  handleSendRequestWithActiveEnvironment,
  handleSetActiveResponse,
  handleSetPreviewMode,
  handleSetResponseFilter,
  handleShowRequestSettingsModal,
  handleSidebarSort,
  handleUpdateRequestAuthentication,
  handleUpdateRequestBody,
  handleUpdateRequestHeaders,
  handleUpdateRequestMethod,
  handleUpdateRequestParameters,
  handleUpdateRequestUrl,
  handleUpdateSettingsUseBulkHeaderEditor,
  handleUpdateSettingsUseBulkParametersEditor,
  wrapperProps,
}) => {
  const {
    activeProject,
    activeWorkspaceMeta,
    handleActivateRequest,
    handleCopyAsCurl,
    handleDuplicateRequest,
    handleDuplicateRequestGroup,
    handleGenerateCode,
    handleGenerateCodeForActiveRequest,
    handleSetRequestGroupCollapsed,
    handleSetRequestPinned,
    handleSetSidebarFilter,
    handleUpdateDownloadPath,
    handleUpdateRequestMimeType,
    headerEditorKey,
    isLoggedIn,
    syncItems,
    vcs,
  } = wrapperProps;

  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeRequest = useSelector(selectActiveRequest);
  const activeRequestResponses = useSelector(selectActiveRequestResponses);
  const activeResponse = useSelector(selectActiveResponse);
  const activeUnitTestResult = useSelector(selectActiveUnitTestResult);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const environments = useSelector(selectEnvironments);
  const loadStartTime = useSelector(selectLoadStartTime);
  const requestVersions = useSelector(selectRequestVersions);
  const responseDownloadPath = useSelector(selectResponseDownloadPath);
  const responseFilter = useSelector(selectResponseFilter);
  const responseFilterHistory = useSelector(selectResponseFilterHistory);
  const responsePreviewMode = useSelector(selectResponsePreviewMode);
  const settings = useSelector(selectSettings);
  const sidebarChildren = useSelector(selectSidebarChildren);
  const sidebarFilter = useSelector(selectSidebarFilter);

  const isTeamSync =
    isLoggedIn &&
    activeWorkspace &&
    isCollection(activeWorkspace) &&
    isRemoteProject(activeProject) &&
    vcs;
  const webSocketRequests = usePoorMansWebSocketRequests(
    activeWorkspace?._id || ''
  );
  const [activeWebsocketId, setActiveWebsocketId] = useState('');
  const activeWebSocketRequest = webSocketRequests.find(
    ws => ws._id === activeWebsocketId
  );

  if (!activeWebSocketRequest) {
    console.error('How did this happen?');
  }

  return (
    <PageLayout
      wrapperProps={wrapperProps}
      renderPageHeader={
        activeWorkspace ? (
          <WorkspacePageHeader
            handleActivityChange={handleActivityChange}
            gridRight={
              isTeamSync ? (
                <SyncDropdown
                  workspace={activeWorkspace}
                  workspaceMeta={activeWorkspaceMeta}
                  project={activeProject}
                  vcs={vcs}
                  syncItems={syncItems}
                />
              ) : isDesign(activeWorkspace) ? (
                gitSyncDropdown
              ) : null
            }
          />
        ) : null
      }
      renderPageSidebar={
        activeWorkspace ? (
          <Fragment>
            <div className="sidebar__menu">
              <EnvironmentsDropdown
                activeEnvironment={activeEnvironment}
                environmentHighlightColorStyle={
                  settings.environmentHighlightColorStyle
                }
                environments={environments}
                handleChangeEnvironment={handleChangeEnvironment}
                hotKeyRegistry={settings.hotKeyRegistry}
                workspace={activeWorkspace}
              />
              <button
                className="btn btn--super-compact"
                onClick={showCookiesModal}
              >
                <div className="sidebar__menu__thing">
                  <span>Cookies</span>
                </div>
              </button>
            </div>

            <SidebarFilter
              key={`${activeWorkspace._id}::filter`}
              onChange={handleSetSidebarFilter}
              sidebarSort={handleSidebarSort}
              filter={sidebarFilter || ''}
              hotKeyRegistry={settings.hotKeyRegistry}
            />

            <ul>
              {webSocketRequests.map(ws => {
                return (
                  <li key={ws._id} onClick={() => setActiveWebsocketId(ws._id)}>
                    {ws.name}
                  </li>
                );
              })}
            </ul>
            <SidebarChildren
              childObjects={sidebarChildren}
              handleActivateRequest={handleActivateRequest}
              handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
              handleSetRequestPinned={handleSetRequestPinned}
              handleDuplicateRequest={handleDuplicateRequest}
              handleDuplicateRequestGroup={handleDuplicateRequestGroup}
              handleGenerateCode={handleGenerateCode}
              handleCopyAsCurl={handleCopyAsCurl}
              filter={sidebarFilter || ''}
              hotKeyRegistry={settings.hotKeyRegistry}
            />
          </Fragment>
        ) : null
      }
      renderPaneOne={
        activeWorkspace ? (
          <ErrorBoundary showAlert>
            {activeWebsocketId && activeWebSocketRequest ? (
              <WSLeftPanel key={activeWebsocketId} request={activeWebSocketRequest} />
            ) : activeRequest && isGrpcRequest(activeRequest) ? (
              <GrpcRequestPane
                activeRequest={activeRequest}
                environmentId={activeEnvironment ? activeEnvironment._id : ''}
                workspaceId={activeWorkspace._id}
                forceRefreshKey={forceRefreshKey}
                settings={settings}
              />
            ) : (
              <RequestPane
                downloadPath={responseDownloadPath}
                environmentId={activeEnvironment ? activeEnvironment._id : ''}
                forceRefreshCounter={forceRefreshKey}
                forceUpdateRequest={handleForceUpdateRequest}
                forceUpdateRequestHeaders={handleForceUpdateRequestHeaders}
                handleGenerateCode={handleGenerateCodeForActiveRequest}
                handleImport={handleImport}
                handleSend={handleSendRequestWithActiveEnvironment}
                handleSendAndDownload={
                  handleSendAndDownloadRequestWithActiveEnvironment
                }
                handleUpdateDownloadPath={handleUpdateDownloadPath}
                headerEditorKey={headerEditorKey}
                request={activeRequest}
                settings={settings}
                updateRequestAuthentication={handleUpdateRequestAuthentication}
                updateRequestBody={handleUpdateRequestBody}
                updateRequestHeaders={handleUpdateRequestHeaders}
                updateRequestMethod={handleUpdateRequestMethod}
                updateRequestMimeType={handleUpdateRequestMimeType}
                updateRequestParameters={handleUpdateRequestParameters}
                updateRequestUrl={handleUpdateRequestUrl}
                updateSettingsUseBulkHeaderEditor={
                  handleUpdateSettingsUseBulkHeaderEditor
                }
                updateSettingsUseBulkParametersEditor={
                  handleUpdateSettingsUseBulkParametersEditor
                }
                workspace={activeWorkspace}
              />
            )}
          </ErrorBoundary>
        ) : null
      }
      renderPaneTwo={
        <ErrorBoundary showAlert>
          {activeWebsocketId && activeWebSocketRequest ? (
            <WSRightPanel key={activeWebsocketId} request={activeWebSocketRequest} />
          ) : activeRequest && isGrpcRequest(activeRequest) ? (
            <GrpcResponsePane
              activeRequest={activeRequest}
              forceRefreshKey={forceRefreshKey}
            />
          ) : (
            <ResponsePane
              disableHtmlPreviewJs={settings.disableHtmlPreviewJs}
              disableResponsePreviewLinks={settings.disableResponsePreviewLinks}
              editorFontSize={settings.editorFontSize}
              environment={activeEnvironment}
              filter={responseFilter}
              filterHistory={responseFilterHistory}
              handleDeleteResponse={handleDeleteResponse}
              handleDeleteResponses={handleDeleteResponses}
              handleSetActiveResponse={handleSetActiveResponse}
              handleSetFilter={handleSetResponseFilter}
              handleSetPreviewMode={handleSetPreviewMode}
              handleShowRequestSettings={handleShowRequestSettingsModal}
              hotKeyRegistry={settings.hotKeyRegistry}
              loadStartTime={loadStartTime}
              previewMode={responsePreviewMode}
              request={activeRequest}
              requestVersions={requestVersions}
              response={activeResponse}
              responses={activeRequestResponses}
              unitTestResult={activeUnitTestResult}
            />
          )}
        </ErrorBoundary>
      }
    />
  );
};

const WSLeftPanel = ({ request }: { request: WebSocketRequest }) => {
  const isConnected = request.connection?.connected;
  return (
    <Pane type="request">
      <PaneHeader>
        <form
          onSubmit={e => {
            e.preventDefault();

            if (isConnected && request.connection) {
              window.main.close({
                connectionId: request.connection._id,
              });
            } else {
              const formData = new FormData(e.target);
              const url = (formData.get('url') as string) || '';
              console.log({ url });
              window.main.open({ url, requestId: request._id });
            }
          }}
        >
          <input name="url" defaultValue="wss://ws.postman-echo.com/raw" />
          <button type="submit">
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </form>
      </PaneHeader>

      <form
        onSubmit={e => {
          e.preventDefault();
          if (!request.connection?._id) {
            console.warn('Sending message to closed connection');
            return;
          }
          const formData = new FormData(e.target);
          const message = formData.get('body') as string || '';
          console.log({ message });
          window.main.message({
            message,
            connectionId: request.connection?._id,
          });
        }}
      >
        <input name="body" defaultValue="example message" />
        <SplitButton disabled={!isConnected}>
          <button type='submit'>Send</button>
          <button
            type='button'
            onClick={() => {
              if (request.connection) {
                window.main.close({
                  connectionId: request.connection._id,
                });
              }
            }}
          >
            Close
          </button>
        </SplitButton>
      </form>
    </Pane>
  );
};
const WSRightPanel = ({ request }: { request: WebSocketRequest }) => {
  // TODO: add and fill in table
  // const [messages, setMessages] = useState<{
  //   _id: string;
  //   createdAt: string;
  //   message: string;
  //   connectionId: string;
  //   direction: string;
  // }[]>([]);

  // useEffect(() => {
  //   const unsubscribe = window.main.on('websocket.response', (_, message) => {
  //     if (message.connectionId === request.connection?._id) {
  //       setMessages(messages => [...messages.slice(-15), message]);
  //     }
  //   });
  //   return unsubscribe;
  // }, [request.connection?._id]);

  return (
    <ul
      style={{
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {request.connection?.messages.reverse().map((m, i) => (
        <li
          style={{
            border: '1px solid #ccc',
          }}
          key={i}
        >
          {m.type === 'UP' ? '⬆️' : m.type === 'INFO' ? 'ℹ️' : '⬇️'} {m.message}</li>
      ))}
    </ul>
  );
};

export default WrapperDebug;
