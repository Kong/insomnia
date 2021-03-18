// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import PageLayout from './page-layout';
import type { HandleImportFileCallback, WrapperProps } from './wrapper';
import RequestPane from './panes/request-pane';
import ErrorBoundary from './error-boundary';
import ResponsePane from './panes/response-pane';
import SidebarChildren from './sidebar/sidebar-children';
import SidebarFilter from './sidebar/sidebar-filter';
import EnvironmentsDropdown from './dropdowns/environments-dropdown';
import { AUTOBIND_CFG } from '../../common/constants';
import { isCollection, isDesign, isGrpcRequest } from '../../models/helpers/is-model';
import GrpcRequestPane from './panes/grpc-request-pane';
import GrpcResponsePane from './panes/grpc-response-pane';
import WorkspacePageHeader from './workspace-page-header';
import { isLoggedIn } from '../../account/session';
import SyncDropdown from './dropdowns/sync-dropdown';
import { Button } from 'insomnia-components';
import { showSyncShareModal } from './modals/sync-share-modal';
import * as session from '../../account/session';

type Props = {
  forceRefreshKey: string,
  gitSyncDropdown: React.Node,
  handleActivityChange: (workspaceId: string, activity: GlobalActivity) => Promise<void>,
  handleChangeEnvironment: Function,
  handleDeleteResponse: Function,
  handleDeleteResponses: Function,
  handleForceUpdateRequest: Function,
  handleForceUpdateRequestHeaders: Function,
  handleImport: Function,
  handleImportFile: HandleImportFileCallback,
  handleRequestCreate: Function,
  handleRequestGroupCreate: Function,
  handleSendAndDownloadRequestWithActiveEnvironment: Function,
  handleSendRequestWithActiveEnvironment: Function,
  handleSetActiveResponse: Function,
  handleSetPreviewMode: Function,
  handleSetResponseFilter: Function,
  handleShowCookiesModal: Function,
  handleShowRequestSettingsModal: Function,
  handleSidebarSort: (sortOrder: SortOrder) => void,
  handleUpdateRequestAuthentication: Function,
  handleUpdateRequestBody: Function,
  handleUpdateRequestHeaders: Function,
  handleUpdateRequestMethod: Function,
  handleUpdateRequestParameters: Function,
  handleUpdateRequestUrl: Function,
  handleUpdateSettingsShowPasswords: Function,
  handleUpdateSettingsUseBulkHeaderEditor: Function,
  wrapperProps: WrapperProps,
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class WrapperDebug extends React.PureComponent<Props> {
  _renderPageHeader() {
    const { wrapperProps, gitSyncDropdown, handleActivityChange } = this.props;
    const { vcs, activeWorkspace, syncItems } = this.props.wrapperProps;

    const collection = isCollection(activeWorkspace);
    const design = isDesign(activeWorkspace);

    const share = session.isLoggedIn() && collection && (
      <Button variant="contained" onClick={showSyncShareModal}>
        <i className="fa fa-globe pad-right-sm" /> Share
      </Button>
    );

    const betaSync = collection && vcs && isLoggedIn() && (
      <SyncDropdown workspace={activeWorkspace} vcs={vcs} syncItems={syncItems} />
    );

    const gitSync = design && gitSyncDropdown;
    const sync = betaSync || gitSync;

    return (
      <WorkspacePageHeader
        wrapperProps={wrapperProps}
        handleActivityChange={handleActivityChange}
        gridRight={
          <>
            {share}
            {sync && <span className="margin-left">{sync}</span>}
          </>
        }
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
      activeRequest,
      activeWorkspace,
      environments,
      handleActivateRequest,
      handleCopyAsCurl,
      handleCreateRequest,
      handleCreateRequestGroup,
      handleDuplicateRequest,
      handleDuplicateRequestGroup,
      handleGenerateCode,
      handleMoveDoc,
      handleMoveRequestGroup,
      handleRender,
      handleSetRequestGroupCollapsed,
      handleSetRequestPinned,
      handleSetSidebarFilter,
      settings,
      sidebarChildren,
      sidebarFilter,
      sidebarHidden,
      sidebarWidth,
    } = this.props.wrapperProps;

    return (
      <React.Fragment>
        <div className="sidebar__menu">
          <EnvironmentsDropdown
            handleChangeEnvironment={handleChangeEnvironment}
            activeEnvironment={activeEnvironment}
            environments={environments}
            workspace={activeWorkspace}
            environmentHighlightColorStyle={settings.environmentHighlightColorStyle}
            hotKeyRegistry={settings.hotKeyRegistry}
          />
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
          handleMoveRequestGroup={handleMoveRequestGroup}
          handleGenerateCode={handleGenerateCode}
          handleCopyAsCurl={handleCopyAsCurl}
          handleRender={handleRender}
          moveDoc={handleMoveDoc}
          hidden={sidebarHidden}
          width={sidebarWidth}
          workspace={activeWorkspace}
          activeRequest={activeRequest}
          filter={sidebarFilter || ''}
          hotKeyRegistry={settings.hotKeyRegistry}
          activeEnvironment={activeEnvironment}
        />
      </React.Fragment>
    );
  }

  _renderRequestPane() {
    const {
      forceRefreshKey,
      handleForceUpdateRequest,
      handleForceUpdateRequestHeaders,
      handleImport,
      handleImportFile,
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
      activeUnitTest,
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

    // activeRequest being truthy only needs to be checked for isGrpcRequest (for now)
    // The RequestPane and ResponsePane components already handle the case where activeRequest is null
    if (activeRequest && isGrpcRequest(activeRequest)) {
      return (
        <ErrorBoundary showAlert>
          <GrpcRequestPane
            activeRequest={activeRequest}
            environmentId={activeEnvironment ? activeEnvironment._id : ''}
            workspaceId={activeWorkspace._id}
            forceRefreshCounter={forceRefreshKey}
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
          handleImportFile={handleImportFile}
          handleRender={handleRender}
          handleSend={handleSendRequestWithActiveEnvironment}
          handleSendAndDownload={handleSendAndDownloadRequestWithActiveEnvironment}
          handleUpdateDownloadPath={handleUpdateDownloadPath}
          headerEditorKey={headerEditorKey}
          isVariableUncovered={isVariableUncovered}
          nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
          oAuth2Token={oAuth2Token}
          request={activeRequest}
          unitTest={activeUnitTest}
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
            forceRefreshCounter={forceRefreshKey}
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
