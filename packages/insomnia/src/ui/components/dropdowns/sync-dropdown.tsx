import classnames from 'classnames';
import React, { FC, Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useRouteLoaderData } from 'react-router-dom';
import { useInterval, useMount } from 'react-use';

import { getAccountId } from '../../../account/session';
import * as session from '../../../account/session';
import { getAppWebsiteBaseURL } from '../../../common/constants';
import { DEFAULT_BRANCH_NAME } from '../../../common/constants';
import { database as db, Operation } from '../../../common/database';
import { docsVersionControl } from '../../../common/documentation';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { isOwnerOfOrganization } from '../../../models/organization';
import { isRemoteProject, Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { Snapshot, Status } from '../../../sync/types';
import { pushSnapshotOnInitialize } from '../../../sync/vcs/initialize-backend-project';
import { logCollectionMovedToProject } from '../../../sync/vcs/migrate-collections';
import { BackendProjectWithTeam } from '../../../sync/vcs/normalize-backend-project-team';
import { pullBackendProject } from '../../../sync/vcs/pull-backend-project';
import { interceptAccessError } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import { type FeatureList, useOrganizationLoaderData } from '../../../ui/routes/organization';
import { invariant } from '../../../utils/invariant';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { Link } from '../base/link';
import { HelpTooltip } from '../help-tooltip';
import { showModal } from '../modals';
import { showError } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { AskModal } from '../modals/ask-modal';
import { GitRepositorySettingsModal } from '../modals/git-repository-settings-modal';
import { SyncBranchesModal } from '../modals/sync-branches-modal';
import { SyncDeleteModal } from '../modals/sync-delete-modal';
import { SyncHistoryModal } from '../modals/sync-history-modal';
import { SyncStagingModal } from '../modals/sync-staging-modal';
import { Button } from '../themed-button';
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
  history: Snapshot[];
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
    history: [],
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
  const { organizationId, projectId } = useParams<{ organizationId: string; projectId: string }>();
  const navigate = useNavigate();
  const {
    activeWorkspaceMeta,
    syncItems,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const { organizations } = useOrganizationLoaderData();
  const currentOrg = organizations.find(organization => (organization.id === organizationId));
  const { features } = useRouteLoaderData(':organizationId') as { features: FeatureList };

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
    const history = await vcs.getHistory();
    const historyCount = await vcs.getHistoryCount();
    const status = await vcs.status(syncItems, {});
    setState(state => ({
      ...state,
      status,
      history,
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

  const [isGitRepoSettingsModalOpen, setIsGitRepoSettingsModalOpen] = useState(false);
  const [isSyncDeleteModalOpen, setIsSyncDeleteModalOpen] = useState(false);
  const [isSyncHistoryModalOpen, setIsSyncHistoryModalOpen] = useState(false);
  const [isSyncStagingModalOpen, setIsSyncStagingModalOpen] = useState(false);
  const [isSyncBranchesModalOpen, setIsSyncBranchesModalOpen] = useState(false);
  useMount(async () => {
    setState(state => ({
      ...state,
      initializing: true,
    }));

    try {
      // NOTE pushes the first snapshot automatically
      if (activeWorkspaceMeta.pushSnapshotOnInitialize) {
        await pushSnapshotOnInitialize({ vcs, workspace, project });
        await refreshVCSAndRefetchRemote();
      }
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

    invariant(project.remoteId, 'Project is not remote');

    const pulledIntoProject = await pullBackendProject({ vcs, backendProject, remoteProject: project });
    if (pulledIntoProject.project._id !== project._id) {
      // If pulled into a different project, reactivate the workspace
      navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}`);
      logCollectionMovedToProject(workspace, pulledIntoProject.project);
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
      invariant(project.remoteId, 'Project is not remote');
      await interceptAccessError({
        callback: () => vcs.push({ teamId: project.parentId, teamProjectId: project.remoteId }),
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
      invariant(project.remoteId, 'Project is not remote');
      const branch = await vcs.getBranch();
      const delta = await interceptAccessError({
        callback: () => vcs.pull({ candidates: syncItems, teamId: project.parentId, teamProjectId: project.remoteId }),
        action: 'pull',
        resourceName: branch,
        resourceType: 'branch',
      });
      await db.batchModifyDocs(delta as unknown as Operation);
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
      await db.batchModifyDocs(delta as unknown as Operation);
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
      await db.batchModifyDocs(delta as unknown as Operation);
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
    history,
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
  const syncMenuHeader = (
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

  const emptyDropdownItemsArray = [{
    id: 'empty',
    icon: 'plus-circle',
    name: 'Create Locally',
    onClick: async () => {
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
    },
  }];

  const isGitSyncEnabled = features.gitSync.enabled;
  const accountId = getAccountId();

  const showUpgradePlanModal = () => {
    if (!currentOrg || !accountId) {
      return;
    }
    const isOwner = isOwnerOfOrganization({
      organization: currentOrg,
      accountId,
    });

    isOwner ?
      showModal(AskModal, {
        title: 'Upgrade Plan',
        message: 'Git Sync is only enabled for Team plan or above, please upgrade your plan.',
        yesText: 'Upgrade',
        noText: 'Cancel',
        onDone: async (isYes: boolean) => {
          if (isYes) {
            window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/subscription/update?plan=team`);
          }
        },
      }) : showModal(AlertModal, {
        title: 'Upgrade Plan',
        message: 'Git Sync is only enabled for Team plan or above, please ask the organization owner to upgrade.',
      });
  };

  if (!vcs.hasBackendProject()) {
    return (
      <div>
        <Dropdown
          className="wide tall"
          onOpen={() => refreshVCSAndRefetchRemote()}
          aria-label="Select a project to sync with"
          triggerButton={
            <DropdownButton
              size="medium"
              removeBorderRadius
              disableHoverBehavior={false}
              removePaddings={false}
              variant='text'
              style={{
                width: '100%',
                borderRadius: '0',
                height: 'var(--line-height-sm)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 'var(--padding-xs)',
                  width: '100%',
                }}
              >
                <i className="fa fa-cloud" /> Setup Sync
              </div>
            </DropdownButton>
          }
        >
          <DropdownSection>
            <DropdownItem
              key='gitSync'
              aria-label='Setup Git Sync'
            >
              <Button
                variant='contained'
                bg='surprise'
                onClick={async () => {
                  isGitSyncEnabled ?
                    setIsGitRepoSettingsModalOpen(true) :
                    showUpgradePlanModal();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--padding-sm)',
                  margin: '0 var(--padding-sm)',
                  justifyContent: 'flex-start!important',
                }}
              >
                <i className="fa-brands fa-git-alt" /> Use Git Sync
              </Button>
            </DropdownItem>
          </DropdownSection>
          <DropdownSection
            aria-label='Sync Projects List'
            items={remoteBackendProjects.length === 0 ? emptyDropdownItemsArray : []}
            title={syncMenuHeader}
          >
            {p =>
              <DropdownItem
                key={p.id}
                textValue={p.name}
              >
                <ItemContent {...p} label={p.name} />
              </DropdownItem>
            }
          </DropdownSection>
          <DropdownSection
            aria-label='Sync Projects List'
            items={remoteBackendProjects.length !== 0 ? remoteBackendProjects : []}
            title={syncMenuHeader}
          >
            {p =>
              <DropdownItem
                key={p.id}
                aria-label={`Pull ${p.name}`}
              >
                <ItemContent
                  icon="cloud-download"
                  label={<>Pull <strong>{p.name}</strong></>}
                  onClick={() => handleSetProject(p)}
                />
              </DropdownItem>
            }
          </DropdownSection>
        </Dropdown>
        {isGitRepoSettingsModalOpen && (
          <GitRepositorySettingsModal
            onHide={() => setIsGitRepoSettingsModalOpen(false)}
          />
        )}
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
        className="wide tall"
        aria-label='Sync Menu'
        onOpen={() => refreshVCSAndRefetchRemote()}
        closeOnSelect={false}
        isDisabled={initializing}
        triggerButton={
          currentBranch === null ?
            <Fragment>Sync</Fragment> :
            <DropdownButton
              size="medium"
              aria-label='Insomnia Sync'
              removeBorderRadius
              disableHoverBehavior={false}
              removePaddings={false}
              variant='text'
              style={{
                width: '100%',
                borderRadius: '0',
                height: 'var(--line-height-sm)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 'var(--padding-xs)',
                  width: '100%',
                }}
              >
                <div className="ellipsis">
                  <i className="fa fa-cloud space-right" />{' '}
                  {initializing ? 'Initializing...' : currentBranch}
                </div>
                <div className="flex space-left">
                  <Tooltip message={snapshotToolTipMsg} delay={800} position="bottom">
                    <i
                      style={{
                        color: canCreateSnapshot ? 'var(--color-notice)' : 'var(--color-hl)',
                      }}
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
              </div>

            </DropdownButton>
        }
      >
        <DropdownSection>
          <DropdownItem
            key='gitSync'
            aria-label='Setup Git Sync'
          >
            <Button
              variant='contained'
              bg='surprise'
              onClick={async () => {
                isGitSyncEnabled ?
                  setIsGitRepoSettingsModalOpen(true) :
                  showUpgradePlanModal();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--padding-sm)',
                margin: '0 var(--padding-sm)',
                justifyContent: 'flex-start!important',
              }}
            >
              <i className="fa-brands fa-git-alt" /> Use Git Sync
            </Button>
          </DropdownItem>
        </DropdownSection>
        <DropdownSection
          aria-label='Sync Branches List'
          title={syncMenuHeader}
        >
          <DropdownItem aria-label='Branches'>
            <ItemContent
              icon="code-fork"
              label="Branches"
              onClick={() => setIsSyncBranchesModalOpen(true)}
            />
          </DropdownItem>

          <DropdownItem aria-label={`Delete ${strings.collection.singular}`}>
            <ItemContent
              icon="remove"
              isDisabled={historyCount === 0}
              label={<>Delete {strings.collection.singular}</>}
              onClick={() => setIsSyncDeleteModalOpen(true)}
            />
          </DropdownItem>
        </DropdownSection>

        <DropdownSection
          aria-label='Local Branches List'
          title="Local Branches"
        >
          {visibleBranches.map(branch => {
            const isCurrentBranch = branch === currentBranch;
            return (
              <DropdownItem
                key={branch}
                aria-label={branch}
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

        <DropdownSection
          aria-label='Snapshot action section'
          title={currentBranch}
        >
          <DropdownItem aria-label='History'>
            <ItemContent
              isDisabled={historyCount === 0}
              icon="clock-o"
              label="History"
              onClick={() => setIsSyncHistoryModalOpen(true)}
            />
          </DropdownItem>

          <DropdownItem aria-label='Revert Changes'>
            <ItemContent
              isDisabled={!canCreateSnapshot || historyCount === 0}
              icon="undo"
              label="Revert Changes"
              withPrompt
              onClick={handleRevert}
            />
          </DropdownItem>

          <DropdownItem aria-label='Create Snapshot'>
            <ItemContent
              isDisabled={!canCreateSnapshot}
              icon="cube"
              label="Create Snapshot"
              onClick={() => setIsSyncStagingModalOpen(true)
              }
            />
          </DropdownItem>

          <DropdownItem aria-label={loadingPull ? 'Pulling Snapshots...' : `Pull ${behind || ''} Snapshot${behind === 1 ? '' : 's'}`}>
            <ItemContent
              isDisabled={behind === 0 || loadingPull}
              icon={loadingPull ? 'spin fa-refresh' : 'cloud-download'}
              label={loadingPull ? 'Pulling Snapshots...' : `Pull ${behind || ''} Snapshot${behind === 1 ? '' : 's'}`}
              onClick={handlePull}
            />
          </DropdownItem>
          <DropdownItem aria-label={loadingPush ? 'Pushing Snapshots...' : `Push ${ahead || ''} Snapshot${ahead === 1 ? '' : 's'}`}>
            <ItemContent
              isDisabled={ahead === 0 || loadingPush}
              icon={loadingPush ? 'spin fa-refresh' : 'cloud-upload'}
              label={loadingPush ? 'Pushing Snapshots...' : `Push ${ahead || ''} Snapshot${ahead === 1 ? '' : 's'}`}
              onClick={handlePush}
            />
          </DropdownItem>
        </DropdownSection>
      </Dropdown>
      {isGitRepoSettingsModalOpen && (
        <GitRepositorySettingsModal
          onHide={() => setIsGitRepoSettingsModalOpen(false)}
        />
      )}
      {isSyncDeleteModalOpen && (
        <SyncDeleteModal
          vcs={vcs}
          onHide={() => {
            refreshVCSAndRefetchRemote();
            setIsSyncDeleteModalOpen(false);
          }}
        />
      )}
      {isSyncBranchesModalOpen && (
        <SyncBranchesModal
          vcs={vcs}
          onHide={() => {
            refreshVCSAndRefetchRemote();
            setIsSyncBranchesModalOpen(false);
          }}
        />
      )}
      {isSyncStagingModalOpen && (
        <SyncStagingModal
          vcs={vcs}
          branch={currentBranch}
          onSnapshot={refreshVCSAndRefetchRemote}
          handlePush={handlePush}
          onHide={() => setIsSyncStagingModalOpen(false)}
        />
      )}
      {/* {isSyncMergeModalOpen && (
        <SyncMergeModal
          onHide={() => setIsSyncMergeModalOpen(false)}
        />
      )} */}
      {isSyncHistoryModalOpen && (
        <SyncHistoryModal
          vcs={vcs}
          branch={currentBranch}
          history={history}
          onHide={() => setIsSyncHistoryModalOpen(false)}
        />
      )}
    </div>
  );
};
