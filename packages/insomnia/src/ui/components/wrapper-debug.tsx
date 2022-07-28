import React, { FC, Fragment, ReactNode } from 'react';
import { useSelector } from 'react-redux';

import { SortOrder } from '../../common/constants';
import { isGrpcRequest } from '../../models/grpc-request';
import { isRemoteProject } from '../../models/project';
import { Request, RequestAuthentication, RequestBody, RequestHeader, RequestParameter } from '../../models/request';
import { Settings } from '../../models/settings';
import { isCollection, isDesign } from '../../models/workspace';
import {
  selectActiveEnvironment,
  selectActiveProject,
  selectActiveRequest,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectEnvironments,
  selectIsLoggedIn,
  selectResponseDownloadPath,
  selectSettings,
} from '../redux/selectors';
import { selectSidebarChildren, selectSidebarFilter } from '../redux/sidebar-selectors';
import { EnvironmentsDropdown } from './dropdowns/environments-dropdown';
import { SyncDropdown } from './dropdowns/sync-dropdown';
import { ErrorBoundary } from './error-boundary';
import { showCookiesModal } from './modals/cookies-modal';
import { PageLayout } from './page-layout';
import { GrpcRequestPane } from './panes/grpc-request-pane';
import { GrpcResponsePane } from './panes/grpc-response-pane';
import { RequestPane } from './panes/request-pane';
import { ResponsePane } from './panes/response-pane';
import { SidebarChildren } from './sidebar/sidebar-children';
import { SidebarFilter } from './sidebar/sidebar-filter';
import { WorkspacePageHeader } from './workspace-page-header';
import type { HandleActivityChange, WrapperProps } from './wrapper';

