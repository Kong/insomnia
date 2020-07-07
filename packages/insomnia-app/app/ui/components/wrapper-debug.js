// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Breadcrumb, Header } from 'insomnia-components';
import PageLayout from './page-layout';
import type { WrapperProps } from './wrapper';
import RequestPane from './request-pane';
import ErrorBoundary from './error-boundary';
import ResponsePane from './response-pane';
import SidebarChildren from './sidebar/sidebar-children';
import SidebarFilter from './sidebar/sidebar-filter';
import EnvironmentsDropdown from './dropdowns/environments-dropdown';
import designerLogo from '../images/insomnia-designer-logo.svg';
import WorkspaceDropdown from './dropdowns/workspace-dropdown';
import { ACTIVITY_HOME, isInsomnia } from '../../common/constants';
import ActivityToggle from './activity-toggle';

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
  handleImportFile: Function,
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

  render() {
    const {
      forceRefreshKey,
      handleChangeEnvironment,
      handleDeleteResponse,
      handleDeleteResponses,
      handleForceUpdateRequest,
      handleForceUpdateRequestHeaders,
      handleImport,
      handleImportFile,
      handleRequestCreate,
      handleRequestGroupCreate,
      handleSendAndDownloadRequestWithActiveEnvironment,
      handleSendRequestWithActiveEnvironment,
      handleSetActiveResponse,
      handleSetPreviewMode,
      handleSetResponseFilter,
      handleShowCookiesModal,
      handleShowRequestSettingsModal,
      handleUpdateRequestAuthentication,
      handleUpdateRequestBody,
      handleUpdateRequestHeaders,
      handleUpdateRequestMethod,
      handleUpdateRequestParameters,
      handleUpdateRequestUrl,
      handleUpdateSettingsShowPasswords,
      handleUpdateSettingsUseBulkHeaderEditor,
    } = this.props;

    const {
      activity,
      activeEnvironment,
      activeRequest,
      activeRequestResponses,
      activeResponse,
      activeUnitTest,
      activeUnitTestResult,
      activeWorkspace,
      environments,
      enableSyncBeta,
      handleActivateRequest,
      handleSetActiveWorkspace,
      handleCopyAsCurl,
      handleCreateRequest,
      handleCreateRequestForWorkspace,
      handleCreateRequestGroup,
      handleDuplicateRequest,
      handleDuplicateRequestGroup,
      handleGenerateCode,
      handleGenerateCodeForActiveRequest,
      handleGetRenderContext,
      handleMoveDoc,
      handleMoveRequestGroup,
      handleRender,
      handleResetDragPaneHorizontal,
      handleResetDragPaneVertical,
      handleSetRequestGroupCollapsed,
      handleSetRequestPaneRef,
      handleSetRequestPinned,
      handleSetResponsePaneRef,
      handleSetSidebarFilter,
      handleStartDragPaneHorizontal,
      handleStartDragPaneVertical,
      handleUpdateDownloadPath,
      handleUpdateRequestMimeType,
      handleUpdateSettingsUseBulkParametersEditor,
      headerEditorKey,
      isVariableUncovered,
      isLoading,
      loadStartTime,
      oAuth2Token,
      requestVersions,
      responseDownloadPath,
      responseFilter,
      responseFilterHistory,
      responsePreviewMode,
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
    const designer = !insomnia;

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={designer && this._renderPageHeader}
        renderPageSidebar={() => (
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
                enableSyncBeta={enableSyncBeta}
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
        )}
        renderPageBody={() => (
          <React.Fragment>
            <ErrorBoundary showAlert>
              <RequestPane
                ref={handleSetRequestPaneRef}
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

            <div className="drag drag--pane-horizontal">
              <div
                onMouseDown={handleStartDragPaneHorizontal}
                onDoubleClick={handleResetDragPaneHorizontal}
              />
            </div>

            <div className="drag drag--pane-vertical">
              <div
                onMouseDown={handleStartDragPaneVertical}
                onDoubleClick={handleResetDragPaneVertical}
              />
            </div>

            <ErrorBoundary showAlert>
              <ResponsePane
                ref={handleSetResponsePaneRef}
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
          </React.Fragment>
        )}
      />
    );
  }
}

export default WrapperDebug;
