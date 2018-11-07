// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import { FileSystemDriver, VCS } from 'insomnia-sync';
import type { Workspace } from '../../../models/workspace';
import * as db from '../../../common/database';
import * as models from '../../../models';
import TimeFromNow from '../time-from-now';

type VCSCommit = {
  parent: string,
  id: string,
  timestamp: number,
  message: string,
  tree: {
    [string]: {
      name: string,
      hash: string
    }
  }
};

type VCSOperation = 'add' | 'modify' | 'delete';

type VCSStageEntry = {
  operation: VCSOperation,
  hash: string,
  name: string,
  content: string
};

type VCSStage = {
  [string]: VCSStageEntry
};

type VCSStatus = {
  stage: VCSStage,
  unstaged: {
    [string]: VCSStageEntry & { id: string }
  }
};

type Props = {
  workspace: Workspace
};

type State = {
  branch: string,
  branches: Array<string>,
  status: VCSStatus,
  message: string,
  error: string,
  newBranchName: string,
  commits: Array<VCSCommit>
};

const WHITE_LIST = {
  [models.workspace.type]: true,
  [models.request.type]: true,
  [models.requestGroup.type]: true,
  [models.environment.type]: true
};

@autobind
class SyncStagingModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  vcs: VCS;

  constructor(props: Props) {
    super(props);
    this.state = {
      branch: '',
      branches: [],
      newBranchName: '',
      commits: [],
      status: {
        stage: {},
        unstaged: {}
      },
      error: '',
      message: ''
    };

    const driver = new FileSystemDriver({ directory: '/Users/gschier/Desktop/vcs' });
    this.vcs = new VCS('123', driver);
  }

  async componentDidMount() {
    await this.show();
  }

  _setModalRef(m: ?Modal) {
    this.modal = m;
  }

  _handleDone(e: SyntheticEvent<HTMLButtonElement>) {
    this.hide();
  }

  _handleMessageChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ message: e.currentTarget.value });
  }

  _handleBranchChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ newBranchName: e.currentTarget.value });
  }

  async _handleChangeBranch(e: SyntheticEvent<HTMLSelectElement>) {
    await this.vcs.checkout(e.currentTarget.value);
    await this.updateStatus();
  }

  async _handleCheckoutBranch() {
    await this.vcs.checkout(this.state.newBranchName);
    await this.updateStatus({ newBranchName: '' });
  }

  async _handleStage(e: SyntheticEvent<HTMLInputElement>) {
    const id = e.currentTarget.name;
    const statusItem = this.state.status.unstaged[id];
    await this.vcs.stage(statusItem);
    await this.updateStatus();
  }

  async _handleUnstage(e: SyntheticEvent<HTMLInputElement>) {
    const id = e.currentTarget.name;
    const statusItem = this.state.status.stage[id];
    await this.vcs.unstage(statusItem);
    await this.updateStatus();
  }

  async _handleCommit(e: SyntheticEvent<HTMLButtonElement>) {
    const { message } = this.state;
    try {
      await this.vcs.commit(message);
    } catch (err) {
      this.setState({ error: err.message });
      return;
    }

    await this.updateStatus({ message: '' });
  }

  async updateStatus(newState?: Object) {
    const items = [];
    const allDocs = await db.withDescendants(this.props.workspace);
    const docs = allDocs.filter(d => WHITE_LIST[d.type]);

    for (const doc of docs) {
      items.push({
        id: doc._id,
        name: (doc: any).name || 'No Name',
        content: doc
      });
    }

    const status = await this.vcs.status(items);
    const commits = await this.vcs.getHistory();
    const branch = await this.vcs.getBranch();
    const branches = await this.vcs.listBranches();
    this.setState({
      status,
      commits,
      branch,
      branches,
      error: '',
      ...newState
    });
  }

  hide() {
    this.modal && this.modal.hide();
  }

  async show() {
    this.modal && this.modal.show();
    await this.updateStatus();
  }

  render() {
    const { branch, branches, newBranchName, status, commits, message, error } = this.state;
    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Stage Files</ModalHeader>
        <ModalBody className="wide pad">
          <div className="form-row">
            <div className="form-control form-control--outlined">
              <select value={branch} onChange={this._handleChangeBranch}>
                {branches.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
            <button className="btn btn--clicky width-auto" onClick={this._handleCheckoutBranch}>
              Create Branch
            </button>
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
            <button className="btn btn--clicky" onClick={this._handleCommit}>
              Commit
            </button>
          </div>
          {error && <div className="text-danger">{error}</div>}
          <h2>Staged</h2>
          <ul>
            {Object.keys(status.stage)
              .sort()
              .map(id => (
                <li key={`${id}::${status.stage[id].hash}`}>
                  <label>
                    <input
                      className="space-right"
                      type="checkbox"
                      checked={true}
                      name={id}
                      onChange={this._handleUnstage}
                    />
                    <code className="txt-sm pad-xxs">{status.stage[id].operation}</code>{' '}
                    {status.stage[id].name}
                  </label>
                </li>
              ))}
          </ul>
          <h2>Not Staged</h2>
          <ul>
            {Object.keys(status.unstaged)
              .sort()
              .map(id => (
                <li key={`${id}::${status.unstaged[id].hash}`}>
                  <label>
                    <input
                      className="space-right"
                      type="checkbox"
                      checked={false}
                      name={id}
                      onChange={this._handleStage}
                    />
                    <code className="small pad-xxs">{status.unstaged[id].operation}</code>{' '}
                    {status.unstaged[id].name}
                  </label>
                </li>
              ))}
          </ul>
          <br />
          <h2>Commits</h2>
          <table className="table--fancy table--striped">
            <thead>
              <tr>
                <th className="text-left">Hash</th>
                <th className="text-left">Time</th>
                <th className="text-left">Message</th>
              </tr>
            </thead>
            <tbody>
              {commits.map(commit => (
                <tr key={commit.id}>
                  <td className="monospace txt-sm">{commit.id}</td>
                  <td>
                    <TimeFromNow timestamp={commit.timestamp} intervalSeconds={30} />
                  </td>
                  <td>{commit.message}</td>
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
