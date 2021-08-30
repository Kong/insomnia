import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { Fragment, PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG, GlobalActivity, SortOrder } from '../../common/constants';
import { isGrpcRequest } from '../../models/grpc-request';
import { isRemoteProject } from '../../models/project';
import { Request, RequestAuthentication, RequestBody, RequestHeader, RequestParameter } from '../../models/request';
import { Settings } from '../../models/settings';
import { isCollection, isDesign } from '../../models/workspace';
import EnvironmentsDropdown from './dropdowns/environments-dropdown';
import SyncDropdown from './dropdowns/sync-dropdown';
import ErrorBoundary from './error-boundary';
import PageLayout from './page-layout';
import GrpcRequestPane from './panes/grpc-request-pane';
import GrpcResponsePane from './panes/grpc-response-pane';
import RequestPane from './panes/request-pane';
import ResponsePane from './panes/response-pane';
import { SidebarChildren } from './sidebar/sidebar-children';
import SidebarFilter from './sidebar/sidebar-filter';
import WorkspacePageHeader from './workspace-page-header';
import type { WrapperProps } from './wrapper';

interface Props {
  forceRefreshKey: number;
  gitSyncDropdown: ReactNode;
  handleActivityChange: (options: {workspaceId?: string, nextActivity: GlobalActivity}) => Promise<void>;
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
  handleShowCookiesModal: Function;
  handleShowRequestSettingsModal: Function;
  handleSidebarSort: (sortOrder: SortOrder) => void;
  handleUpdateRequestAuthentication: (r: Request, auth: RequestAuthentication) => Promise<Request>;
  handleUpdateRequestBody: (r: Request, body: RequestBody) => Promise<Request>;
  handleUpdateRequestHeaders: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  handleUpdateRequestMethod: (r: Request, method: string) => Promise<Request>;
  handleUpdateRequestParameters: (r: Request, params: RequestParameter[]) => Promise<Request>;
  handleUpdateRequestUrl: (r: Request, url: string) => Promise<Request>;
  handleUpdateSettingsShowPasswords: (showPasswords: boolean) => Promise<Settings>;
  handleUpdateSettingsUseBulkHeaderEditor: Function;
  handleUpdateSettingsUseBulkParametersEditor: (useBulkParametersEditor: boolean) => Promise<Settings>;
  wrapperProps: WrapperProps;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class WrapperDebug extends PureComponent<Props> {
  _renderPageHeader() {
    const { wrapperProps, gitSyncDropdown, handleActivityChange } = this.props;
    const { vcs, activeWorkspace, activeWorkspaceMeta, activeProject, syncItems, isLoggedIn } = this.props.wrapperProps;

    if (!activeWorkspace) {
      return null;
    }

    const collection = isCollection(activeWorkspace);
    const design = isDesign(activeWorkspace);

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

    const gitSync = design && gitSyncDropdown;
    const sync = insomniaSync || gitSync;

    return (
      <WorkspacePageHeader
        wrapperProps={wrapperProps}
        handleActivityChange={handleActivityChange}
        gridRight={sync}
      />
    );
  }

  _renderPageSidebar() {
    const {
      handleChangeEnvironment,
      handleRequestCreate,
      handleRequestGroupCreate,
      handleShowCookiesModal,
      handleSidebarSort,
    } = this.props;
    const {
      activeEnvironment,
      activeWorkspace,
      environments,
      handleActivateRequest,
      handleCopyAsCurl,
      handleCreateRequest,
      handleCreateRequestGroup,
      handleDuplicateRequest,
      handleDuplicateRequestGroup,
      handleGenerateCode,
      handleRender,
      handleSetRequestGroupCollapsed,
      handleSetRequestPinned,
      handleSetSidebarFilter,
      settings,
      sidebarChildren,
      sidebarFilter,
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
          {/* @ts-expect-error -- TSCONVERSION onClick event doesn't matter */}
          <button className="btn btn--super-compact" onClick={handleShowCookiesModal}>
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
          handleRender={handleRender}
          filter={sidebarFilter || ''}
          hotKeyRegistry={settings.hotKeyRegistry}
        />
      </Fragment>
    );
  }

  _renderRequestPane() {
    const {
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
      handleUpdateSettingsShowPasswords,
      handleUpdateSettingsUseBulkHeaderEditor,
      handleUpdateSettingsUseBulkParametersEditor,
    } = this.props;
    const {
      activeEnvironment,
      activeRequest,
      activeWorkspace,
      handleCreateRequestForWorkspace,
      handleGenerateCodeForActiveRequest,
      handleGetRenderContext,
      handleRender,
      handleUpdateDownloadPath,
      handleUpdateRequestMimeType,
      headerEditorKey,
      isVariableUncovered,
      oAuth2Token,
      responseDownloadPath,
      settings,
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
            handleRender={handleRender}
            isVariableUncovered={isVariableUncovered}
            handleGetRenderContext={handleGetRenderContext}
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
          handleGetRenderContext={handleGetRenderContext}
          handleImport={handleImport}
          handleRender={handleRender}
          handleSend={handleSendRequestWithActiveEnvironment}
          handleSendAndDownload={handleSendAndDownloadRequestWithActiveEnvironment}
          handleUpdateDownloadPath={handleUpdateDownloadPath}
          headerEditorKey={headerEditorKey}
          isVariableUncovered={isVariableUncovered}
          oAuth2Token={oAuth2Token}
          request={activeRequest}
          settings={settings}
          updateRequestAuthentication={handleUpdateRequestAuthentication}
          updateRequestBody={handleUpdateRequestBody}
          updateRequestHeaders={handleUpdateRequestHeaders}
          updateRequestMethod={handleUpdateRequestMethod}
          updateRequestMimeType={handleUpdateRequestMimeType}
          updateRequestParameters={handleUpdateRequestParameters}
          updateRequestUrl={handleUpdateRequestUrl}
          updateSettingsShowPasswords={handleUpdateSettingsShowPasswords}
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
      handleShowCookiesModal,
      handleShowRequestSettingsModal,
    } = this.props;
    const {
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
    } = this.props.wrapperProps;

    // activeRequest being truthy only needs to be checked for isGrpcRequest (for now)
    // The RequestPane and ResponsePane components already handle the case where activeRequest is null
    if (activeRequest && isGrpcRequest(activeRequest)) {
      return (
        <ErrorBoundary showAlert>
          <GrpcResponsePane
            activeRequest={activeRequest}
            forceRefreshKey={forceRefreshKey}
            settings={settings}
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
          editorIndentSize={settings.editorIndentSize}
          editorKeyMap={settings.editorKeyMap}
          editorLineWrapping={settings.editorLineWrapping}
          environment={activeEnvironment}
          filter={responseFilter}
          filterHistory={responseFilterHistory}
          handleDeleteResponse={handleDeleteResponse}
          handleDeleteResponses={handleDeleteResponses}
          handleSetActiveResponse={handleSetActiveResponse}
          handleSetFilter={handleSetResponseFilter}
          handleSetPreviewMode={handleSetPreviewMode}
          handleShowRequestSettings={handleShowRequestSettingsModal}
          showCookiesModal={handleShowCookiesModal}
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

export default WrapperDebug;
