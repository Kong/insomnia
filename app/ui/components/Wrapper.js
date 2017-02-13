import React, {PropTypes, Component} from 'react';
import classnames from 'classnames';
import {showModal, registerModal} from './modals/index';
import AlertModal from '../components/modals/AlertModal';
import ChangelogModal from '../components/modals/ChangelogModal';
import CookiesModal from '../components/modals/CookiesModal';
import EnvironmentEditModal from '../components/modals/EnvironmentEditModal';
import GenerateCodeModal from '../components/modals/GenerateCodeModal';
import LoginModal from '../components/modals/LoginModal';
import PaymentNotificationModal from '../components/modals/PaymentNotificationModal';
import PromptModal from '../components/modals/PromptModal';
import RequestCreateModal from '../components/modals/RequestCreateModal';
import RequestPane from './RequestPane';
import RequestSwitcherModal from '../components/modals/RequestSwitcherModal';
import ResponsePane from './ResponsePane';
import SettingsModal from '../components/modals/SettingsModal';
import Sidebar from './sidebar/Sidebar';
import SyncLogsModal from '../components/modals/SyncLogsModal';
import WorkspaceEnvironmentsEditModal from '../components/modals/WorkspaceEnvironmentsEditModal';
import WorkspaceSettingsModal from '../components/modals/WorkspaceSettingsModal';
import WorkspaceShareSettingsModal from '../components/modals/WorkspaceShareSettingsModal';
import * as models from '../../models/index';
import {updateMimeType} from '../../models/request';
import {trackEvent} from '../../analytics/index';
import * as importers from 'insomnia-importers';

const rUpdate = models.request.update;
const sUpdate = models.settings.update;

class Wrapper extends Component {
  state = {forceRefreshRequestPaneCounter: Date.now()};

  // Request updaters
  _handleForceUpdateRequest = async patch => {
    const newRequest = await rUpdate(this.props.activeRequest, patch);
    this.forceRequestPaneRefresh();
    return newRequest;
  };

  _handleUpdateRequestBody = body => rUpdate(this.props.activeRequest, {body});
  _handleUpdateRequestMethod = method => rUpdate(this.props.activeRequest, {method});
  _handleUpdateRequestParameters = parameters => rUpdate(this.props.activeRequest, {parameters});
  _handleUpdateRequestAuthentication = authentication => rUpdate(this.props.activeRequest, {authentication});
  _handleUpdateRequestHeaders = headers => rUpdate(this.props.activeRequest, {headers});
  _handleUpdateRequestUrl = url => rUpdate(this.props.activeRequest, {url});

