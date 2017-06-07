import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import {registerModal, showModal} from './modals/index';
import AlertModal from './modals/alert-modal';
import ChangelogModal from './modals/changelog-modal';
import CookiesModal from './modals/cookies-modal';
import EnvironmentEditModal from './modals/environment-edit-modal';
import GenerateCodeModal from './modals/generate-code-modal';
import LoginModal from './modals/login-modal';
import PaymentNotificationModal from './modals/payment-notification-modal';
import NunjucksModal from './modals/nunjucks-modal';
import PromptModal from './modals/prompt-modal';
import RequestCreateModal from './modals/request-create-modal';
import RequestPane from './request-pane';
import RequestSwitcherModal from './modals/request-switcher-modal';
import SetupSyncModal from './modals/setup-sync-modal';
import SettingsModal from './modals/settings-modal';
import FilterHelpModal from './modals/filter-help-modal';
import ResponsePane from './response-pane';
import RequestSettingsModal from './modals/request-settings-modal';
import RequestRenderErrorModal from './modals/request-render-error-modal';
import Sidebar from './sidebar/sidebar';
import WorkspaceEnvironmentsEditModal from './modals/workspace-environments-edit-modal';
import WorkspaceSettingsModal from './modals/workspace-settings-modal';
import WorkspaceShareSettingsModal from './modals/workspace-share-settings-modal';
import * as models from '../../models/index';
import {updateMimeType} from '../../models/request';
import {trackEvent} from '../../analytics/index';
import * as importers from 'insomnia-importers';

const rUpdate = models.request.update;
const sUpdate = models.settings.update;

