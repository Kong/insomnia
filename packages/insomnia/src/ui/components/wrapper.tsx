import { autoBindMethodsForReact } from 'class-autobind-decorator';
import * as importers from 'insomnia-importers';
import React, { Fragment, lazy, PureComponent, Suspense } from 'react';
import { connect, useSelector } from 'react-redux';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { AnyAction, bindActionCreators, Dispatch } from 'redux';

import type { GlobalActivity } from '../../common/constants';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
  AUTOBIND_CFG,
} from '../../common/constants';
import { importRaw } from '../../common/import';
import { initializeSpectral, isLintError } from '../../common/spectral';
import { update } from '../../models/helpers/request-operations';
import * as models from '../../models/index';
import {
  isRequest,
  Request,
  RequestHeader,
} from '../../models/request';
import { Response } from '../../models/response';
import { GitVCS } from '../../sync/git/git-vcs';
import { VCS } from '../../sync/vcs/vcs';
import { CookieModifyModal } from '../components/modals/cookie-modify-modal';
import { GrpcDispatchModalWrapper } from '../context/grpc';
import { updateRequestMetaByParentId } from '../hooks/create-request';
import { RootState } from '../redux/modules';
import { setActiveActivity } from '../redux/modules/global';
import { selectActiveActivity, selectActiveApiSpec, selectActiveCookieJar, selectActiveEnvironment, selectActiveGitRepository, selectActiveRequest, selectActiveResponse, selectActiveWorkspace, selectActiveWorkspaceMeta, selectSettings } from '../redux/selectors';
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

export type Props = ReturnType<typeof mapStateToProps> & ReturnType<typeof mapDispatchToProps> & {
  handleDuplicateRequest: Function;
  handleSetResponseFilter: Function;
  handleUpdateRequestMimeType: (mimeType: string | null) => Promise<Request | null>;
  headerEditorKey: string;
  vcs: VCS | null;
  gitVCS: GitVCS | null;
};

export type HandleActivityChange = (options: {
  workspaceId?: string;
  nextActivity: GlobalActivity;
}) => Promise<void>;

interface State {
  forceRefreshKey: number;
  activeGitBranch: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class WrapperClass extends PureComponent<Props, State> {
  state: State = {
    forceRefreshKey: Date.now(),
    activeGitBranch: 'no-vcs',
  };

  // Request updaters
  async _handleForceUpdateRequest(r: Request, patch: Partial<Request>) {
    const newRequest = await update(r, patch);
    this._forceRequestPaneRefreshAfterDelay();

    return newRequest;
  }

  _handleForceUpdateRequestHeaders(r: Request, headers: RequestHeader[]) {
    return this._handleForceUpdateRequest(r, { headers });
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
    } catch (error) {
      // Import failed, that's alright
    }

    return null;
  }
  async handleSetActiveResponse(requestId: string, activeResponse: Response | null = null) {
    const { activeEnvironment } = this.props;
    const activeResponseId = activeResponse ? activeResponse._id : null;
    await updateRequestMetaByParentId(requestId, {
      activeResponseId,
    });

    let response: Response | null;
    if (activeResponseId) {
      response = await models.response.getById(activeResponseId);
    } else {
      const environmentId = activeEnvironment ? activeEnvironment._id : null;
      response = await models.response.getLatestForRequest(requestId, environmentId);
    }
    if (!response || !response.requestVersionId) {
      return;
    }
    const request = await models.requestVersion.restore(response.requestVersionId);
    if (!request) {
      return;
    }
    // Refresh app to reflect changes. Using timeout because we need to
    // wait for the request update to propagate.
    setTimeout(() => this._forceRequestPaneRefresh(), 500);
  }
  async _handleWorkspaceActivityChange({ workspaceId, nextActivity }: Parameters<HandleActivityChange>[0]): ReturnType<HandleActivityChange> {
    const { activeActivity, activeApiSpec, handleSetActiveActivity } = this.props;

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
  }

