
import React, { FC, Fragment, lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Route, Routes, useNavigate } from 'react-router-dom';

import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
} from '../../common/constants';
import * as models from '../../models/index';
import { CookieModifyModal } from '../components/modals/cookie-modify-modal';
import { GrpcDispatchModalWrapper } from '../context/grpc';
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
} from '../redux/selectors';
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
import { registerModal } from './modals/index';
import { LoginModal } from './modals/login-modal';
import { NunjucksModal } from './modals/nunjucks-modal';
import ProjectSettingsModal from './modals/project-settings-modal';
import { PromptModal } from './modals/prompt-modal';
import ProtoFilesModal from './modals/proto-files-modal';
import { RequestGroupSettingsModal } from './modals/request-group-settings-modal';
import { RequestRenderErrorModal } from './modals/request-render-error-modal';
import { RequestSettingsModal } from './modals/request-settings-modal';
import { RequestSwitcherModal } from './modals/request-switcher-modal';
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

const lazyWithPreload = <T extends FC<any>>(
  importFn: () => Promise<{ default: T }>
) => {
  const LazyComponent = lazy(importFn);
  const preload = () => importFn();

  return [LazyComponent, preload] as const;
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

const LoadingIndicator = () => (<div
  id="app-loading-indicator"
  style={{
    position: 'fixed',
    top: '0',
    left: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
  }}
>
  <img src="./ui/images/insomnia-logo.svg" alt="Insomnia" />
</div>);

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

export const Wrapper: FC = () => {
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const activeCookieJar = useSelector(selectActiveCookieJar);
  const activeGitRepository = useSelector(selectActiveGitRepository);
  const activeWorkspace = useSelector(selectActiveWorkspace);
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

  async function handleSetActiveEnvironment(activeEnvironmentId: string | null) {
    if (activeWorkspaceMeta) {
      await models.workspaceMeta.update(activeWorkspaceMeta, { activeEnvironmentId });
    }
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
          <RequestSettingsModal ref={instance => registerModal(instance, 'RequestSettingsModal')} />
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
          <ResponseDebugModal ref={instance => registerModal(instance, 'ResponseDebugModal')} />

          <RequestSwitcherModal ref={instance => registerModal(instance, 'RequestSwitcherModal')} />

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
            handleSetActiveEnvironment={handleSetActiveEnvironment}
            activeEnvironmentId={activeEnvironment ? activeEnvironment._id : null}
          />

          <AddKeyCombinationModal ref={instance => registerModal(instance, 'AddKeyCombinationModal')} />
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
            <Suspense fallback={<LoadingIndicator />}>
              <WrapperHome
                vcs={vcs}
              />
            </Suspense>
          }
        />
        <Route
          path={ACTIVITY_UNIT_TEST}
          element={
            <Suspense fallback={<LoadingIndicator />}>
              <WrapperUnitTest />
            </Suspense>
          }
        />
        <Route
          path={ACTIVITY_SPEC}
          element={
            <Suspense fallback={<LoadingIndicator />}>
              <WrapperDesign />
            </Suspense>
          }
        />
        <Route
          path={ACTIVITY_DEBUG}
          element={
            <Suspense fallback={<LoadingIndicator />}>
              <WrapperDebug />
            </Suspense>
          }
        />
      </Routes>
      <ActivityRouter />
    </Fragment>
  );
};
