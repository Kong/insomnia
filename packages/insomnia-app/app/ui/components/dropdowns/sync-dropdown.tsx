import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { Fragment, PureComponent } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import * as session from '../../../account/session';
import { AUTOBIND_CFG, DEFAULT_BRANCH_NAME } from '../../../common/constants';
import { database as db } from '../../../common/database';
import { docsVersionControl } from '../../../common/documentation';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { isRemoteProject, Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { WorkspaceMeta } from '../../../models/workspace-meta';
import { Snapshot, Status, StatusCandidate } from '../../../sync/types';
import { pushSnapshotOnInitialize } from '../../../sync/vcs/initialize-backend-project';
import { logCollectionMovedToProject } from '../../../sync/vcs/migrate-collections';
import { BackendProjectWithTeam } from '../../../sync/vcs/normalize-backend-project-team';
import { pullBackendProject } from '../../../sync/vcs/pull-backend-project';
import { interceptAccessError } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import { RootState } from '../../redux/modules';
import { activateWorkspace } from '../../redux/modules/workspace';
import { selectRemoteProjects } from '../../redux/selectors';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import Link from '../base/link';
import PromptButton from '../base/prompt-button';
import HelpTooltip from '../help-tooltip';
import { showAlert, showModal } from '../modals';
import ErrorModal from '../modals/error-modal';
import LoginModal from '../modals/login-modal';
import SyncBranchesModal from '../modals/sync-branches-modal';
import SyncDeleteModal from '../modals/sync-delete-modal';
import SyncHistoryModal from '../modals/sync-history-modal';
import SyncStagingModal from '../modals/sync-staging-modal';
import Tooltip from '../tooltip';

// Stop refreshing if user hasn't been active in this long
const REFRESH_USER_ACTIVITY = 1000 * 60 * 10;
// Refresh dropdown periodically
const REFRESH_PERIOD = 1000 * 60 * 1;

type ReduxProps = ReturnType<typeof mapStateToProps> & ReturnType<typeof mapDispatchToProps>;

const mapStateToProps = (state: RootState) => ({
  remoteProjects: selectRemoteProjects(state),
});

const mapDispatchToProps = dispatch => {
  const bound = bindActionCreators({ activateWorkspace }, dispatch);
  return {
    handleActivateWorkspace: bound.activateWorkspace,
  };
};

interface Props extends ReduxProps {
  workspace: Workspace;
  workspaceMeta?: WorkspaceMeta;
  project: Project;
  vcs: VCS;
  syncItems: StatusCandidate[];
  className?: string;
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

@autoBindMethodsForReact(AUTOBIND_CFG)
class UnconnectedSyncDropdown extends PureComponent<Props, State> {
  checkInterval: NodeJS.Timeout | null = null;
  refreshOnNextSyncItems = false;
  lastUserActivity = Date.now();

  state: State = {
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
  }

  async refreshMainAttributes(extraState: Partial<State> = {}) {
    const { vcs, syncItems, workspace, project } = this.props;

    if (!vcs.hasBackendProject() && isRemoteProject(project)) {
      const remoteBackendProjects = await vcs.remoteBackendProjectsInAnyTeam();
      const matchedBackendProjects = remoteBackendProjects.filter(p => p.rootDocumentId === workspace._id);
      this.setState({
        remoteBackendProjects: matchedBackendProjects,
      });
      return;
    }

    const localBranches = (await vcs.getBranches()).sort();
    const currentBranch = await vcs.getBranch();
    const historyCount = await vcs.getHistoryCount();
    const status = await vcs.status(syncItems, {});
    const newState: Partial<State> = {
      status,
      historyCount,
      localBranches,
      currentBranch,
      ...extraState,
    };

    // Do the remote stuff
    if (session.isLoggedIn()) {
      try {
        newState.compare = await vcs.compareRemoteBranch();
      } catch (err) {
        console.log('Failed to compare remote branches', err.message);
      }
    }

    this.setState(prevState => ({ ...prevState, ...newState }));
  }

  async componentDidMount() {
    this.setState({
      initializing: true,
    });

    const { vcs, workspace, workspaceMeta, project } = this.props;

    try {
      await pushSnapshotOnInitialize({ vcs, workspace, workspaceMeta, project });
      await this.refreshMainAttributes();
    } catch (err) {
      console.log('[sync_menu] Error refreshing sync state', err);
    } finally {
      this.setState({
        initializing: false,
      });
    }

    // Refresh but only if the user has been active in the last n minutes
    this.checkInterval = setInterval(async () => {
      if (Date.now() - this.lastUserActivity < REFRESH_USER_ACTIVITY) {
        await this.refreshMainAttributes();
      }
    }, REFRESH_PERIOD);
    document.addEventListener('mousemove', this._handleUserActivity);
  }

  componentWillUnmount() {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
    }
    document.removeEventListener('mousemove', this._handleUserActivity);
  }

  componentDidUpdate(prevProps: Props) {
    const { vcs, syncItems } = this.props;

    // Update if new sync items
    if (syncItems !== prevProps.syncItems) {
      if (vcs.hasBackendProject()) {
        vcs.status(syncItems, {}).then(status => {
          this.setState({
            status,
          });
        });
      }

      if (this.refreshOnNextSyncItems) {
        this.refreshMainAttributes();
        this.refreshOnNextSyncItems = false;
      }
    }
  }

  _handleUserActivity() {
    this.lastUserActivity = Date.now();
  }

  _handleShowBranchesModal() {
    showModal(SyncBranchesModal, {
      onHide: this.refreshMainAttributes,
    });
  }

  _handleShowStagingModal() {
    showModal(SyncStagingModal, {
      onSnapshot: async () => {
        await this.refreshMainAttributes();
      },
      handlePush: async () => {
        await this._handlePushChanges();
      },
    });
  }

  static _handleShowLoginModal() {
    showModal(LoginModal);
  }

  async _handlePushChanges() {
    const { vcs, project: { remoteId } } = this.props;
    this.setState({
      loadingPush: true,
    });

    try {
      const branch = await vcs.getBranch();
      await interceptAccessError({
        callback: async () => await vcs.push(remoteId),
        action: 'push',
        resourceName: branch,
        resourceType: 'branch',
      });
    } catch (err) {
      showModal(ErrorModal, {
        title: 'Push Error',
        message: err.message,
      });
    }

    await this.refreshMainAttributes({
      loadingPush: false,
    });
  }

  async _handlePullChanges() {
    const { vcs, syncItems, project: { remoteId } } = this.props;
    this.setState({
      loadingPull: true,
    });

    try {
      const branch = await vcs.getBranch();
      const delta = await interceptAccessError({
        callback: async () => await vcs.pull(syncItems, remoteId),
        action: 'pull',
        resourceName: branch,
        resourceType: 'branch',
      });
      // @ts-expect-error -- TSCONVERSION
      await db.batchModifyDocs(delta);
      this.refreshOnNextSyncItems = true;
    } catch (err) {
      showModal(ErrorModal, {
        title: 'Pull Error',
        message: err.message,
      });
    }

    this.setState({
      loadingPull: false,
    });
  }

  async _handleRollback(snapshot: Snapshot) {
    const { vcs, syncItems } = this.props;
    const delta = await vcs.rollback(snapshot.id, syncItems);
    // @ts-expect-error -- TSCONVERSION
    await db.batchModifyDocs(delta);
    this.refreshOnNextSyncItems = true;
  }

  async _handleRevert() {
    const { vcs, syncItems } = this.props;

    try {
      const delta = await vcs.rollbackToLatest(syncItems);
      // @ts-expect-error -- TSCONVERSION
      await db.batchModifyDocs(delta);
    } catch (err) {
      showModal(ErrorModal, {
        title: 'Revert Error',
        message: err.message,
      });
    }
  }

  _handleShowHistoryModal() {
    showModal(SyncHistoryModal, {
      handleRollback: this._handleRollback,
    });
  }

  async _handleOpen() {
    await this.refreshMainAttributes();
  }

  async _handleEnableSync() {
    this.setState({
      loadingProjectPull: true,
    });
    const { vcs, workspace } = this.props;
    await vcs.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);
    await this.refreshMainAttributes({
      loadingProjectPull: false,
    });
  }

  _handleShowDeleteModal() {
    showModal(SyncDeleteModal, {
      onHide: this.refreshMainAttributes,
    });
  }

  async _handleSetProject(backendProject: BackendProjectWithTeam) {
    const { vcs, remoteProjects, project, workspace, handleActivateWorkspace } = this.props;
    this.setState({
      loadingProjectPull: true,
    });

    const pulledIntoProject = await pullBackendProject({ vcs, backendProject, remoteProjects });
    if (pulledIntoProject._id !== project._id) {
      // If pulled into a different project, reactivate the workspace
      await handleActivateWorkspace({ workspaceId: workspace._id });
      logCollectionMovedToProject(workspace, pulledIntoProject);
    }

    await this.refreshMainAttributes({
      loadingProjectPull: false,
    });
  }

  async _handleSwitchBranch(branch: string) {
    const { vcs, syncItems } = this.props;

    try {
      const delta = await vcs.checkout(syncItems, branch);

      if (branch === DEFAULT_BRANCH_NAME) {
        const { historyCount } = this.state;
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
      showAlert({
        title: 'Branch Switch Error',
        message: err.message,
      });
    }

    // We can't refresh now because we won't yet have the new syncItems
    this.refreshOnNextSyncItems = true;
    // Still need to do this in case sync items don't change
    this.setState({
      currentBranch: branch,
    });
  }

  renderBranch(branch: string) {
    const { currentBranch } = this.state;
    const icon =
      branch === currentBranch ? <i className="fa fa-tag" /> : <i className="fa fa-empty" />;
    const isCurrentBranch = branch === currentBranch;
    return (
      // @ts-expect-error -- TSCONVERSION
      <DropdownItem
        key={branch}
        onClick={isCurrentBranch ? null : () => this._handleSwitchBranch(branch)}
        className={classnames({
          bold: isCurrentBranch,
        })}
        title={isCurrentBranch ? null : `Switch to "${branch}"`}
      >
        {icon}
        {branch}
      </DropdownItem>
    );
  }

  renderButton() {
    const {
      currentBranch,
      compare: { ahead, behind },
      initializing,
      status,
      loadingPull,
      loadingPush,
    } = this.state;
    const canPush = ahead > 0;
    const canPull = behind > 0;
    const canCreateSnapshot =
      Object.keys(status.stage).length > 0 || Object.keys(status.unstaged).length > 0;
    const loadIcon = <i className="fa fa-spin fa-refresh fa--fixed-width" />;
    const pullToolTipMsg = canPull
      ? `There ${behind === 1 ? 'is' : 'are'} ${behind} snapshot${behind === 1 ? '' : 's'} to pull`
      : 'No changes to pull';
    const pushToolTipMsg = canPush
      ? `There ${ahead === 1 ? 'is' : 'are'} ${ahead} snapshot${ahead === 1 ? '' : 's'} to push`
      : 'No changes to push';
    const snapshotToolTipMsg = canCreateSnapshot ? 'Local changes made' : 'No local changes made';

    if (currentBranch === null) {
      return <Fragment>Sync</Fragment>;
    }

    return (
      <DropdownButton
        className="btn--clicky-small btn-sync btn-utility wide text-left overflow-hidden row-spaced"
        disabled={initializing}
      >
        <div className="ellipsis">
          <i className="fa fa-code-fork space-right" />{' '}
          {initializing ? 'Initializing...' : currentBranch}
        </div>
        <div className="space-left">
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
    );
  }

  render() {
    if (!session.isLoggedIn()) {
      return null;
    }

    const { className, vcs } = this.props;
    const {
      localBranches,
      currentBranch,
      status,
      historyCount,
      loadingPull,
      loadingPush,
      loadingProjectPull,
      remoteBackendProjects,
      compare: { ahead, behind },
    } = this.state;
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
        <div className={className}>
          <button className="btn btn--compact wide">
            <i className="fa fa-refresh fa-spin" /> Initializing
          </button>
        </div>
      );
    }

    if (!vcs.hasBackendProject()) {
      return (
        <div className={className}>
          <Dropdown className="wide tall" onOpen={this._handleOpen}>
            <DropdownButton className="btn btn--compact wide">
              <i className="fa fa-code-fork " /> Setup Sync
            </DropdownButton>
            {syncMenuHeader}
            {remoteBackendProjects.length === 0 && (
              <DropdownItem onClick={this._handleEnableSync}>
                <i className="fa fa-plus-circle" /> Create Locally
              </DropdownItem>
            )}
            {remoteBackendProjects.map(p => (
              <DropdownItem key={p.id} onClick={() => this._handleSetProject(p)}>
                <i className="fa fa-cloud-download" /> Pull <strong>{p.name}</strong>
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      );
    }

    return (
      <div className={className}>
        <Dropdown className="wide tall" onOpen={this._handleOpen}>
          {this.renderButton()}

          {syncMenuHeader}

          {!session.isLoggedIn() && (
            <DropdownItem onClick={SyncDropdown._handleShowLoginModal}>
              <i className="fa fa-sign-in" /> Log In
            </DropdownItem>
          )}

          <DropdownItem onClick={this._handleShowBranchesModal}>
            <i className="fa fa-code-fork" />
            Branches
          </DropdownItem>

          <DropdownItem onClick={this._handleShowDeleteModal} disabled={historyCount === 0}>
            <i className="fa fa-remove" />
            Delete {strings.collection.singular}
          </DropdownItem>

          <DropdownDivider>Local Branches</DropdownDivider>
          {visibleBranches.map(this.renderBranch)}

          <DropdownDivider>{currentBranch}</DropdownDivider>

          <DropdownItem onClick={this._handleShowHistoryModal} disabled={historyCount === 0}>
            <i className="fa fa-clock-o" />
            History
          </DropdownItem>

          <DropdownItem
            onClick={this._handleRevert}
            buttonClass={PromptButton}
            stayOpenAfterClick
            disabled={!canCreateSnapshot || historyCount === 0}
          >
            <i className="fa fa-undo" />
            Revert Changes
          </DropdownItem>

          <DropdownItem onClick={this._handleShowStagingModal} disabled={!canCreateSnapshot}>
            <i className="fa fa-cube" />
            Create Snapshot
          </DropdownItem>

          <DropdownItem onClick={this._handlePullChanges} disabled={behind === 0 || loadingPull}>
            {loadingPull ? (
              <Fragment>
                <i className="fa fa-spin fa-refresh" /> Pulling Snapshots...
              </Fragment>
            ) : (
              <Fragment>
                <i className="fa fa-cloud-upload" /> Pull {behind || ''} Snapshot
                {behind === 1 ? '' : 's'}
              </Fragment>
            )}
          </DropdownItem>

          <DropdownItem onClick={this._handlePushChanges} disabled={ahead === 0 || loadingPush}>
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
  }
}

const SyncDropdown = connect(mapStateToProps, mapDispatchToProps)(UnconnectedSyncDropdown);
export default SyncDropdown;
