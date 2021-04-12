// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import classnames from 'classnames';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import type { Workspace } from '../../../models/workspace';
import { showAlert, showModal } from '../modals';
import SyncStagingModal from '../modals/sync-staging-modal';
import HelpTooltip from '../help-tooltip';
import Link from '../base/link';
import SyncHistoryModal from '../modals/sync-history-modal';
import SyncShareModal from '../modals/sync-share-modal';
import SyncBranchesModal from '../modals/sync-branches-modal';
import SyncDeleteModal from '../modals/sync-delete-modal';
import VCS from '../../../sync/vcs';
import type { Project, Snapshot, Status, StatusCandidate } from '../../../sync/types';
import ErrorModal from '../modals/error-modal';
import Tooltip from '../tooltip';
import LoginModal from '../modals/login-modal';
import * as session from '../../../account/session';
import PromptButton from '../base/prompt-button';
import * as db from '../../../common/database';
import * as models from '../../../models';
import { docsVersionControl } from '../../../common/documentation';
import { strings } from '../../../common/strings';

// Stop refreshing if user hasn't been active in this long
const REFRESH_USER_ACTIVITY = 1000 * 60 * 10;

// Refresh dropdown periodically
const REFRESH_PERIOD = 1000 * 60 * 1;

const DEFAULT_BRANCH_NAME = 'master';

type Props = {
  workspace: Workspace,
  vcs: VCS,
  syncItems: Array<StatusCandidate>,

  // Optional
  className?: string,
};