  _handleSetResponseFilter(filter: string) {
    const activeRequest = this.props.activeRequest;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    this.props.handleSetResponseFilter(activeRequestId, filter);
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

  _handleGitBranchChanged(branch: string) {
    this.setState({
      activeGitBranch: branch || 'no-vcs',
    });
  }

  async _handleSetActiveEnvironment(activeEnvironmentId: string | null) {
    if (this.props.activeWorkspaceMeta) {
      await models.workspaceMeta.update(this.props.activeWorkspaceMeta, { activeEnvironmentId });
    }
    // Give it time to update and re-render
    setTimeout(() => {
      this._forceRequestPaneRefresh();
    }, 300);
  }

  render() {
    const {
      activeCookieJar,
      activeEnvironment,
      activeGitRepository,
      activeWorkspace,
      activeApiSpec,
      handleUpdateRequestMimeType,
      gitVCS,
      vcs,
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
                />
                <CookieModifyModal ref={registerModal} />
              </> : null}

              <NunjucksModal
                uniqueKey={`key::${this.state.forceRefreshKey}`}
                ref={registerModal}
                workspace={activeWorkspace}
              />

              {activeApiSpec ? <WorkspaceSettingsModal
                ref={registerModal}
                workspace={activeWorkspace}
                apiSpec={activeApiSpec}
              /> : null}
            </> : null}

            <GenerateCodeModal
              ref={registerModal}
              environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
            />

            <SettingsModal ref={instance => registerModal(instance, 'SettingsModal')} />
            <ResponseDebugModal ref={registerModal} />

            <RequestSwitcherModal
              ref={registerModal}
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
                    handleGitBranchChanged={this._handleGitBranchChanged}
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
              handleSetActiveEnvironment={this._handleSetActiveEnvironment}
              activeEnvironmentId={activeEnvironment ? activeEnvironment._id : null}
            />

            <AddKeyCombinationModal ref={registerModal} />
            <ExportRequestsModal ref={registerModal} />

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
                <WrapperHome
                  vcs={vcs}
                />
              </Suspense>
            }
          />
          <Route
            path={ACTIVITY_UNIT_TEST}
            element={
              <Suspense fallback={<div />}>
                <WrapperUnitTest
                  gitSyncDropdown={gitSyncDropdown}
                  handleActivityChange={this._handleWorkspaceActivityChange}
                />
              </Suspense>
            }
          />
          <Route
            path={ACTIVITY_SPEC}
            element={
              <Suspense fallback={<div />}>
                <WrapperDesign
                  gitSyncDropdown={gitSyncDropdown}
                  handleActivityChange={this._handleWorkspaceActivityChange}
                />
              </Suspense>
            }
          />
          <Route
            path={ACTIVITY_DEBUG}
            element={
              <Suspense fallback={<div />}>
                <WrapperDebug
                  forceRefreshKey={this.state.forceRefreshKey}
                  gitSyncDropdown={gitSyncDropdown}
                  handleActivityChange={this._handleWorkspaceActivityChange}
                  handleSetActiveEnvironment={this._handleSetActiveEnvironment}
                  handleForceUpdateRequest={this._handleForceUpdateRequest}
                  handleForceUpdateRequestHeaders={this._handleForceUpdateRequestHeaders}
                  handleImport={this._handleImport}
                  handleSetResponseFilter={this._handleSetResponseFilter}
                  handleUpdateRequestMimeType={handleUpdateRequestMimeType}
                  handleSetActiveResponse={this.handleSetActiveResponse}
                />
              </Suspense>
            }
          />
        </Routes>
        <ActivityRouter />
      </Fragment>
    );
  }
}
const mapStateToProps = (state: RootState) => ({
  activeActivity: selectActiveActivity(state),
  activeRequest: selectActiveRequest(state),
  activeCookieJar: selectActiveCookieJar(state),
  activeEnvironment: selectActiveEnvironment(state),
  activeGitRepository: selectActiveGitRepository(state),
  activeWorkspace: selectActiveWorkspace(state),
  activeWorkspaceMeta: selectActiveWorkspaceMeta(state),
  activeApiSpec: selectActiveApiSpec(state),
  activeResponse: selectActiveResponse(state),
  settings: selectSettings(state),
});
const mapDispatchToProps = (dispatch: Dispatch<AnyAction>) => {
  const bound = bindActionCreators({ setActiveActivity }, dispatch);
  return {
    handleSetActiveActivity: bound.setActiveActivity,
  };
};

export const Wrapper = connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(WrapperClass);
