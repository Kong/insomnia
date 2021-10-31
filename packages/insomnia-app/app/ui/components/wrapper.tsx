import { autoBindMethodsForReact } from 'class-autobind-decorator';
import * as importers from 'insomnia-importers';
import React, { Fragment, PureComponent, Ref } from 'react';

import { trackPageView } from '../../common/analytics';
import type { GlobalActivity } from '../../common/constants';
import {
  ACTIVITY_ANALYTICS,
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_MIGRATION,
  ACTIVITY_ONBOARDING,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
  AUTOBIND_CFG,
  SortOrder,
} from '../../common/constants';
import { database as db } from '../../common/database';
import { importRaw } from '../../common/import';
import { HandleGetRenderContext, HandleRender } from '../../common/render';
import { initializeSpectral, isLintError } from '../../common/spectral';
import type { ApiSpec } from '../../models/api-spec';
import type { Cookie } from '../../models/cookie-jar';
import * as models from '../../models/index';
import {
  isRequest,
  Request,
  RequestAuthentication,
  RequestBody,
  RequestHeader,
  RequestParameter,
} from '../../models/request';
import { RequestGroup } from '../../models/request-group';
import type { Response } from '../../models/response';
import { GitVCS } from '../../sync/git/git-vcs';
import { VCS } from '../../sync/vcs/vcs';
import { CookieModifyModal } from '../components/modals/cookie-modify-modal';
import { AppProps } from '../containers/app';
import { GrpcDispatchModalWrapper } from '../context/grpc';
import { DropdownButton } from './base/dropdown/dropdown-button';
import GitSyncDropdown from './dropdowns/git-sync-dropdown';
import { ErrorBoundary } from './error-boundary';
import { AddKeyCombinationModal } from './modals/add-key-combination-modal';
import { AlertModal } from './modals/alert-modal';
import { AskModal } from './modals/ask-modal';
import { CodePromptModal } from './modals/code-prompt-modal';
import { CookiesModal } from './modals/cookies-modal';
import { EnvironmentEditModal } from './modals/environment-edit-modal';
import { ErrorModal } from './modals/error-modal';
import { ExportRequestsModal } from './modals/export-requests-modal';
import { FilterHelpModal } from './modals/filter-help-modal';
import { GenerateCodeModal } from './modals/generate-code-modal';
import { GenerateConfigModal } from './modals/generate-config-modal';
import { GitBranchesModal } from './modals/git-branches-modal';
import { GitLogModal } from './modals/git-log-modal';
import { GitRepositorySettingsModal } from './modals/git-repository-settings-modal';
import { GitStagingModal } from './modals/git-staging-modal';
import { registerModal, showModal } from './modals/index';
import { LoginModal } from './modals/login-modal';
import { NunjucksModal } from './modals/nunjucks-modal';
import { PaymentNotificationModal } from './modals/payment-notification-modal';
import ProjectSettingsModal from './modals/project-settings-modal';
import { PromptModal } from './modals/prompt-modal';
import ProtoFilesModal from './modals/proto-files-modal';
import { RequestCreateModal } from './modals/request-create-modal';
import { RequestGroupSettingsModal } from './modals/request-group-settings-modal';
import { RequestRenderErrorModal } from './modals/request-render-error-modal';
import { RequestSettingsModal } from './modals/request-settings-modal';
import RequestSwitcherModal from './modals/request-switcher-modal';
import { ResponseDebugModal } from './modals/response-debug-modal';
import { SelectModal } from './modals/select-modal';
import { SettingsModal } from './modals/settings-modal';
import { SyncBranchesModal } from './modals/sync-branches-modal';
import { SyncDeleteModal } from './modals/sync-delete-modal';
import { SyncHistoryModal } from './modals/sync-history-modal';
import { SyncMergeModal } from './modals/sync-merge-modal';
import { SyncStagingModal } from './modals/sync-staging-modal';
import { WorkspaceDuplicateModal } from './modals/workspace-duplicate-modal';
import { WorkspaceEnvironmentsEditModal } from './modals/workspace-environments-edit-modal';
import { WorkspaceSettingsModal } from './modals/workspace-settings-modal';
import { WrapperModal } from './modals/wrapper-modal';
import { WrapperAnalytics } from './wrapper-analytics';
import { WrapperDebug } from './wrapper-debug';
import { WrapperDesign } from './wrapper-design';
import WrapperHome from './wrapper-home';
import { WrapperMigration } from './wrapper-migration';
import WrapperOnboarding from './wrapper-onboarding';
import { WrapperUnitTest } from './wrapper-unit-test';

