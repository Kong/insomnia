// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import { VCS } from 'insomnia-sync';
import type { Workspace } from '../../../models/workspace';
import * as db from '../../../common/database';
import * as models from '../../../models';
import PromptButton from '../base/prompt-button';
import TimeFromNow from '../time-from-now';
import type { BaseModel } from '../../../models';
import * as syncTypes from 'insomnia-sync/src/types';

type Props = {
  workspace: Workspace,
};

type State = {
  branch: string,
  actionBranch: string,
  branches: Array<string>,
  history: Array<syncTypes.Snapshot>,
  status: syncTypes.Status,
  message: string,
  error: string,
  newBranchName: string,
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
  vcs: VCS;

  constructor(props: Props) {
    super(props);
    this.state = {
      branch: '',
      actionBranch: '',
      branches: [],
      newBranchName: '',
      history: [],
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

  _handleBranchChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ newBranchName: e.currentTarget.value });
  }

  async _handleChangeActionBranch(e: SyntheticEvent<HTMLSelectElement>) {
    this.setState({ actionBranch: e.currentTarget.value });
  }

  async _handleFork(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const { newBranchName } = this.state;
    await this.vcs.fork(newBranchName);
    await this.vcs.checkout(newBranchName);
    await this.updateStatus({ newBranchName: '' });
  }

  async _handleRemoveBranch() {
    const { actionBranch } = this.state;

    try {
      await this.vcs.removeBranch(actionBranch);
    } catch (err) {
      this.setState({ error: err.message });
      return;
    }

    await this.updateStatus({ actionBranch: '' });
  }

  async _handleMergeBranch() {
    const { actionBranch } = this.state;

    try {
      await this.vcs.merge(actionBranch);
    } catch (err) {
      this.setState({ error: `Failed to merge: ${err.message}` });
      return;
    }

    await this.syncDatabase();

    await this.updateStatus();
  }

  async _handleStage(e: SyntheticEvent<HTMLInputElement>) {
    const id = e.currentTarget.name;
    const statusItem = this.state.status.unstaged[id];
    await this.vcs.stage([statusItem]);
    await this.updateStatus();
  }

  async _handleStageAll() {
    const { unstaged } = this.state.status;

    const items = [];
    for (const id of Object.keys(unstaged)) {
      items.push(unstaged[id]);
    }

    await this.vcs.stage(items);
    await this.updateStatus();
  }

  async _handleUnstageAll() {
    const { stage } = this.state.status;
    const items = [];
    for (const id of Object.keys(stage)) {
      items.push(stage[id]);
    }

    await this.vcs.unstage(items);
    await this.updateStatus();
  }

  async _handleUnstage(e: SyntheticEvent<HTMLInputElement>) {
    const id = e.currentTarget.name;
    const statusItem = this.state.status.stage[id];
    await this.vcs.unstage([statusItem]);
    await this.updateStatus();
  }

  async _handleTakeSnapshot() {
    try {
      const { message } = this.state;
      await this.vcs.takeSnapshot(message);
    } catch (err) {
      this.setState({ error: err.message });
      return;
    }

    await this.updateStatus({ message: '', error: '' });
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

  async syncDatabase() {
    const items = await this.generateStatusItems();
    const itemsMap = {};
    for (const item of items) {
      itemsMap[item.key] = item.document;
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

  async updateStatus(newState?: Object) {
    const items = await this.generateStatusItems();
    const status = await this.vcs.status(items);
    const branch = await this.vcs.getBranch();
    const branches = await this.vcs.getBranches();
    const history = await this.vcs.getHistory();

    this.setState({
      status,
      branch,
      branches,
      history: history.sort((a, b) => (a.created < b.created ? 1 : -1)),
      error: '',
      ...newState,
    });
  }

  hide() {
    this.modal && this.modal.hide();
  }

  async show(options: { vcs: VCS }) {
    this.vcs = options.vcs;
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
    const {
      actionBranch,
      branch,
      branches,
      history,
      newBranchName,
      status,
      message,
      error,
    } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Stage Files</ModalHeader>
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
              confirmMessage=" ">
              <i className="fa fa-trash-o" />
            </PromptButton>
            <PromptButton
              className="btn btn--clicky width-auto"
              onClick={this._handleMergeBranch}
              disabled={!actionBranch || actionBranch === branch}
              addIcon
              confirmMessage=" ">
              <i className="fa fa-code-fork" />
            </PromptButton>
          </div>
          <form onSubmit={this._handleFork}>
            <div className="form-row">
              <div className="form-control form-control--outlined">
                <input
                  key={branch}
                  type="text"
                  placeholder="my-branch"
                  onChange={this._handleBranchChange}
                  defaultValue={newBranchName}
                />
              </div>
              <button type="submit" className="btn btn--clicky width-auto">
                Create Branch
              </button>
            </div>
          </form>
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
              Take Snapshot
            </button>
          </div>
          <div>
            <button
              className="pull-right btn btn--clicky-small"
              disabled={Object.keys(status.stage).length === 0}
              onClick={this._handleUnstageAll}>
              Remove All
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
              Add All ({Object.keys(status.unstaged).length})
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
          <br />
          <h2>History</h2>
          <table className="table--fancy table--striped">
            <thead>
              <tr>
                <th className="text-left">Hash</th>
                <th className="text-left">Time</th>
                <th className="text-left">Message</th>
                <th className="text-left">Count</th>
              </tr>
            </thead>
            <tbody>
              {history.map(snapshot => (
                <tr key={snapshot.id}>
                  <td className="monospace txt-sm">{snapshot.id}</td>
                  <td>
                    <TimeFromNow timestamp={snapshot.created} intervalSeconds={30} />
                  </td>
                  <td>{snapshot.name}</td>
                  <td>{snapshot.state.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModalBody>
        <ModalFooter>
          <div>
            <button className="btn" onClick={this.hide}>
              Cancel
            </button>
            <button className="btn" onClick={this._handleDone}>
              Ok
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default SyncStagingModal;
