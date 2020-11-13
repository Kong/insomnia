// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Breadcrumb, Header } from 'insomnia-components';
import PageLayout from './page-layout';
import type { WrapperProps } from './wrapper';
import RequestPane from './panes/request-pane';
import ErrorBoundary from './error-boundary';
import ResponsePane from './panes/response-pane';
import SidebarChildren from './sidebar/sidebar-children';
import SidebarFilter from './sidebar/sidebar-filter';
import EnvironmentsDropdown from './dropdowns/environments-dropdown';
import designerLogo from '../images/insomnia-designer-logo.svg';
import WorkspaceDropdown from './dropdowns/workspace-dropdown';
import { ACTIVITY_HOME, isInsomnia } from '../../common/constants';
import ActivityToggle from './activity-toggle';
import { isGrpcRequest } from '../../models/helpers/is-model';
import type { ForceToWorkspace } from '../redux/modules/helpers';
import GrpcRequestPane from './panes/grpc-request-pane';
import GrpcResponsePane from './panes/grpc-response-pane';

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
  handleImportFile: (forceToWorkspace?: ForceToWorkspace) => void,
  handleRequestCreate: Function,
  handleRequestGroupCreate: Function,
  handleSendAndDownloadRequestWithActiveEnvironment: Function,
  handleSendRequestWithActiveEnvironment: Function,
  handleSetActiveResponse: Function,
  handleSetPreviewMode: Function,
  handleSetResponseFilter: Function,
  handleShowCookiesModal: Function,
  handleShowRequestSettingsModal: Function,
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

@autobind
class WrapperDebug extends React.PureComponent<Props> {
  _handleBreadcrumb() {
    this.props.wrapperProps.handleSetActiveActivity(ACTIVITY_HOME);
  }

  _renderPageHeader() {
    const {
      gitSyncDropdown,
      handleActivityChange,
      wrapperProps: { activeApiSpec, activeWorkspace, activity },
    } = this.props;

    return (
      <Header
        className="app-header"
        gridLeft={
          <React.Fragment>
            <img src={designerLogo} alt="Insomnia" width="32" height="32" />
            <Breadcrumb
              className="breadcrumb"
              crumbs={['Documents', activeApiSpec.fileName]}
              onClick={this._handleBreadcrumb}
            />
          </React.Fragment>
        }
        gridCenter={
          <ActivityToggle
            activity={activity}
            handleActivityChange={handleActivityChange}
            workspace={activeWorkspace}
          />
        }
        gridRight={gitSyncDropdown}
      />
    );
  }

  _renderPageSidebar() {
    const {
      handleChangeEnvironment,
      handleRequestCreate,
      handleRequestGroupCreate,
      handleShowCookiesModal,
    } = this.props;

    const {
      activity,
      activeEnvironment,
      activeRequest,
      activeWorkspace,
      environments,
      handleActivateRequest,
      handleSetActiveWorkspace,
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
      isLoading,
      settings,
      sidebarChildren,
      sidebarFilter,
      sidebarHidden,
      sidebarWidth,
      unseenWorkspaces,
      vcs,
      workspaces,
    } = this.props.wrapperProps;

    const insomnia = isInsomnia(activity);

    return (
      <React.Fragment>
        {insomnia && (
          <WorkspaceDropdown
            className="sidebar__header theme--sidebar__header"
            activeEnvironment={activeEnvironment}
            activeWorkspace={activeWorkspace}
            workspaces={workspaces}
            unseenWorkspaces={unseenWorkspaces}
            hotKeyRegistry={settings.hotKeyRegistry}
            handleSetActiveWorkspace={handleSetActiveWorkspace}
            enableSyncBeta={settings.enableSyncBeta}
            isLoading={isLoading}
            vcs={vcs}
          />
        )}
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
            forceRefreshCounter={forceRefreshKey}
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
    const { activity } = this.props.wrapperProps;

    const insomnia = isInsomnia(activity);
    const designer = !insomnia;

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={designer && this._renderPageHeader}
        renderPageSidebar={this._renderPageSidebar}
        renderPaneOne={this._renderRequestPane}
        renderPaneTwo={this._renderResponsePane}
      />
    );
  }
}

export default WrapperDebug;
