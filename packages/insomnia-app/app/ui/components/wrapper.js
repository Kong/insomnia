// @flow
import type { Settings } from '../../models/settings';
import type { Response } from '../../models/response';
import type { OAuth2Token } from '../../models/o-auth-2-token';
import type { Workspace } from '../../models/workspace';
import type {
  Request,
  RequestAuthentication,
  RequestBody,
  RequestHeader,
  RequestParameter,
} from '../../models/request';

import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import { registerModal, showModal } from './modals/index';
import AlertModal from './modals/alert-modal';
import WrapperModal from './modals/wrapper-modal';
import ErrorModal from './modals/error-modal';
import CookiesModal from './modals/cookies-modal';
import CookieModifyModal from '../components/modals/cookie-modify-modal';
import EnvironmentEditModal from './modals/environment-edit-modal';
import GenerateCodeModal from './modals/generate-code-modal';
import LoginModal from './modals/login-modal';
import ResponseDebugModal from './modals/response-debug-modal';
import PaymentNotificationModal from './modals/payment-notification-modal';
import NunjucksModal from './modals/nunjucks-modal';
import PromptModal from './modals/prompt-modal';
import AskModal from './modals/ask-modal';
import SelectModal from './modals/select-modal';
import RequestCreateModal from './modals/request-create-modal';
import RequestPane from './request-pane';
import RequestSwitcherModal from './modals/request-switcher-modal';
import SettingsModal from './modals/settings-modal';
import FilterHelpModal from './modals/filter-help-modal';
import ResponsePane from './response-pane';
import RequestSettingsModal from './modals/request-settings-modal';
import SetupSyncModal from './modals/setup-sync-modal';
import SyncStagingModal from './modals/sync-staging-modal';
import SyncMergeModal from './modals/sync-merge-modal';
import SyncHistoryModal from './modals/sync-history-modal';
import SyncShareModal from './modals/sync-share-modal';
import SyncBranchesModal from './modals/sync-branches-modal';
import RequestRenderErrorModal from './modals/request-render-error-modal';
import Sidebar from './sidebar/sidebar';
import WorkspaceEnvironmentsEditModal from './modals/workspace-environments-edit-modal';
import WorkspaceSettingsModal from './modals/workspace-settings-modal';
import WorkspaceShareSettingsModal from './modals/workspace-share-settings-modal';
import CodePromptModal from './modals/code-prompt-modal';
import * as db from '../../common/database';
import * as models from '../../models/index';
import * as importers from 'insomnia-importers';
import type { CookieJar } from '../../models/cookie-jar';
import type { Environment } from '../../models/environment';
import ErrorBoundary from './error-boundary';
import type { ClientCertificate } from '../../models/client-certificate';
import MoveRequestGroupModal from './modals/move-request-group-modal';
import AddKeyCombinationModal from './modals/add-key-combination-modal';
import ExportRequestsModal from './modals/export-requests-modal';
import VCS from '../../sync/vcs';
import type { StatusCandidate } from '../../sync/types';

type Props = {
  // Helper Functions
  handleActivateRequest: Function,
  handleSetSidebarFilter: Function,
  handleToggleMenuBar: Function,
  handleImportFileToWorkspace: Function,
  handleImportUriToWorkspace: Function,
  handleExportFile: Function,
  handleShowExportRequestsModal: Function,
  handleExportRequestsToFile: Function,
  handleSetActiveWorkspace: Function,
  handleSetActiveEnvironment: Function,
  handleMoveDoc: Function,
  handleCreateRequest: Function,
  handleDuplicateRequest: Function,
  handleDuplicateRequestGroup: Function,
  handleMoveRequestGroup: Function,
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
  handleUpdateRequestMimeType: Function,

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
  isVariableUncovered: boolean,
  vcs: VCS | null,
  syncItems: Array<StatusCandidate>,

  // Optional
  oAuth2Token: ?OAuth2Token,
  activeRequest: ?Request,
  activeResponse: ?Response,
};

