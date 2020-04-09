// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Breadcrumb, Switch, Header } from 'insomnia-components';
import PageLayout from './page-layout';
import type { WrapperProps } from './wrapper';
import { ACTIVITY_HOME } from './activity-bar/activity-bar';
import RequestPane from './request-pane';
import ErrorBoundary from './error-boundary';
import ResponsePane from './response-pane';
import SidebarChildren from './sidebar/sidebar-children';
import SidebarFilter from './sidebar/sidebar-filter';
import EnvironmentsDropdown from './dropdowns/environments-dropdown';
import designerLogo from '../images/insomnia-designer-logo.svg';

type Props = {
  forceRefreshKey: string,
  gitSyncDropdown: React.Node,
  handleChangeEnvironment: Function,
  handleDeleteResponse: Function,
  handleDeleteResponses: Function,
  handleForceUpdateRequest: Function,
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
  handleSetDesignActivity: (workspaceId: string) => void,
  wrapperProps: WrapperProps,
};

@autobind
class WrapperDebug extends React.PureComponent<Props> {
  _handleBreadcrumb(index: number) {
    this.props.wrapperProps.handleSetActiveActivity(ACTIVITY_HOME);
  }

  _handleDesign() {
    const { handleSetDesignActivity, wrapperProps: { activeWorkspace } } = this.props;
    handleSetDesignActivity(activeWorkspace._id);
  }

  render() {
    const {
      forceRefreshKey,
      gitSyncDropdown,
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
      activeEnvironment,
      activeRequest,
      activeRequestResponses,
      activeResponse,
      activeWorkspace,
      environments,
      handleActivateRequest,
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
    } = this.props.wrapperProps;

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={() => (
          <Header
              className="app-header"
              gridLeft={
                  <React.Fragment>
                      <img src={designerLogo} alt="Insomnia" width="24" height="24" />
                      <Breadcrumb className="breadcrumb" crumbs={['Documents', activeWorkspace.name]} onClick={this._handleBreadcrumb} />
                  </React.Fragment>
              }
              gridCenter={
                  <Switch onClick={this._handleDesign} optionItems={[{ label: 'DESIGN', selected: false }, { label: 'DEBUG', selected: true }]} />
              }
              gridRight={gitSyncDropdown}
          />
        )}
        renderPageSidebar={() => (
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
              />
            </ErrorBoundary>
          </React.Fragment>
        )}
      />
    );
  }
}

export default WrapperDebug;