@autobind
class Wrapper extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      forceRefreshKey: Date.now()
    };
  }

  // Request updaters
  async _handleForceUpdateRequest (patch) {
    const newRequest = await rUpdate(this.props.activeRequest, patch);

    // Give it a second for the app to render first. If we don't wait, it will refresh
    // on the old request and won't catch the newest one.
    window.setTimeout(this._forceRequestPaneRefresh, 100);

    return newRequest;
  }

  _handleUpdateRequestBody (body) {
    rUpdate(this.props.activeRequest, {body});
  }

  _handleUpdateRequestMethod (method) {
    rUpdate(this.props.activeRequest, {method});
  }

  _handleUpdateRequestParameters (parameters) {
    rUpdate(this.props.activeRequest, {parameters});
  }

  _handleUpdateRequestAuthentication (authentication) {
    rUpdate(this.props.activeRequest, {authentication});
  }

  _handleUpdateRequestHeaders (headers) {
    rUpdate(this.props.activeRequest, {headers});
  }

  _handleUpdateRequestUrl (url) {
    rUpdate(this.props.activeRequest, {url});
  }

  // Special request updaters
  async _handleUpdateRequestMimeType (mimeType) {
    await updateMimeType(this.props.activeRequest, mimeType);

    // Force it to update, because other editor components (header editor)
    // needs to change. Need to wait a delay so the next render can finish
    setTimeout(this._forceRequestPaneRefresh, 300);
  }

  _handleStartDragSidebar (e) {
    e.preventDefault();
    this.props.handleStartDragSidebar();
  }

  async _handleImport (text) {
    // Allow user to paste any import file into the url. If it results in
    // only one item, it will overwrite the current request.
    try {
      const {data} = importers.convert(text);
      const {resources} = data;
      const r = resources[0];

      if (r && r._type === 'request') {
        trackEvent('Import', 'Url Bar');

        // Only pull fields that we want to update
        return this._handleForceUpdateRequest({
          url: r.url,
          method: r.method,
          headers: r.headers,
          body: r.body,
          authentication: r.authentication,
          parameters: r.parameters
        });
      }
    } catch (e) {
      // Import failed, that's alright
    }

    return null;
  }

  // Settings updaters
  _handleUpdateSettingsShowPasswords (showPasswords) {
    sUpdate(this.props.settings, {showPasswords});
  }

  _handleUpdateSettingsUseBulkHeaderEditor (useBulkHeaderEditor) {
    sUpdate(this.props.settings, {useBulkHeaderEditor});
  }

  // Other Helpers
  _handleImportFile () {
    this.props.handleImportFileToWorkspace(this.props.activeWorkspace._id);
  }

  _handleImportUri (uri) {
    this.props.handleImportUriToWorkspace(this.props.activeWorkspace._id, uri);
  }

  _handleExportWorkspaceToFile () {
    this.props.handleExportFile(this.props.activeWorkspace._id);
  }

  _handleSetActiveResponse (responseId) {
    this.props.handleSetActiveResponse(this.props.activeRequest._id, responseId);
  }

  _handleShowEnvironmentsModal () {
    showModal(WorkspaceEnvironmentsEditModal, this.props.activeWorkspace);
  }

  _handleShowCookiesModal () {
    showModal(CookiesModal, this.props.activeWorkspace);
  }

  _handleShowRequestSettingsModal () {
    showModal(RequestSettingsModal, this.props.activeRequest);
  }

  _handleDeleteResponses () {
    models.response.removeForRequest(this.props.activeRequest._id);
    this._handleSetActiveResponse(null);
  }

  async _handleRemoveActiveWorkspace () {
    const {workspaces, activeWorkspace} = this.props;
    if (workspaces.length <= 1) {
      showModal(AlertModal, {
        title: 'Deleting Last Workspace',
        message: 'Since you deleted your only workspace, a new one has been created for you.'
      });

      models.workspace.create({name: 'Insomnia'});
      trackEvent('Workspace', 'Delete', 'Last');
    } else {
      trackEvent('Workspace', 'Delete');
    }

    models.workspace.remove(activeWorkspace);
  }

  async _handleDuplicateActiveWorkspace () {
    const {activeWorkspace} = this.props;

    trackEvent('Workspace', 'Duplicate');

    const newWorkspace = await models.workspace.duplicate(activeWorkspace);
    await this.props.handleSetActiveWorkspace(newWorkspace._id);
  }

  _handleSendRequestWithActiveEnvironment () {
    const {activeRequest, activeEnvironment, handleSendRequestWithEnvironment} = this.props;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    handleSendRequestWithEnvironment(activeRequestId, activeEnvironmentId);
  }

  _handleSendAndDownloadRequestWithActiveEnvironment (filename) {
    const {activeRequest, activeEnvironment, handleSendAndDownloadRequestWithEnvironment} = this.props;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    handleSendAndDownloadRequestWithEnvironment(activeRequestId, activeEnvironmentId, filename);
  }

  _handleSetPreviewMode (previewMode) {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponsePreviewMode(activeRequestId, previewMode);
  }

  _handleSetResponseFilter (filter) {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponseFilter(activeRequestId, filter);
  }

  _forceRequestPaneRefresh () {
    this.setState({forceRefreshKey: Date.now()});
  }

  render () {
    const {
      activeEnvironment,
      activeRequest,
      activeResponseId,
      activeWorkspace,
      environments,
      handleActivateRequest,
      handleCreateRequest,
      handleCreateRequestForWorkspace,
      handleCreateRequestGroup,
      handleDuplicateRequest,
      handleDuplicateRequestGroup,
      handleExportFile,
      handleMoveRequest,
      handleMoveRequestGroup,
      handleResetDragPaneHorizontal,
      handleResetDragPaneVertical,
      handleResetDragSidebar,
      handleSetActiveEnvironment,
      handleSetActiveWorkspace,
      handleSetRequestGroupCollapsed,
      handleSetRequestPaneRef,
      handleSetResponsePaneRef,
      handleSetSidebarRef,
      handleStartDragPaneHorizontal,
      handleStartDragPaneVertical,
      handleSetSidebarFilter,
      handleToggleMenuBar,
      handleRender,
      handleGetRenderContext,
      handleDuplicateWorkspace,
      handleGenerateCodeForActiveRequest,
      handleGenerateCode,
      isLoading,
      loadStartTime,
      paneWidth,
      paneHeight,
      responseFilter,
      responsePreviewMode,
      oAuth2Token,
      settings,
      sidebarChildren,
      sidebarFilter,
      sidebarHidden,
      sidebarWidth,
      workspaceChildren,
      workspaces
    } = this.props;

    const realSidebarWidth = sidebarHidden ? 0 : sidebarWidth;

    const columns = `${realSidebarWidth}rem 0 minmax(0, ${paneWidth}fr) 0 minmax(0, ${1 - paneWidth}fr)`;
    const rows = `minmax(0, ${paneHeight}fr) 0 minmax(0, ${1 - paneHeight}fr)`;

    return (
      <div id="wrapper"
           className={classnames('wrapper', {'wrapper--vertical': settings.forceVerticalLayout})}
           style={{gridTemplateColumns: columns, gridTemplateRows: rows}}>

        <Sidebar
          ref={handleSetSidebarRef}
          showEnvironmentsModal={this._handleShowEnvironmentsModal}
          showCookiesModal={this._handleShowCookiesModal}
          handleActivateRequest={handleActivateRequest}
          handleChangeFilter={handleSetSidebarFilter}
          handleImportFile={this._handleImportFile}
          handleExportFile={handleExportFile}
          handleSetActiveWorkspace={handleSetActiveWorkspace}
          handleDuplicateRequest={handleDuplicateRequest}
          handleGenerateCode={handleGenerateCode}
          handleDuplicateRequestGroup={handleDuplicateRequestGroup}
          handleSetActiveEnvironment={handleSetActiveEnvironment}
          moveRequest={handleMoveRequest}
          moveRequestGroup={handleMoveRequestGroup}
          handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
          activeRequest={activeRequest}
          activeEnvironment={activeEnvironment}
          handleCreateRequest={handleCreateRequest}
          handleCreateRequestGroup={handleCreateRequestGroup}
          filter={sidebarFilter || ''}
          hidden={sidebarHidden || false}
          workspace={activeWorkspace}
          childObjects={sidebarChildren}
          width={sidebarWidth}
          isLoading={isLoading}
          workspaces={workspaces}
          environments={environments}
        />

        <div className="drag drag--sidebar">
          <div onDoubleClick={handleResetDragSidebar} onMouseDown={this._handleStartDragSidebar}>
          </div>
        </div>

        <RequestPane
          ref={handleSetRequestPaneRef}
          handleImportFile={this._handleImportFile}
          request={activeRequest}
          showPasswords={settings.showPasswords}
          useBulkHeaderEditor={settings.useBulkHeaderEditor}
          editorFontSize={settings.editorFontSize}
          editorIndentSize={settings.editorIndentSize}
          editorKeyMap={settings.editorKeyMap}
          editorLineWrapping={settings.editorLineWrapping}
          workspace={activeWorkspace}
          oAuth2Token={oAuth2Token}
          forceUpdateRequest={this._handleForceUpdateRequest}
          handleCreateRequest={handleCreateRequestForWorkspace}
          handleGenerateCode={handleGenerateCodeForActiveRequest}
          handleImport={this._handleImport}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          updateRequestBody={this._handleUpdateRequestBody}
          updateRequestUrl={this._handleUpdateRequestUrl}
          updateRequestMethod={this._handleUpdateRequestMethod}
          updateRequestParameters={this._handleUpdateRequestParameters}
          updateRequestAuthentication={this._handleUpdateRequestAuthentication}
          updateRequestHeaders={this._handleUpdateRequestHeaders}
          updateRequestMimeType={this._handleUpdateRequestMimeType}
          updateSettingsShowPasswords={this._handleUpdateSettingsShowPasswords}
          updateSettingsUseBulkHeaderEditor={this._handleUpdateSettingsUseBulkHeaderEditor}
          forceRefreshCounter={this.state.forceRefreshKey}
          handleSend={this._handleSendRequestWithActiveEnvironment}
          handleSendAndDownload={this._handleSendAndDownloadRequestWithActiveEnvironment}
        />

        <div className="drag drag--pane-horizontal">
          <div
            onMouseDown={handleStartDragPaneHorizontal}
            onDoubleClick={handleResetDragPaneHorizontal}>
          </div>
        </div>

        <div className="drag drag--pane-vertical">
          <div
            onMouseDown={handleStartDragPaneVertical}
            onDoubleClick={handleResetDragPaneVertical}>
          </div>
        </div>

        <ResponsePane
          ref={handleSetResponsePaneRef}
          request={activeRequest}
          editorFontSize={settings.editorFontSize}
          editorIndentSize={settings.editorIndentSize}
          editorKeyMap={settings.editorKeyMap}
          editorLineWrapping={settings.editorLineWrapping}
          previewMode={responsePreviewMode}
          activeResponseId={activeResponseId}
          filter={responseFilter}
          loadStartTime={loadStartTime}
          showCookiesModal={this._handleShowCookiesModal}
          handleShowRequestSettings={this._handleShowRequestSettingsModal}
          handleSetActiveResponse={this._handleSetActiveResponse}
          handleSetPreviewMode={this._handleSetPreviewMode}
          handleDeleteResponses={this._handleDeleteResponses}
          handleSetFilter={this._handleSetResponseFilter}
        />

        <div className="modals">
          <AlertModal ref={registerModal}/>
          <ChangelogModal ref={registerModal}/>
          <LoginModal ref={registerModal}/>
          <PromptModal ref={registerModal}/>
          <RequestCreateModal ref={registerModal}/>
          <PaymentNotificationModal ref={registerModal}/>
          <FilterHelpModal ref={registerModal}/>
          <RequestRenderErrorModal ref={registerModal}/>

          <RequestSettingsModal
            ref={registerModal}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
            editorLineWrapping={settings.editorLineWrapping}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
          />

          <CookiesModal
            ref={registerModal}
            workspace={activeWorkspace}
          />
          <NunjucksModal
            uniqueKey={`key::${this.state.forceRefreshKey}`}
            ref={registerModal}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            workspace={activeWorkspace}
          />
          <WorkspaceSettingsModal
            ref={registerModal}
            workspace={activeWorkspace}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
            editorLineWrapping={settings.editorLineWrapping}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            handleRemoveWorkspace={this._handleRemoveActiveWorkspace}
            handleDuplicateWorkspace={handleDuplicateWorkspace}
          />
          <WorkspaceShareSettingsModal
            ref={registerModal}
            workspace={activeWorkspace}
          />
          <GenerateCodeModal
            ref={registerModal}
            environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
          />
          <SettingsModal
            ref={registerModal}
            handleExportWorkspaceToFile={this._handleExportWorkspaceToFile}
            handleExportAllToFile={handleExportFile}
            handleImportFile={this._handleImportFile}
            handleImportUri={this._handleImportUri}
            handleToggleMenuBar={handleToggleMenuBar}
            settings={settings}
          />
          <RequestSwitcherModal
            ref={registerModal}
            workspaces={workspaces}
            workspaceChildren={workspaceChildren}
            workspaceId={activeWorkspace._id}
            activeRequestParentId={activeRequest ? activeRequest.parentId : activeWorkspace._id}
            activateRequest={handleActivateRequest}
            handleSetActiveWorkspace={handleSetActiveWorkspace}
          />
          <EnvironmentEditModal
            ref={registerModal}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
            lineWrapping={settings.editorLineWrapping}
            onChange={models.requestGroup.update}
            render={handleRender}
            getRenderContext={handleGetRenderContext}
          />
          <SetupSyncModal
            ref={registerModal}
            workspace={activeWorkspace}
          />
          <WorkspaceEnvironmentsEditModal
            ref={registerModal}
            onChange={models.workspace.update}
            lineWrapping={settings.editorLineWrapping}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
            render={handleRender}
            getRenderContext={handleGetRenderContext}
          />
        </div>
      </div>
    );
  }
}