interface Props {
  forceRefreshKey: number;
  gitSyncDropdown: ReactNode;
  handleActivityChange: HandleActivityChange;
  handleChangeEnvironment: Function;
  handleForceUpdateRequest: (r: Request, patch: Partial<Request>) => Promise<Request>;
  handleForceUpdateRequestHeaders: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  handleImport: Function;
  handleSendAndDownloadRequestWithActiveEnvironment: (filepath?: string) => Promise<void>;
  handleSendRequestWithActiveEnvironment: () => void;
  handleSetActiveResponse: Function;
  handleSetResponseFilter: (filter: string) => void;
  handleShowRequestSettingsModal: Function;
  handleSidebarSort: (sortOrder: SortOrder) => void;
  handleUpdateRequestAuthentication: (r: Request, auth: RequestAuthentication) => Promise<Request>;
  handleUpdateRequestBody: (r: Request, body: RequestBody) => Promise<Request>;
  handleUpdateRequestHeaders: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  handleUpdateRequestMethod: (r: Request, method: string) => Promise<Request>;
  handleUpdateRequestParameters: (r: Request, params: RequestParameter[]) => Promise<Request>;
  handleUpdateRequestUrl: (r: Request, url: string) => Promise<Request>;
  handleUpdateSettingsUseBulkHeaderEditor: Function;
  handleUpdateSettingsUseBulkParametersEditor: (useBulkParametersEditor: boolean) => Promise<Settings>;
  wrapperProps: WrapperProps;
}
export const WrapperDebug: FC<Props> = ({
  forceRefreshKey,
  gitSyncDropdown,
  handleActivityChange,
  handleChangeEnvironment,
  handleForceUpdateRequest,
  handleForceUpdateRequestHeaders,
  handleImport,
  handleSendAndDownloadRequestWithActiveEnvironment,
  handleSendRequestWithActiveEnvironment,
  handleSetActiveResponse,
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
    handleActivateRequest,
    handleCopyAsCurl,
    handleDuplicateRequest,
    handleGenerateCode,
    handleGenerateCodeForActiveRequest,
    handleSetSidebarFilter,
    handleUpdateDownloadPath,
    handleUpdateRequestMimeType,
    headerEditorKey,
    vcs,
  } = wrapperProps;
  const activeProject = useSelector(selectActiveProject);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const isLoggedIn = useSelector(selectIsLoggedIn);

  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeRequest = useSelector(selectActiveRequest);

  const activeWorkspace = useSelector(selectActiveWorkspace);
  const environments = useSelector(selectEnvironments);

  const responseDownloadPath = useSelector(selectResponseDownloadPath);
  const settings = useSelector(selectSettings);
  const sidebarChildren = useSelector(selectSidebarChildren);
  const sidebarFilter = useSelector(selectSidebarFilter);

  const isTeamSync = isLoggedIn && activeWorkspace && isCollection(activeWorkspace) && isRemoteProject(activeProject) && vcs;

  return (
    <PageLayout
      renderPageHeader={activeWorkspace ?
        <WorkspacePageHeader
          handleActivityChange={handleActivityChange}
          gridRight={isTeamSync ? <SyncDropdown
            workspace={activeWorkspace}
            workspaceMeta={activeWorkspaceMeta}
            project={activeProject}
            vcs={vcs}
          /> : isDesign(activeWorkspace) ? gitSyncDropdown : null}
        />
        : null}
      renderPageSidebar={activeWorkspace ? <Fragment>
        <div className="sidebar__menu">
          <EnvironmentsDropdown
            activeEnvironment={activeEnvironment}
            environmentHighlightColorStyle={settings.environmentHighlightColorStyle}
            environments={environments}
            handleChangeEnvironment={handleChangeEnvironment}
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
          onChange={handleSetSidebarFilter}
          sidebarSort={handleSidebarSort}
          filter={sidebarFilter || ''}
        />

        <SidebarChildren
          childObjects={sidebarChildren}
          handleActivateRequest={handleActivateRequest}
          handleDuplicateRequest={handleDuplicateRequest}
          handleGenerateCode={handleGenerateCode}
          handleCopyAsCurl={handleCopyAsCurl}
          filter={sidebarFilter || ''}
        />
      </Fragment>
        : null}
      renderPaneOne={activeWorkspace ?
        <ErrorBoundary showAlert>
          {activeRequest && isGrpcRequest(activeRequest) ?
            <GrpcRequestPane
              activeRequest={activeRequest}
              environmentId={activeEnvironment ? activeEnvironment._id : ''}
              workspaceId={activeWorkspace._id}
              forceRefreshKey={forceRefreshKey}
              settings={settings}
            />
            :
            <RequestPane
              downloadPath={responseDownloadPath}
              environmentId={activeEnvironment ? activeEnvironment._id : ''}
              forceRefreshCounter={forceRefreshKey}
              forceUpdateRequest={handleForceUpdateRequest}
              forceUpdateRequestHeaders={handleForceUpdateRequestHeaders}
              handleGenerateCode={handleGenerateCodeForActiveRequest}
              handleImport={handleImport}
              handleSend={handleSendRequestWithActiveEnvironment}
              handleSendAndDownload={handleSendAndDownloadRequestWithActiveEnvironment}
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
              updateSettingsUseBulkHeaderEditor={handleUpdateSettingsUseBulkHeaderEditor}
              updateSettingsUseBulkParametersEditor={handleUpdateSettingsUseBulkParametersEditor}
              workspace={activeWorkspace}
            />}
        </ErrorBoundary>
        : null}
      renderPaneTwo={
        <ErrorBoundary showAlert>
          {activeRequest && isGrpcRequest(activeRequest) ?
            <GrpcResponsePane
              activeRequest={activeRequest}
              forceRefreshKey={forceRefreshKey}
            />
            :
            <ResponsePane
              handleSetActiveResponse={handleSetActiveResponse}
              handleSetFilter={handleSetResponseFilter}
              handleShowRequestSettings={handleShowRequestSettingsModal}
              request={activeRequest}
            />}
        </ErrorBoundary>}
    />
  );
};

export default WrapperDebug;
