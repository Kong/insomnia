import React, {PropTypes, Component} from 'react';
import classnames from 'classnames';
import {showModal, registerModal} from './modals/index';
import WorkspaceEnvironmentsEditModal from '../components/modals/WorkspaceEnvironmentsEditModal';
import CookiesModal from '../components/modals/CookiesModal';
import EnvironmentEditModal from '../components/modals/EnvironmentEditModal';
import RequestSwitcherModal from '../components/modals/RequestSwitcherModal';
import GenerateCodeModal from '../components/modals/GenerateCodeModal';
import PromptModal from '../components/modals/PromptModal';
import AlertModal from '../components/modals/AlertModal';
import PaymentModal from '../components/modals/PaymentModal';
import PaymentNotificationModal from '../components/modals/PaymentNotificationModal';
import ChangelogModal from '../components/modals/ChangelogModal';
import SyncLogsModal from '../components/modals/SyncLogsModal';
import LoginModal from '../components/modals/LoginModal';
import SignupModal from '../components/modals/SignupModal';
import SettingsModal from '../components/modals/SettingsModal';
import Sidebar from './sidebar/Sidebar';
import RequestPane from './RequestPane';
import ResponsePane from './ResponsePane';
import * as models from '../../models/index';
import {updateMimeType} from '../../models/request';


class Wrapper extends Component {
  _handleImportFile = () => {
    this.props.handleImportFileToWorkspace(this.props.activeWorkspace._id);
  };

  _handleExportWorkspaceToFile = () => {
    this.props.handleExportFile(this.props.activeWorkspace._id);
  };

  _handleShowCookiesModal = () => {
    showModal(CookiesModal, this.props.activeWorkspace);
  };

  _handleSetPreviewMode = (previewMode) => {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponsePreviewMode(activeRequestId, previewMode);
  };

  _handleSetResponseFilter = (filter) => {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponseFilter(activeRequestId, filter);
  };

  _handleSetSidebarFilter = (filter) => {
    this.props.handleSetSidebarFilter(this.props.activeWorkspace._id, filter);
  };

  _showEnvironmentsModal = () => {
    showModal(WorkspaceEnvironmentsEditModal, this.props.activeWorkspace);
  };

  _showCookiesModal = () => {
    showModal(CookiesModal, this.props.activeWorkspace);
  };


  render () {
    const {
      isLoading,
      loadStartTime,
      activeWorkspace,
      activeRequest,
      activeEnvironment,
      sidebarHidden,
      sidebarFilter,
      sidebarWidth,
      paneWidth,
      forceRefreshCounter,
      workspaces,
      settings,
      environments,
      responsePreviewMode,
      responseFilter,
      handleSendRequestWithEnvironment,
      handleCreateRequest,
      handleCreateRequestForWorkspace,
      handleCreateRequestGroup,
      handleExportFile,
      handleActivateRequest,
      handleSetActiveWorkspace,
      handleSetActiveEnvironment,
      handleSetRequestGroupCollapsed,
      handleMoveRequest,
      handleMoveRequestGroup,
      handleSetRequestPaneRef,
      handleSetResponsePaneRef,
      handleSetSidebarRef,
      handleStartDragSidebar,
      handleResetDragSidebar,
      handleStartDragPane,
      handleResetDragPane,
      handleUpdateRequestUrl,
      sidebarChildren,
    } = this.props;

    const realSidebarWidth = sidebarHidden ? 0 : sidebarWidth;
    const gridTemplateColumns = `${realSidebarWidth}rem 0 ${paneWidth}fr 0 ${1 - paneWidth}fr`;

    return (
      <div id="wrapper"
           key={`wrapper::${forceRefreshCounter}`}
           className={classnames('wrapper', {'wrapper--vertical': settings.forceVerticalLayout})}
           style={{gridTemplateColumns: gridTemplateColumns}}>
        <Sidebar
          ref={handleSetSidebarRef}
          showEnvironmentsModal={this._showEnvironmentsModal}
          showCookiesModal={this._showCookiesModal}
          handleActivateRequest={handleActivateRequest}
          handleChangeFilter={this._handleSetSidebarFilter}
          handleImportFile={this._handleImportFile}
          handleExportFile={handleExportFile}
          handleSetActiveWorkspace={handleSetActiveWorkspace}
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
          editorLineWrapping={settings.editorLineWrapping}
          environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
          handleCreateRequest={handleCreateRequestForWorkspace}
          updateRequestBody={body => models.request.update(activeRequest, {body})}
          updateRequestUrl={url => handleUpdateRequestUrl(activeRequest, url)}
          updateRequestMethod={method => models.request.update(activeRequest, {method})}
          updateRequestParameters={parameters => models.request.update(activeRequest, {parameters})}
          updateRequestAuthentication={authentication => models.request.update(activeRequest, {authentication})}
          updateRequestHeaders={headers => models.request.update(activeRequest, {headers})}
          updateRequestMimeType={mimeType => updateMimeType(activeRequest, mimeType)}
          updateSettingsShowPasswords={showPasswords => models.settings.update(settings, {showPasswords})}
          updateSettingsUseBulkHeaderEditor={useBulkHeaderEditor => models.settings.update(settings, {useBulkHeaderEditor})}
          handleSend={handleSendRequestWithEnvironment.bind(
            null,
            activeRequest ? activeRequest._id : 'n/a',
            activeEnvironment ? activeEnvironment._id : 'n/a'
          )}
        />

        <div className="drag drag--pane">
          <div onMouseDown={handleStartDragPane} onDoubleClick={handleResetDragPane}></div>
        </div>

        <ResponsePane
          ref={handleSetResponsePaneRef}
          request={activeRequest}
          editorFontSize={settings.editorFontSize}
          editorLineWrapping={settings.editorLineWrapping}
          previewMode={responsePreviewMode}
          filter={responseFilter}
          loadStartTime={loadStartTime}
          showCookiesModal={this._handleShowCookiesModal}
          handleSetPreviewMode={this._handleSetPreviewMode}
          handleSetFilter={this._handleSetResponseFilter}
        />

        <AlertModal ref={registerModal}/>
        <CookiesModal ref={registerModal}/>
        <ChangelogModal ref={registerModal}/>
        <SyncLogsModal ref={registerModal}/>
        <LoginModal ref={registerModal}/>
        <PromptModal ref={registerModal}/>
        <SignupModal ref={registerModal}/>
        <PaymentModal ref={registerModal}/>
        <PaymentNotificationModal ref={registerModal}/>
        <EnvironmentEditModal
          ref={registerModal}
          onChange={models.requestGroup.update}
        />
        <GenerateCodeModal
          ref={registerModal}
          environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
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
          workspaceId={activeWorkspace._id}
          activeRequestParentId={activeRequest ? activeRequest.parentId : activeWorkspace._id}
          activateRequest={handleActivateRequest}
          handleSetActiveWorkspace={handleSetActiveWorkspace}
        />
        <WorkspaceEnvironmentsEditModal
          ref={registerModal}
          onChange={models.workspace.update}/>
      </div>
    )
  }
}

