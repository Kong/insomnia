import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import path from 'path';
import React, { Fragment, PureComponent } from 'react';
import YAML from 'yaml';

import { AUTOBIND_CFG } from '../../../common/constants';
import { database as db } from '../../../common/database';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { isApiSpec } from '../../../models/api-spec';
import type { Workspace } from '../../../models/workspace';
import { gitRollback } from '../../../sync/git/git-rollback';
import { GIT_INSOMNIA_DIR, GIT_INSOMNIA_DIR_NAME, GitVCS } from '../../../sync/git/git-vcs';
import parseGitPath from '../../../sync/git/parse-git-path';
import IndeterminateCheckbox from '../base/indeterminate-checkbox';
import Modal from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import PromptButton from '../base/prompt-button';
import Tooltip from '../tooltip';

interface Item {
  path: string;
  type: string;
  status: string;
  staged: boolean;
  added: boolean;
  editable: boolean;
}

interface Props {
  workspace: Workspace;
  vcs: GitVCS;
}

interface State {
  loading: boolean;
  branch: string;
  message: string;
  items: Record<string, Item>;
}

const INITIAL_STATE: State = {
  loading: false,
  branch: '',
  message: '',
  items: {},
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class GitStagingModal extends PureComponent<Props, State> {
  modal: Modal | null = null;
  statusNames: Record<string, string>;
  textarea: HTMLTextAreaElement | null = null;
  onCommit: null | (() => void);

  constructor(props: Props) {
    super(props);
    this.state = INITIAL_STATE;
    this.onCommit = null;
  }

  _setModalRef(ref: Modal) {
    this.modal = ref;
  }

  _setTextareaRef(ref: HTMLTextAreaElement) {
    this.textarea = ref;
  }

  async _handleMessageChange(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    this.setState({
      message: e.currentTarget.value,
    });
  }

  async _handleCommit() {
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
    this.modal?.hide();

    if (typeof this.onCommit === 'function') {
      this.onCommit();
    }
  }

  _hideModal() {
    this.modal?.hide();
  }

  async _toggleAll(items: Item[], forceAdd = false) {
    const allStaged = items.every(i => i.staged);
    const doStage = !allStaged;
    const newItems = { ...this.state.items };

    for (const { path: p } of items) {
      if (!newItems[p].editable) {
        continue;
      }

      newItems[p].staged = doStage || forceAdd;
    }

    this.setState({
      items: newItems,
    });
  }

  async _handleToggleOne(e: React.SyntheticEvent<HTMLInputElement>) {
    const newItems = { ...this.state.items };
    const gitPath = e.currentTarget.name;

    if (!newItems[gitPath] || !newItems[gitPath].editable) {
      return;
    }

    newItems[gitPath].staged = !newItems[gitPath].staged;
    this.setState({
      items: newItems,
    });
  }

  async getAllPaths(): Promise<string[]> {
    const { vcs } = this.props;
    // @ts-expect-error -- TSCONVERSION
    const f = vcs.getFs().promises;
    const fsPaths: string[] = [];

    for (const type of await f.readdir(GIT_INSOMNIA_DIR)) {
      const typeDir = path.join(GIT_INSOMNIA_DIR, type);

      for (const name of await f.readdir(typeDir)) {
        // NOTE: git paths don't start with '/' so we're omitting
        //  it here too.
        const gitPath = path.join(GIT_INSOMNIA_DIR_NAME, type, name);
        fsPaths.push(path.join(gitPath));
      }
    }

    // To get all possible paths, we need to combine the paths already in Git
    // with the paths on the FS. This is required to cover the case where a
    // file can be deleted from FS or from Git.
    const gitPaths = await vcs.listFiles();
    const uniquePaths = new Set([...fsPaths, ...gitPaths]);
    return Array.from(uniquePaths).sort();
  }

  async show(options: { onCommit?: () => void }) {
    this.onCommit = options.onCommit || null;
    this.modal?.show();
    // Reset state
    this.setState(INITIAL_STATE);
    await this._refresh(() => {
      this.textarea?.focus();
    });
  }

  async _refresh(callback?: () => void) {
    const { vcs, workspace } = this.props;
    this.setState({
      loading: true,
    });
    // Get and set branch name
    const branch = await vcs.getBranch();
    this.setState({
      branch,
    });
    // Cache status names
    const docs = await db.withDescendants(workspace);
    const allPaths = await this.getAllPaths();
    this.statusNames = {};

    for (const doc of docs) {
      const name = (isApiSpec(doc) && doc.fileName) || doc.name || '';
      this.statusNames[path.join(GIT_INSOMNIA_DIR_NAME, doc.type, `${doc._id}.json`)] = name;
      this.statusNames[path.join(GIT_INSOMNIA_DIR_NAME, doc.type, `${doc._id}.yml`)] = name;
    }

    // Create status items
    const items = {};
    const log = (await vcs.log(1)) || [];

    for (const gitPath of allPaths) {
      const status = await vcs.status(gitPath);

      if (status === 'unmodified') {
        continue;
      }

      if (!this.statusNames[gitPath] && log.length > 0) {
        const docYML = await vcs.readObjFromTree(log[0].commit.tree, gitPath);

        if (!docYML) {
          continue;
        }

        try {
          // @ts-expect-error -- TSCONVERSION
          const doc = YAML.parse(docYML);
          this.statusNames[gitPath] = doc.name || '';
        } catch (err) {
          // Nothing here
        }
      }

      // We know that type is in the path; extract it. If the model is not found, set to Unknown.
      let { type } = parseGitPath(gitPath);

      // @ts-expect-error -- TSCONVERSION
      if (!models.types().includes(type)) {
        type = 'Unknown';
      }

      const added = status.includes('added');
      let staged = !added;
      let editable = true;

      // We want to enforce that workspace changes are always committed because otherwise
      // others won't be able to clone from it. We also make fundamental migrations to the
      // scope property which need to be committed.
      // So here we're preventing people from un-staging the workspace.
      if (type === models.workspace.type) {
        editable = false;
        staged = true;
      }

      items[gitPath] = {
        type,
        staged,
        editable,
        status,
        added,
        path: gitPath,
      };
    }

    this.setState(
      {
        items,
        loading: false,
      },
      callback,
    );
  }

  renderOperation(item: Item) {
    let child: JSX.Element | null = null;
    let message = '';
    let type = item.type;

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

    if (type === models.workspace.type) {
      type = strings.document.singular;
    }

    return (
      <Fragment>
        <Tooltip message={message}>
          {child} {type}
        </Tooltip>
      </Fragment>
    );
  }

  async _handleRollback(items: Item[]) {
    const { vcs } = this.props;
    const files = items
      .filter(i => i.editable) // only rollback if editable
      .map(i => ({
        filePath: i.path,
        status: i.status,
      }));
    await gitRollback(vcs, files);
    await this._refresh();
  }

  renderItem(item: Item) {
    const { path: gitPath, staged, editable } = item;
    const docName = this.statusNames[gitPath] || 'n/a';
    return (
      <tr key={gitPath} className="table--no-outline-row">
        <td>
          <label className="no-pad wide">
            <input
              disabled={!editable}
              className="space-right"
              type="checkbox"
              checked={staged}
              name={gitPath}
              onChange={this._handleToggleOne}
            />{' '}
            {docName}
          </label>
        </td>
        <td className="text-right">
          {item.editable && <Tooltip message={item.added ? 'Delete' : 'Rollback'}>
            <button
              className="btn btn--micro space-right"
              onClick={() => this._handleRollback([item])}
            >
              <i className={classnames('fa', item.added ? 'fa-trash' : 'fa-undo')} />
            </button>
          </Tooltip>}
          {this.renderOperation(item)}
        </td>
      </tr>
    );
  }

  renderTable(title: string, items: Item[], rollbackLabel: string) {
    if (items.length === 0) {
      return null;
    }

    const allStaged = items.every(i => i.staged);
    const allUnstaged = items.every(i => !i.staged);
    return (
      <div className="pad-top">
        <strong>{title}</strong>
        <PromptButton
          className="btn pull-right btn--micro"
          onClick={() => this._handleRollback(items)}
        >
          {rollbackLabel}
        </PromptButton>
        <table className="table--fancy table--outlined margin-top-sm">
          <thead>
            <tr className="table--no-outline-row">
              <th>
                <label className="wide no-pad">
                  <span className="txt-md">
                    <IndeterminateCheckbox
                      className="space-right"
                      // @ts-expect-error -- TSCONVERSION
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

  _renderEmpty() {
    const { loading } = this.state;

    if (loading) {
      return <>Loading...</>;
    }

    return <>No changes to commit.</>;
  }

  _renderItems(items: Item[]) {
    const { message } = this.state;
    const newItems = items.filter(i => i.status.includes('added'));
    const existingItems = items.filter(i => !i.status.includes('added'));
    return (
      <>
        <div className="form-control form-control--outlined">
          <textarea
            ref={this._setTextareaRef}
            rows={3}
            required
            placeholder="A descriptive message to describe changes made"
            defaultValue={message}
            onChange={this._handleMessageChange}
          />
        </div>
        {this.renderTable('Modified Objects', existingItems, 'Rollback all')}
        {this.renderTable('Unversioned Objects', newItems, 'Delete all')}
      </>
    );
  }

  render() {
    const { items, branch, loading } = this.state;
    const itemsList = Object.keys(items).map(k => items[k]);
    const hasChanges = !!itemsList.length;
    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Commit Changes</ModalHeader>
        <ModalBody className="wide pad">
          {hasChanges ? this._renderItems(itemsList) : this._renderEmpty()}
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm">
            <i className="fa fa-code-fork" /> {branch}{' '}
            {loading && <i className="fa fa-refresh fa-spin" />}
          </div>
          <div>
            <button className="btn" onClick={this._hideModal}>
              Close
            </button>
            <button className="btn" onClick={this._handleCommit} disabled={loading || !hasChanges}>
              Commit
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default GitStagingModal;