const spectral = initializeSpectral();

export type WrapperProps = AppProps & {
  handleActivateRequest: (activeRequestId: string) => void;
  handleSetSidebarFilter: (value: string) => Promise<void>;
  handleShowSettingsModal: Function;
  handleSetActiveEnvironment: (environmentId: string | null) => Promise<void>;
  handleCreateRequest: (id: string) => void;
  handleDuplicateRequest: Function;
  handleDuplicateRequestGroup: (requestGroup: RequestGroup) => void;
  handleCreateRequestGroup: (parentId: string) => void;
  handleGenerateCodeForActiveRequest: Function;
  handleGenerateCode: Function;
  handleCopyAsCurl: Function;
  handleCreateRequestForWorkspace: () => void;
  requestPaneRef: Ref<HTMLElement>;
  responsePaneRef: Ref<HTMLElement>;
  handleSetResponsePreviewMode: Function;
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  handleSetResponseFilter: Function;
  handleSetActiveResponse: Function;
  sidebarRef: Ref<HTMLElement>;
  handleSidebarSort: (sortOrder: SortOrder) => void;
  handleStartDragSidebar: React.MouseEventHandler;
  handleResetDragSidebar: React.MouseEventHandler;
  handleStartDragPaneHorizontal: React.MouseEventHandler;
  handleStartDragPaneVertical: React.MouseEventHandler;
  handleResetDragPaneHorizontal: React.MouseEventHandler;
  handleResetDragPaneVertical: React.MouseEventHandler;
  handleSetRequestGroupCollapsed: Function;
  handleSetRequestPinned: Function;
  handleSendRequestWithEnvironment: Function;
  handleSendAndDownloadRequestWithEnvironment: Function;
  handleUpdateRequestMimeType: (mimeType: string) => Promise<Request | null>;
  handleUpdateDownloadPath: Function;

  paneWidth: number;
  paneHeight: number;
  sidebarWidth: number;
  headerEditorKey: string;
  isVariableUncovered: boolean;
  vcs: VCS | null;
  gitVCS: GitVCS | null;
};

interface State {
  forceRefreshKey: number;
  activeGitBranch: string;
}

