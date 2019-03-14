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
import * as session from '../../../sync/session';
import * as db from '../../../common/database';
import type { BaseModel } from '../../../models';
import * as models from '../../../models';
import { getDataDirectory } from '../../../common/misc';
import HelpTooltip from '../help-tooltip';
import Link from '../base/link';
import SyncHistoryModal from '../modals/sync-history-modal';

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
};

@autobind
class SyncDropdown extends React.PureComponent<Props, State> {
  vcs: VCS;

  constructor(props: Props) {
    super(props);
    this.state = {
      localBranches: [],
      currentBranch: '',
    };
  }

  setupVCS() {
    const { workspace } = this.props;
    const directory = pathJoin(getDataDirectory(), 'version-control');
    const driver = new FileSystemDriver({ directory });
    const author = session.getAccountId() || 'account_1';

    this.vcs = new VCS(
      workspace._id,
      driver,
      author,
      'http://localhost:8000/graphql/',
      session.getCurrentSessionId(),
    );
  }

  async refreshMainAttributes() {
    const localBranches = (await this.vcs.getBranches()).sort();
    const currentBranch = await this.vcs.getBranch();

    this.setState({
      localBranches,
      currentBranch,
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { workspace } = this.props;
    if (prevProps.workspace._id !== workspace._id) {
      this.setupVCS();
    }
  }

  componentDidMount() {
    this.setupVCS();
    this.refreshMainAttributes().catch(err => {
      if (err) {
        console.log('[sync_menu] Error refreshing sync state', err);
      }
    });
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

  async syncDatabase(delta: { add: Array<Object>, update: Array<Object>, remove: Array<Object> }) {
    const { add, update, remove } = delta;
    const flushId = await db.bufferChanges();

    const promisesAdded = [];
    const promisesUpdated = [];
    const promisesDeleted = [];
    for (const doc: BaseModel of update) {
      promisesUpdated.push(db.update(doc, true));
    }

    for (const doc: BaseModel of add) {
      promisesAdded.push(db.insert(doc, true));
    }

    for (const doc: BaseModel of remove) {
      promisesDeleted.push(db.unsafeRemove(doc, true));
    }

    // Perform from least to most dangerous
    await Promise.all(promisesAdded);
    await Promise.all(promisesUpdated);
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
    showModal(SyncStagingModal, { vcs: this.vcs });
  }

  _handleShowHistoryModal() {
    showModal(SyncHistoryModal, { vcs: this.vcs });
  }

  async _handleRevertChanges() {
    const items = await this.generateStatusItems();
    const delta = await this.vcs.revert(items);
    await this.syncDatabase(delta);
  }

  async _handlePush() {
    try {
      await this.vcs.push();
    } catch (err) {
      console.log('[sync] Failed to push', err);
    }
  }

  async _handleOpen() {
    await this.refreshMainAttributes();
  }

  async _handleSwitchBranch(branch: string) {
    const items = await this.generateStatusItems();
    const delta = await this.vcs.checkout(items, branch);
    await this.syncDatabase(delta);
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
    const { currentBranch } = this.state;
    if (currentBranch !== null) {
      return (
        <React.Fragment>
          <i className="fa fa-code-fork" /> {currentBranch}
        </React.Fragment>
      );
    } else {
      return <React.Fragment>Sync</React.Fragment>;
    }
  }

  render() {
    const { className } = this.props;
    const { localBranches, currentBranch } = this.state;

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
          <DropdownItem>
            <i className="fa fa-cog" />
            Configure
          </DropdownItem>

          <DropdownDivider>{currentBranch}</DropdownDivider>
          <DropdownItem onClick={this._handlePush}>
            <i className="fa fa-upload" />
            Push Changes
          </DropdownItem>

          <DropdownItem onClick={this._handleShowStagingModal}>
            <i className="fa fa-cube" />
            Create Snapshot
          </DropdownItem>

          <DropdownItem onClick={this._handleRevertChanges}>
            <i className="fa fa-undo" />
            Revert Changes
          </DropdownItem>

          <DropdownItem onClick={this._handleShowHistoryModal}>
            <i className="fa fa-clock-o" />
            View History
          </DropdownItem>

          <DropdownDivider>Branches</DropdownDivider>
          {localBranches.map(this.renderBranch)}
        </Dropdown>
      </div>
    );
  }
}

export default SyncDropdown;
