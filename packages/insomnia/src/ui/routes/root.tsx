import React, { Fragment, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Outlet, useNavigate } from 'react-router-dom';

import {
  ACTIVITY_HOME,
} from '../../common/constants';
import { database as db } from '../../common/database';
import * as models from '../../models';
import { ErrorBoundary } from '../components/error-boundary';
import { AddKeyCombinationModal } from '../components/modals/add-key-combination-modal';
import { AlertModal } from '../components/modals/alert-modal';
import { AnalyticsModal } from '../components/modals/analytics-modal';
import { AskModal } from '../components/modals/ask-modal';
import { CodePromptModal } from '../components/modals/code-prompt-modal';
import { CookieModifyModal } from '../components/modals/cookie-modify-modal';
import { CookiesModal } from '../components/modals/cookies-modal';
import { EnvironmentEditModal } from '../components/modals/environment-edit-modal';
import { ErrorModal } from '../components/modals/error-modal';
import { ExportRequestsModal } from '../components/modals/export-requests-modal';
import { FilterHelpModal } from '../components/modals/filter-help-modal';
import { GenerateCodeModal } from '../components/modals/generate-code-modal';
import { GenerateConfigModal } from '../components/modals/generate-config-modal';
import { GitBranchesModal } from '../components/modals/git-branches-modal';
import { GitLogModal } from '../components/modals/git-log-modal';
import { GitRepositorySettingsModal } from '../components/modals/git-repository-settings-modal';
import { GitStagingModal } from '../components/modals/git-staging-modal';
import { registerModal } from '../components/modals/index';
import { LoginModal } from '../components/modals/login-modal';
import { NunjucksModal } from '../components/modals/nunjucks-modal';
import ProjectSettingsModal from '../components/modals/project-settings-modal';
import { PromptModal } from '../components/modals/prompt-modal';
import { ProtoFilesModal } from '../components/modals/proto-files-modal';
import { RequestGroupSettingsModal } from '../components/modals/request-group-settings-modal';
import { RequestRenderErrorModal } from '../components/modals/request-render-error-modal';
import { RequestSettingsModal } from '../components/modals/request-settings-modal';
import { RequestSwitcherModal } from '../components/modals/request-switcher-modal';
import { ResponseDebugModal } from '../components/modals/response-debug-modal';
import { SelectModal } from '../components/modals/select-modal';
import { SettingsModal } from '../components/modals/settings-modal';
import { SyncBranchesModal } from '../components/modals/sync-branches-modal';
import { SyncDeleteModal } from '../components/modals/sync-delete-modal';
import { SyncHistoryModal } from '../components/modals/sync-history-modal';
import { SyncMergeModal } from '../components/modals/sync-merge-modal';
import { SyncStagingModal } from '../components/modals/sync-staging-modal';
import { WorkspaceDuplicateModal } from '../components/modals/workspace-duplicate-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { WorkspaceSettingsModal } from '../components/modals/workspace-settings-modal';
import { WrapperModal } from '../components/modals/wrapper-modal';
import { Toast } from '../components/toast';
import { AppHooks } from '../containers/app-hooks';
import withDragDropContext from '../context/app/drag-drop-context';
import { GrpcDispatchModalWrapper, GrpcProvider } from '../context/grpc';
import { NunjucksEnabledProvider } from '../context/nunjucks/nunjucks-enabled-context';
import { useGitVCS } from '../hooks/use-git-vcs';
import { useVCS } from '../hooks/use-vcs';
import {
  selectActiveActivity,
  selectActiveApiSpec,
  selectActiveCookieJar,
  selectActiveEnvironment,
  selectActiveGitRepository,
  selectActiveProject,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectEnvironments,
  selectIsFinishedBooting,
  selectIsLoggedIn,
} from '../redux/selectors';

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

interface State {
  isMigratingChildren: boolean;
}

