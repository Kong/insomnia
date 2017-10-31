// @flow
import type {Settings} from '../../models/settings';
import type {Response} from '../../models/response';
import type {OAuth2Token} from '../../models/o-auth-2-token';
import type {Workspace} from '../../models/workspace';
import type {Request, RequestAuthentication, RequestBody, RequestHeader, RequestParameter} from '../../models/request';
import {updateMimeType} from '../../models/request';

import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import {registerModal, showModal} from './modals/index';
import AlertModal from './modals/alert-modal';
import ErrorModal from './modals/error-modal';
import ChangelogModal from './modals/changelog-modal';
import CookiesModal from './modals/cookies-modal';
import CookieModifyModal from '../components/modals/cookie-modify-modal';
import EnvironmentEditModal from './modals/environment-edit-modal';
import GenerateCodeModal from './modals/generate-code-modal';
import LoginModal from './modals/login-modal';
import PaymentNotificationModal from './modals/payment-notification-modal';
import NunjucksModal from './modals/nunjucks-modal';
import PromptModal from './modals/prompt-modal';
import AskModal from './modals/ask-modal';
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
import CodePromptModal from './modals/code-prompt-modal';
import * as models from '../../models/index';
import {trackEvent} from '../../analytics/index';
import * as importers from 'insomnia-importers';
import type {CookieJar} from '../../models/cookie-jar';
import type {Environment} from '../../models/environment';
import ErrorBoundary from './error-boundary';
import type {ClientCertificate} from '../../models/client-certificate';

type Props = {
  // Helper Functions
  handleActivateRequest: Function,
  handleSetSidebarFilter: Function,
  handleToggleMenuBar: Function,
  handleImportFileToWorkspace: Function,
  handleImportUriToWorkspace: Function,
  handleExportFile: Function,
  handleSetActiveWorkspace: Function,
  handleSetActiveEnvironment: Function,
  handleMoveDoc: Function,
  handleCreateRequest: Function,
  handleDuplicateRequest: Function,
  handleDuplicateRequestGroup: Function,
  handleDuplicateWorkspace: Function,
  handleCreateRequestGroup: Function,
  handleGenerateCodeForActiveRequest: Function,
  handleGenerateCode: Function,
  handleCopyAsCurl: Function,
  handleCreateRequestForWorkspace: Function,
  handleSetRequestPaneRef: Function,
  handleSetResponsePaneRef: Function,
  handleSetResponsePreviewMode: Function,
  handleRender: Function,
  handleGetRenderContext: Function,
  handleSetResponseFilter: Function,
  handleSetActiveResponse: Function,
  handleSetSidebarRef: Function,
  handleStartDragSidebar: Function,
  handleResetDragSidebar: Function,
  handleStartDragPaneHorizontal: Function,
  handleStartDragPaneVertical: Function,
  handleResetDragPaneHorizontal: Function,
  handleResetDragPaneVertical: Function,
  handleSetRequestGroupCollapsed: Function,
  handleSendRequestWithEnvironment: Function,
  handleSendAndDownloadRequestWithEnvironment: Function,

  // Properties
  loadStartTime: number,
  isLoading: boolean,
  paneWidth: number,
  paneHeight: number,
  responsePreviewMode: string,
  responseFilter: string,
  responseFilterHistory: Array<string>,
  sidebarWidth: number,
  sidebarHidden: boolean,
  sidebarFilter: string,
  sidebarChildren: Array<Object>,
  settings: Settings,
  workspaces: Array<Workspace>,
  unseenWorkspaces: Array<Workspace>,
  workspaceChildren: Array<Object>,
  environments: Array<Object>,
  activeRequestResponses: Array<Response>,
  activeWorkspace: Workspace,
  activeCookieJar: CookieJar,
  activeEnvironment: Environment | null,
  activeWorkspaceClientCertificates: Array<ClientCertificate>,

  // Optional
  oAuth2Token: ?OAuth2Token,
  activeRequest: ?Request,
  activeResponse: ?Response,
};

type State = {
  forceRefreshKey: number
};

const rUpdate = (request, ...args) => {
  if (!request) {
    throw new Error('Tried to update null request');
  }

  return models.request.update(request, ...args);
};

const sUpdate = models.settings.update;

@autobind
class Wrapper extends React.PureComponent<Props, State> {
  constructor (props: any) {
    super(props);
    this.state = {
      forceRefreshKey: Date.now()
    };
  }

  // Request updaters
  async _handleForceUpdateRequest (patch: Object): Promise<Request> {
    const newRequest = await rUpdate(this.props.activeRequest, patch);

    // Give it a second for the app to render first. If we don't wait, it will refresh
    // on the old request and won't catch the newest one.
    window.setTimeout(this._forceRequestPaneRefresh, 100);

    return newRequest;
  }

  _handleUpdateRequestBody (body: RequestBody): Promise<Request> {
    return rUpdate(this.props.activeRequest, {body});
  }

