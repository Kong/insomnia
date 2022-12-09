import React, { FC, Fragment } from 'react';
import { useSelector } from 'react-redux';

import { ErrorBoundary } from '../components/error-boundary';
import { registerModal } from '../components/modals';
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
import { LoginModal } from '../components/modals/login-modal';
import { NunjucksModal } from '../components/modals/nunjucks-modal';
import { PromptModal } from '../components/modals/prompt-modal';
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
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { WorkspaceSettingsModal } from '../components/modals/workspace-settings-modal';
import { WrapperModal } from '../components/modals/wrapper-modal';
import { useGitVCS } from '../hooks/use-git-vcs';
import { useVCS } from '../hooks/use-vcs';
import {
  selectActiveCookieJar,
  selectActiveEnvironment,
  selectActiveGitRepository,
  selectActiveProject,
  selectActiveWorkspace,
} from '../redux/selectors';

const Modals: FC = () => {
  const activeCookieJar = useSelector(selectActiveCookieJar);
  const activeWorkspace = useSelector(selectActiveWorkspace);
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

  return (
    <div key="modals" className="modals">
      <ErrorBoundary showAlert>
        <AnalyticsModal />
        <AlertModal ref={instance => registerModal(instance, 'AlertModal')} />
        <ErrorModal ref={instance => registerModal(instance, 'ErrorModal')} />
        <PromptModal
          ref={instance => registerModal(instance, 'PromptModal')}
        />
        <WrapperModal
          ref={instance => registerModal(instance, 'WrapperModal')}
        />
        <LoginModal ref={instance => registerModal(instance, 'LoginModal')} />
        <AskModal ref={instance => registerModal(instance, 'AskModal')} />
        <SelectModal
          ref={instance => registerModal(instance, 'SelectModal')}
        />
        <FilterHelpModal
          ref={instance => registerModal(instance, 'FilterHelpModal')}
        />
        <RequestRenderErrorModal
          ref={instance => registerModal(instance, 'RequestRenderErrorModal')}
        />
        <GenerateConfigModal
          ref={instance => registerModal(instance, 'GenerateConfigModal')}
        />

        <CodePromptModal
          ref={instance => registerModal(instance, 'CodePromptModal')}
        />
        <RequestSettingsModal
          ref={instance => registerModal(instance, 'RequestSettingsModal')}
        />
        <RequestGroupSettingsModal
          ref={instance =>
            registerModal(instance, 'RequestGroupSettingsModal')
          }
        />

        {activeWorkspace ? (
          <>
            {/* TODO: Figure out why cookieJar is sometimes null */}
            {activeCookieJar ? (
              <>
                <CookiesModal
                  ref={instance => registerModal(instance, 'CookiesModal')}
                />
                <CookieModifyModal
                  ref={instance =>
                    registerModal(instance, 'CookieModifyModal')
                  }
                />
              </>
            ) : null}

            <NunjucksModal
              ref={instance => registerModal(instance, 'NunjucksModal')}
              workspace={activeWorkspace}
            />

            <WorkspaceSettingsModal
              ref={instance =>
                registerModal(instance, 'WorkspaceSettingsModal')
              }
            />
          </>
        ) : null}

        <GenerateCodeModal
          ref={instance => registerModal(instance, 'GenerateCodeModal')}
          environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
        />

        <SettingsModal
          ref={instance => registerModal(instance, 'SettingsModal')}
        />
        <ResponseDebugModal
          ref={instance => registerModal(instance, 'ResponseDebugModal')}
        />

        <RequestSwitcherModal
          ref={instance => registerModal(instance, 'RequestSwitcherModal')}
        />

        <EnvironmentEditModal
          ref={instance => registerModal(instance, 'EnvironmentEditModal')}
        />

        <GitRepositorySettingsModal
          ref={instance =>
            registerModal(instance, 'GitRepositorySettingsModal')
          }
        />

        {activeWorkspace && gitVCS ? (
          <Fragment>
            <GitStagingModal
              ref={instance => registerModal(instance, 'GitStagingModal')}
              workspace={activeWorkspace}
              vcs={gitVCS}
              gitRepository={activeGitRepository}
            />
            <GitLogModal
              ref={instance => registerModal(instance, 'GitLogModal')}
              vcs={gitVCS}
            />
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
            <SyncStagingModal
              ref={instance => registerModal(instance, 'SyncStagingModal')}
              vcs={vcs}
            />
            <SyncMergeModal
              ref={instance => registerModal(instance, 'SyncMergeModal')}
            />
            <SyncBranchesModal
              ref={instance => registerModal(instance, 'SyncBranchesModal')}
              vcs={vcs}
            />
            <SyncDeleteModal
              ref={instance => registerModal(instance, 'SyncDeleteModal')}
              vcs={vcs}
            />
            <SyncHistoryModal
              ref={instance => registerModal(instance, 'SyncHistoryModal')}
              vcs={vcs}
            />
          </Fragment>
        ) : null}

        <WorkspaceEnvironmentsEditModal
          ref={instance =>
            registerModal(instance, 'WorkspaceEnvironmentsEditModal')
          }
        />

        <AddKeyCombinationModal
          ref={instance => registerModal(instance, 'AddKeyCombinationModal')}
        />
        <ExportRequestsModal
          ref={instance => registerModal(instance, 'ExportRequestsModal')}
        />

      </ErrorBoundary>
    </div>
  );
};

export default Modals;