const App = () => {
  const [state, setState] = useState<State>({
    isMigratingChildren: false,
  });

  const activeCookieJar = useSelector(selectActiveCookieJar);
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const environments = useSelector(selectEnvironments);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const isFinishedBooting = useSelector(selectIsFinishedBooting);
  const activeGitRepository = useSelector(selectActiveGitRepository);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeProject = useSelector(selectActiveProject);

  const vcs = useVCS({
    workspaceId: activeWorkspace?._id,
  });

  const gitVCS = useGitVCS({
    workspaceId: activeWorkspace?._id,
    projectId: activeProject?._id,
    gitRepository: activeGitRepository,
  });

  // Ensure Children: Make sure cookies, env, and meta models are created under this workspace
  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    const baseEnvironments = environments.filter(environment => environment.parentId === activeWorkspace._id);
    const workspaceHasChildren = baseEnvironments.length && activeCookieJar && activeApiSpec && activeWorkspaceMeta;
    if (workspaceHasChildren) {
      return;
    }
    // We already started migrating. Let it finish.
    if (state.isMigratingChildren) {
      return;
    }
    // Prevent rendering of everything until we check the workspace has cookies, env, and meta
    setState(state => ({ ...state, isMigratingChildren: true }));
    async function update() {
      if (activeWorkspace) {
        const flushId = await db.bufferChanges();
        await models.workspace.ensureChildren(activeWorkspace);
        await db.flushChanges(flushId);
        setState(state => ({ ...state, isMigratingChildren: false }));
      }
    }
    update();
  }, [activeApiSpec, activeCookieJar, activeWorkspace, activeWorkspaceMeta, environments, state.isMigratingChildren]);

  if (state.isMigratingChildren) {
    console.log('[app] Waiting for migration to complete');
    return null;
  }

  if (!isFinishedBooting) {
    console.log('[app] Waiting to finish booting');
    return null;
  }

  const uniquenessKey = `${isLoggedIn}::${activeWorkspace?._id || 'n/a'}`;
  return (
    <GrpcProvider>
      <NunjucksEnabledProvider>
        <AppHooks />
        <div className="app" key={uniquenessKey}>
          <ErrorBoundary showAlert>
            <div key="modals" className="modals">
              <ErrorBoundary showAlert>
                <AnalyticsModal />
                <AlertModal ref={instance => registerModal(instance, 'AlertModal')} />
                <ErrorModal ref={instance => registerModal(instance, 'ErrorModal')} />
                <PromptModal ref={instance => registerModal(instance, 'PromptModal')} />
                <WrapperModal ref={instance => registerModal(instance, 'WrapperModal')} />
                <LoginModal ref={registerModal} />
                <AskModal ref={instance => registerModal(instance, 'AskModal')} />
                <SelectModal ref={instance => registerModal(instance, 'SelectModal')} />
                <FilterHelpModal ref={instance => registerModal(instance, 'FilterHelpModal')} />
                <RequestRenderErrorModal ref={instance => registerModal(instance, 'RequestRenderErrorModal')} />
                <GenerateConfigModal ref={instance => registerModal(instance, 'GenerateConfigModal')} />
                <ProjectSettingsModal ref={instance => registerModal(instance, 'ProjectSettingsModal')} />
                <WorkspaceDuplicateModal ref={instance => registerModal(instance, 'WorkspaceDuplicateModal')} />
                <CodePromptModal ref={instance => registerModal(instance, 'CodePromptModal')} />
                <RequestSettingsModal ref={instance => registerModal(instance, 'RequestSettingsModal')} />
                <RequestGroupSettingsModal ref={instance => registerModal(instance, 'RequestGroupSettingsModal')} />

                {activeWorkspace ? <>
                  {/* TODO: Figure out why cookieJar is sometimes null */}
                  {activeCookieJar ? <>
                    <CookiesModal
                      ref={instance => registerModal(instance, 'CookiesModal')}
                    />
                    <CookieModifyModal ref={instance => registerModal(instance, 'CookieModifyModal')} />
                  </> : null}

                  <NunjucksModal
                    ref={instance => registerModal(instance, 'NunjucksModal')}
                    workspace={activeWorkspace}
                  />

                  {activeApiSpec ? <WorkspaceSettingsModal
                    ref={instance => registerModal(instance, 'WorkspaceSettingsModal')}
                  /> : null}
                </> : null}

                <GenerateCodeModal
                  ref={instance => registerModal(instance, 'GenerateCodeModal')}
                  environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
                />

                <SettingsModal ref={instance => registerModal(instance, 'SettingsModal')} />
                <ResponseDebugModal ref={instance => registerModal(instance, 'ResponseDebugModal')} />

                <RequestSwitcherModal ref={instance => registerModal(instance, 'RequestSwitcherModal')} />

                <EnvironmentEditModal ref={instance => registerModal(instance, 'EnvironmentEditModal')} />

                <GitRepositorySettingsModal ref={instance => registerModal(instance, 'GitRepositorySettingsModal')}  />

                {activeWorkspace && gitVCS ? (
                  <Fragment>
                    <GitStagingModal ref={instance => registerModal(instance, 'GitStagingModal')} workspace={activeWorkspace} vcs={gitVCS} gitRepository={activeGitRepository} />
                    <GitLogModal ref={instance => registerModal(instance, 'GitLogModal')} vcs={gitVCS} />
                    {activeGitRepository !== null && (
                      <GitBranchesModal
                        ref={instance => registerModal(instance, 'GitBranchesModal')}
                        vcs={gitVCS}
                      />
                    )}
                  </Fragment>
                ) : null}

                {activeWorkspace && vcs ? (
                  <Fragment>
                    <SyncStagingModal ref={instance => registerModal(instance, 'SyncStagingModal')} vcs={vcs} />
                    <SyncMergeModal ref={instance => registerModal(instance, 'SyncMergeModal')} />
                    <SyncBranchesModal ref={instance => registerModal(instance, 'SyncBranchesModal')} vcs={vcs} />
                    <SyncDeleteModal ref={instance => registerModal(instance, 'SyncDeleteModal')} vcs={vcs} />
                    <SyncHistoryModal ref={instance => registerModal(instance, 'SyncHistoryModal')} vcs={vcs} />
                  </Fragment>
                ) : null}

                <WorkspaceEnvironmentsEditModal ref={instance => registerModal(instance, 'WorkspaceEnvironmentsEditModal')} />

                <AddKeyCombinationModal ref={instance => registerModal(instance, 'AddKeyCombinationModal')} />
                <ExportRequestsModal ref={instance => registerModal(instance, 'ExportRequestsModal')} />

                <GrpcDispatchModalWrapper>
                  {dispatch => (
                    <ProtoFilesModal
                      ref={instance => registerModal(instance, 'ProtoFilesModal')}
                      grpcDispatch={dispatch}
                    />
                  )}
                </GrpcDispatchModalWrapper>
              </ErrorBoundary>
            </div>

            <Outlet />
            <ActivityRouter />
          </ErrorBoundary>

          <ErrorBoundary showAlert>
            <Toast />
          </ErrorBoundary>
        </div>
      </NunjucksEnabledProvider>
    </GrpcProvider>
  );
};

export default withDragDropContext(App);