type State = {
  currentBranch: string,
  localBranches: Array<string>,
  compare: {
    ahead: number,
    behind: number,
  },
  status: Status,
  initializing: boolean,
  historyCount: number,
  loadingPull: boolean,
  loadingProjectPull: boolean,
  loadingPush: boolean,
  remoteProjects: Array<Project>,
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class SyncDropdown extends React.PureComponent<Props, State> {
  checkInterval: IntervalID;
  refreshOnNextSyncItems = false;
  lastUserActivity = Date.now();

  constructor(props: Props) {
    super(props);
    this.state = {
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
      remoteProjects: [],
    };
  }

  async refreshMainAttributes(extraState?: Object = {}) {
    const { vcs, syncItems, workspace } = this.props;

    if (!vcs.hasProject()) {
      const remoteProjects = await vcs.remoteProjects();
      const matchedProjects = remoteProjects.filter(p => p.rootDocumentId === workspace._id);
      this.setState({ remoteProjects: matchedProjects });
      return;
    }

    const localBranches = (await vcs.getBranches()).sort();
    const currentBranch = await vcs.getBranch();
    const historyCount = await vcs.getHistoryCount();
    const status = await vcs.status(syncItems, {});

    const newState = {
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

    this.setState(newState);
  }

  componentDidMount() {
    this.setState({ initializing: true });
    this.refreshMainAttributes()
      .catch(err => console.log('[sync_menu] Error refreshing sync state', err))
      .finally(() => this.setState({ initializing: false }));

    // Refresh but only if the user has been active in the last n minutes
    this.checkInterval = setInterval(async () => {
      if (Date.now() - this.lastUserActivity < REFRESH_USER_ACTIVITY) {
        await this.refreshMainAttributes();
      }
    }, REFRESH_PERIOD);

    document.addEventListener('mousemove', this._handleUserActivity);
  }

  componentWillUnmount() {
    clearInterval(this.checkInterval);
    document.removeEventListener('mousemove', this._handleUserActivity);
  }

  componentDidUpdate(prevProps: Props) {
    const { vcs, syncItems } = this.props;

    // Update if new sync items
    if (syncItems !== prevProps.syncItems) {
      if (vcs.hasProject()) {
        vcs.status(syncItems, {}).then(status => {
          this.setState({ status });
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

  static _handleShowSharingModal() {
    showModal(SyncShareModal);
  }

  static _handleShowLoginModal() {
    showModal(LoginModal);
  }

  async _handlePushChanges() {
    const { vcs } = this.props;
    this.setState({ loadingPush: true });

    try {
      await vcs.push();
    } catch (err) {
      showModal(ErrorModal, {
        title: 'Push Error',
        message: err.message,
      });
    }

    await this.refreshMainAttributes({ loadingPush: false });
  }

  async _handlePullChanges() {
    const { vcs, syncItems } = this.props;

    this.setState({ loadingPull: true });
    try {
      const delta = await vcs.pull(syncItems);
      await db.batchModifyDocs(delta);
      this.refreshOnNextSyncItems = true;
    } catch (err) {
      showModal(ErrorModal, {
        title: 'Pull Error',
        message: err.message,
      });
    }
    this.setState({ loadingPull: false });
  }

  async _handleRollback(snapshot: Snapshot) {
    const { vcs, syncItems } = this.props;
    const delta = await vcs.rollback(snapshot.id, syncItems);
    await db.batchModifyDocs(delta);
    this.refreshOnNextSyncItems = true;
  }

  async _handleRevert() {
    const { vcs, syncItems } = this.props;

    try {
      const delta = await vcs.rollbackToLatest(syncItems);
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
    this.setState({ loadingProjectPull: true });
    const { vcs, workspace } = this.props;
    await vcs.switchAndCreateProjectIfNotExist(workspace._id, workspace.name);
    await this.refreshMainAttributes({ loadingProjectPull: false });
  }

  _handleShowDeleteModal() {
    showModal(SyncDeleteModal, {
      onHide: this.refreshMainAttributes,
    });
  }

  async _handleSetProject(p: Project) {
    const { vcs } = this.props;
    this.setState({ loadingProjectPull: true });
    await vcs.setProject(p);

    await vcs.checkout([], DEFAULT_BRANCH_NAME);

    const remoteBranches = await vcs.getRemoteBranches();
    const defaultBranchMissing = !remoteBranches.includes(DEFAULT_BRANCH_NAME);

    // The default branch does not exist, so we create it and the workspace locally
    if (defaultBranchMissing) {
      const workspace: Workspace = await models.initModel(models.workspace.type, {
        _id: p.rootDocumentId,
        name: p.name,
      });

      await db.upsert(workspace);
    } else {
      // Pull changes
      await vcs.pull([]); // There won't be any existing docs since it's a new pull
      const flushId = await db.bufferChanges();
      for (const doc of await vcs.allDocuments()) {
        await db.upsert(doc);
      }
      await db.flushChanges(flushId);
    }

    await this.refreshMainAttributes({ loadingProjectPull: false });
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
          delta.remove = delta.remove.filter(e => e.type !== models.workspace.type);
        }
      }

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
    this.setState({ currentBranch: branch });
  }

  renderBranch(branch: string) {
    const { currentBranch } = this.state;

    const icon =
      branch === currentBranch ? <i className="fa fa-tag" /> : <i className="fa fa-empty" />;

    const isCurrentBranch = branch === currentBranch;
    return (
      <DropdownItem
        key={branch}
        onClick={isCurrentBranch ? null : () => this._handleSwitchBranch(branch)}
        className={classnames({ bold: isCurrentBranch })}
        title={isCurrentBranch ? null : `Switch to "${branch}"`}>
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
      return <React.Fragment>Sync</React.Fragment>;
    }

    return (
      <DropdownButton className="btn--clicky-small btn-sync btn-utility wide text-left overflow-hidden row-spaced">
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
            <React.Fragment>
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
            </React.Fragment>
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
      remoteProjects,
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

    if (!vcs.hasProject()) {
      return (
        <div className={className}>
          <Dropdown className="wide tall" onOpen={this._handleOpen}>
            <DropdownButton className="btn btn--compact wide">
              <i className="fa fa-code-fork " /> Setup Sync
            </DropdownButton>
            {syncMenuHeader}
            {remoteProjects.length === 0 && (
              <DropdownItem onClick={this._handleEnableSync}>
                <i className="fa fa-plus-circle" /> Create Local Project
              </DropdownItem>
            )}
            {remoteProjects.map(p => (
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

          <DropdownItem onClick={SyncDropdown._handleShowSharingModal}>
            <i className="fa fa-users" />
            Share Settings
          </DropdownItem>

          <DropdownItem onClick={this._handleShowBranchesModal}>
            <i className="fa fa-code-fork" />
            Branches
          </DropdownItem>

          <DropdownItem onClick={this._handleShowDeleteModal} disabled={historyCount === 0}>
            <i className="fa fa-remove" />
            Delete {strings.collection}
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
            disabled={!canCreateSnapshot || historyCount === 0}>
            <i className="fa fa-undo" />
            Revert Changes
          </DropdownItem>

          <DropdownItem onClick={this._handleShowStagingModal} disabled={!canCreateSnapshot}>
            <i className="fa fa-cube" />
            Create Snapshot
          </DropdownItem>

          <DropdownItem onClick={this._handlePullChanges} disabled={behind === 0 || loadingPull}>
            {loadingPull ? (
              <React.Fragment>
                <i className="fa fa-spin fa-refresh" /> Pulling Snapshots...
              </React.Fragment>
            ) : (
              <React.Fragment>
                <i className="fa fa-cloud-upload" /> Pull {behind || ''} Snapshot
                {behind === 1 ? '' : 's'}
              </React.Fragment>
            )}
          </DropdownItem>

          <DropdownItem onClick={this._handlePushChanges} disabled={ahead === 0 || loadingPush}>
            {loadingPush ? (
              <React.Fragment>
                <i className="fa fa-spin fa-refresh" /> Pushing Snapshots...
              </React.Fragment>
            ) : (
              <React.Fragment>
                <i className="fa fa-cloud-upload" /> Push {ahead || ''} Snapshot
                {ahead === 1 ? '' : 's'}
              </React.Fragment>
            )}
          </DropdownItem>
        </Dropdown>
      </div>
    );
  }
}

export default SyncDropdown;
