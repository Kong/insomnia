// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import type { Workspace } from '../../../models/workspace';
import { showModal } from '../modals';
import SyncStagingModal from '../modals/sync-staging-modal';
import { session } from 'insomnia-account';
import * as db from '../../../common/database';
import type { BaseModel } from '../../../models';
import * as models from '../../../models';
import HelpTooltip from '../help-tooltip';
import Link from '../base/link';
import SyncHistoryModal from '../modals/sync-history-modal';
import Tooltip from '../tooltip';
import SyncShareModal from '../modals/sync-share-modal';
import SyncBranchesModal from '../modals/sync-branches-modal';
import VCS from '../../../sync/vcs';
import type { Snapshot, Status, StatusCandidate } from '../../../sync/types';

type Props = {
  workspace: Workspace,
  vcs: VCS,

  // Optional
  className?: string,
};

type State = {
  currentBranch: string,
  localBranches: Array<string>,
  ahead: number,
  behind: number,
  status: Status,
  initializing: boolean,
  historyCount: number,
};

@autobind
class SyncDropdown extends React.PureComponent<Props, State> {
  checkInterval: IntervalID;

  constructor(props: Props) {
    super(props);
    this.state = {
      localBranches: [],
      currentBranch: '',
      ahead: 0,
      behind: 0,
      historyCount: 0,
      initializing: true,
      status: {
        key: 'n/a',
        stage: {},
        unstaged: {},
      },
    };
  }

  async refreshMainAttributes() {
    const { vcs } = this.props;
    const localBranches = (await vcs.getBranches()).sort();
    const currentBranch = await vcs.getBranch();
    const historyCount = await vcs.getHistoryCount();

    this.setState({
      historyCount,
      localBranches,
      currentBranch,
    });

    // Slow stuff next
    const items = await this.generateStatusItems();
    const status = await vcs.status(items);
    const { ahead, behind } = await vcs.compareRemoteBranch();

    this.setState({
      ahead,
      behind,
      status,
    });
  }

  componentDidMount() {
    this.setState({ initializing: true });
    this.refreshMainAttributes()
      .catch(err => console.log('[sync_menu] Error refreshing sync state', err))
      .finally(() => this.setState({ initializing: false }));

    this.checkInterval = setInterval(this.refreshMainAttributes, 1000 * 60);
  }

  componentWillUnmount() {
    clearInterval(this.checkInterval);
  }

  async generateStatusItems(): Promise<Array<StatusCandidate>> {
    const { workspace } = this.props;

    const items = [];
    const allDocs = await db.withDescendants(workspace);
    const docs = allDocs.filter(models.canSync);

    for (const doc of docs) {
      items.push({
        key: doc._id,
        name: (doc: any).name || 'No Name',
        document: doc,
      });
    }

    return items;
  }

  static async syncDatabase(delta: { upsert: Array<Object>, remove: Array<Object> }) {
    const { upsert, remove } = delta;
    const flushId = await db.bufferChanges();

    const promisesUpserted = [];
    const promisesDeleted = [];
    for (const doc: BaseModel of upsert) {
      promisesUpserted.push(db.upsert(doc, true));
    }

    for (const doc: BaseModel of remove) {
      promisesDeleted.push(db.unsafeRemove(doc, true));
    }

    // Perform from least to most dangerous
    await Promise.all(promisesUpserted);
    await Promise.all(promisesDeleted);

    await db.flushChanges(flushId);
  }

  static _handleCreateBranch() {
    showModal(SyncBranchesModal);
  }

  _handleShowStagingModal() {
    showModal(SyncStagingModal, {
      onPush: async () => {
        await this.refreshMainAttributes();
      },
    });
  }

  static _handleShowSharingModal() {
    showModal(SyncShareModal);
  }

  async _handlePullChanges() {
    const { vcs } = this.props;
    const items = await this.generateStatusItems();
    const delta = await vcs.pull(items);
    await SyncDropdown.syncDatabase(delta);
  }

  async _handleRollback(snapshot: Snapshot) {
    const { vcs } = this.props;
    const items = await this.generateStatusItems();
    const delta = await vcs.rollback(snapshot.id, items);
    await SyncDropdown.syncDatabase(delta);
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
    const { vcs } = this.props;
    const items = await this.generateStatusItems();
    const delta = await vcs.checkout(items, branch);
    await SyncDropdown.syncDatabase(delta);
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
    const { currentBranch, behind, initializing } = this.state;
    if (currentBranch !== null) {
      return (
        <React.Fragment>
          {initializing ? (
            <React.Fragment>
              <i className="fa fa-refresh fa-spin" /> Initializing
            </React.Fragment>
          ) : (
            <React.Fragment>
              <i className="fa fa-code-fork" /> {currentBranch}
            </React.Fragment>
          )}
          {behind > 0 && (
            <Tooltip message="There are remote changes available to pull">
              <i className="fa fa-asterisk space-left" />
            </Tooltip>
          )}
        </React.Fragment>
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
    const { localBranches, currentBranch, ahead, behind, status, historyCount } = this.state;

    const canCreateSnapshot =
      Object.keys(status.stage).length > 0 || Object.keys(status.unstaged).length > 0;

    const visibleBranches = localBranches.filter(b => !b.match(/\.hidden$/));
    const aheadPlusDirty = canCreateSnapshot ? ahead + 1 : ahead;

    return (
      <div className={className}>
        <Dropdown wide className="wide tall" onOpen={this._handleOpen}>
          <DropdownButton className="btn btn--compact wide">{this.renderButton()}</DropdownButton>

          <DropdownDivider>
            Cloud Sync{' '}
            <HelpTooltip>
              Sync and collaborate on your workspaces{' '}
              <Link href="https://support.insomnia.rest/article/67-version-control">
                <span className="no-wrap">
                  <br />
                  Documentation <i className="fa fa-external-link" />
                </span>
              </Link>
            </HelpTooltip>
          </DropdownDivider>

          <DropdownItem onClick={SyncDropdown._handleCreateBranch}>
            <i className="fa fa-code-fork" />
            Branches
          </DropdownItem>

          <DropdownItem onClick={SyncDropdown._handleShowSharingModal}>
            <i className="fa fa-users" />
            Share Workspace
          </DropdownItem>

          <DropdownDivider>Branches</DropdownDivider>
          {visibleBranches.map(this.renderBranch)}

          <DropdownDivider>{currentBranch}</DropdownDivider>

          {historyCount > 0 && (
            <DropdownItem onClick={this._handleShowHistoryModal}>
              <i className="fa fa-clock-o" />
              View History
            </DropdownItem>
          )}

          <DropdownItem onClick={this._handleShowStagingModal} disabled={aheadPlusDirty === 0}>
            <i className="fa fa-cloud-upload" />
            Push Changes
          </DropdownItem>

          <DropdownItem onClick={this._handlePullChanges} disabled={behind === 0}>
            <i className="fa fa-cloud-download" />
            Pull Changes
          </DropdownItem>
        </Dropdown>
      </div>
    );
  }
}

export default SyncDropdown;
