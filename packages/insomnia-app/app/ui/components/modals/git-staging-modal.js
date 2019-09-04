// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { Workspace } from '../../../models/workspace';
import GitVCS from '../../../sync/git/git-vcs';
import type { GitStatusEntry } from '../../../sync/git/git-vcs';
import { withDescendants } from '../../../common/database';
import IndeterminateCheckbox from '../base/indeterminate-checkbox';
import ModalFooter from '../base/modal-footer';

type Props = {|
  workspace: Workspace,
  vcs: GitVCS,
|};

type State = {|
  branch: string,
  message: string,
  status: {
    allChecked: boolean,
    noneChecked: boolean,
    entries: Array<GitStatusEntry>,
  },
  statusNames: { [string]: string },
|};

const INITIAL_STATE = {
  branch: '',
  message: '',
  status: {
    allChecked: true,
    noneChecked: false,
    entries: [],
  },
  statusNames: {},
};

@autobind
class GitStagingModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

  constructor(props: Props) {
    super(props);
    this.state = INITIAL_STATE;
  }

  _setModalRef(ref: ?Modal) {
    this.modal = ref;
  }

  async _refreshState() {
    const { vcs, workspace } = this.props;

    const branch = await vcs.branch();
    const status = await vcs.status();

    const docs = await withDescendants(workspace);
    const statusNames = {};
    for (const doc of docs) {
      statusNames[doc._id] = (doc: any).name || '';
    }

    this.setState({
      branch,
      status: this._getStatus(status),
      statusNames,
    });
  }

  async _handleMessageChange(e: SyntheticEvent<HTMLTextAreaElement>) {
    this.setState({ message: e.currentTarget.value });
  }

  async _handleCommit(e: SyntheticEvent<HTMLButtonElement>) {
    const { vcs } = this.props;
    const { message } = this.state;

    await vcs.commit(message);

    this.modal && this.modal.hide();
  }

  async _handleToggleAll(e: SyntheticEvent<HTMLInputElement>) {
    await this._toggleAll();
  }

  async _toggleAll(forceAdd?: boolean) {
    const { vcs } = this.props;
    const { status } = this.state;

    const doStage = !status.allChecked;

    for (const [gitPath, head, workdir, stage] of status.entries) {
      const unmodified = head * workdir * stage === 1;

      if (unmodified) {
        continue;
      }

      if (doStage || forceAdd) {
        await vcs.add(gitPath);
      } else {
        await vcs.remove(gitPath);
      }
    }

    await this._refreshState();
  }

  async _handleToggleOne(e: SyntheticEvent<HTMLInputElement>) {
    const { vcs } = this.props;
    const { status } = this.state;

    const gitPath = e.currentTarget.name;

    // This may seem backwards but that's because the toggle has already flipped
    if (e.currentTarget.checked) {
      await vcs.add(gitPath);
    } else {
      await vcs.remove(gitPath);
    }

    const newEntries = [];
    for (const entry of status.entries) {
      if (entry[0] !== gitPath) {
        newEntries.push(entry);
      } else {
        const newEntry = await vcs.status(entry[0]);
        newEntries.push(newEntry[0]);
      }
    }

    this.setState({ status: this._getStatus(newEntries) });
  }

  _getStatus(
    status: Array<GitStatusEntry>,
  ): {
    allChecked: boolean,
    noneChecked: boolean,
    entries: Array<GitStatusEntry>,
  } {
    return {
      allChecked: status.every(s => s[3] >= s[2]),
      noneChecked: status.every(s => s[3] < s[2]),
      entries: status,
    };
  }

  async show(options: {}) {
    this.modal && this.modal.show();

    this.setState(INITIAL_STATE);
    await this._refreshState();
    await this._toggleAll(true);
  }

  describeChange(
    head: number,
    workdir: number,
    stage: number,
  ): {
    description: string,
    staged: boolean,
    unmodified: boolean,
  } {
    const change = {
      description: '',
      staged: false,
      unmodified: false,
    };

    if (head * workdir * stage === 1) {
      change.unmodified = true;
      change.description = 'Unmodified';
    }

    if (workdir < head) {
      change.description = 'Deleted';
    } else if (workdir > head && head === 0) {
      change.description = 'New';
    } else if (workdir > head && head > 0) {
      change.description = 'Modified';
    }

    change.staged = stage >= workdir;

    return change;
  }

  renderStatusEntry(entry: GitStatusEntry) {
    const { statusNames } = this.state;

    const [gitPath, headStatus, workdirStatus, stageStatus] = entry;

    const [type, name] = gitPath.split('/');
    const id = name.replace(/\.json$/, '');
    const docName = statusNames[id] || 'n/a';

    const change = this.describeChange(headStatus, workdirStatus, stageStatus);

    // Nothing to render if it wasn't changed
    if (change.unmodified) {
      return null;
    }

    return (
      <tr key={gitPath} className="table--no-outline-row">
        <td>
          <label className="no-pad wide">
            <input
              className="space-right"
              type="checkbox"
              checked={change.staged}
              name={gitPath}
              onChange={this._handleToggleOne}
            />{' '}
            {docName}
          </label>
        </td>
        <td className="text-right">{change.description}</td>
        <td className="text-right">{type}</td>
      </tr>
    );
  }

  render() {
    const { status, message, branch } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Commit Changes</ModalHeader>
        <ModalBody className="wide pad">
          <div className="form-control form-control--outlined">
            <textarea
              rows="3"
              required
              placeholder="A descriptive message to describe changes made"
              defaultValue={message}
              onChange={this._handleMessageChange}
            />
          </div>
          <div className="pad-top">
            <strong>Changes</strong>
            <table className="table--fancy table--outlined margin-top-sm">
              <thead>
                <tr className="table--no-outline-row">
                  <th>
                    <label className="wide no-pad">
                      <span className="txt-md">
                        <IndeterminateCheckbox
                          className="space-right"
                          type="checkbox"
                          checked={status.allChecked}
                          onChange={this._handleToggleAll}
                          indeterminate={!status.allChecked && !status.noneChecked}
                        />
                      </span>{' '}
                      name
                    </label>
                  </th>
                  <th className="text-right ">Changes</th>
                  <th className="text-right">Description</th>
                </tr>
              </thead>
              <tbody>{status.entries.map(entry => this.renderStatusEntry(entry))}</tbody>
            </table>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm tall">
            <i className="fa fa-code-fork" /> {branch}
          </div>
          <div>
            <button className="btn" onClick={this._handleCommit}>
              Commit
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default GitStagingModal;