  // Special request updaters
  _handleUpdateRequestMimeType = mimeType => updateMimeType(this.props.activeRequest, mimeType);
  _handleImport = async text => {
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
          parameters: r.parameters,
        });
      }
    } catch (e) {
      // Import failed, that's alright
    }

    return null;
  };


  // Settings updaters
  _handleUpdateSettingsShowPasswords = showPasswords => sUpdate(this.props.settings, {showPasswords});
  _handleUpdateSettingsUseBulkHeaderEditor = useBulkHeaderEditor => sUpdate(this.props.settings, {useBulkHeaderEditor});

  // Other Helpers
  _handleImportFile = () => {
    this.props.handleImportFileToWorkspace(this.props.activeWorkspace._id);
  };

  _handleExportWorkspaceToFile = () => this.props.handleExportFile(this.props.activeWorkspace._id);
  _handleSetActiveResponse = responseId => this.props.handleSetActiveResponse(this.props.activeRequest._id, responseId);
  _handleShowEnvironmentsModal = () => showModal(WorkspaceEnvironmentsEditModal, this.props.activeWorkspace);
  _handleShowCookiesModal = () => showModal(CookiesModal, this.props.activeWorkspace);

  _handleDeleteResponses = () => {
    models.response.removeForRequest(this.props.activeRequest._id);
    this._handleSetActiveResponse(null);
  };

  _handleRemoveActiveWorkspace = async () => {
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
  };

  _handleSendRequestWithActiveEnvironment = () => {
    const {activeRequest, activeEnvironment, handleSendRequestWithEnvironment} = this.props;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    handleSendRequestWithEnvironment(activeRequestId, activeEnvironmentId);
  };

  _handleSendAndDownloadRequestWithActiveEnvironment = filename => {
    const {activeRequest, activeEnvironment, handleSendAndDownloadRequestWithEnvironment} = this.props;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    handleSendAndDownloadRequestWithEnvironment(activeRequestId, activeEnvironmentId, filename);
  };

  _handleSetPreviewMode = previewMode => {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponsePreviewMode(activeRequestId, previewMode);
  };

  _handleSetResponseFilter = filter => {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponseFilter(activeRequestId, filter);
  };

  forceRequestPaneRefresh () {
    this.setState({forceRefreshRequestPaneCounter: Date.now()});
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
      handleResetDragPane,
      handleResetDragSidebar,
      handleSetActiveEnvironment,
      handleSetActiveWorkspace,
      handleSetRequestGroupCollapsed,
      handleSetRequestPaneRef,
      handleSetResponsePaneRef,
      handleSetSidebarRef,
      handleStartDragPane,
      handleStartDragSidebar,
      handleSetSidebarFilter,
      handleRender,
      handleGenerateCodeForActiveRequest,
      handleGenerateCode,
      isLoading,
      loadStartTime,
      paneWidth,
      responseFilter,
      responsePreviewMode,
      settings,
      sidebarChildren,
      sidebarFilter,
      sidebarHidden,
      sidebarWidth,
      workspaceChildren,
      workspaces,
    } = this.props;

    const realSidebarWidth = sidebarHidden ? 0 : sidebarWidth;
    const gridTemplateColumns = `${realSidebarWidth}rem 0 ${paneWidth}fr 0 ${1 - paneWidth}fr`;

    return (
      <div id="wrapper"
           className={classnames('wrapper', {'wrapper--vertical': settings.forceVerticalLayout})}
           style={{gridTemplateColumns: gridTemplateColumns}}>

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
          children={sidebarChildren}
          width={sidebarWidth}
          isLoading={isLoading}
          workspaces={workspaces}
          environments={environments}
        />

        <div className="drag drag--sidebar">
          <div onDoubleClick={handleResetDragSidebar} onMouseDown={e => {
            e.preventDefault();
            handleStartDragSidebar();
          }}></div>
        </div>

        <RequestPane
          ref={handleSetRequestPaneRef}
          handleImportFile={this._handleImportFile}
          request={activeRequest}
          showPasswords={settings.showPasswords}
          useBulkHeaderEditor={settings.useBulkHeaderEditor}
          editorFontSize={settings.editorFontSize}
          editorKeyMap={settings.editorKeyMap}
          editorLineWrapping={settings.editorLineWrapping}
          environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
          workspace={activeWorkspace}
          forceUpdateRequest={this._handleForceUpdateRequest}
          handleCreateRequest={handleCreateRequestForWorkspace}
          handleGenerateCode={handleGenerateCodeForActiveRequest}
          handleImport={this._handleImport}
          handleRender={handleRender}
          updateRequestBody={this._handleUpdateRequestBody}
          updateRequestUrl={this._handleUpdateRequestUrl}
          updateRequestMethod={this._handleUpdateRequestMethod}
          updateRequestParameters={this._handleUpdateRequestParameters}
          updateRequestAuthentication={this._handleUpdateRequestAuthentication}
          updateRequestHeaders={this._handleUpdateRequestHeaders}
          updateRequestMimeType={this._handleUpdateRequestMimeType}
          updateSettingsShowPasswords={this._handleUpdateSettingsShowPasswords}
          updateSettingsUseBulkHeaderEditor={this._handleUpdateSettingsUseBulkHeaderEditor}
          forceRefreshCounter={this.state.forceRefreshRequestPaneCounter}
          handleSend={this._handleSendRequestWithActiveEnvironment}
          handleSendAndDownload={this._handleSendAndDownloadRequestWithActiveEnvironment}
        />

        <div className="drag drag--pane">
          <div onMouseDown={handleStartDragPane} onDoubleClick={handleResetDragPane}></div>
        </div>

        <ResponsePane
          ref={handleSetResponsePaneRef}
          request={activeRequest}
          editorFontSize={settings.editorFontSize}
          editorKeyMap={settings.editorKeyMap}
          editorLineWrapping={settings.editorLineWrapping}
          previewMode={responsePreviewMode}
          activeResponseId={activeResponseId}
          filter={responseFilter}
          loadStartTime={loadStartTime}
          showCookiesModal={this._handleShowCookiesModal}
          handleSetActiveResponse={this._handleSetActiveResponse}
          handleSetPreviewMode={this._handleSetPreviewMode}
          handleDeleteResponses={this._handleDeleteResponses}
          handleSetFilter={this._handleSetResponseFilter}
        />

        <AlertModal ref={registerModal}/>
        <CookiesModal ref={registerModal}/>
        <ChangelogModal ref={registerModal}/>
        <SyncLogsModal ref={registerModal}/>
        <LoginModal ref={registerModal}/>
        <PromptModal ref={registerModal}/>
        <RequestCreateModal ref={registerModal}/>
        <PaymentNotificationModal ref={registerModal}/>
        <WorkspaceSettingsModal
          ref={registerModal}
          workspace={activeWorkspace}
          handleRemoveWorkspace={this._handleRemoveActiveWorkspace}/>
        <WorkspaceShareSettingsModal
          ref={registerModal}
          workspace={activeWorkspace}/>
        <GenerateCodeModal
          ref={registerModal}
          environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
          editorFontSize={settings.editorFontSize}
          editorKeyMap={settings.editorKeyMap}
        />
        <SettingsModal
          ref={registerModal}
          handleExportWorkspaceToFile={this._handleExportWorkspaceToFile}
          handleExportAllToFile={handleExportFile}
          handleImportFile={this._handleImportFile}
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
          editorKeyMap={settings.editorKeyMap}
          onChange={models.requestGroup.update}
        />
        <WorkspaceEnvironmentsEditModal
          ref={registerModal}
          onChange={models.workspace.update}
          editorFontSize={settings.editorFontSize}
          editorKeyMap={settings.editorKeyMap}
        />
      </div>
    )
  }
}

