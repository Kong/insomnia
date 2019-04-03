// @flow
import * as React from 'react';
import { join as pathJoin } from 'path';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import type { Workspace } from '../../../models/workspace';
import { showModal, showPrompt } from '../modals';
import SyncStagingModal from '../modals/sync-staging-modal';
import { FileSystemDriver, VCS } from 'insomnia-sync';
import { session } from 'insomnia-account';
import * as db from '../../../common/database';
import type { BaseModel } from '../../../models';
import * as models from '../../../models';
import { getDataDirectory } from '../../../common/misc';
import HelpTooltip from '../help-tooltip';
import Link from '../base/link';
import SyncHistoryModal from '../modals/sync-history-modal';
import type { Snapshot, Status } from 'insomnia-sync/src/types';
import Tooltip from '../tooltip';
import SyncShareModal from '../modals/sync-share-modal';

const MODEL_WHITELIST = {
  [models.workspace.type]: true,
  [models.request.type]: true,
  [models.requestGroup.type]: true,
  [models.environment.type]: true,
};

type Props = {
  workspace: Workspace,

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
};

@autobind
class SyncDropdown extends React.PureComponent<Props, State> {
  vcs: VCS;
  checkInterval: IntervalID;

  constructor(props: Props) {
    super(props);
    this.state = {
      localBranches: [],
      currentBranch: '',
      ahead: 0,
      behind: 0,
      initializing: true,
      status: {
        key: 'n/a',
        stage: {},
        unstaged: {},
      },
    };
  }

  async setupVCS() {
    const { workspace } = this.props;
    const directory = pathJoin(getDataDirectory(), 'version-control');
    const driver = new FileSystemDriver({ directory });
    this.vcs = new VCS(driver);

    if (session.isLoggedIn()) {
      await this.vcs.setSession({
        accountId: session.getAccountId(),
        sessionId: session.getCurrentSessionId(),
        privateKey: session.getPrivateKey(),
        publicKey: session.getPublicKey(),
      });
    }

    await this.vcs.switchProject(workspace._id, workspace.name);
  }

  async refreshMainAttributes() {
    const localBranches = (await this.vcs.getBranches()).sort();
    const currentBranch = await this.vcs.getBranch();

    const { ahead, behind } = await this.vcs.compareRemoteBranch();
    const items = await this.generateStatusItems();
    const status = await this.vcs.status(items);

    this.setState({
      ahead,
      behind,
      status,
      localBranches,
      currentBranch,
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { workspace } = this.props;
    if (prevProps.workspace._id !== workspace._id) {
      this.vcs
        .switchProject(workspace._id, workspace.name)
        .catch(err => console.log('[sync_menu] Error switching sync project', err))
        .finally(() => this.setState({ initializing: false }));
    }
  }

  componentDidMount() {
    this.setState({ initializing: true });
    this.setupVCS()
      .then(this.refreshMainAttributes)
      .catch(err => console.log('[sync_menu] Error refreshing sync state', err))
      .finally(() => this.setState({ initializing: false }));

    this.checkInterval = setInterval(this.refreshMainAttributes, 1000 * 60);
  }

  componentWillUnmount() {
    clearInterval(this.checkInterval);
  }

  async generateStatusItems(): Promise<Array<{ key: string, name: string, document: Object }>> {
    const { workspace } = this.props;

    const items = [];
    const allDocs = await db.withDescendants(workspace);
    const docs = allDocs.filter(d => MODEL_WHITELIST[d.type] && !(d: any).isPrivate);

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

  _handleCreateBranch() {
    showPrompt({
      title: 'Branch Name',
      submitName: 'Create Branch',
      label: 'Name',
      placeholder: 'my-branch-name',
      validate: name => this.vcs.validateBranchName(name),
      onComplete: async name => {
        await this.vcs.fork(name);
        await this._handleSwitchBranch(name);
      },
    });
  }

  _handleShowStagingModal() {
    showModal(SyncStagingModal, {
      vcs: this.vcs,
      onPush: async () => {
        await this.refreshMainAttributes();
      },
    });
  }

  async _handleShowSharingModal() {
    const teams = await this.vcs._queryTeams();
    const projectTeams = await this.vcs._queryProjectTeams();
    showModal(SyncShareModal, {
      teams,
      team: projectTeams[0] || null,
      handleShare: async team => {
        await this.vcs.shareWithTeam(team.id);
      },
      handleUnShare: async () => {
        await this.vcs.unShareWithTeam();
      },
    });
  }

  async _handlePullChanges() {
    const items = await this.generateStatusItems();
    const delta = await this.vcs.pull(items);
    await SyncDropdown.syncDatabase(delta);
  }

  async _handleRollback(snapshot: Snapshot) {
    const items = await this.generateStatusItems();
    const delta = await this.vcs.rollback(snapshot.id, items);
    await SyncDropdown.syncDatabase(delta);
  }

  _handleShowHistoryModal() {
    showModal(SyncHistoryModal, {
      vcs: this.vcs,
      handleRollback: this._handleRollback,
    });
  }

  async _handleOpen() {
    await this.refreshMainAttributes();
  }

  async _handleSwitchBranch(branch: string) {
    const items = await this.generateStatusItems();
    const delta = await this.vcs.checkout(items, branch);
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
    const { localBranches, currentBranch, ahead, behind, status } = this.state;

    const canCreateSnapshot =
      Object.keys(status.stage).length > 0 || Object.keys(status.unstaged).length > 0;

    const visibleBranches = localBranches.filter(b => !b.match(/\.hidden$/));
    const aheadPlusDirty = canCreateSnapshot ? ahead + 1 : ahead;

    return (
      <div className={className}>
        <Dropdown wide className="wide tall" onOpen={this._handleOpen}>
          <DropdownButton className="btn btn--compact wide">{this.renderButton()}</DropdownButton>

          <DropdownDivider>
            Version Control{' '}
            <HelpTooltip>
              Manage the history of a workspace{' '}
              <Link href="https://support.insomnia.rest/article/67-version-control">
                <span className="no-wrap">
                  Help <i className="fa fa-external-link" />
                </span>
              </Link>
            </HelpTooltip>
          </DropdownDivider>

          <DropdownItem onClick={this._handleCreateBranch}>
            <i className="fa fa-code-fork" />
            New Branch
          </DropdownItem>

          <DropdownItem onClick={this._handleShowSharingModal}>
            <i className="fa fa-share" />
            Share
          </DropdownItem>

          <DropdownDivider>{currentBranch}</DropdownDivider>

          <DropdownItem onClick={this._handleShowStagingModal} disabled={aheadPlusDirty === 0}>
            <i className="fa fa-cloud-upload" />
            Push {aheadPlusDirty} Snapshot{aheadPlusDirty !== 1 ? 's' : ''}
          </DropdownItem>

          <DropdownItem onClick={this._handlePullChanges} disabled={behind === 0}>
            <i className="fa fa-cloud-download" />
            Pull {behind} Snapshot{behind !== 1 ? 's' : ''}
          </DropdownItem>

          <DropdownItem onClick={this._handleShowHistoryModal}>
            <i className="fa fa-clock-o" />
            View History
          </DropdownItem>

          <DropdownDivider>Branches</DropdownDivider>
          {visibleBranches.map(this.renderBranch)}
        </Dropdown>
      </div>
    );
  }
}

export default SyncDropdown;