  _handleUpdateRequestMethod (method: string): Promise<Request> {
    return rUpdate(this.props.activeRequest, {method});
  }

  _handleUpdateRequestParameters (parameters: Array<RequestParameter>): Promise<Request> {
    return rUpdate(this.props.activeRequest, {parameters});
  }

  _handleUpdateRequestAuthentication (authentication: RequestAuthentication): Promise<Request> {
    return rUpdate(this.props.activeRequest, {authentication});
  }

  _handleUpdateRequestHeaders (headers: Array<RequestHeader>): Promise<Request> {
    return rUpdate(this.props.activeRequest, {headers});
  }

  _handleUpdateRequestUrl (url: string): Promise<Request> {
    return rUpdate(this.props.activeRequest, {url});
  }

  // Special request updaters
  async _handleUpdateRequestMimeType (mimeType: string): Promise<Request | null> {
    if (!this.props.activeRequest) {
      console.warn('Tried to update request mime-type when no active request');
      return null;
    }

    const newRequest = await updateMimeType(this.props.activeRequest, mimeType);

    // Force it to update, because other editor components (header editor)
    // needs to change. Need to wait a delay so the next render can finish
    setTimeout(this._forceRequestPaneRefresh, 300);

    return newRequest;
  }

  _handleStartDragSidebar (e: Event): void {
    e.preventDefault();
    this.props.handleStartDragSidebar();
  }

