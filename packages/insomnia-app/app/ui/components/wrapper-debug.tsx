import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { Fragment, PureComponent, ReactNode } from 'react';
import { connect } from 'react-redux';

import { AUTOBIND_CFG, SortOrder } from '../../common/constants';
import { isGrpcRequest } from '../../models/grpc-request';
import { isRemoteProject } from '../../models/project';
import { Request, RequestAuthentication, RequestBody, RequestHeader, RequestParameter } from '../../models/request';
import { Settings } from '../../models/settings';
import { isCollection, isDesign } from '../../models/workspace';
import { RootState } from '../redux/modules';
import { selectActiveEnvironment, selectActiveRequest, selectActiveRequestResponses, selectActiveResponse, selectActiveUnitTestResult, selectActiveWorkspace, selectEnvironments, selectLoadStartTime, selectRequestVersions, selectResponseDownloadPath, selectResponseFilter, selectResponseFilterHistory, selectResponsePreviewMode, selectSettings } from '../redux/selectors';
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

interface Props extends ReturnType<typeof mapStateToProps> {
  forceRefreshKey: number;
  gitSyncDropdown: ReactNode;
  handleActivityChange: HandleActivityChange;
  handleChangeEnvironment: Function;
  handleDeleteResponse: Function;
  handleDeleteResponses: Function;
  handleForceUpdateRequest: (r: Request, patch: Partial<Request>) => Promise<Request>;
  handleForceUpdateRequestHeaders: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  handleImport: Function;
  handleRequestCreate: () => void;
  handleRequestGroupCreate: () => void;
  handleSendAndDownloadRequestWithActiveEnvironment: (filepath?: string) => Promise<void>;
  handleSendRequestWithActiveEnvironment: () => void;
  handleSetActiveResponse: Function;
  handleSetPreviewMode: Function;
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

@autoBindMethodsForReact(AUTOBIND_CFG)
class UnconnectedWrapperDebug extends PureComponent<Props> {
  _renderPageHeader() {
    const { gitSyncDropdown, handleActivityChange, wrapperProps: {
      vcs,
      activeWorkspace,
      activeWorkspaceMeta,
      activeProject,
      syncItems,
      isLoggedIn,
    } } = this.props;

    if (!activeWorkspace) {
      return null;
    }

    const collection = isCollection(activeWorkspace);

    let insomniaSync: ReactNode = null;
    if (isLoggedIn && collection && isRemoteProject(activeProject) && vcs) {
      insomniaSync = <SyncDropdown
        workspace={activeWorkspace}
        workspaceMeta={activeWorkspaceMeta}
        project={activeProject}
        vcs={vcs}
        syncItems={syncItems}
      />;
    }

    const gitSync = isDesign(activeWorkspace) && gitSyncDropdown;
    const sync = insomniaSync || gitSync;

    return (
      <WorkspacePageHeader
        handleActivityChange={handleActivityChange}
        gridRight={sync}
      />
    );
  }

  _renderPageSidebar() {
    const {
      activeEnvironment,
      activeWorkspace,
      environments,
      handleChangeEnvironment,
      handleRequestCreate,
      handleRequestGroupCreate,
      handleSidebarSort,
      settings,
      sidebarChildren,
      sidebarFilter,
    } = this.props;
    const {
      handleActivateRequest,
      handleCopyAsCurl,
      handleCreateRequest,
      handleCreateRequestGroup,
      handleDuplicateRequest,
      handleDuplicateRequestGroup,
      handleGenerateCode,
      handleSetRequestGroupCollapsed,
      handleSetRequestPinned,
      handleSetSidebarFilter,
    } = this.props.wrapperProps;

    if (!activeWorkspace) {
      return null;
    }

    return (
      <Fragment>
        <div className="sidebar__menu">
          <EnvironmentsDropdown
            handleChangeEnvironment={handleChangeEnvironment}
            activeEnvironment={activeEnvironment}
            environments={environments}
            workspace={activeWorkspace}
            environmentHighlightColorStyle={settings.environmentHighlightColorStyle}
            hotKeyRegistry={settings.hotKeyRegistry}
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
          requestCreate={handleRequestCreate}
          requestGroupCreate={handleRequestGroupCreate}
          sidebarSort={handleSidebarSort}
          filter={sidebarFilter || ''}
          hotKeyRegistry={settings.hotKeyRegistry}
        />

        <SidebarChildren
          childObjects={sidebarChildren}
          handleActivateRequest={handleActivateRequest}
          handleCreateRequest={handleCreateRequest}
          handleCreateRequestGroup={handleCreateRequestGroup}
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
    );
  }

