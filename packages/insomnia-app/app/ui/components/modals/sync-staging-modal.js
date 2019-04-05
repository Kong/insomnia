// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import { VCS, types as syncTypes } from 'insomnia-sync';
import type { Workspace } from '../../../models/workspace';
import * as db from '../../../common/database';
import type { BaseModel } from '../../../models';
import * as models from '../../../models';
import PromptButton from '../base/prompt-button';

type Props = {
  workspace: Workspace,
  vcs: VCS,
};

type State = {
  branch: string,
  actionBranch: string,
  branches: Array<string>,
  status: syncTypes.Status,
  message: string,
  error: string,
};

const WHITE_LIST = {
  [models.workspace.type]: true,
  [models.request.type]: true,
  [models.requestGroup.type]: true,
  [models.environment.type]: true,
};

@autobind
class SyncStagingModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  onPush: () => any;

  constructor(props: Props) {
    super(props);
    this.state = {
      branch: '',
      actionBranch: '',
      branches: [],
      status: {
        stage: {},
        unstaged: {},
        key: '',
      },
      error: '',
      message: '',
    };
  }

  _setModalRef(m: ?Modal) {
    this.modal = m;
  }

  _handleDone() {
    this.hide();
  }

  _handleClearError() {
    this.setState({ error: '' });
  }

  _handleMessageChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ message: e.currentTarget.value });
  }

  async _handleChangeActionBranch(e: SyntheticEvent<HTMLSelectElement>) {
    this.setState({ actionBranch: e.currentTarget.value });
  }

  async _handleRemoveBranch() {
    const { vcs } = this.props;
    const { actionBranch } = this.state;

    try {
      await vcs.removeBranch(actionBranch);
    } catch (err) {
      this.setState({ error: err.message });
      return;
    }

    await this.updateStatus({ actionBranch: '' });
  }

  async _handleMergeBranch() {
    const { vcs } = this.props;
    const { actionBranch } = this.state;
    const items = await this.generateStatusItems();

    let delta;
    try {
      delta = await vcs.merge(items, actionBranch);
    } catch (err) {
      this.setState({ error: `Failed to merge: ${err.message}` });
      return;
    }

    await this.syncDatabase(delta);
    await this.updateStatus();
  }

  async _handleStage(e: SyntheticEvent<HTMLInputElement>) {
    const { vcs } = this.props;
    const id = e.currentTarget.name;
    const statusItem = this.state.status.unstaged[id];
    await vcs.stage([statusItem]);
    await this.updateStatus();
  }

  async _handleStageAll() {
    const { vcs } = this.props;
    const { unstaged } = this.state.status;

    const items = [];
    for (const id of Object.keys(unstaged)) {
      items.push(unstaged[id]);
    }

    await vcs.stage(items);
    await this.updateStatus();
  }

  async _handleUnstageAll() {
    const { vcs } = this.props;
    const { stage } = this.state.status;
    const items = [];
    for (const id of Object.keys(stage)) {
      items.push(stage[id]);
    }

    await vcs.unstage(items);
    await this.updateStatus();
  }

  async _handleUnstage(e: SyntheticEvent<HTMLInputElement>) {
    const { vcs } = this.props;
    const id = e.currentTarget.name;
    const statusItem = this.state.status.stage[id];
    await vcs.unstage([statusItem]);
    await this.updateStatus();
  }

  async _handleTakeSnapshot() {
    const { vcs } = this.props;
    const { message } = this.state;
    try {
      await vcs.takeSnapshot(message);
    } catch (err) {
      this.setState({ error: err.message });
      return;
    }

    try {
      const { workspace } = this.props;
      await vcs.push(workspace);
    } catch (err) {
      this.setState({ error: err.message });
      return;
    }

    await this.updateStatus({ message: '', error: '' });

    if (this.onPush) {
      this.onPush();
    }
  }

  async generateStatusItems(): Promise<Array<syncTypes.StatusCandidate>> {
    const items = [];
    const allDocs = await db.withDescendants(this.props.workspace);
    const docs = allDocs.filter(d => WHITE_LIST[d.type] && !(d: any).isPrivate);

    for (const doc of docs) {
      items.push({
        key: doc._id,
        name: (doc: any).name || 'No Name',
        document: doc,
      });
    }

    return items;
  }

  async syncDatabase(delta?: { upsert: Array<BaseModel>, remove: Array<BaseModel> }) {
    const { vcs } = this.props;
    const items = await this.generateStatusItems();
    const itemsMap = {};
    for (const item of items) {
      itemsMap[item.key] = item.document;
    }

    const flushId = await db.bufferChanges();
    delta = delta || (await vcs.delta(items));

    const { remove, upsert } = delta;

    const promises = [];
    for (const doc: BaseModel of upsert) {
      promises.push(db.upsert(doc));
    }

    for (const doc: BaseModel of remove) {
      promises.push(db.unsafeRemove(doc));
    }

    await Promise.all(promises);
    await db.flushChanges(flushId);
  }

  async updateStatus(newState?: Object) {
    const { vcs } = this.props;
    const items = await this.generateStatusItems();
    const status = await vcs.status(items);
    const branch = await vcs.getBranch();
    const branches = await vcs.getBranches();

    this.setState({
      status,
      branch,
      branches,
      error: '',
      ...newState,
    });
  }

  hide() {
    this.modal && this.modal.hide();
  }

  async show(options: { vcs: VCS, onPush: () => any }) {
    this.onPush = options.onPush;
    this.modal && this.modal.show();
    await this.updateStatus();
  }

  static renderOperation(entry: syncTypes.StageEntry) {
    let name;
    if (entry.added) {
      name = 'Added';
    } else if (entry.modified) {
      name = 'Modified';
    } else if (entry.deleted) {
      name = 'Deleted';
    } else {
      name = 'Unknown Operation';
    }

    return <code className="txt-sm pad-xxs">{name}</code>;
  }

  render() {
    const { actionBranch, branch, branches, status, message, error } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Sync Changes</ModalHeader>
        <ModalBody className="wide pad">
          {error && (
            <p className="notice error margin-bottom-sm no-margin-top">
              <button className="pull-right icon" onClick={this._handleClearError}>
                <i className="fa fa-times" />
              </button>
              {error}
            </p>
          )}
          <div className="form-row">
            <div className="form-control form-control--outlined">
              <select value={actionBranch || ''} onChange={this._handleChangeActionBranch}>
                <option value="">-- Select Branch --</option>
                {branches.filter(b => b !== branch).map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <PromptButton
              className="btn btn--clicky width-auto"
              onClick={this._handleRemoveBranch}
              disabled={!actionBranch || actionBranch === branch}
              addIcon
              confirmMessage="">
              <i className="fa fa-trash-o" />
            </PromptButton>
            <PromptButton
              className="btn btn--clicky width-auto"
              onClick={this._handleMergeBranch}
              disabled={!actionBranch || actionBranch === branch}
              addIcon
              confirmMessage="">
              <i className="fa fa-code-fork" />
            </PromptButton>
          </div>
          <div className="form-group">
            <div className="form-control form-control--outlined">
              <textarea
                cols="30"
                rows="3"
                onChange={this._handleMessageChange}
                value={message}
                placeholder="My commit message"
              />
            </div>
            <button className="btn btn--clicky space-left" onClick={this._handleTakeSnapshot}>
              Sync Changes
            </button>
          </div>
          <div>
            <button
              className="pull-right btn btn--clicky-small"
              disabled={Object.keys(status.stage).length === 0}
              onClick={this._handleUnstageAll}>
              Uncheck All
            </button>
            <h2>Added Changes</h2>
          </div>
          <ul>
            {Object.keys(status.stage)
              .sort()
              .map(key => (
                <li key={key}>
                  <label>
                    <input
                      className="space-right"
                      type="checkbox"
                      checked={true}
                      name={key}
                      onChange={this._handleUnstage}
                    />
                    {SyncStagingModal.renderOperation(status.stage[key])} {status.stage[key].name}
                  </label>
                </li>
              ))}
          </ul>
          <div>
            <button
              className="pull-right btn btn--clicky-small"
              onClick={this._handleStageAll}
              disabled={Object.keys(status.unstaged).length === 0}>
              Select All ({Object.keys(status.unstaged).length})
            </button>
            <h2>Changes</h2>
          </div>
          <ul key={status.key}>
            {Object.keys(status.unstaged)
              .sort()
              .map(id => (
                <li key={id}>
                  <label>
                    <input
                      className="space-right"
                      type="checkbox"
                      checked={false}
                      name={id}
                      onChange={this._handleStage}
                    />
                    {SyncStagingModal.renderOperation(status.unstaged[id])}{' '}
                    {status.unstaged[id].name}
                  </label>
                </li>
              ))}
          </ul>
        </ModalBody>
      </Modal>
    );
  }
}

export default SyncStagingModal;
