// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import type { Workspace } from '../../../models/workspace';
import { showModal } from '../modals';
import SyncStagingModal from '../modals/sync-staging-modal';
import { VCS, FileSystemDriver } from 'insomnia-sync';
import * as session from '../../../sync/session';
import * as db from '../../../common/database';
import * as models from '../../../models';
import type { BaseModel } from '../../../models';

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
    this.setupVCS();
    this.state = {
      localBranches: [],
      currentBranch: '',
    };
  }

  setupVCS() {
    const driver = new FileSystemDriver({ directory: '/Users/gschier/Desktop/vcs' });
    const author = session.getAccountId() || 'account_1';
    this.vcs = new VCS(
      'prj_15e703454c1841a79c88d5244fa0f2e5',
      driver,
      author,
      'http://localhost:8000/graphql/',
      session.getCurrentSessionId(),
    );
  }

  async refreshMainAttributes() {
    const localBranches = await this.vcs.getBranches();
    const currentBranch = await this.vcs.getBranch();

    this.setState({
      localBranches,
      currentBranch,
    });
  }

  componentDidMount() {
    this.refreshMainAttributes().catch(err => {
      if (err) {
        console.log('[sync_menu] Error refreshing sync state', err);
      }
    });
  }

  async generateStatusItems(): Promise<Array<{ key: string, name: string, content: Object }>> {
    const { workspace } = this.props;

    const items = [];
    const allDocs = await db.withDescendants(workspace);
    const docs = allDocs.filter(d => MODEL_WHITELIST[d.type] && !(d: any).isPrivate);

    for (const doc of docs) {
      items.push({
        key: doc._id,
        name: (doc: any).name || 'No Name',
        content: doc,
      });
    }

    return items;
  }

  async syncDatabase() {
    const items = await this.generateStatusItems();
    const itemsMap = {};
    for (const item of items) {
      itemsMap[item.key] = item.content;
    }

    db.bufferChanges();
    const delta = await this.vcs.delta(items);

    const { deleted, updated, added } = delta;

    const promises = [];
    for (const doc: BaseModel of updated) {
      promises.push(db.update(doc));
    }

    for (const doc: BaseModel of added) {
      promises.push(db.insert(doc));
    }

    for (const id of deleted) {
      const doc = itemsMap[id];
      promises.push(db.unsafeRemove(doc));
    }

    await Promise.all(promises);
    await db.flushChanges();
  }

  _handleShowStagingModal() {
    showModal(SyncStagingModal, { vcs: this.vcs });
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
    await this.vcs.checkout(branch);
    await this.syncDatabase();
    this.setState({ currentBranch: branch });
  }

  renderBranch(branch: string) {
    const { currentBranch } = this.state;

    const icon =
      branch === currentBranch ? (
        <i className="fa fa-tag" />
      ) : (
        <i className="fa fa-tag ultra-faint" />
      );

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

          <DropdownDivider>Branch: {currentBranch}</DropdownDivider>
          <DropdownItem onClick={this._handlePush}>
            <i className="fa fa-upload" />
            Push Snapshots
          </DropdownItem>

          <DropdownItem onClick={this._handleShowStagingModal}>
            <i className="fa fa-cube" />
            Create Snapshot
          </DropdownItem>

          <DropdownDivider>Branches</DropdownDivider>
          {localBranches.map(this.renderBranch)}
        </Dropdown>
      </div>
    );
  }
}

export default SyncDropdown;
