// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import type { Workspace } from '../../../models/workspace';
import { showAlert, showModal } from '../modals';
import SyncStagingModal from '../modals/sync-staging-modal';
import { batchModifyDocs } from '../../../common/database';
import HelpTooltip from '../help-tooltip';
import Link from '../base/link';
import SyncHistoryModal from '../modals/sync-history-modal';
import SyncShareModal from '../modals/sync-share-modal';
import SyncBranchesModal from '../modals/sync-branches-modal';
import VCS from '../../../sync/vcs';
import type { Snapshot, Status, StatusCandidate } from '../../../sync/types';
import ErrorModal from '../modals/error-modal';
import Tooltip from '../tooltip';
import LoginModal from '../modals/login-modal';
import * as session from '../../../account/session';
import PromptButton from '../base/prompt-button';

// Stop refreshing if user hasn't been active in this long
const REFRESH_USER_ACTIVITY = 1000 * 60 * 10;

// Refresh dropdown periodically
const REFRESH_PERIOD = 1000 * 60 * 1;

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
  loadingPush: boolean,
};

@autobind
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
      status: {
        key: 'n/a',
        stage: {},
        unstaged: {},
      },
    };
  }

  async refreshMainAttributes(extraState?: Object = {}) {
    const { vcs, syncItems } = this.props;
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
      vcs.status(syncItems, {}).then(status => {
        this.setState({ status });
      });

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
        error: err,
        message: 'Failed to push snapshots to remote',
      });
    }

    await this.refreshMainAttributes({ loadingPush: false });
  }

  async _handlePullChanges() {
    const { vcs, syncItems } = this.props;

    this.setState({ loadingPull: true });
    try {
      const delta = await vcs.pull(syncItems);
      await batchModifyDocs(delta);
      this.refreshOnNextSyncItems = true;
    } catch (err) {
      showModal(ErrorModal, {
        title: 'Pull Error',
        error: err,
        message: 'Failed to pull snapshots from remote',
      });
    }
    this.setState({ loadingPull: false });
  }

  async _handleRollback(snapshot: Snapshot) {
    const { vcs, syncItems } = this.props;
    const delta = await vcs.rollback(snapshot.id, syncItems);
    await batchModifyDocs(delta);
    this.refreshOnNextSyncItems = true;
  }

  async _handleRevert() {
    const { vcs, syncItems } = this.props;

    try {
      const delta = await vcs.rollbackToLatest(syncItems);
      await batchModifyDocs(delta);
    } catch (err) {
      showModal(ErrorModal, {
        title: 'Revert Error',
        error: err,
        message: 'Failed to revert changes',
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

  async _handleSwitchBranch(branch: string) {
    const { vcs, syncItems } = this.props;
    try {
      const delta = await vcs.checkout(syncItems, branch);
      await batchModifyDocs(delta);
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

    if (currentBranch !== null) {
      return (
        <DropdownButton className="btn btn--compact wide text-left overflow-hidden row-spaced">
          <div className="ellipsis">
            <i className="fa fa-code-fork space-right" />{' '}
            {initializing ? 'Initializing...' : currentBranch}
          </div>
          <div className="space-left">
            <Tooltip message={snapshotToolTipMsg} delay={800}>
              <i
                className={classnames('icon fa fa-cube fa--fixed-width', {
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
                  <Tooltip message={pullToolTipMsg} delay={800}>
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
                  <Tooltip message={pushToolTipMsg} delay={800}>
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
    } else {
      return <React.Fragment>Sync</React.Fragment>;
    }
  }

  render() {
    if (!session.isLoggedIn()) {
      return null;
    }

    const { className } = this.props;
    const {
      localBranches,
      currentBranch,
      status,
      historyCount,
      loadingPull,
      loadingPush,
      compare: { ahead, behind },
    } = this.state;

    const canCreateSnapshot =
      Object.keys(status.stage).length > 0 || Object.keys(status.unstaged).length > 0;

    const visibleBranches = localBranches.filter(b => !b.match(/\.hidden$/));

    return (
      <div className={className}>
        <Dropdown className="wide tall" onOpen={this._handleOpen}>
          {this.renderButton()}

          <DropdownDivider>
            Insomnia Sync{' '}
            <HelpTooltip>
              Sync and collaborate on workspaces{' '}
              <Link href="https://support.insomnia.rest/article/67-version-control">
                <span className="no-wrap">
                  <br />
                  Documentation <i className="fa fa-external-link" />
                </span>
              </Link>
            </HelpTooltip>
          </DropdownDivider>

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