  async _handleImport (text: string): Promise<Request | null> {
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
  _handleUpdateSettingsShowPasswords (showPasswords: boolean): Promise<Request> {
    return sUpdate(this.props.settings, {showPasswords});
  }

  _handleUpdateSettingsUseBulkHeaderEditor (useBulkHeaderEditor: boolean): Promise<Request> {
    return sUpdate(this.props.settings, {useBulkHeaderEditor});
  }

  // Other Helpers
  _handleImportFile (): void {
    this.props.handleImportFileToWorkspace(this.props.activeWorkspace._id);
  }

  _handleImportUri (uri: string): void {
    this.props.handleImportUriToWorkspace(this.props.activeWorkspace._id, uri);
  }

  _handleExportWorkspaceToFile (): void {
    this.props.handleExportFile(this.props.activeWorkspace._id);
  }

  _handleSetActiveResponse (responseId: string | null): void {
    if (!this.props.activeRequest) {
      console.warn('Tried to set active response when request not active');
      return;
    }

    this.props.handleSetActiveResponse(this.props.activeRequest._id, responseId);
  }

  _handleShowEnvironmentsModal (): void {
    showModal(WorkspaceEnvironmentsEditModal, this.props.activeWorkspace);
  }

  _handleShowCookiesModal (): void {
    showModal(CookiesModal, this.props.activeWorkspace);
  }

  _handleShowModifyCookieModal (cookie: Object): void {
    showModal(CookieModifyModal, cookie);
  }

  _handleShowRequestSettingsModal (): void {
    showModal(RequestSettingsModal, {request: this.props.activeRequest});
  }

  _handleDeleteResponses (): void {
    if (!this.props.activeRequest) {
      console.warn('Tried to delete responses when request not active');
      return;
    }

    models.response.removeForRequest(this.props.activeRequest._id);
    this._handleSetActiveResponse(null);
  }

  async _handleDeleteResponse (response: Response): Promise<void> {
    if (response) {
      await models.response.remove(response);
    }

    // Also unset active response it's the one we're deleting
    if (this.props.activeResponse && this.props.activeResponse._id === response._id) {
      this._handleSetActiveResponse(null);
    }
  }

  async _handleRemoveActiveWorkspace (): Promise<void> {
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

    await models.workspace.remove(activeWorkspace);
  }

  _handleSendRequestWithActiveEnvironment (): void {
    const {activeRequest, activeEnvironment, handleSendRequestWithEnvironment} = this.props;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    handleSendRequestWithEnvironment(activeRequestId, activeEnvironmentId);
  }

  _handleSendAndDownloadRequestWithActiveEnvironment (filename: string): void {
    const {activeRequest, activeEnvironment, handleSendAndDownloadRequestWithEnvironment} = this.props;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    handleSendAndDownloadRequestWithEnvironment(activeRequestId, activeEnvironmentId, filename);
  }

  _handleSetPreviewMode (previewMode: string): void {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponsePreviewMode(activeRequestId, previewMode);
  }

  _handleSetResponseFilter (filter: string): void {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponseFilter(activeRequestId, filter);
  }

  _forceRequestPaneRefresh (): void {
    this.setState({forceRefreshKey: Date.now()});
  }

  render () {
    const {
      activeEnvironment,
      activeRequest,
      activeWorkspace,
      activeCookieJar,
      activeRequestResponses,
      activeResponse,
      activeWorkspaceClientCertificates,
      environments,
      handleActivateRequest,
      handleCreateRequest,
      handleCreateRequestForWorkspace,
      handleCreateRequestGroup,
      handleDuplicateRequest,
      handleDuplicateRequestGroup,
      handleExportFile,
      handleMoveDoc,
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
      handleCopyAsCurl,
      isLoading,
      loadStartTime,
      paneWidth,
      paneHeight,
      responseFilter,
      responseFilterHistory,
      responsePreviewMode,
      oAuth2Token,
      settings,
      sidebarChildren,
      sidebarFilter,
      sidebarHidden,
      sidebarWidth,
      workspaceChildren,
      workspaces,
      unseenWorkspaces
    } = this.props;

    const realSidebarWidth = sidebarHidden ? 0 : sidebarWidth;

    const columns = `${realSidebarWidth}rem 0 minmax(0, ${paneWidth}fr) 0 minmax(0, ${1 - paneWidth}fr)`;
    const rows = `minmax(0, ${paneHeight}fr) 0 minmax(0, ${1 - paneHeight}fr)`;

    return [
      <div key="modals" className="modals">
        <ErrorBoundary showAlert>
          <AlertModal ref={registerModal}/>
          <ErrorModal ref={registerModal}/>
          <PromptModal ref={registerModal}/>

          <ChangelogModal ref={registerModal}/>
          <LoginModal ref={registerModal}/>
          <AskModal ref={registerModal}/>
          <RequestCreateModal ref={registerModal}/>
          <PaymentNotificationModal ref={registerModal}/>
          <FilterHelpModal ref={registerModal}/>
          <RequestRenderErrorModal ref={registerModal}/>

          <CodePromptModal
            ref={registerModal}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
            editorLineWrapping={settings.editorLineWrapping}
          />

          <RequestSettingsModal
            ref={registerModal}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
            editorLineWrapping={settings.editorLineWrapping}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
          />

          <CookiesModal
            handleShowModifyCookieModal={this._handleShowModifyCookieModal}
            handleRender={handleRender}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            ref={registerModal}
            workspace={activeWorkspace}
            cookieJar={activeCookieJar}
          />

          <CookieModifyModal
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            ref={registerModal}
            cookieJar={activeCookieJar}
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
            clientCertificates={activeWorkspaceClientCertificates}
            workspace={activeWorkspace}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
            editorLineWrapping={settings.editorLineWrapping}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
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
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
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
            activeEnvironment={activeEnvironment}
            render={handleRender}
            getRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
          />
        </ErrorBoundary>
      </div>,
      <div key="wrapper"
           id="wrapper"
           className={classnames('wrapper', {'wrapper--vertical': settings.forceVerticalLayout})}
           style={{gridTemplateColumns: columns, gridTemplateRows: rows}}>

        <ErrorBoundary showAlert>
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
            handleCopyAsCurl={handleCopyAsCurl}
            handleDuplicateRequestGroup={handleDuplicateRequestGroup}
            handleSetActiveEnvironment={handleSetActiveEnvironment}
            moveDoc={handleMoveDoc}
            handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
            activeRequest={activeRequest}
            activeEnvironment={activeEnvironment}
            handleCreateRequest={handleCreateRequest}
            handleCreateRequestGroup={handleCreateRequestGroup}
            filter={sidebarFilter || ''}
            hidden={sidebarHidden || false}
            workspace={activeWorkspace}
            unseenWorkspaces={unseenWorkspaces}
            childObjects={sidebarChildren}
            width={sidebarWidth}
            isLoading={isLoading}
            workspaces={workspaces}
            environments={environments}
          />
        </ErrorBoundary>

        <div className="drag drag--sidebar">
          <div onDoubleClick={handleResetDragSidebar} onMouseDown={this._handleStartDragSidebar}>
          </div>
        </div>

        <ErrorBoundary showAlert>
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
            settings={settings}
            environmentId={activeEnvironment ? activeEnvironment._id : ''}
            oAuth2Token={oAuth2Token}
            forceUpdateRequest={this._handleForceUpdateRequest}
            handleCreateRequest={handleCreateRequestForWorkspace}
            handleGenerateCode={handleGenerateCodeForActiveRequest}
            handleImport={this._handleImport}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
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
        </ErrorBoundary>

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

        <ErrorBoundary showAlert>
          <ResponsePane
            ref={handleSetResponsePaneRef}
            request={activeRequest}
            responses={activeRequestResponses}
            response={activeResponse}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
            editorLineWrapping={settings.editorLineWrapping}
            previewMode={responsePreviewMode}
            filter={responseFilter}
            filterHistory={responseFilterHistory}
            loadStartTime={loadStartTime}
            showCookiesModal={this._handleShowCookiesModal}
            handleShowRequestSettings={this._handleShowRequestSettingsModal}
            handleSetActiveResponse={this._handleSetActiveResponse}
            handleSetPreviewMode={this._handleSetPreviewMode}
            handleDeleteResponses={this._handleDeleteResponses}
            handleDeleteResponse={this._handleDeleteResponse}
            handleSetFilter={this._handleSetResponseFilter}
          />
        </ErrorBoundary>
      </div>
    ];
  }
}

export default Wrapper;
