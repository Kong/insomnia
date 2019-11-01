// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import path from 'path';
import * as models from '../../../models';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { Workspace } from '../../../models/workspace';
import GitVCS from '../../../sync/git/git-vcs';
import { withDescendants } from '../../../common/database';
import IndeterminateCheckbox from '../base/indeterminate-checkbox';
import ModalFooter from '../base/modal-footer';
import Tooltip from '../tooltip';

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
  items: {
    [string]: Item,
  },
|};

const INITIAL_STATE = {
  branch: '',
  message: '',
  items: {},
};

@autobind
class GitStagingModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  statusNames: { [string]: string };
  textarea: ?HTMLTextAreaElement;
  onCommit: null | (() => void);

  constructor(props: Props) {
    super(props);
    this.state = INITIAL_STATE;
    this.onCommit = null;
  }

  _setModalRef(ref: ?Modal) {
    this.modal = ref;
  }

  _setTextareaRef(ref: ?Modal) {
    this.textarea = ref;
  }

  async _handleMessageChange(e: SyntheticEvent<HTMLTextAreaElement>) {
    this.setState({ message: e.currentTarget.value });
  }

  async _handleCommit(e: SyntheticEvent<HTMLButtonElement>) {
    const { vcs } = this.props;
    const { items, message } = this.state;

    // Set the stage
    for (const p of Object.keys(items)) {
      const item = items[p];

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

    if (typeof this.onCommit === 'function') {
      this.onCommit();
    }
  }

  async _toggleAll(items: Array<Item>, forceAdd?: boolean = false) {
    const allStaged = items.every(i => i.staged);
    const doStage = !allStaged;

    const newItems = { ...this.state.items };

    for (const { path: p } of items) {
      newItems[p].staged = doStage || forceAdd;
    }

    this.setState({ items: newItems });
  }

  async _handleToggleOne(e: SyntheticEvent<HTMLInputElement>) {
    const newItems = { ...this.state.items };

    const gitPath = e.currentTarget.name;

    if (!newItems[gitPath]) {
      return;
    }

    newItems[gitPath].staged = !newItems[gitPath].staged;

    this.setState({ items: newItems });
  }

  async show(options: { onCommit?: () => void }) {
    const { vcs, workspace } = this.props;

    this.onCommit = options.onCommit || null;

    this.modal && this.modal.show();

    // Reset state
    this.setState(INITIAL_STATE);

    // Cache status names
    const docs = await withDescendants(workspace);
    this.statusNames = {};
    for (const doc of docs) {
      this.statusNames[path.join('.studio', doc.type, `${doc._id}.json`)] = (doc: any).name || '';
    }

    // Create status items
    const items = {};
    const status = await vcs.status();
    const log = (await vcs.log()) || [];
    for (const s of status.entries) {
      if (s.status === 'unmodified') {
        continue;
      }

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

      // We know that type is in the path but we don't know where. This
      // is the safest way to check for the type
      let type = 'Unknown';
      for (const t of models.types()) {
        if (s.path.includes(t)) {
          type = t;
          break;
        }
      }

      items[s.path] = {
        type,
        path: s.path,
        status: s.status,
        name: 'n/a',
        staged: !s.status.includes('added'),
      };
    }

    const branch = await vcs.getBranch();
    this.setState(
      {
        items,
        branch,
      },
      () => {
        this.textarea && this.textarea.focus();
      },
    );
  }

  renderOperation(item: Item) {
    let child = null;
    let message = '';

    if (item.status.includes('added')) {
      child = <i className="fa fa-plus-circle success" />;
      message = 'Added';
    } else if (item.status.includes('modified')) {
      child = <i className="fa fa-circle faded" />;
      message = 'Modified';
    } else if (item.status.includes('deleted')) {
      child = <i className="fa fa-minus-circle danger" />;
      message = 'Deleted';
    } else {
      child = <i className="fa fa-question-circle info" />;
      message = 'Unknown';
    }

    return (
      <React.Fragment>
        <Tooltip message={message}>
          {child} {item.type}
        </Tooltip>
      </React.Fragment>
    );
  }

  renderItem(item: Item) {
    const { path: gitPath, staged } = item;

    const docName = this.statusNames[gitPath] || 'n/a';

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
        <td className="text-right">{this.renderOperation(item)}</td>
      </tr>
    );
  }

  renderTable(title: string, items: Array<Item>) {
    if (items.length === 0) {
      return null;
    }

    const allStaged = items.every(i => i.staged);
    const allUnstaged = items.every(i => !i.staged);

    return (
      <div className="pad-top">
        <strong>{title}</strong>
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
                      onChange={() => this._toggleAll(items, !allStaged)}
                      indeterminate={!allStaged && !allUnstaged}
                    />
                  </span>{' '}
                  name
                </label>
              </th>
              <th className="text-right">Description</th>
            </tr>
          </thead>
          <tbody>{items.map(this.renderItem)}</tbody>
        </table>
      </div>
    );
  }

  render() {
    const { items, message, branch } = this.state;

    const itemsList = Object.keys(items).map(k => items[k]);
    const addedItems = itemsList.filter(i => i.status.includes('added'));
    const nonAddedItems = itemsList.filter(i => !i.status.includes('added'));

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Commit Changes</ModalHeader>
        <ModalBody className="wide pad">
          <div className="form-control form-control--outlined">
            <textarea
              ref={this._setTextareaRef}
              rows="3"
              required
              placeholder="A descriptive message to describe changes made"
              defaultValue={message}
              onChange={this._handleMessageChange}
            />
          </div>
          {this.renderTable('Modified Objects', nonAddedItems)}
          {this.renderTable('Unversioned Objects', addedItems)}
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
