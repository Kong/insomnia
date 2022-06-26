import * as importers from 'insomnia-importers';
import React, { forwardRef, Fragment, lazy, Ref, Suspense, useImperativeHandle, useState } from 'react';
import { useSelector } from 'react-redux';
import { Route, Routes, useNavigate } from 'react-router-dom';

import type { GlobalActivity } from '../../common/constants';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
  SortOrder,
} from '../../common/constants';
import { database as db } from '../../common/database';
import { importRaw } from '../../common/import';
import { initializeSpectral, isLintError } from '../../common/spectral';
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
import { selectActiveActivity, selectActiveWorkspace } from '../redux/selectors';
import { DropdownButton } from './base/dropdown/dropdown-button';
import GitSyncDropdown from './dropdowns/git-sync-dropdown';
import { ErrorBoundary } from './error-boundary';
import { AddKeyCombinationModal } from './modals/add-key-combination-modal';
import { AlertModal } from './modals/alert-modal';
import { AnalyticsModal } from './modals/analytics-modal';
import { AskModal } from './modals/ask-modal';
import { CodePromptModal } from './modals/code-prompt-modal';
import { CookiesModalFC } from './modals/cookies-modal';
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
import ProjectSettingsModal from './modals/project-settings-modal';
import { PromptModal } from './modals/prompt-modal';
import ProtoFilesModal from './modals/proto-files-modal';
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

const lazyWithPreload = (
  importFn: () => Promise<{ default: React.ComponentType<any> }>
): [
    React.LazyExoticComponent<React.ComponentType<any>>,
    () => Promise<{
      default: React.ComponentType<any>;
    }>
  ] => {
  const LazyComponent = lazy(importFn);
  const preload = () => importFn();

  return [LazyComponent, preload];
};

const [WrapperHome, preloadWrapperHome] = lazyWithPreload(
  () => import('./wrapper-home')
);
const [WrapperDebug, preloadWrapperDebug] = lazyWithPreload(
  () => import('./wrapper-debug')
);
const [WrapperDesign, preloadWrapperDesign] = lazyWithPreload(
  () => import('./wrapper-design')
);
const [WrapperUnitTest, preloadWrapperUnitTest] = lazyWithPreload(
  () => import('./wrapper-unit-test')
);

preloadWrapperHome();
preloadWrapperDebug();
preloadWrapperDesign();
preloadWrapperUnitTest();

const ActivityRouter = () => {
  const selectedActivity = useSelector(selectActiveActivity);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  // If there is no active workspace, we want to navigate to home no matter what the previous activity was
  const activity = activeWorkspace ? selectedActivity : ACTIVITY_HOME;
  const navigate = useNavigate();

  React.useEffect(() => {
    if (activity) {
      navigate(activity);
    }
  }, [activity, navigate]);

  return null;
};

const spectral = initializeSpectral();

export type WrapperProps = AppProps & {
  gitVCS: GitVCS | null;
  handleActivateRequest: (activeRequestId: string) => void;
  handleCopyAsCurl: Function;
  handleCreateRequestGroup: (parentId: string) => void;
  handleDuplicateRequest: Function;
  handleDuplicateRequestGroup: (requestGroup: RequestGroup) => void;
  handleGenerateCode: Function;
  handleGenerateCodeForActiveRequest: Function;
  handleResetDragPaneHorizontal: React.MouseEventHandler;
  handleResetDragPaneVertical: React.MouseEventHandler;
  handleResetDragSidebar: React.MouseEventHandler;
  handleSendAndDownloadRequestWithEnvironment: Function;
  handleSendRequestWithEnvironment: Function;
  handleSetActiveEnvironment: (environmentId: string | null) => Promise<void>;
  handleSetActiveResponse: Function;
  handleSetRequestGroupCollapsed: Function;
  handleSetRequestPinned: Function;
  handleSetResponseFilter: Function;
  handleSetResponsePreviewMode: Function;
  handleSetSidebarFilter: (value: string) => Promise<void>;
  handleShowSettingsModal: Function;
  handleSidebarSort: (sortOrder: SortOrder) => void;
  handleStartDragPaneHorizontal: React.MouseEventHandler;
  handleStartDragPaneVertical: React.MouseEventHandler;
  handleStartDragSidebar: React.MouseEventHandler;
  handleUpdateDownloadPath: Function;
  handleUpdateRequestMimeType: (mimeType: string | null) => Promise<Request | null>;
  headerEditorKey: string;
  paneHeight: number;
  paneWidth: number;
  requestPaneRef: Ref<HTMLElement>;
  responsePaneRef: Ref<HTMLElement>;
  sidebarRef: Ref<HTMLElement>;
  sidebarWidth: number;
  vcs: VCS | null;
};

