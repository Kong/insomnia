import classnames from 'classnames';
import React, { FC, Fragment, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import * as session from '../../../account/session';
import { DEFAULT_BRANCH_NAME } from '../../../common/constants';
import { database as db } from '../../../common/database';
import { docsVersionControl } from '../../../common/documentation';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { Status } from '../../../sync/types';
import { pushSnapshotOnInitialize } from '../../../sync/vcs/initialize-backend-project';
import { BackendProjectWithTeam } from '../../../sync/vcs/normalize-backend-project-team';
import { interceptAccessError } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import { selectActiveWorkspaceMeta, selectSyncItems } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { Link } from '../base/link';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';
import { showError, showModal } from '../modals';
import { LoginModalHandle } from '../modals/login-modal';
import { SyncBranchesModal } from '../modals/sync-branches-modal';
import { SyncDeleteModal } from '../modals/sync-delete-modal';
import { SyncHistoryModal } from '../modals/sync-history-modal';
import { SyncStagingModal } from '../modals/sync-staging-modal';
import { Tooltip } from '../tooltip';

// Stop refreshing if user hasn't been active in this long
// const REFRESH_USER_ACTIVITY = 1000 * 60 * 10;
// Refresh dropdown periodically
// const REFRESH_PERIOD = 1000 * 60 * 1;

interface Props {
  workspace: Workspace;
  project: Project;
  vcs: VCS;
}

interface State {
  currentBranch: string;
  localBranches: string[];
  compare: {
    ahead: number;
    behind: number;
  };
  status: Status;
  initializing: boolean;
  historyCount: number;
  loadingPull: boolean;
  loadingProjectPull: boolean;
  loadingPush: boolean;
  remoteBackendProjects: BackendProjectWithTeam[];
}
export const SyncDropdown: FC<Props> = ({ vcs, workspace, project }) => {
  const [state, setState] = useState<State>({
    localBranches: [],
    currentBranch: '',
    compare: {
      ahead: 0,
      behind: 0,
    },
    historyCount: 0,
    initializing: true,
    loadingPull: false,
    loadingPush: false,
    loadingProjectPull: false,
    status: {
      key: 'n/a',
      stage: {},
      unstaged: {},
    },
    remoteBackendProjects: [],
  });
  const syncItems = useSelector(selectSyncItems);
  const workspaceMeta = useSelector(selectActiveWorkspaceMeta);

  const refreshMainAttributes = useCallback(async () => {
    const localBranches = (await vcs.getBranches()).sort();
    const currentBranch = await vcs.getBranch();
    const historyCount = await vcs.getHistoryCount();
    const status = await vcs.status(syncItems, {});
    // Do the remote stuff
    if (session.isLoggedIn()) {
      try {
        const compare = await vcs.compareRemoteBranch();
        setState(state => ({
          ...state,
          compare,
        }));
      } catch (err) {
        console.log('Failed to compare remote branches', err.message);
      }
    }
    setState(state => ({
      ...state,
      status,
      historyCount,
      localBranches,
      currentBranch,
    }));
  }, [syncItems, vcs]);

  // on mount
  useEffect(() => {
    let isMounted = true;
    const fn = async () => {
      isMounted && setState(state => ({
        ...state,
        initializing: true,
      }));

      try {
        // NOTE pushes the first snapshot automatically
        await pushSnapshotOnInitialize({ vcs, workspace, workspaceMeta, project });
        await refreshMainAttributes();
      } catch (err) {
        console.log('[sync_menu] Error refreshing sync state', err);
      } finally {
        isMounted && setState(state => ({
          ...state,
          initializing: false,
        }));
      }
      // Refresh but only if the user has been active in the last n minutes
      // checkInterval = setInterval(async () => {
      //   if (Date.now() - lastUserActivity < REFRESH_USER_ACTIVITY) {
      //     await refreshMainAttributes();
      //   }
      // }, REFRESH_PERIOD);
      // document.addEventListener('mousemove', _handleUserActivity);
    };
    fn();

    return () => {
      isMounted = false;
      // document.removeEventListener('mousemove', _handleUserActivity);
    };
  }, [project, refreshMainAttributes, vcs, workspace, workspaceMeta]);
  // Update if new sync items
  useEffect(() => {
    if (vcs.hasBackendProject()) {
      vcs.status(syncItems, {}).then(status => {
        setState(state => ({
          ...state,
          status,
        }));
      });
    }
  }, [syncItems, vcs]);

  async function _handlePushChanges() {
    setState(state => ({
      ...state,
      loadingPush: true,
    }));

    try {
      const branch = await vcs.getBranch();
      await interceptAccessError({
        callback: () => vcs.push(project.remoteId),
        action: 'push',
        resourceName: branch,
        resourceType: 'branch',
      });
    } catch (err) {
      showError({
        title: 'Push Error',
        message: err.message,
        error: err,
      });
    }

    await refreshMainAttributes();
    setState(state => ({
      ...state,
      loadingPush: false,
    }));
  }

  async function _handlePullChanges() {
    setState(state => ({
      ...state,
      loadingPull: true,
    }));

    try {
      const branch = await vcs.getBranch();
      const delta = await interceptAccessError({
        callback: () => vcs.pull(syncItems, project.remoteId),
        action: 'pull',
        resourceName: branch,
        resourceType: 'branch',
      });
      // @ts-expect-error -- TSCONVERSION
      await db.batchModifyDocs(delta);
    } catch (err) {
      showError({
        title: 'Pull Error',
        message: err.message,
        error: err,
      });
    }

    setState(state => ({
      ...state,
      loadingPull: false,
    }));
  }

  async function _handleRevert() {
    try {
      const delta = await vcs.rollbackToLatest(syncItems);
      // @ts-expect-error -- TSCONVERSION
      await db.batchModifyDocs(delta);
    } catch (err) {
      showError({
        title: 'Revert Error',
        message: err.message,
        error: err,
      });
    }
  }

  async function _handleSwitchBranch(branch: string) {
    try {
      const delta = await vcs.checkout(syncItems, branch);

      if (branch === DEFAULT_BRANCH_NAME) {
        const defaultBranchHistoryCount = await vcs.getHistoryCount(DEFAULT_BRANCH_NAME);

        // If the default branch has no snapshots, but the current branch does
        // It will result in the workspace getting deleted
        // So we filter out the workspace from the delta to prevent this
        if (!defaultBranchHistoryCount && historyCount) {
          delta.remove = delta.remove.filter(e => e?.type !== models.workspace.type);
        }
      }

      // @ts-expect-error -- TSCONVERSION
      await db.batchModifyDocs(delta);
    } catch (err) {
      showError({
        title: 'Branch Switch Error',
        message: err.message,
        error: err,
      });
    }

    // We can't refresh now because we won't yet have the new syncItems
    // Still need to do this in case sync items don't change
    setState(state => ({
      ...state,
      currentBranch: branch,
    }));
  }

  if (!session.isLoggedIn()) {
    return null;
  }

  const {
    localBranches,
    currentBranch,
    status,
    historyCount,
    loadingPull,
    loadingPush,
    loadingProjectPull,
    compare: { ahead, behind },
    initializing,
  } = state;
  const canCreateSnapshot =
    Object.keys(status.stage).length > 0 || Object.keys(status.unstaged).length > 0;
  const visibleBranches = localBranches.filter(b => !b.match(/\.hidden$/));
  const syncMenuHeader = (
    <DropdownDivider>
      Insomnia Sync{' '}
      <HelpTooltip>
        Sync and collaborate on workspaces{' '}
        <Link href={docsVersionControl}>
          <span className="no-wrap">
            <br />
            Documentation <i className="fa fa-external-link" />
          </span>
        </Link>
      </HelpTooltip>
    </DropdownDivider>
  );

  if (loadingProjectPull) {
    return (
      <div>
        <button className="btn btn--compact wide">
          <i className="fa fa-refresh fa-spin" /> Initializing
        </button>
      </div>
    );
  }

  const canPush = ahead > 0;
  const canPull = behind > 0;
  const loadIcon = <i className="fa fa-spin fa-refresh fa--fixed-width" />;
  const pullToolTipMsg = canPull
    ? `There ${behind === 1 ? 'is' : 'are'} ${behind} snapshot${behind === 1 ? '' : 's'} to pull`
    : 'No changes to pull';
  const pushToolTipMsg = canPush
    ? `There ${ahead === 1 ? 'is' : 'are'} ${ahead} snapshot${ahead === 1 ? '' : 's'} to push`
    : 'No changes to push';
  const snapshotToolTipMsg = canCreateSnapshot ? 'Local changes made' : 'No local changes made';

  return (
    <div>
      <Dropdown className="wide tall" onOpen={() => refreshMainAttributes()}>
        {currentBranch === null ?
          <Fragment>Sync</Fragment> :
          <DropdownButton
            className="btn--clicky-small btn-sync wide text-left overflow-hidden row-spaced"
            disabled={initializing}
          >
            <div className="ellipsis">
              <i className="fa fa-code-fork space-right" />{' '}
              {initializing ? 'Initializing...' : currentBranch}
            </div>
            <div className="flex space-left">
              <Tooltip message={snapshotToolTipMsg} delay={800} position="bottom">
                <i
                  className={classnames('fa fa-cube fa--fixed-width', {
                    'super-duper-faint': !canCreateSnapshot,
                  })}
                />
              </Tooltip>

              {/* Only show cloud icons if logged in */}
              {session.isLoggedIn() && (
                <Fragment>
                  {loadingPull ? (
                    loadIcon
                  ) : (
                    <Tooltip message={pullToolTipMsg} delay={800} position="bottom">
                      <i
                        className={classnames('fa fa-cloud-download fa--fixed-width', {
                          'super-duper-faint': !canPull,
                        })}
                      />
                    </Tooltip>
                  )}

                  {loadingPush ? (
                    loadIcon
                  ) : (
                    <Tooltip message={pushToolTipMsg} delay={800} position="bottom">
                      <i
                        className={classnames('fa fa-cloud-upload fa--fixed-width', {
                          'super-duper-faint': !canPush,
                        })}
                      />
                    </Tooltip>
                  )}
                </Fragment>
              )}
            </div>
          </DropdownButton>}

        {syncMenuHeader}

        {!session.isLoggedIn() && (
          <DropdownItem onClick={() => showModal(LoginModalHandle)}>
            <i className="fa fa-sign-in" /> Log In
          </DropdownItem>
        )}

        <DropdownItem onClick={() => showModal(SyncBranchesModal, { onHide: refreshMainAttributes })}>
          <i className="fa fa-code-fork" />
          Branches
        </DropdownItem>

        <DropdownItem onClick={() => showModal(SyncDeleteModal, { onHide: refreshMainAttributes })} disabled={historyCount === 0}>
          <i className="fa fa-remove" />
          Delete {strings.collection.singular}
        </DropdownItem>

        <DropdownDivider>Local Branches</DropdownDivider>
        {visibleBranches.map(branch => {
          const icon = branch === currentBranch ? <i className="fa fa-tag" /> : <i className="fa fa-empty" />;
          const isCurrentBranch = branch === currentBranch;
          return <DropdownItem
            key={branch}
            onClick={isCurrentBranch ? undefined : () => _handleSwitchBranch(branch)}
            className={classnames({
              bold: isCurrentBranch,
            })}
            title={isCurrentBranch ? '' : `Switch to "${branch}"`}
          >
            {icon}
            {branch}
          </DropdownItem>;
        })}

        <DropdownDivider>{currentBranch}</DropdownDivider>

        <DropdownItem onClick={() => showModal(SyncHistoryModal)} disabled={historyCount === 0}>
          <i className="fa fa-clock-o" />
          History
        </DropdownItem>

        <DropdownItem
          onClick={_handleRevert}
          buttonClass={PromptButton}
          stayOpenAfterClick
          disabled={!canCreateSnapshot || historyCount === 0}
        >
          <i className="fa fa-undo" />
          Revert Changes
        </DropdownItem>

        <DropdownItem
          onClick={() =>
            showModal(SyncStagingModal, {
              onSnapshot: () => refreshMainAttributes(),
              handlePush: () => _handlePushChanges(),
            })
          }
          disabled={!canCreateSnapshot}
        >
          <i className="fa fa-cube" />
          Create Snapshot
        </DropdownItem>

        <DropdownItem onClick={_handlePullChanges} disabled={behind === 0 || loadingPull}>
          {loadingPull ? (
            <Fragment>
              <i className="fa fa-spin fa-refresh" /> Pulling Snapshots...
            </Fragment>
          ) : (
            <Fragment>
              <i className="fa fa-cloud-download" /> Pull {behind || ''} Snapshot
              {behind === 1 ? '' : 's'}
            </Fragment>
          )}
        </DropdownItem>

        <DropdownItem onClick={_handlePushChanges} disabled={ahead === 0 || loadingPush}>
          {loadingPush ? (
            <Fragment>
              <i className="fa fa-spin fa-refresh" /> Pushing Snapshots...
            </Fragment>
          ) : (
            <Fragment>
              <i className="fa fa-cloud-upload" /> Push {ahead || ''} Snapshot
              {ahead === 1 ? '' : 's'}
            </Fragment>
          )}
        </DropdownItem>
      </Dropdown>
    </div>
  );
};