Wrapper.propTypes = {
  // Helper Functions
  handleActivateRequest: PropTypes.func.isRequired,
  handleSetSidebarFilter: PropTypes.func.isRequired,
  handleImportFileToWorkspace: PropTypes.func.isRequired,
  handleExportFile: PropTypes.func.isRequired,
  handleSetActiveWorkspace: PropTypes.func.isRequired,
  handleSetActiveEnvironment: PropTypes.func.isRequired,
  handleMoveRequest: PropTypes.func.isRequired,
  handleMoveRequestGroup: PropTypes.func.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  handleDuplicateRequest: PropTypes.func.isRequired,
  handleDuplicateRequestGroup: PropTypes.func.isRequired,
  handleCreateRequestGroup: PropTypes.func.isRequired,
  handleGenerateCodeForActiveRequest: PropTypes.func.isRequired,
  handleGenerateCode: PropTypes.func.isRequired,
  handleCreateRequestForWorkspace: PropTypes.func.isRequired,
  handleSetRequestPaneRef: PropTypes.func.isRequired,
  handleSetResponsePaneRef: PropTypes.func.isRequired,
  handleSetResponsePreviewMode: PropTypes.func.isRequired,
  handleRender: PropTypes.func.isRequired,
  handleSetResponseFilter: PropTypes.func.isRequired,
  handleSetActiveResponse: PropTypes.func.isRequired,
  handleSetSidebarRef: PropTypes.func.isRequired,
  handleStartDragSidebar: PropTypes.func.isRequired,
  handleResetDragSidebar: PropTypes.func.isRequired,
  handleStartDragPane: PropTypes.func.isRequired,
  handleResetDragPane: PropTypes.func.isRequired,
  handleSetRequestGroupCollapsed: PropTypes.func.isRequired,
  handleSendRequestWithEnvironment: PropTypes.func.isRequired,
  handleSendAndDownloadRequestWithEnvironment: PropTypes.func.isRequired,

  // Properties
  loadStartTime: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  paneWidth: PropTypes.number.isRequired,
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

  // Optional
  activeEnvironment: PropTypes.object,
};

export default Wrapper;
