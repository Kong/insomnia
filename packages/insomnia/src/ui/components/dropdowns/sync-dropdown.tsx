import classnames from 'classnames';
import React, { FC, Fragment, useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useInterval, useMount } from 'react-use';

import * as session from '../../../account/session';
import { DEFAULT_BRANCH_NAME } from '../../../common/constants';
import { database as db } from '../../../common/database';
import { docsVersionControl } from '../../../common/documentation';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { isRemoteProject, Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { Status } from '../../../sync/types';
import { pushSnapshotOnInitialize } from '../../../sync/vcs/initialize-backend-project';
import { logCollectionMovedToProject } from '../../../sync/vcs/migrate-collections';
import { BackendProjectWithTeam } from '../../../sync/vcs/normalize-backend-project-team';
import { pullBackendProject } from '../../../sync/vcs/pull-backend-project';
import { interceptAccessError } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import { activateWorkspace } from '../../redux/modules/workspace';
import { selectActiveWorkspaceMeta, selectRemoteProjects, selectSyncItems } from '../../redux/selectors';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { Link } from '../base/link';
import { HelpTooltip } from '../help-tooltip';
import { showError, showModal } from '../modals';
import { LoginModal } from '../modals/login-modal';
import { SyncBranchesModal } from '../modals/sync-branches-modal';
import { SyncDeleteModal } from '../modals/sync-delete-modal';
import { SyncHistoryModal } from '../modals/sync-history-modal';
import { SyncStagingModal } from '../modals/sync-staging-modal';
import { Tooltip } from '../tooltip';

// TODO: handle refetching logic in one place not here in a component

// Refresh dropdown periodically
const REFRESH_PERIOD = 1000 * 60 * 1;

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
  const dispatch = useDispatch();
  const remoteProjects = useSelector(selectRemoteProjects);
  const syncItems = useSelector(selectSyncItems);
  const workspaceMeta = useSelector(selectActiveWorkspaceMeta);

  const refetchRemoteBranch = useCallback(async () => {
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
  }, [vcs]);

  const refreshVCSAndRefetchRemote = useCallback(async () => {
    if (!vcs.hasBackendProject() && isRemoteProject(project)) {
      const remoteBackendProjects = await vcs.remoteBackendProjectsInAnyTeam();
      const matchedBackendProjects = remoteBackendProjects.filter(p => p.rootDocumentId === workspace._id);
      setState(state => ({
        ...state,
        remoteBackendProjects: matchedBackendProjects,
      }));
      return;
    }
    const localBranches = (await vcs.getBranches()).sort();
    const currentBranch = await vcs.getBranch();
    const historyCount = await vcs.getHistoryCount();
    const status = await vcs.status(syncItems, {});
    setState(state => ({
      ...state,
      status,
      historyCount,
      localBranches,
      currentBranch,
    }));
    // Do the remote stuff
    refetchRemoteBranch();
  }, [project, refetchRemoteBranch, syncItems, vcs, workspace._id]);

  useInterval(() => {
    refetchRemoteBranch();
  }, REFRESH_PERIOD);

  useMount(async () => {
    setState(state => ({
      ...state,
      initializing: true,
    }));

    try {
      // NOTE pushes the first snapshot automatically
      await pushSnapshotOnInitialize({ vcs, workspace, workspaceMeta, project });
      await refreshVCSAndRefetchRemote();
    } catch (err) {
      console.log('[sync_menu] Error refreshing sync state', err);
    } finally {
      setState(state => ({
        ...state,
        initializing: false,
      }));
    }
  });

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
  async function handleSetProject(backendProject: BackendProjectWithTeam) {
    setState(state => ({
      ...state,
      loadingProjectPull: true,
    }));
    const pulledIntoProject = await pullBackendProject({ vcs, backendProject, remoteProjects });
    if (pulledIntoProject._id !== project._id) {
      // If pulled into a different project, reactivate the workspace
      await dispatch(activateWorkspace({ workspaceId: workspace._id }));
      logCollectionMovedToProject(workspace, pulledIntoProject);
    }
    await refreshVCSAndRefetchRemote();
    setState(state => ({
      ...state,
      loadingProjectPull: false,
    }));
  }
  async function handlePush() {
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

    await refreshVCSAndRefetchRemote();
    setState(state => ({
      ...state,
      loadingPush: false,
    }));
  }

  async function handlePull() {
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

  async function handleRevert() {
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

  async function handleSwitchBranch(branch: string) {
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
    remoteBackendProjects,
  } = state;
  const canCreateSnapshot =
    Object.keys(status.stage).length > 0 || Object.keys(status.unstaged).length > 0;
  const visibleBranches = localBranches.filter(b => !b.match(/\.hidden$/));

  if (loadingProjectPull) {
    return (
      <div>
        <button className="btn btn--compact wide">
          <i className="fa fa-refresh fa-spin" /> Initializing
        </button>
      </div>
    );
  }

  if (!vcs.hasBackendProject()) {
    return (
      <div>
        <Dropdown
          style={{
            marginLeft: 'var(--padding-md)',
          }}
          className="wide tall"
          onOpen={() => refreshVCSAndRefetchRemote()}
          triggerButton={
            <DropdownButton
              variant='outlined'
              disableHoverBehavior={false}
              removePaddings={false}
              className="btn--clicky-small btn-sync wide text-left overflow-hidden row-spaced"
            >
              <i className="fa fa-code-fork " /> Setup Sync
            </DropdownButton>
          }
        >
          <DropdownSection
            title={
              <>
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
              </>
            }
          >
            <DropdownItem>
              {remoteBackendProjects.length === 0 && (
                <ItemContent
                  icon="plus-circle"
                  label="Create Locally"
                  onClick={async () => {
                    setState(state => ({
                      ...state,
                      loadingProjectPull: true,
                    }));
                    await vcs.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);
                    await refreshVCSAndRefetchRemote();
                    setState(state => ({
                      ...state,
                      loadingProjectPull: false,
                    }));
                  }}
                />
              )}
            </DropdownItem>
            <>
              {remoteBackendProjects.map(p => (
                <DropdownItem key={p.id}>
                  <ItemContent
                    icon="cloud-download"
                    label={<>Pull <strong>{p.name}</strong></>}
                    onClick={() => handleSetProject(p)}
                  />
                </DropdownItem>
              ))}
            </>
          </DropdownSection>
        </Dropdown>
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
      <Dropdown
        style={{ marginLeft: 'var(--padding-md)' }}
        className="wide tall"
        onOpen={() => refreshVCSAndRefetchRemote()}
        isDisabled={initializing}
        triggerButton={
          currentBranch === null ?
            <Fragment>Sync</Fragment> :
            <DropdownButton
              variant='outlined'
              disableHoverBehavior={false}
              removePaddings={false}
              className="btn--clicky-small btn-sync wide text-left overflow-hidden row-spaced"
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
            </DropdownButton>
        }
      >
        <DropdownSection
          title={
            <>
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
            </>
          }
        >

          <DropdownItem>
            {!session.isLoggedIn() && (
              <ItemContent
                icon="sign-in"
                label="Log In"
                onClick={() => showModal(LoginModal)}
              />
            )}
          </DropdownItem>

          <DropdownItem>
            <ItemContent icon="code-fork" label="Branches" onClick={() => showModal(SyncBranchesModal, { onHide: refreshVCSAndRefetchRemote })} />
          </DropdownItem>

          <DropdownItem>
            <ItemContent
              icon="remove"
              label={<>Delete {strings.collection.singular}</>}
              onClick={() => showModal(SyncDeleteModal, { onHide: refreshVCSAndRefetchRemote })}
            // disabled={historyCount === 0}
            />
          </DropdownItem>
        </DropdownSection>

        <DropdownSection title="Local Branches">
          {visibleBranches.map(branch => {
            const isCurrentBranch = branch === currentBranch;
            return (
              <DropdownItem
                key={branch}
                title={isCurrentBranch ? '' : `Switch to "${branch}"`}
              >
                <ItemContent
                  icon={currentBranch ? 'tag' : 'empty'}
                  label={branch}
                  className={classnames({
                    bold: isCurrentBranch,
                  })}
                  onClick={isCurrentBranch ? undefined : () => handleSwitchBranch(branch)}
                />
              </DropdownItem>
            );
          })}
        </DropdownSection>

        <DropdownSection title={currentBranch}>
          <DropdownItem>
            <ItemContent
              icon="clock-o"
              label="History"
              onClick={() => showModal(SyncHistoryModal)}
            // disabled={historyCount === 0}
            />
          </DropdownItem>

          <DropdownItem> {/* disabled={!canCreateSnapshot || historyCount === 0} */}
            <ItemContent
              icon="undo"
              label="Revert Changes"
              withPrompt
              onClick={handleRevert}
            />
          </DropdownItem>

          <DropdownItem> {/* disabled={!canCreateSnapshot} */}
            <ItemContent
              icon="cube"
              label="Create Snapshot"
              onClick={() =>
                showModal(SyncStagingModal, {
                  onSnapshot: refreshVCSAndRefetchRemote,
                  handlePush,
                })
              }
            />
          </DropdownItem>

          <DropdownItem> {/* disabled={behind === 0 || loadingPull}> */}
            <ItemContent
              icon={loadingPull ? 'spin fa-refresh' : 'cloud-download'}
              label={loadingPull ? 'Pulling Snapshots...' : `Pull ${behind || ''} Snapshot ${behind === 1 ? '' : 's'}`}
              onClick={handlePull}
            />
          </DropdownItem>
          <DropdownItem>
            <ItemContent
              icon={loadingPush ? 'spin fa-refresh' : 'cloud-upload'}
              label={loadingPush ? 'Pushing Snapshots...' : `Push ${ahead || ''} Snapshot ${ahead === 1 ? '' : 's'}`}
              onClick={handlePush}
            // disabled={ahead === 0 || loadingPush}
            />
          </DropdownItem>
        </DropdownSection>
      </Dropdown>
    </div>
  );
};