Wrapper.propTypes = {
  // Helper Functions
  handleActivateRequest: PropTypes.func.isRequired,
  handleSetSidebarFilter: PropTypes.func.isRequired,
  handleSetSidebarHidden: PropTypes.func.isRequired,
  handleSetSidebarWidth: PropTypes.func.isRequired,
  handleSetPaneWidth: PropTypes.func.isRequired,
  handleImportFileToWorkspace: PropTypes.func.isRequired,
  handleExportFile: PropTypes.func.isRequired,
  handleSetActiveWorkspace: PropTypes.func.isRequired,
  handleSetActiveEnvironment: PropTypes.func.isRequired,
  handleMoveRequest: PropTypes.func.isRequired,
  handleMoveRequestGroup: PropTypes.func.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  handleCreateRequestGroup: PropTypes.func.isRequired,
  handleCreateRequestForWorkspace: PropTypes.func.isRequired,
  handleSetRequestPaneRef: PropTypes.func.isRequired,
  handleSetResponsePaneRef: PropTypes.func.isRequired,
  handleSetResponsePreviewMode: PropTypes.func.isRequired,
  handleSetResponseFilter: PropTypes.func.isRequired,
  handleSetSidebarRef: PropTypes.func.isRequired,
  handleStartDragSidebar: PropTypes.func.isRequired,
  handleResetDragSidebar: PropTypes.func.isRequired,
  handleStartDragPane: PropTypes.func.isRequired,
  handleResetDragPane: PropTypes.func.isRequired,
  handleUpdateRequestUrl: PropTypes.func.isRequired,
  handleSetRequestGroupCollapsed: PropTypes.func.isRequired,
  handleSendRequestWithEnvironment: PropTypes.func.isRequired,

  // Properties
  loadStartTime: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  paneWidth: PropTypes.number.isRequired,
  responsePreviewMode: PropTypes.string.isRequired,
  responseFilter: PropTypes.string.isRequired,
  sidebarWidth: PropTypes.number.isRequired,
  sidebarHidden: PropTypes.bool.isRequired,
  sidebarFilter: PropTypes.string.isRequired,
  sidebarChildren: PropTypes.arrayOf(PropTypes.object).isRequired,
  settings: PropTypes.object.isRequired,
  workspaces: PropTypes.arrayOf(PropTypes.object).isRequired,
  environments: PropTypes.arrayOf(PropTypes.object).isRequired,

  // Optional
  activeEnvironment: PropTypes.object,
};

export default Wrapper;
