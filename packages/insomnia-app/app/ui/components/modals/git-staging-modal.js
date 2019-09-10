// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { Workspace } from '../../../models/workspace';
import GitVCS from '../../../sync/git/git-vcs';
import { withDescendants } from '../../../common/database';
import IndeterminateCheckbox from '../base/indeterminate-checkbox';
import ModalFooter from '../base/modal-footer';

type Props = {|
  workspace: Workspace,
  vcs: GitVCS,
|};

type Item = {|
  path: string,
  type: string,
  name: string,
  status: string,
  staged: boolean,
|};

type State = {|
  branch: string,
  message: string,
  items: Array<Item>,
|};

const INITIAL_STATE = {
  branch: '',
  message: '',
  items: [],
};

@autobind
class GitStagingModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  statusNames: { [string]: string };

  constructor(props: Props) {
    super(props);
    this.state = INITIAL_STATE;
  }

  _setModalRef(ref: ?Modal) {
    this.modal = ref;
  }

  async _handleMessageChange(e: SyntheticEvent<HTMLTextAreaElement>) {
    this.setState({ message: e.currentTarget.value });
  }

  async _handleCommit(e: SyntheticEvent<HTMLButtonElement>) {
    const { vcs } = this.props;
    const { items, message } = this.state;

    // Set the stage
    for (const item of items) {
      if (!item.staged) {
        continue;
      }

      if (item.status.includes('deleted')) {
        await vcs.remove(item.path);
      } else {
        await vcs.add(item.path);
      }
    }

    await vcs.commit(message);

    this.modal && this.modal.hide();
  }

  async _handleToggleAll(e: SyntheticEvent<HTMLInputElement>) {
    await this._toggleAll();
  }

  async _toggleAll(forceAdd?: boolean = false) {
    const items = [...this.state.items];

    const allStaged = items.every(i => i.staged);
    const doStage = !allStaged;

    for (const item of items) {
      item.staged = doStage || forceAdd;
    }

    this.setState({ items });
  }

  async _handleToggleOne(e: SyntheticEvent<HTMLInputElement>) {
    const items = [...this.state.items];

    const gitPath = e.currentTarget.name;

    for (const item of items) {
      if (item.path === gitPath) {
        item.staged = !item.staged;
      }
    }

    this.setState({ items });
  }

  async _refreshStatusNames() {
    const { workspace } = this.props;
    const docs = await withDescendants(workspace);
    this.statusNames = {};
    for (const doc of docs) {
      this.statusNames[doc._id] = (doc: any).name || '';
    }
  }

  async show(options: {}) {
    const { vcs, workspace } = this.props;

    this.modal && this.modal.show();

    // Reset state
    this.setState(INITIAL_STATE);

    // Cache status names
    const docs = await withDescendants(workspace);
    this.statusNames = {};
    for (const doc of docs) {
      this.statusNames[`${doc.type}/${doc._id}.json`] = (doc: any).name || '';
    }

    // Create status items
    const items = [];
    const status = await vcs.status();
    const log = (await vcs.log()) || [];
    console.log('LOG', this.statusNames);
    for (const s of status.entries) {
      if (!this.statusNames[s.path] && log.length > 0) {
        const docJSON = await vcs.readObjFromTree(log[0].tree, s.path);
        if (!docJSON) {
          continue;
        }

        try {
          const doc = JSON.parse(docJSON);
          this.statusNames[s.path] = (doc: any).name || '';
        } catch (err) {
          // Nothing here
        }
      }

      items.push({
        path: s.path,
        status: s.status,
        type: s.path.split('/')[0] || 'Unknown',
        name: 'n/a',
        staged: true,
      });
    }

    const branch = await vcs.branch();
    this.setState({
      items,
      branch,
    });
  }

  renderItem(item: Item) {
    const { path: gitPath, status, staged, type } = item;

    const docName = this.statusNames[gitPath] || 'n/a';

    // Nothing to render if it wasn't changed
    if (status === 'unmodified') {
      return null;
    }

    return (
      <tr key={gitPath} className="table--no-outline-row">
        <td>
          <label className="no-pad wide">
            <input
              className="space-right"
              type="checkbox"
              checked={staged}
              name={gitPath}
              onChange={this._handleToggleOne}
            />{' '}
            {docName}
          </label>
        </td>
        <td className="text-right">{status.replace('*', '')}</td>
        <td className="text-right">{type}</td>
      </tr>
    );
  }

  render() {
    const { items, message, branch } = this.state;

    const allStaged = items.every(i => i.staged);
    const allUnstaged = items.every(i => !i.staged);

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
                          checked={allStaged}
                          onChange={this._handleToggleAll}
                          indeterminate={!allStaged && !allUnstaged}
                        />
                      </span>{' '}
                      name
                    </label>
                  </th>
                  <th className="text-right ">Changes</th>
                  <th className="text-right">Description</th>
                </tr>
              </thead>
              <tbody>{items.map(this.renderItem)}</tbody>
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