Wrapper.propTypes = {
  // Helper Functions
  handleActivateRequest: PropTypes.func.isRequired,
  handleSetSidebarFilter: PropTypes.func.isRequired,
  handleToggleMenuBar: PropTypes.func.isRequired,
  handleImportFileToWorkspace: PropTypes.func.isRequired,
  handleImportUriToWorkspace: PropTypes.func.isRequired,
  handleExportFile: PropTypes.func.isRequired,
  handleSetActiveWorkspace: PropTypes.func.isRequired,
  handleSetActiveEnvironment: PropTypes.func.isRequired,
  handleMoveRequest: PropTypes.func.isRequired,
  handleMoveRequestGroup: PropTypes.func.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  handleDuplicateRequest: PropTypes.func.isRequired,
  handleDuplicateRequestGroup: PropTypes.func.isRequired,
  handleDuplicateWorkspace: PropTypes.func.isRequired,
  handleCreateRequestGroup: PropTypes.func.isRequired,
  handleGenerateCodeForActiveRequest: PropTypes.func.isRequired,
  handleGenerateCode: PropTypes.func.isRequired,
  handleCreateRequestForWorkspace: PropTypes.func.isRequired,
  handleSetRequestPaneRef: PropTypes.func.isRequired,
  handleSetResponsePaneRef: PropTypes.func.isRequired,
  handleSetResponsePreviewMode: PropTypes.func.isRequired,
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  handleSetResponseFilter: PropTypes.func.isRequired,
  handleSetActiveResponse: PropTypes.func.isRequired,
  handleSetSidebarRef: PropTypes.func.isRequired,
  handleStartDragSidebar: PropTypes.func.isRequired,
  handleResetDragSidebar: PropTypes.func.isRequired,
  handleStartDragPaneHorizontal: PropTypes.func.isRequired,
  handleStartDragPaneVertical: PropTypes.func.isRequired,
  handleResetDragPaneHorizontal: PropTypes.func.isRequired,
  handleResetDragPaneVertical: PropTypes.func.isRequired,
  handleSetRequestGroupCollapsed: PropTypes.func.isRequired,
  handleSendRequestWithEnvironment: PropTypes.func.isRequired,
  handleSendAndDownloadRequestWithEnvironment: PropTypes.func.isRequired,

  // Properties
  loadStartTime: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  paneWidth: PropTypes.number.isRequired,
  paneHeight: PropTypes.number.isRequired,
  responsePreviewMode: PropTypes.string.isRequired,
  responseFilter: PropTypes.string.isRequired,
  activeResponseId: PropTypes.string.isRequired,
  sidebarWidth: PropTypes.number.isRequired,
  sidebarHidden: PropTypes.bool.isRequired,
  sidebarFilter: PropTypes.string.isRequired,
  sidebarChildren: PropTypes.arrayOf(PropTypes.object).isRequired,
  settings: PropTypes.object.isRequired,
  workspaces: PropTypes.arrayOf(PropTypes.object).isRequired,
  workspaceChildren: PropTypes.arrayOf(PropTypes.object).isRequired,
  environments: PropTypes.arrayOf(PropTypes.object).isRequired,
  activeWorkspace: PropTypes.shape({
    _id: PropTypes.string.isRequired
  }).isRequired,

  // Optional
  oAuth2Token: PropTypes.object,
  activeRequest: PropTypes.object,
  activeEnvironment: PropTypes.object
};

export default Wrapper;
