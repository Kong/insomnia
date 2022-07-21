import classnames from 'classnames';
import React, { FC, Fragment, ReactNode, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { SortOrder } from '../../common/constants';
import type { EventLog } from '../../main/ipc/main';
import { isGrpcRequest } from '../../models/grpc-request';
import { isRemoteProject } from '../../models/project';
import {
  isRequest,
  Request,
  RequestAuthentication,
  RequestBody,
  RequestHeader,
  RequestParameter,
} from '../../models/request';
import { Settings } from '../../models/settings';
import { isCollection, isDesign } from '../../models/workspace';
import { useNunjucks } from '../context/nunjucks/use-nunjucks';
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
import { CodeEditor, UnconnectedCodeEditor } from './codemirror/code-editor';
import { EnvironmentsDropdown } from './dropdowns/environments-dropdown';
import { SyncDropdown } from './dropdowns/sync-dropdown';
import { ErrorBoundary } from './error-boundary';
import { showCookiesModal } from './modals/cookies-modal';
import { PageLayout } from './page-layout';
import { GrpcRequestPane } from './panes/grpc-request-pane';
import { GrpcResponsePane } from './panes/grpc-response-pane';
import { Pane, paneBodyClasses, PaneHeader } from './panes/pane';
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
            {activeRequest && isRequest(activeRequest) && activeRequest?.method === 'WS' && <WSLeftPanel request={activeRequest} />}
            {activeRequest && isGrpcRequest(activeRequest) && (
              <GrpcRequestPane
                activeRequest={activeRequest}
                environmentId={activeEnvironment ? activeEnvironment._id : ''}
                workspaceId={activeWorkspace._id}
                forceRefreshKey={forceRefreshKey}
                settings={settings}
              />
            )}
            {activeRequest && !isGrpcRequest(activeRequest) && activeRequest?.method !== 'WS' && (
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
          {activeRequest && isRequest(activeRequest) && activeRequest?.method === 'WS' && <WSRightPanel request={activeRequest} />}
          {activeRequest && isGrpcRequest(activeRequest) && (
            <GrpcResponsePane
              activeRequest={activeRequest}
              forceRefreshKey={forceRefreshKey}
            />)}
          {activeRequest && !isGrpcRequest(activeRequest) && activeRequest?.method !== 'WS' && (
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

function usePollingConnectionStatus(requestId?: string) {
  const [connectionStatus, setConnectionStatus] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function syncWebSocketConnection() {
      if (requestId) {
        const c = await window.main.getWebSocketConnectionStatus({ requestId });
        isMounted && setConnectionStatus(c);
      }
    }

    requestId && syncWebSocketConnection();
    const timeoutId = setInterval(() => syncWebSocketConnection(), 500);

    return () => {
      isMounted = false;
      clearInterval(timeoutId);
    };
  }, [requestId]);

  return connectionStatus;
}
const StretchedPaneHeader = styled(PaneHeader)({ '&&': { alignItems: 'stretch' } });
const WSLeftPanel = ({ request }: { request: Request }) => {
  const isConnected = usePollingConnectionStatus(request._id);
  const editorRef = useRef<UnconnectedCodeEditor>(null);
  const { handleRender } = useNunjucks();

  return (
    <Pane type="request">
      <StretchedPaneHeader>
        <form
          style={{ display: 'flex', flex: 1 }}
          onSubmit={e => {
            e.preventDefault();
            if (isConnected) {
              window.main.close({
                requestId: request._id,
              });
            } else {
              const formData = new FormData(e.currentTarget);
              const url = (formData.get('url') as string) || '';
              window.main.open({ url, requestId: request._id });
            }
          }}
        >
          <div className="urlbar">
            <div className="urlbar__flex__right">
              <input
                name="url"
                defaultValue="wss://ws.postman-echo.com/raw"
                placeholder="wss://ws.postman-echo.com/raw"
                style={{ flex: 1, marginLeft: '0.5rem' }}
              />
            </div>
            <button type="submit" className="urlbar__send-btn">
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </form>
      </StretchedPaneHeader>
      <form
        onSubmit={async e => {
          e.preventDefault();
          if (!isConnected) {
            console.warn('Sending message to closed connection');
            return;
          }
          const msg = editorRef.current?.getValue() || '';
          const message = await handleRender(msg);
          window.main.message({
            message,
            requestId: request._id,
          });
        }}
      >
        <Tabs className={classnames(paneBodyClasses, 'react-tabs')}>
          <div className="tab-action-wrapper">
            <div className="tab-action-tabs">
              <TabList>
                <Tab tabIndex="-1">
                  <button type="button">Text</button>
                </Tab>
              </TabList>
            </div>

            <StyledButton
              type="submit"
              disabled={!isConnected}
              className="btn btn--compact btn--clicky margin-sm bg-surprise"
            >
              Send <i className="fa fa-arrow-right" />
            </StyledButton>
          </div>
          <TabPanel className="react-tabs__tab-panel scrollable-container">
            <CodeEditor
              ref={editorRef}
              onChange={() => { }}
              defaultValue={''}
              enableNunjucks
            />
          </TabPanel>
        </Tabs>
      </form>
    </Pane >
  );
};
const StyledButton = styled('button')`
&:focus,
&:hover {
  filter: brightness(0.8);
}`;
function useEventLogQuery(requestId?: string) {
  const [eventLog, setEventLog] = useState<EventLog>([]);

  useEffect(() => {
    let isMounted = true;
    async function syncWebSocketEventLog() {
      if (requestId) {
        const e = await window.main.getWebSocketEventLog({ requestId });
        isMounted && setEventLog(e);
      }
    }
    requestId && syncWebSocketEventLog();

    return () => {
      isMounted = false;
    };
  }, [requestId]);

  return { eventLog, setEventLog };
}
const useEventSubscription = (requestId?: string) => {
  const { eventLog, setEventLog } = useEventLogQuery(requestId);
  useEffect(() => {
    const unsubscribe = window.main.on('websocket.log', (_, lastEvent) => {
      if (lastEvent.requestId === requestId) {
        setEventLog(events => [...events, lastEvent]);
      }
    });
    return unsubscribe;
  }, [requestId, setEventLog]);
  return eventLog;
};

const WSRightPanel = ({ request }: { request: Request }) => {
  const [selected, setSelected] = useState<EventLog[0] | null>(null);
  // TODO: add and fill in table
  const eventLog = useEventSubscription(request._id);
  // reverse
  const list = eventLog || [];
  return (
    <Tabs className={classnames(paneBodyClasses, 'react-tabs')}>
      <TabList>
        <Tab tabIndex="-1">
          <button type="button">Preview</button>
        </Tab>
      </TabList>
      <TabPanel className="react-tabs__tab-panel scrollable-container">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ height: '50%', display: 'flex' }}>
            <div style={{ width: '100%' }}>
              {list ?
                <div className="selectable scrollable" style={{ height: '100%' }}>
                  <table className="table--fancy table--striped table--compact">
                    <tbody>
                      {[...list].reverse().map(event => (
                        <tr style={{ border: selected?._id === event._id ? '1px solid var(--hl-md)' : '' }} key={event._id} onClick={() => setSelected(event)}>
                          <td>{event.type === 'OUTGOING' ? '⬆️' : event.type === 'INFO' ? 'ℹ️' : '⬇️'}</td>
                          <td>{event.message.slice(0, 50)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                : null}
            </div>
          </div>
          <div style={{ height: '1px', background: 'lightgrey' }} />
          <div style={{ height: '50%', display: 'flex' }}>
            <CodeEditor hideLineNumbers mode={'text/plain'} defaultValue={selected?.message || ''} uniquenessKey={selected?._id} readOnly />
          </div>
        </div>
      </TabPanel>
    </Tabs>
  );
};

export default WrapperDebug;