export type HandleActivityChange = (options: {
  workspaceId?: string;
  nextActivity: GlobalActivity;
}) => Promise<void>;

const requestUpdate = (request: Request, patch: Partial<Request>) => {
  if (!request) {
    throw new Error('Tried to update null request');
  }

  return models.request.update(request, patch);
};

export const Wrapper = forwardRef<{_forceRequestPaneRefresh:()=>void}, WrapperProps>((props, ref) => {
  const {
    activeActivity,
    activeApiSpec,
    activeCookieJar,
    activeEnvironment,
    activeGitRepository,
    activeRequest,
    activeResponse,
    activeWorkspace,
    activeWorkspaceClientCertificates,
    gitVCS,
    handleActivateRequest,
    handleCreateRequestGroup,
    handleExportRequestsToFile,
    handleInitializeEntities,
    handleSendAndDownloadRequestWithEnvironment,
    handleSendRequestWithEnvironment,
    handleSetActiveActivity,
    handleSetActiveEnvironment,
    handleSetActiveResponse,
    handleSetResponseFilter,
    handleSetResponsePreviewMode,
    handleSidebarSort,
    settings,
    sidebarChildren,
    vcs,
  } = props;
  const [forceRefreshKey, setForceRefreshKey] = useState<number>(Date.now());
  const _forceRequestPaneRefresh = () => {
    setForceRefreshKey(Date.now());
  };

  useImperativeHandle(ref, () => ({ _forceRequestPaneRefresh }));
  const _handleForceUpdateRequest = async (r: Request, patch: Partial<Request>) => {
    const newRequest = await requestUpdate(r, patch);
    _forceRequestPaneRefreshAfterDelay();

    return newRequest;
  };

  const _handleForceUpdateRequestHeaders = (r: Request, headers: RequestHeader[]) => {
    return _handleForceUpdateRequest(r, { headers });
  };

  const _handleUpdateRequestBody = (request: Request, body: RequestBody) => {
    return requestUpdate(request, { body });
  };

  const _handleUpdateRequestParameters = (request: Request, parameters: RequestParameter[]) => {
    return requestUpdate(request, { parameters });
  };

  const _handleUpdateRequestAuthentication = (request: Request, authentication: RequestAuthentication) => {
    return requestUpdate(request, { authentication });
  };

  const _handleUpdateRequestHeaders = (request: Request, headers: RequestHeader[]) => {
    return requestUpdate(request, { headers });
  };

  const _handleUpdateRequestMethod = (request: Request, method: string) => {
    return requestUpdate(request, { method });
  };

  const _handleUpdateRequestUrl = (request: Request, url: string) => {
    // Don't update if we don't need to
    if (request.url === url) {
      return Promise.resolve(request);
    }

    return requestUpdate(request, { url });
  };

  const _handleImport = async (text: string) => {
    // Allow user to paste any import file into the url. If it results in
    // only one item, it will overwrite the current request.
    try {
      const { data } = await importers.convert(text);
      const { resources } = data;
      const r = resources[0];

      if (r && r._type === 'request' && activeRequest && isRequest(activeRequest)) {
        // Only pull fields that we want to update
        return _handleForceUpdateRequest(activeRequest, {
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
    } catch (error) {
      // Import failed, that's alright
    }

    return null;
  };

  const _handleWorkspaceActivityChange = async ({ workspaceId, nextActivity }: Parameters<HandleActivityChange>[0]): ReturnType<HandleActivityChange> => {
    // Remember last activity on workspace for later, but only if it isn't HOME
    if (workspaceId && nextActivity !== ACTIVITY_HOME) {
      await models.workspaceMeta.updateByParentId(workspaceId, {
        activeActivity: nextActivity,
      });
    }

    const editingASpec = activeActivity === ACTIVITY_SPEC;

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
        message: 'Some requests may not be available due to errors found in the specification. We recommend fixing errors before proceeding.',
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
  };

  // Settings updaters
  const _handleUpdateSettingsUseBulkHeaderEditor = (useBulkHeaderEditor: boolean) => {
    return models.settings.update(settings, { useBulkHeaderEditor });
  };

  const _handleUpdateSettingsUseBulkParametersEditor = (useBulkParametersEditor: boolean) => {
    return models.settings.update(settings, { useBulkParametersEditor });
  };

  const _handleSetActiveResponse = (responseId: string | null) => {
    if (!activeRequest) {
      console.warn('Tried to set active response when request not active');
      return;
    }

    handleSetActiveResponse(activeRequest._id, responseId);
  };

  const _handleShowModifyCookieModal = (cookie: Cookie) => {
    showModal(CookieModifyModal, cookie);
  };

  const _handleShowRequestSettingsModal = () => {
    showModal(RequestSettingsModal, { request: activeRequest });
  };

  const _handleDeleteResponses = async (requestId: string, environmentId: string | null) => {
    await models.response.removeForRequest(requestId, environmentId);

    if (activeRequest && activeRequest._id === requestId) {
      await handleSetActiveResponse(requestId, null);
    }
  };

  const _handleDeleteResponse = async (response: Response) => {
    if (response) {
      await models.response.remove(response);
    }

    // Also unset active response it's the one we're deleting
    if (activeResponse?._id === response._id) {
      _handleSetActiveResponse(null);
    }
  };

  const _handleRemoveActiveWorkspace = async () => {
    if (!activeWorkspace) {
      return;
    }

    await models.stats.incrementDeletedRequestsForDescendents(activeWorkspace);
    await models.workspace.remove(activeWorkspace);

    handleSetActiveActivity(ACTIVITY_HOME);
  };

  const _handleActiveWorkspaceClearAllResponses = async () => {
    if (!activeWorkspace) {
      return;
    }

    const docs = await db.withDescendants(activeWorkspace, models.request.type);
    const requests = docs.filter(isRequest);

    for (const req of requests) {
      await models.response.removeForRequest(req._id);
    }
  };

  const _handleSendRequestWithActiveEnvironment = () => {
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    handleSendRequestWithEnvironment(activeRequestId, activeEnvironmentId);
  };

  const _handleSendAndDownloadRequestWithActiveEnvironment = async (filename?: string) => {
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    await handleSendAndDownloadRequestWithEnvironment(
      activeRequestId,
      activeEnvironmentId,
      filename,
    );
  };

  const _handleSetPreviewMode = (previewMode: string) => {
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    handleSetResponsePreviewMode(activeRequestId, previewMode);
  };

  const _handleSetResponseFilter = (filter: string) => {
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    handleSetResponseFilter(activeRequestId, filter);
  };

  const _handleCreateRequestGroupInWorkspace = () => {
    if (!activeWorkspace) {
      return;
    }

    handleCreateRequestGroup(activeWorkspace._id);
  };

  const _handleChangeEnvironment = (id: string | null) => {
    handleSetActiveEnvironment(id);
  };

  const _forceRequestPaneRefreshAfterDelay = (): void => {
    // Give it a second for the app to render first. If we don't wait, it will refresh
    // on the old request and won't catch the newest one.
    // TODO: Move this refresh key into redux store so we don't need timeout
    window.setTimeout(_forceRequestPaneRefresh, 100);
  };

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
          <AnalyticsModal />
          <AlertModal ref={registerModal} />
          <ErrorModal ref={registerModal} />
          <PromptModal ref={registerModal} />
          <WrapperModal ref={registerModal} />
          <LoginModal ref={registerModal} />
          <AskModal ref={registerModal} />
          <SelectModal ref={registerModal} />
          <FilterHelpModal ref={registerModal} />
          <RequestRenderErrorModal ref={registerModal} />
          <GenerateConfigModal ref={registerModal} />
          <ProjectSettingsModal ref={registerModal} />
          <WorkspaceDuplicateModal ref={registerModal} vcs={vcs || undefined} />
          <CodePromptModal ref={registerModal} />
          <RequestSettingsModal ref={registerModal} />
          <RequestGroupSettingsModal ref={registerModal} />

          {activeWorkspace ? <>
            {/* TODO: Figure out why cookieJar is sometimes null */}
            {activeCookieJar ? <>
              <CookiesModalFC
                ref={registerModal}
                handleShowModifyCookieModal={_handleShowModifyCookieModal}
              />
              <CookieModifyModal ref={registerModal} />
            </> : null}

            <NunjucksModal
              uniqueKey={`key::${forceRefreshKey}`}
              ref={registerModal}
              workspace={activeWorkspace}
            />

            {activeApiSpec ? <WorkspaceSettingsModal
              ref={registerModal}
              clientCertificates={activeWorkspaceClientCertificates}
              workspace={activeWorkspace}
              apiSpec={activeApiSpec}
              handleRemoveWorkspace={_handleRemoveActiveWorkspace}
              handleClearAllResponses={_handleActiveWorkspaceClearAllResponses}
            /> : null}
          </> : null}

          <GenerateCodeModal
            ref={registerModal}
            environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
          />

          <SettingsModal ref={registerModal} />
          <ResponseDebugModal ref={registerModal} />

          <RequestSwitcherModal
            ref={registerModal}
            activateRequest={handleActivateRequest}
          />

          <EnvironmentEditModal
            ref={registerModal}
            onChange={models.requestGroup.update}
          />

          <GitRepositorySettingsModal ref={registerModal} />

          {activeWorkspace && gitVCS ? (
            <Fragment>
              <GitStagingModal ref={registerModal} workspace={activeWorkspace} vcs={gitVCS} gitRepository={activeGitRepository} />
              <GitLogModal ref={registerModal} vcs={gitVCS} />
              {activeGitRepository !== null && (
                <GitBranchesModal
                  ref={registerModal}
                  vcs={gitVCS}
                  gitRepository={activeGitRepository}
                  handleInitializeEntities={handleInitializeEntities}
                />
              )}
            </Fragment>
          ) : null}

          {activeWorkspace && vcs ? (
            <Fragment>
              <SyncStagingModal ref={registerModal} vcs={vcs} />
              <SyncMergeModal ref={registerModal} vcs={vcs} />
              <SyncBranchesModal ref={registerModal} vcs={vcs} />
              <SyncDeleteModal ref={registerModal} vcs={vcs} />
              <SyncHistoryModal ref={registerModal} vcs={vcs} />
            </Fragment>
          ) : null}

          <WorkspaceEnvironmentsEditModal
            ref={registerModal}
            handleChangeEnvironment={id => handleSetActiveEnvironment(id)}
            activeEnvironmentId={activeEnvironment ? activeEnvironment._id : null}
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

      <Routes>
        <Route
          path="*"
          element={
            <Suspense fallback={<div />}>
              <WrapperHome wrapperProps={props} />
            </Suspense>
          }
        />
        <Route
          path={ACTIVITY_UNIT_TEST}
          element={
            <Suspense fallback={<div />}>
              <WrapperUnitTest
                gitSyncDropdown={gitSyncDropdown}
                wrapperProps={props}
                handleActivityChange={_handleWorkspaceActivityChange}
              >
                {sidebarChildren}
              </WrapperUnitTest>
            </Suspense>
          }
        />
        <Route
          path={ACTIVITY_SPEC}
          element={
            <Suspense fallback={<div />}>
              <WrapperDesign
                gitSyncDropdown={gitSyncDropdown}
                handleActivityChange={_handleWorkspaceActivityChange}
                wrapperProps={props}
              />
            </Suspense>
          }
        />
        <Route
          path={ACTIVITY_DEBUG}
          element={
            <Suspense fallback={<div />}>
              <WrapperDebug
                forceRefreshKey={forceRefreshKey}
                gitSyncDropdown={gitSyncDropdown}
                handleActivityChange={_handleWorkspaceActivityChange}
                handleChangeEnvironment={_handleChangeEnvironment}
                handleDeleteResponse={_handleDeleteResponse}
                handleDeleteResponses={_handleDeleteResponses}
                handleForceUpdateRequest={_handleForceUpdateRequest}
                handleForceUpdateRequestHeaders={_handleForceUpdateRequestHeaders}
                handleImport={_handleImport}
                handleRequestGroupCreate={_handleCreateRequestGroupInWorkspace}
                handleSendAndDownloadRequestWithActiveEnvironment={_handleSendAndDownloadRequestWithActiveEnvironment}
                handleSendRequestWithActiveEnvironment={_handleSendRequestWithActiveEnvironment}
                handleSetActiveResponse={_handleSetActiveResponse}
                handleSetPreviewMode={_handleSetPreviewMode}
                handleSetResponseFilter={_handleSetResponseFilter}
                handleShowRequestSettingsModal={_handleShowRequestSettingsModal}
                handleSidebarSort={handleSidebarSort}
                handleUpdateRequestAuthentication={_handleUpdateRequestAuthentication}
                handleUpdateRequestBody={_handleUpdateRequestBody}
                handleUpdateRequestHeaders={_handleUpdateRequestHeaders}
                handleUpdateRequestMethod={_handleUpdateRequestMethod}
                handleUpdateRequestParameters={_handleUpdateRequestParameters}
                handleUpdateRequestUrl={_handleUpdateRequestUrl}
                handleUpdateSettingsUseBulkHeaderEditor={_handleUpdateSettingsUseBulkHeaderEditor}
                handleUpdateSettingsUseBulkParametersEditor={_handleUpdateSettingsUseBulkParametersEditor}
                wrapperProps={props}
              />
            </Suspense>
          }
        />
      </Routes>
      <ActivityRouter />
    </Fragment>
  );
});
Wrapper.displayName = 'Wrapper';