type State = {
  forceRefreshKey: number,
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
  constructor(props: any) {
    super(props);
    this.state = {
      forceRefreshKey: Date.now(),
    };
  }

  // Request updaters
  async _handleForceUpdateRequest(r: Request, patch: Object): Promise<Request> {
    const newRequest = await rUpdate(r, patch);

    // Give it a second for the app to render first. If we don't wait, it will refresh
    // on the old request and won't catch the newest one.
    // TODO: Move this refresh key into redux store so we don't need timeout
    window.setTimeout(this._forceRequestPaneRefresh, 100);

    return newRequest;
  }

  _handleForceUpdateRequestHeaders(r: Request, headers: Array<RequestHeader>): Promise<Request> {
    return this._handleForceUpdateRequest(r, { headers });
  }

  static _handleUpdateRequestBody(r: Request, body: RequestBody): Promise<Request> {
    return rUpdate(r, { body });
  }

  static _handleUpdateRequestParameters(
    r: Request,
    parameters: Array<RequestParameter>,
  ): Promise<Request> {
    return rUpdate(r, { parameters });
  }

  static _handleUpdateRequestAuthentication(
    r: Request,
    authentication: RequestAuthentication,
  ): Promise<Request> {
    return rUpdate(r, { authentication });
  }

  static _handleUpdateRequestHeaders(r: Request, headers: Array<RequestHeader>): Promise<Request> {
    return rUpdate(r, { headers });
  }

  static _handleUpdateRequestMethod(r: Request, method: string): Promise<Request> {
    return rUpdate(r, { method });
  }

  static _handleUpdateRequestUrl(r: Request, url: string): Promise<Request> {
    // Don't update if we don't need to
    if (r.url === url) {
      return Promise.resolve(r);
    }

    return rUpdate(r, { url });
  }

  // Special request updaters
  _handleStartDragSidebar(e: Event): void {
    e.preventDefault();
    this.props.handleStartDragSidebar();
  }

  async _handleImport(text: string): Promise<Request | null> {
    // Allow user to paste any import file into the url. If it results in
    // only one item, it will overwrite the current request.
    try {
      const { data } = await importers.convert(text);
      const { resources } = data;
      const r = resources[0];

      if (r && r._type === 'request' && this.props.activeRequest) {
        // Only pull fields that we want to update
        return this._handleForceUpdateRequest(this.props.activeRequest, {
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
  }

  // Settings updaters
  _handleUpdateSettingsShowPasswords(showPasswords: boolean): Promise<Settings> {
    return sUpdate(this.props.settings, { showPasswords });
  }

  _handleUpdateSettingsUseBulkHeaderEditor(useBulkHeaderEditor: boolean): Promise<Settings> {
    return sUpdate(this.props.settings, { useBulkHeaderEditor });
  }

  // Other Helpers
  _handleImportFile(): void {
    this.props.handleImportFileToWorkspace(this.props.activeWorkspace._id);
  }

  _handleImportUri(uri: string): void {
    this.props.handleImportUriToWorkspace(this.props.activeWorkspace._id, uri);
  }

  _handleSetActiveResponse(responseId: string | null): void {
    if (!this.props.activeRequest) {
      console.warn('Tried to set active response when request not active');
      return;
    }

    this.props.handleSetActiveResponse(this.props.activeRequest._id, responseId);
  }

  _handleShowEnvironmentsModal(): void {
    showModal(WorkspaceEnvironmentsEditModal, this.props.activeWorkspace);
  }

  _handleShowCookiesModal(): void {
    showModal(CookiesModal, this.props.activeWorkspace);
  }

  static _handleShowModifyCookieModal(cookie: Object): void {
    showModal(CookieModifyModal, cookie);
  }

  _handleShowRequestSettingsModal(): void {
    showModal(RequestSettingsModal, { request: this.props.activeRequest });
  }

  async _handleDeleteResponses(): Promise<void> {
    if (!this.props.activeRequest) {
      console.warn('Tried to delete responses when request not active');
      return;
    }

    await models.response.removeForRequest(this.props.activeRequest._id);
    this._handleSetActiveResponse(null);
  }

  async _handleDeleteResponse(response: Response): Promise<void> {
    if (response) {
      await models.response.remove(response);
    }

    // Also unset active response it's the one we're deleting
    if (this.props.activeResponse && this.props.activeResponse._id === response._id) {
      this._handleSetActiveResponse(null);
    }
  }

  async _handleRemoveActiveWorkspace(): Promise<void> {
    const { workspaces, activeWorkspace } = this.props;
    if (workspaces.length <= 1) {
      showModal(AlertModal, {
        title: 'Deleting Last Workspace',
        message: 'Since you deleted your only workspace, a new one has been created for you.',
      });

      models.workspace.create({ name: 'Insomnia' });
    }

    await models.workspace.remove(activeWorkspace);
  }

  async _handleActiveWorkspaceClearAllResponses(): Promise<void> {
    const docs = await db.withDescendants(this.props.activeWorkspace, models.request.type);
    const requests = docs.filter(doc => doc.type === models.request.type);
    for (const req of requests) {
      await models.response.removeForRequest(req._id);
    }
  }

  _handleSendRequestWithActiveEnvironment(): void {
    const { activeRequest, activeEnvironment, handleSendRequestWithEnvironment } = this.props;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    handleSendRequestWithEnvironment(activeRequestId, activeEnvironmentId);
  }

  async _handleSendAndDownloadRequestWithActiveEnvironment(filename?: string): Promise<void> {
    const {
      activeRequest,
      activeEnvironment,
      handleSendAndDownloadRequestWithEnvironment,
    } = this.props;

    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    await handleSendAndDownloadRequestWithEnvironment(
      activeRequestId,
      activeEnvironmentId,
      filename,
    );
  }

  _handleSetPreviewMode(previewMode: string): void {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponsePreviewMode(activeRequestId, previewMode);
  }

  _handleSetResponseFilter(filter: string): void {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponseFilter(activeRequestId, filter);
  }

  _forceRequestPaneRefresh(): void {
    this.setState({ forceRefreshKey: Date.now() });
  }

  render() {
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
      handleMoveRequestGroup,
      handleExportFile,
      handleShowExportRequestsModal,
      handleExportRequestsToFile,
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
      handleUpdateRequestMimeType,
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
      syncItems,
      workspaceChildren,
      workspaces,
      unseenWorkspaces,
      isVariableUncovered,
      vcs,
    } = this.props;

    const realSidebarWidth = sidebarHidden ? 0 : sidebarWidth;

    const columns = `${realSidebarWidth}rem 0 minmax(0, ${paneWidth}fr) 0 minmax(0, ${1 -
      paneWidth}fr)`;
    const rows = `minmax(0, ${paneHeight}fr) 0 minmax(0, ${1 - paneHeight}fr)`;

    return [
      <div key="modals" className="modals">
        <ErrorBoundary showAlert>
          <AlertModal ref={registerModal} />
          <ErrorModal ref={registerModal} />
          <PromptModal ref={registerModal} />

          <WrapperModal ref={registerModal} />
          <LoginModal ref={registerModal} />
          <AskModal ref={registerModal} />
          <SelectModal ref={registerModal} />
          <RequestCreateModal ref={registerModal} />
          <PaymentNotificationModal ref={registerModal} />
          <FilterHelpModal ref={registerModal} />
          <RequestRenderErrorModal ref={registerModal} />

          <CodePromptModal
            ref={registerModal}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
            editorLineWrapping={settings.editorLineWrapping}
            isVariableUncovered={isVariableUncovered}
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
            workspaces={workspaces}
            isVariableUncovered={isVariableUncovered}
          />

          {/* TODO: Figure out why cookieJar is sometimes null */}
          {activeCookieJar ? (
            <CookiesModal
              handleShowModifyCookieModal={Wrapper._handleShowModifyCookieModal}
              handleRender={handleRender}
              nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
              ref={registerModal}
              workspace={activeWorkspace}
              cookieJar={activeCookieJar}
              isVariableUncovered={isVariableUncovered}
            />
          ) : null}

          <CookieModifyModal
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            ref={registerModal}
            cookieJar={activeCookieJar}
            workspace={activeWorkspace}
            isVariableUncovered={isVariableUncovered}
          />

          <NunjucksModal
            uniqueKey={`key::${this.state.forceRefreshKey}`}
            ref={registerModal}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            workspace={activeWorkspace}
          />

          <MoveRequestGroupModal ref={registerModal} workspaces={workspaces} />

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
            handleClearAllResponses={this._handleActiveWorkspaceClearAllResponses}
            isVariableUncovered={isVariableUncovered}
          />

          <WorkspaceShareSettingsModal ref={registerModal} workspace={activeWorkspace} />

          <GenerateCodeModal
            ref={registerModal}
            environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
          />

          <SettingsModal
            ref={registerModal}
            handleShowExportRequestsModal={handleShowExportRequestsModal}
            handleExportAllToFile={handleExportFile}
            handleImportFile={this._handleImportFile}
            handleImportUri={this._handleImportUri}
            handleToggleMenuBar={handleToggleMenuBar}
            settings={settings}
          />

          <ResponseDebugModal ref={registerModal} settings={settings} />

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
            isVariableUncovered={isVariableUncovered}
          />

          <SetupSyncModal ref={registerModal} workspace={activeWorkspace} />

          {vcs && (
            <React.Fragment>
              <SyncStagingModal
                ref={registerModal}
                workspace={activeWorkspace}
                vcs={vcs}
                syncItems={syncItems}
              />
              <SyncMergeModal
                ref={registerModal}
                workspace={activeWorkspace}
                syncItems={syncItems}
                vcs={vcs}
              />
              <SyncBranchesModal
                ref={registerModal}
                workspace={activeWorkspace}
                vcs={vcs}
                syncItems={syncItems}
              />
              <SyncHistoryModal ref={registerModal} workspace={activeWorkspace} vcs={vcs} />
              <SyncShareModal ref={registerModal} workspace={activeWorkspace} vcs={vcs} />
            </React.Fragment>
          )}

          <WorkspaceEnvironmentsEditModal
            ref={registerModal}
            onChange={models.workspace.update}
            lineWrapping={settings.editorLineWrapping}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
            activeEnvironmentId={activeEnvironment ? activeEnvironment._id : null}
            render={handleRender}
            getRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            isVariableUncovered={isVariableUncovered}
          />

          <AddKeyCombinationModal ref={registerModal} />
          <ExportRequestsModal
            ref={registerModal}
            childObjects={sidebarChildren}
            handleExportRequestsToFile={handleExportRequestsToFile}
          />
        </ErrorBoundary>
      </div>,
      <div
        key="wrapper"
        id="wrapper"
        className={classnames('wrapper', {
          'wrapper--vertical': settings.forceVerticalLayout,
        })}
        style={{
          gridTemplateColumns: columns,
          gridTemplateRows: rows,
          boxSizing: 'border-box',
          borderTop:
            activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-top'
              ? '5px solid ' + activeEnvironment.color
              : null,
          borderBottom:
            activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-bottom'
              ? '5px solid ' + activeEnvironment.color
              : null,
          borderLeft:
            activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-left'
              ? '5px solid ' + activeEnvironment.color
              : null,
          borderRight:
            activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-right'
              ? '5px solid ' + activeEnvironment.color
              : null,
        }}>
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
            handleMoveRequestGroup={handleMoveRequestGroup}
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
            environmentHighlightColorStyle={settings.environmentHighlightColorStyle}
            enableSyncBeta={settings.enableSyncBeta}
            hotKeyRegistry={settings.hotKeyRegistry}
            vcs={vcs}
            syncItems={syncItems}
          />
        </ErrorBoundary>

        <div className="drag drag--sidebar">
          <div onDoubleClick={handleResetDragSidebar} onMouseDown={this._handleStartDragSidebar} />
        </div>

        <ErrorBoundary showAlert>
          <RequestPane
            ref={handleSetRequestPaneRef}
            handleImportFile={this._handleImportFile}
            request={activeRequest}
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
            updateRequestBody={Wrapper._handleUpdateRequestBody}
            forceUpdateRequestHeaders={this._handleForceUpdateRequestHeaders}
            updateRequestUrl={Wrapper._handleUpdateRequestUrl}
            updateRequestMethod={Wrapper._handleUpdateRequestMethod}
            updateRequestParameters={Wrapper._handleUpdateRequestParameters}
            updateRequestAuthentication={Wrapper._handleUpdateRequestAuthentication}
            updateRequestHeaders={Wrapper._handleUpdateRequestHeaders}
            updateRequestMimeType={handleUpdateRequestMimeType}
            updateSettingsShowPasswords={this._handleUpdateSettingsShowPasswords}
            updateSettingsUseBulkHeaderEditor={this._handleUpdateSettingsUseBulkHeaderEditor}
            forceRefreshCounter={this.state.forceRefreshKey}
            handleSend={this._handleSendRequestWithActiveEnvironment}
            handleSendAndDownload={this._handleSendAndDownloadRequestWithActiveEnvironment}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            isVariableUncovered={isVariableUncovered}
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
            request={activeRequest}
            responses={activeRequestResponses}
            response={activeResponse}
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorKeyMap={settings.editorKeyMap}
            editorLineWrapping={settings.editorLineWrapping}
            hotKeyRegistry={settings.hotKeyRegistry}
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
      </div>,
    ];
  }
}

export default Wrapper;
