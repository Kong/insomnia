// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import type { Workspace } from '../../../models/workspace';
import type { Environment } from '../../../models/environment';
import classnames from 'classnames';
import { COLLAPSE_SIDEBAR_REMS, SIDEBAR_SKINNY_REMS } from '../../../common/constants';
import WorkspaceDropdown from '../dropdowns/workspace-dropdown';
import VCS from '../../../sync/vcs';
import SyncDropdown from '../dropdowns/sync-dropdown';
import SyncLegacyDropdown from '../dropdowns/sync-legacy-dropdown';
import type { StatusCandidate } from '../../../sync/types';
import { isLoggedIn } from '../../../account/session';
import GitSyncDropdown from '../dropdowns/git-sync-dropdown';
import GitVCS from '../../../sync/git/git-vcs';
import type { GitRepository } from '../../../models/git-repository';

type Props = {|
  activeEnvironment: Environment | null,
  activeGitRepository: GitRepository | null,
  children: React.Node,
  enableSyncBeta: boolean,
  environmentHighlightColorStyle: string,
  handleSetActiveEnvironment: Function,
  handleSetActiveWorkspace: Function,
  handleDeploySpec: () => void,
  handleInitializeEntities: () => void,
  hidden: boolean,
  hotKeyRegistry: HotKeyRegistry,
  isLoading: boolean,
  showEnvironmentsModal: Function,
  syncItems: Array<StatusCandidate>,
  unseenWorkspaces: Array<Workspace>,
  vcs: VCS | null,
  gitVCS: GitVCS | null,
  width: number,
  workspace: Workspace,
  workspaces: Array<Workspace>,
|};

@autobind
class Sidebar extends React.PureComponent<Props> {
  render() {
    const {
      activeEnvironment,
      activeGitRepository,
      children,
      enableSyncBeta,
      environmentHighlightColorStyle,
      handleInitializeEntities,
      handleSetActiveWorkspace,
      handleDeploySpec,
      hidden,
      hotKeyRegistry,
      isLoading,
      syncItems,
      unseenWorkspaces,
      vcs,
      gitVCS,
      width,
      workspace,
      workspaces,
    } = this.props;

    return (
      <aside
        className={classnames('sidebar', 'theme--sidebar', {
          'sidebar--hidden': hidden,
          'sidebar--skinny': width < SIDEBAR_SKINNY_REMS,
          'sidebar--collapsed': width < COLLAPSE_SIDEBAR_REMS,
        })}
        style={{
          borderRight:
            activeEnvironment &&
            activeEnvironment.color &&
            environmentHighlightColorStyle === 'sidebar-edge'
              ? '5px solid ' + activeEnvironment.color
              : null,
        }}>
        <WorkspaceDropdown
          className="sidebar__header theme--sidebar__header"
          activeWorkspace={workspace}
          workspaces={workspaces}
          unseenWorkspaces={unseenWorkspaces}
          hotKeyRegistry={hotKeyRegistry}
          handleSetActiveWorkspace={handleSetActiveWorkspace}
          handleDeploySpec={handleDeploySpec}
          enableSyncBeta={enableSyncBeta}
          isLoading={isLoading}
          vcs={vcs}
        />

        {children}

        {gitVCS && (
          <GitSyncDropdown
            workspace={workspace}
            className="sidebar__footer"
            gitRepository={activeGitRepository}
            vcs={gitVCS}
            handleInitializeEntities={handleInitializeEntities}
          />
        )}

        {enableSyncBeta && vcs && isLoggedIn() && (
          <SyncDropdown
            className="sidebar__footer"
            workspace={workspace}
            vcs={vcs}
            syncItems={syncItems}
          />
        )}

        {!enableSyncBeta && (
          <SyncLegacyDropdown
            className="sidebar__footer"
            key={workspace._id}
            workspace={workspace}
          />
        )}
      </aside>
    );
  }
}

export default Sidebar;