const requestUpdate = (request: Request, patch: Partial<Request>) => {
  if (!request) {
    throw new Error('Tried to update null request');
  }

  return models.request.update(request, patch);
};

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Wrapper extends PureComponent<WrapperProps, State> {
  state: State = {
    forceRefreshKey: Date.now(),
    activeGitBranch: 'no-vcs',
  };

  // Request updaters
  async _handleForceUpdateRequest(r: Request, patch: Partial<Request>) {
    const newRequest = await requestUpdate(r, patch);
    this._forceRequestPaneRefreshAfterDelay();

    return newRequest;
  }

  _handleForceUpdateRequestHeaders(r: Request, headers: RequestHeader[]) {
    return this._handleForceUpdateRequest(r, { headers });
  }

  async _handleUpdateApiSpec(apiSpec: ApiSpec) {
    await models.apiSpec.update(apiSpec);
  }

  static _handleUpdateRequestBody(request: Request, body: RequestBody) {
    return requestUpdate(request, { body });
  }

  static _handleUpdateRequestParameters(request: Request, parameters: RequestParameter[]) {
    return requestUpdate(request, { parameters });
  }

  static _handleUpdateRequestAuthentication(request: Request, authentication: RequestAuthentication) {
    return requestUpdate(request, { authentication });
  }

  static _handleUpdateRequestHeaders(request: Request, headers: RequestHeader[]) {
    return requestUpdate(request, { headers });
  }

  static _handleUpdateRequestMethod(request: Request, method: string) {
    return requestUpdate(request, { method });
  }

  static _handleUpdateRequestUrl(request: Request, url: string) {
    // Don't update if we don't need to
    if (request.url === url) {
      return Promise.resolve(request);
    }

    return requestUpdate(request, { url });
  }

  async _handleImport(text: string) {
    const { activeRequest } = this.props;

    // Allow user to paste any import file into the url. If it results in
    // only one item, it will overwrite the current request.
    try {
      const { data } = await importers.convert(text);
      const { resources } = data;
      const r = resources[0];

      if (r && r._type === 'request' && activeRequest && isRequest(activeRequest)) {
        // Only pull fields that we want to update
        return this._handleForceUpdateRequest(activeRequest, {
          url: r.url,
          method: r.method,
          headers: r.headers,
          // @ts-expect-error -- TSCONVERSION
          body: r.body,
          authentication: r.authentication,
          // @ts-expect-error -- TSCONVERSION
          parameters: r.parameters,
        });
      }
    } catch (e) {
      // Import failed, that's alright
    }

    return null;
  }

  async _handleWorkspaceActivityChange({ workspaceId, nextActivity }: {workspaceId?: string; nextActivity: GlobalActivity}) {
    const { activity, activeApiSpec, handleSetActiveActivity } = this.props;

    // Remember last activity on workspace for later, but only if it isn't HOME
    if (workspaceId && nextActivity !== ACTIVITY_HOME) {
      await models.workspaceMeta.updateByParentId(workspaceId, {
        activeActivity: nextActivity,
      });
    }

    const editingASpec = activity === ACTIVITY_SPEC;

    if (!editingASpec) {
      handleSetActiveActivity(nextActivity);
      return;
    }

    if (!activeApiSpec || !workspaceId) {
      return;
    }

    const goingToDebugOrTest = nextActivity === ACTIVITY_DEBUG || nextActivity === ACTIVITY_UNIT_TEST;

    // If editing a spec and not going to debug or test, don't regenerate anything
    if (editingASpec && !goingToDebugOrTest) {
      handleSetActiveActivity(nextActivity);
      return;
    }

    // Handle switching away from the spec design activity. For this, we want to generate
    // requests that can be accessed from debug or test.
    // If there are errors in the spec, show the user a warning first
    const results = (await spectral.run(activeApiSpec.contents)).filter(isLintError);
    if (activeApiSpec.contents && results && results.length) {
      showModal(AlertModal, {
        title: 'Error Generating Configuration',
        message:
          'Some requests may not be available due to errors found in the ' +
          'specification. We recommend fixing errors before proceeding. 🤗',
        okLabel: 'Proceed',
        addCancel: true,
        onConfirm: () => {
          handleSetActiveActivity(nextActivity);
        },
      });
      return;
    }

    // Delaying generation so design to debug mode is smooth
    handleSetActiveActivity(nextActivity);
    setTimeout(() => {
      importRaw(activeApiSpec.contents, {
        getWorkspaceId: () => Promise.resolve(workspaceId),
        enableDiffBasedPatching: true,
        enableDiffDeep: true,
        bypassDiffProps: {
          url: true,
        },
      });
    }, 1000);
  }

  // Settings updaters
  _handleUpdateSettingsShowPasswords(showPasswords: boolean) {
    return models.settings.update(this.props.settings, { showPasswords });
  }

  _handleUpdateSettingsUseBulkHeaderEditor(useBulkHeaderEditor: boolean) {
    return models.settings.update(this.props.settings, { useBulkHeaderEditor });
  }

  _handleUpdateSettingsUseBulkParametersEditor(useBulkParametersEditor: boolean) {
    return models.settings.update(this.props.settings, { useBulkParametersEditor });
  }

  _handleSetActiveResponse(responseId: string | null) {
    if (!this.props.activeRequest) {
      console.warn('Tried to set active response when request not active');
      return;
    }

    this.props.handleSetActiveResponse(this.props.activeRequest._id, responseId);
  }

  _handleShowEnvironmentsModal() {
    showModal(WorkspaceEnvironmentsEditModal, this.props.activeWorkspace);
  }

  _handleShowCookiesModal() {
    showModal(CookiesModal, this.props.activeWorkspace);
  }

  static _handleShowModifyCookieModal(cookie: Cookie) {
    showModal(CookieModifyModal, cookie);
  }

  _handleShowRequestSettingsModal() {
    showModal(RequestSettingsModal, { request: this.props.activeRequest });
  }

  async _handleDeleteResponses(requestId: string, environmentId: string | null) {
    const { handleSetActiveResponse, activeRequest } = this.props;
    await models.response.removeForRequest(requestId, environmentId);

    if (activeRequest && activeRequest._id === requestId) {
      await handleSetActiveResponse(requestId, null);
    }
  }

  async _handleDeleteResponse(response: Response) {
    if (response) {
      await models.response.remove(response);
    }

    // Also unset active response it's the one we're deleting
    if (this.props.activeResponse?._id === response._id) {
      this._handleSetActiveResponse(null);
    }
  }

  async _handleRemoveActiveWorkspace() {
    const { workspaces, activeWorkspace, handleSetActiveActivity } = this.props;

    if (!activeWorkspace) {
      return;
    }

    await models.stats.incrementDeletedRequestsForDescendents(activeWorkspace);
    await models.workspace.remove(activeWorkspace);

    if (workspaces.length <= 1) {
      handleSetActiveActivity(ACTIVITY_HOME);
    }
  }

  async _handleActiveWorkspaceClearAllResponses() {
    const { activeWorkspace } = this.props;

    if (!activeWorkspace) {
      return;
    }

    const docs = await db.withDescendants(activeWorkspace, models.request.type);
    const requests = docs.filter(isRequest);

    for (const req of requests) {
      await models.response.removeForRequest(req._id);
    }
  }

  _handleSendRequestWithActiveEnvironment() {
    const { activeRequest, activeEnvironment, handleSendRequestWithEnvironment } = this.props;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    handleSendRequestWithEnvironment(activeRequestId, activeEnvironmentId);
  }

  async _handleSendAndDownloadRequestWithActiveEnvironment(filename?: string) {
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

  _handleSetPreviewMode(previewMode: string) {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponsePreviewMode(activeRequestId, previewMode);
  }

  _handleSetResponseFilter(filter: string) {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponseFilter(activeRequestId, filter);
  }

  _handleCreateRequestInWorkspace() {
    const { activeWorkspace, handleCreateRequest } = this.props;

    if (!activeWorkspace) {
      return;
    }

    handleCreateRequest(activeWorkspace._id);
  }

  _handleCreateRequestGroupInWorkspace() {
    const { activeWorkspace, handleCreateRequestGroup } = this.props;

    if (!activeWorkspace) {
      return;
    }

    handleCreateRequestGroup(activeWorkspace._id);
  }

  _handleChangeEnvironment(id: string | null) {
    const { handleSetActiveEnvironment } = this.props;
    handleSetActiveEnvironment(id);
  }

  _forceRequestPaneRefreshAfterDelay(): void {
    // Give it a second for the app to render first. If we don't wait, it will refresh
    // on the old request and won't catch the newest one.
    // TODO: Move this refresh key into redux store so we don't need timeout
    window.setTimeout(this._forceRequestPaneRefresh, 100);
  }

  _forceRequestPaneRefresh() {
    this.setState({
      forceRefreshKey: Date.now(),
    });
  }

  _handleGitBranchChanged(branch) {
    this.setState({
      activeGitBranch: branch || 'no-vcs',
    });
  }

  componentDidMount() {
    const { activity } = this.props;
    trackPageView(`/${activity || ''}`);
  }

  componentDidUpdate(prevProps: WrapperProps) {
    // We're using activities as page views so here we monitor
    // for a change in activity and send it as a pageview.
    const { activity } = this.props;

    if (prevProps.activity !== activity) {
      trackPageView(`/${activity || ''}`);
    }
  }

  render() {
    const {
      activeCookieJar,
      activeEnvironment,
      activeGitRepository,
      activeWorkspace,
      activeProject,
      activeApiSpec,
      activeWorkspaceClientCertificates,
      activity,
      gitVCS,
      handleActivateRequest,
      handleExportRequestsToFile,
      handleGetRenderContext,
      handleInitializeEntities,
      handleRender,
      handleSidebarSort,
      isVariableUncovered,
      settings,
      sidebarChildren,
      syncItems,
      vcs,
      workspaces,
    } = this.props;

    // Setup git sync dropdown for use in Design/Debug pages
    let gitSyncDropdown: JSX.Element | null = null;

    if (activeWorkspace && gitVCS) {
      gitSyncDropdown = (
        <GitSyncDropdown
          className="margin-left"
          workspace={activeWorkspace}
          gitRepository={activeGitRepository}
          vcs={gitVCS}
          handleInitializeEntities={handleInitializeEntities}
          handleGitBranchChanged={this._handleGitBranchChanged}
          renderDropdownButton={children => (
            <DropdownButton className="btn--clicky-small btn-sync">
              {children}
            </DropdownButton>
          )}
        />
      );
    }

    return (
      <Fragment>
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
            <GenerateConfigModal ref={registerModal} settings={settings} />
            <ProjectSettingsModal ref={registerModal} />
            <WorkspaceDuplicateModal ref={registerModal} vcs={vcs || undefined} />

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

            <RequestGroupSettingsModal
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

            {activeWorkspace ? <>
              {/* TODO: Figure out why cookieJar is sometimes null */}
              {activeCookieJar ? <>
                <CookiesModal
                  handleShowModifyCookieModal={Wrapper._handleShowModifyCookieModal}
                  handleRender={handleRender}
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
                  isVariableUncovered={isVariableUncovered}
                />
              </> : null}

              <NunjucksModal
                uniqueKey={`key::${this.state.forceRefreshKey}`}
                ref={registerModal}
                handleRender={handleRender}
                handleGetRenderContext={handleGetRenderContext}
                workspace={activeWorkspace}
              />

              {activeApiSpec ? <WorkspaceSettingsModal
                ref={registerModal}
                clientCertificates={activeWorkspaceClientCertificates}
                workspace={activeWorkspace}
                apiSpec={activeApiSpec}
                editorFontSize={settings.editorFontSize}
                editorIndentSize={settings.editorIndentSize}
                editorKeyMap={settings.editorKeyMap}
                editorLineWrapping={settings.editorLineWrapping}
                handleRender={handleRender}
                handleGetRenderContext={handleGetRenderContext}
                nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
                handleRemoveWorkspace={this._handleRemoveActiveWorkspace}
                handleClearAllResponses={this._handleActiveWorkspaceClearAllResponses}
                isVariableUncovered={isVariableUncovered}
              /> : null}
            </> : null}

            <GenerateCodeModal
              ref={registerModal}
              environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
              editorFontSize={settings.editorFontSize}
              editorIndentSize={settings.editorIndentSize}
              editorKeyMap={settings.editorKeyMap}
            />

            <SettingsModal
              ref={registerModal}
              settings={settings}
            />

            <ResponseDebugModal ref={registerModal} settings={settings} />

            <RequestSwitcherModal
              ref={registerModal}
              activateRequest={handleActivateRequest}
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

            <GitRepositorySettingsModal ref={registerModal} />

            {activeWorkspace && gitVCS ? (
              <Fragment>
                <GitStagingModal ref={registerModal} workspace={activeWorkspace} vcs={gitVCS} />
                <GitLogModal ref={registerModal} vcs={gitVCS} />
                {activeGitRepository !== null && (
                  <GitBranchesModal
                    ref={registerModal}
                    vcs={gitVCS}
                    gitRepository={activeGitRepository}
                    handleInitializeEntities={handleInitializeEntities}
                    handleGitBranchChanged={this._handleGitBranchChanged}
                  />
                )}
              </Fragment>
            ) : null}

            {activeWorkspace && vcs ? (
              <Fragment>
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
                  project={activeProject}
                  syncItems={syncItems}
                />
                <SyncDeleteModal ref={registerModal} workspace={activeWorkspace} vcs={vcs} />
                <SyncHistoryModal ref={registerModal} workspace={activeWorkspace} vcs={vcs} />
              </Fragment>
            ) : null}

            <WorkspaceEnvironmentsEditModal
              ref={registerModal}
              handleChangeEnvironment={this._handleChangeEnvironment}
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
              childObjects={sidebarChildren.all}
              handleExportRequestsToFile={handleExportRequestsToFile}
            />

            <GrpcDispatchModalWrapper>
              {dispatch => (
                <ProtoFilesModal
                  ref={registerModal}
                  grpcDispatch={dispatch}
                />
              )}
            </GrpcDispatchModalWrapper>
          </ErrorBoundary>
        </div>
        <Fragment key={`views::${this.state.activeGitBranch}`}>
          {(activity === ACTIVITY_HOME || !activeWorkspace) && (
            <WrapperHome
              wrapperProps={this.props}
            />
          )}

          {activity === ACTIVITY_SPEC && (
            <WrapperDesign
              gitSyncDropdown={gitSyncDropdown}
              handleActivityChange={this._handleWorkspaceActivityChange}
              handleUpdateApiSpec={this._handleUpdateApiSpec}
              wrapperProps={this.props}
            />
          )}

          {activity === ACTIVITY_UNIT_TEST && (
            <WrapperUnitTest
              gitSyncDropdown={gitSyncDropdown}
              wrapperProps={this.props}
              handleActivityChange={this._handleWorkspaceActivityChange}
            >
              {sidebarChildren}
            </WrapperUnitTest>
          )}

          {activity === ACTIVITY_DEBUG && (
            <WrapperDebug
              forceRefreshKey={this.state.forceRefreshKey}
              gitSyncDropdown={gitSyncDropdown}
              handleActivityChange={this._handleWorkspaceActivityChange}
              handleChangeEnvironment={this._handleChangeEnvironment}
              handleDeleteResponse={this._handleDeleteResponse}
              handleDeleteResponses={this._handleDeleteResponses}
              handleForceUpdateRequest={this._handleForceUpdateRequest}
              handleForceUpdateRequestHeaders={this._handleForceUpdateRequestHeaders}
              handleImport={this._handleImport}
              handleRequestCreate={this._handleCreateRequestInWorkspace}
              handleRequestGroupCreate={this._handleCreateRequestGroupInWorkspace}
              handleSendAndDownloadRequestWithActiveEnvironment={
                this._handleSendAndDownloadRequestWithActiveEnvironment
              }
              handleSendRequestWithActiveEnvironment={this._handleSendRequestWithActiveEnvironment}
              handleSetActiveResponse={this._handleSetActiveResponse}
              handleSetPreviewMode={this._handleSetPreviewMode}
              handleSetResponseFilter={this._handleSetResponseFilter}
              handleShowCookiesModal={this._handleShowCookiesModal}
              handleShowRequestSettingsModal={this._handleShowRequestSettingsModal}
              handleSidebarSort={handleSidebarSort}
              handleUpdateRequestAuthentication={Wrapper._handleUpdateRequestAuthentication}
              handleUpdateRequestBody={Wrapper._handleUpdateRequestBody}
              handleUpdateRequestHeaders={Wrapper._handleUpdateRequestHeaders}
              handleUpdateRequestMethod={Wrapper._handleUpdateRequestMethod}
              handleUpdateRequestParameters={Wrapper._handleUpdateRequestParameters}
              handleUpdateRequestUrl={Wrapper._handleUpdateRequestUrl}
              handleUpdateSettingsShowPasswords={this._handleUpdateSettingsShowPasswords}
              handleUpdateSettingsUseBulkHeaderEditor={
                this._handleUpdateSettingsUseBulkHeaderEditor
              }
              handleUpdateSettingsUseBulkParametersEditor={
                this._handleUpdateSettingsUseBulkParametersEditor
              }
              wrapperProps={this.props}
            />
          )}

          {activity === ACTIVITY_MIGRATION && <WrapperMigration wrapperProps={this.props} />}

          {activity === ACTIVITY_ANALYTICS && <WrapperAnalytics wrapperProps={this.props} />}

          {(activity === ACTIVITY_ONBOARDING || activity === null) && (
            <WrapperOnboarding wrapperProps={this.props} />
          )}
        </Fragment>
      </Fragment>
    );
  }
}