  _renderRequestPane() {
    const {
      activeEnvironment,
      activeRequest,
      activeWorkspace,
      forceRefreshKey,
      handleForceUpdateRequest,
      handleForceUpdateRequestHeaders,
      handleImport,
      handleSendAndDownloadRequestWithActiveEnvironment,
      handleSendRequestWithActiveEnvironment,
      handleUpdateRequestAuthentication,
      handleUpdateRequestBody,
      handleUpdateRequestHeaders,
      handleUpdateRequestMethod,
      handleUpdateRequestParameters,
      handleUpdateRequestUrl,
      handleUpdateSettingsUseBulkHeaderEditor,
      handleUpdateSettingsUseBulkParametersEditor,
      responseDownloadPath,
      settings,
    } = this.props;
    const {
      handleCreateRequestForWorkspace,
      handleGenerateCodeForActiveRequest,
      handleUpdateDownloadPath,
      handleUpdateRequestMimeType,
      headerEditorKey,
    } = this.props.wrapperProps;

    if (!activeWorkspace) {
      return null;
    }

    // activeRequest being truthy only needs to be checked for isGrpcRequest (for now)
    // The RequestPane and ResponsePane components already handle the case where activeRequest is null
    if (activeRequest && isGrpcRequest(activeRequest)) {
      return (
        <ErrorBoundary showAlert>
          <GrpcRequestPane
            activeRequest={activeRequest}
            environmentId={activeEnvironment ? activeEnvironment._id : ''}
            workspaceId={activeWorkspace._id}
            forceRefreshKey={forceRefreshKey}
            settings={settings}
          />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary showAlert>
        <RequestPane
          downloadPath={responseDownloadPath}
          environmentId={activeEnvironment ? activeEnvironment._id : ''}
          forceRefreshCounter={forceRefreshKey}
          forceUpdateRequest={handleForceUpdateRequest}
          forceUpdateRequestHeaders={handleForceUpdateRequestHeaders}
          handleCreateRequest={handleCreateRequestForWorkspace}
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
        />
      </ErrorBoundary>
    );
  }

  _renderResponsePane() {
    const {
      forceRefreshKey,
      handleDeleteResponse,
      handleDeleteResponses,
      handleSetActiveResponse,
      handleSetPreviewMode,
      handleSetResponseFilter,
      handleShowRequestSettingsModal,
      activeEnvironment,
      activeRequest,
      activeRequestResponses,
      activeResponse,
      activeUnitTestResult,
      loadStartTime,
      requestVersions,
      responseFilter,
      responseFilterHistory,
      responsePreviewMode,
      settings,
    } = this.props;

    // activeRequest being truthy only needs to be checked for isGrpcRequest (for now)
    // The RequestPane and ResponsePane components already handle the case where activeRequest is null
    if (activeRequest && isGrpcRequest(activeRequest)) {
      return (
        <ErrorBoundary showAlert>
          <GrpcResponsePane
            activeRequest={activeRequest}
            forceRefreshKey={forceRefreshKey}
          />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary showAlert>
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
      </ErrorBoundary>
    );
  }

  render() {
    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={this._renderPageHeader}
        renderPageSidebar={this._renderPageSidebar}
        renderPaneOne={this._renderRequestPane}
        renderPaneTwo={this._renderResponsePane}
      />
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  activeEnvironment: selectActiveEnvironment(state),
  activeRequest: selectActiveRequest(state),
  activeRequestResponses: selectActiveRequestResponses(state),
  activeResponse: selectActiveResponse(state),
  activeUnitTestResult: selectActiveUnitTestResult(state),
  activeWorkspace: selectActiveWorkspace(state),
  environments: selectEnvironments(state),
  loadStartTime: selectLoadStartTime(state),
  requestVersions: selectRequestVersions(state),
  responseDownloadPath: selectResponseDownloadPath(state),
  responseFilter: selectResponseFilter(state),
  responseFilterHistory: selectResponseFilterHistory(state),
  responsePreviewMode: selectResponsePreviewMode(state),
  settings: selectSettings(state),
  sidebarChildren: selectSidebarChildren(state),
  sidebarFilter: selectSidebarFilter(state),
});

export const WrapperDebug = connect(mapStateToProps)(UnconnectedWrapperDebug);
