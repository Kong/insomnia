import React, {PropTypes} from 'react';
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


const Wrapper = props => {
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
    handleSetResponsePreviewMode,
    handleSetResponseFilter,
    handleSendRequestWithEnvironment,
    handleCreateRequest,
    handleCreateRequestGroup,
    handleImportFileToWorkspace,
    handleExportFile,
    handleSetActiveRequest,
    handleSetSidebarFilter,
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
  } = props;

  const realSidebarWidth = sidebarHidden ? 0 : sidebarWidth;
  const gridTemplateColumns = `${realSidebarWidth}rem 0 ${paneWidth}fr 0 ${1 - paneWidth}fr`;
  const handleImportFile = handleImportFileToWorkspace.bind(null, activeWorkspace._id);
  const handleExportWorkspaceToFile = handleExportFile.bind(null, activeWorkspace._id);
  const activeRequestId = activeRequest ? activeRequest._id : 'n/a';

  return (
    <div id="wrapper"
         className={classnames('wrapper', {'wrapper--vertical': settings.forceVerticalLayout})}
         style={{gridTemplateColumns: gridTemplateColumns}}>
      <Sidebar
        ref={handleSetSidebarRef}
        showEnvironmentsModal={() => showModal(WorkspaceEnvironmentsEditModal, activeWorkspace)}
        showCookiesModal={() => showModal(CookiesModal, activeWorkspace)}
        handleActivateRequest={r => handleSetActiveRequest(activeWorkspace._id, r._id)}
        handleChangeFilter={filter => handleSetSidebarFilter(activeWorkspace._id, filter)}
        handleImportFile={handleImportFile}
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
        <div onMouseDown={e => e.preventDefault() || handleStartDragSidebar()}
             onDoubleClick={handleResetDragSidebar}
        />
      </div>

      <RequestPane
        key={(activeRequest ? activeRequest._id : 'n/a') + forceRefreshCounter}
        ref={handleSetRequestPaneRef}
        handleImportFile={handleImportFile}
        request={activeRequest}
        showPasswords={settings.showPasswords}
        useBulkHeaderEditor={settings.useBulkHeaderEditor}
        editorFontSize={settings.editorFontSize}
        editorLineWrapping={settings.editorLineWrapping}
        environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
        handleCreateRequest={handleCreateRequest.bind(null, activeRequest ? activeRequest.parentId : activeWorkspace._id)}
        updateRequestBody={body => models.request.update(activeRequest, {body})}
        updateRequestUrl={url => handleUpdateRequestUrl(activeRequest, url)}
        updateRequestMethod={method => models.request.update(activeRequest, {method})}
        updateRequestParameters={parameters => models.request.update(activeRequest, {parameters})}
        updateRequestAuthentication={authentication => models.request.update(activeRequest, {authentication})}
        updateRequestHeaders={headers => models.request.update(activeRequest, {headers})}
        updateRequestContentType={contentType => models.request.updateContentType(activeRequest, contentType)}
        updateSettingsShowPasswords={showPasswords => models.settings.update(settings, {showPasswords})}
        updateSettingsUseBulkHeaderEditor={useBulkHeaderEditor => models.settings.update(settings, {useBulkHeaderEditor})}
        handleSend={handleSendRequestWithEnvironment.bind(
          null,
          activeRequest ? activeRequest._id : 'n/a',
          activeEnvironment ? activeEnvironment._id : 'n/a'
        )}
      />

      <div className="drag drag--pane">
        <div onMouseDown={handleStartDragPane}
             onDoubleClick={handleResetDragPane}></div>
      </div>

      <ResponsePane
        ref={handleSetResponsePaneRef}
        request={activeRequest}
        editorFontSize={settings.editorFontSize}
        editorLineWrapping={settings.editorLineWrapping}
        previewMode={responsePreviewMode}
        filter={responseFilter}
        loadStartTime={loadStartTime}
        showCookiesModal={() => showModal(CookiesModal, activeWorkspace)}
        handleSetPreviewMode={handleSetResponsePreviewMode.bind(null, activeRequestId)}
        handleSetFilter={handleSetResponseFilter.bind(null, activeRequestId)}
      />

      <PromptModal ref={m => registerModal(m)}/>
      <AlertModal ref={m => registerModal(m)}/>
      <ChangelogModal ref={m => registerModal(m)}/>
      <SyncLogsModal ref={m => registerModal(m)}/>
      <LoginModal ref={m => registerModal(m)}/>
      <SignupModal ref={m => registerModal(m)}/>
      <PaymentModal ref={m => registerModal(m)}/>
      <PaymentNotificationModal ref={m => registerModal(m)}/>
      <GenerateCodeModal
        ref={m => registerModal(m)}
        environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
      />
      <SettingsModal
        ref={m => registerModal(m)}
        handleExportWorkspaceToFile={handleExportWorkspaceToFile}
        handleExportAllToFile={handleExportFile}
        handleImportFile={handleImportFile}
        settings={settings}
      />
      <RequestSwitcherModal
        ref={m => registerModal(m)}
        workspaceId={activeWorkspace._id}
        activeRequestParentId={activeRequest ? activeRequest.parentId : activeWorkspace._id}
        activateRequest={r => handleSetActiveRequest(activeWorkspace._id, r._id)}
        handleSetActiveWorkspace={handleSetActiveWorkspace}
      />
      <EnvironmentEditModal
        ref={m => registerModal(m)}
        onChange={rg => models.requestGroup.update(rg)}/>
      <WorkspaceEnvironmentsEditModal
        ref={m => registerModal(m)}
        onChange={w => models.workspace.update(w)}/>
      <CookiesModal ref={m => registerModal(m)}/>
    </div>
  )
};

Wrapper.propTypes = {
  // Helper Functions
  handleSetActiveRequest: PropTypes.func.isRequired,
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
