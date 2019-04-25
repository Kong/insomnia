// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import type { Workspace } from '../../../models/workspace';
import VCS from '../../../sync/vcs';
import type { DocumentKey, Stage, StageEntry, Status, StatusCandidate } from '../../../sync/types';
import * as models from '../../../models';
import Tooltip from '../tooltip';
import IndeterminateCheckbox from '../base/indeterminate-checkbox';
import { describeChanges } from '../../../sync/vcs/util';

type Props = {
  workspace: Workspace,
  syncItems: Array<StatusCandidate>,
  vcs: VCS,
};

type State = {
  status: Status,
  message: string,
  error: string,
  branch: string,
  lookupMap: {
    [string]: {|
      entry: StageEntry,
      changes: null | Array<string>,
      type: string,
      checked: boolean,
    |},
  },
};

const _initialState: State = {
  status: {
    stage: {},
    unstaged: {},
    key: '',
  },
  branch: '',
  error: '',
  message: '',
  lookupMap: {},
};

@autobind
class SyncStagingModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  _onSnapshot: ?() => void;
  _handlePush: ?() => Promise<void>;
  textarea: ?HTMLTextAreaElement;

  state = _initialState;

  _setModalRef(m: ?Modal) {
    this.modal = m;
  }

  _setTextAreaRef(m: ?HTMLTextAreaElement) {
    this.textarea = m;
  }

  _handleClearError() {
    this.setState({ error: '' });
  }

  _handleMessageChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ message: e.currentTarget.value });
  }

  async _handleStageToggle(e: SyntheticEvent<HTMLInputElement>) {
    const { vcs } = this.props;
    const { status } = this.state;
    const id = e.currentTarget.name;

    const isStaged = !!status.stage[id];

    const newStage = isStaged
      ? await vcs.unstage(status.stage, [status.stage[id]])
      : await vcs.stage(status.stage, [status.unstaged[id]]);

    await this.refreshMainAttributes({}, newStage);
  }

  async _handleAllToggle(keys: Array<DocumentKey>, doStage: boolean) {
    const { vcs } = this.props;
    const { status } = this.state;

    let stage;
    if (doStage) {
      const entries: Array<StageEntry> = [];
      for (const k of Object.keys(status.unstaged)) {
        if (keys.includes(k)) {
          entries.push(status.unstaged[k]);
        }
      }
      stage = await vcs.stage(status.stage, entries);
    } else {
      const entries: Array<StageEntry> = [];
      for (const k of Object.keys(status.stage)) {
        if (keys.includes(k)) {
          entries.push(status.stage[k]);
        }
      }
      stage = await vcs.unstage(status.stage, entries);
    }

    await this.refreshMainAttributes({}, stage);
  }

  async _handleTakeSnapshotAndPush() {
    const success = await this._handleTakeSnapshot();
    if (success) {
      this._handlePush && this._handlePush();
    }
  }

  async _handleTakeSnapshot(): Promise<boolean> {
    const { vcs } = this.props;
    const {
      message,
      status: { stage },
    } = this.state;

    try {
      await vcs.takeSnapshot(stage, message);
    } catch (err) {
      this.setState({ error: err.message });
      return false;
    }

    this._onSnapshot && this._onSnapshot();
    await this.refreshMainAttributes({ message: '', error: '' });
    this.hide();
    return true;
  }

  async refreshMainAttributes(newState?: Object = {}, newStage?: Stage = {}) {
    const { vcs, syncItems } = this.props;
    const branch = await vcs.getBranch();
    const status = await vcs.status(syncItems, newStage);

    const lookupMap = {};
    const allKeys = [...Object.keys(status.stage), ...Object.keys(status.unstaged)];
    for (const key of allKeys) {
      const item = syncItems.find(si => si.key === key);
      const oldDoc: Object | null = await vcs.blobFromLastSnapshot(key);
      const doc = (item && item.document) || oldDoc;
      const entry = status.stage[key] || status.unstaged[key];

      if (!entry || !doc) {
        continue;
      }

      let changes = null;
      if (item && item.document && oldDoc) {
        changes = describeChanges(item.document, oldDoc);
      }

      lookupMap[key] = {
        changes,
        entry: entry,
        type: models.getModelName(doc.type),
        checked: !!status.stage[key],
      };
    }

    this.setState({
      status,
      branch,
      lookupMap,
      error: '',
      ...newState,
    });
  }

  hide() {
    this.modal && this.modal.hide();
  }

  async show(options: { onSnapshot?: () => any, handlePush: () => Promise<void> }) {
    const { vcs, syncItems } = this.props;

    this.modal && this.modal.show();
    this._onSnapshot = options.onSnapshot;
    this._handlePush = options.handlePush;

    // Reset state
    this.setState(_initialState);

    // Add everything to stage by default except new items
    const status: Status = await vcs.status(syncItems, {});
    const toStage = [];
    for (const key of Object.keys(status.unstaged)) {
      if (status.unstaged[key].added) {
        // Don't automatically stage added resources
        continue;
      }

      toStage.push(status.unstaged[key]);
    }

    const stage = await vcs.stage(status.stage, toStage);
    await this.refreshMainAttributes({}, stage);
    this.textarea && this.textarea.focus();
  }

  static renderOperation(entry: StageEntry, type: string, changes: Array<string>) {
    let child = null;
    let message = '';

    if (entry.added) {
      child = <i className="fa fa-plus-circle success" />;
      message = 'Added';
    } else if (entry.modified) {
      child = <i className="fa fa-circle faded" />;
      message = `Modified (${changes.join(', ')})`;
    } else if (entry.deleted) {
      child = <i className="fa fa-minus-circle danger" />;
      message = 'Deleted';
    } else {
      child = <i className="fa fa-question-circle info" />;
      message = 'Unknown';
    }

    return (
      <React.Fragment>
        <Tooltip message={message}>
          {child} {type}
        </Tooltip>
      </React.Fragment>
    );
  }

  renderTable(keys: Array<DocumentKey>, title: React.Node) {
    const { status, lookupMap } = this.state;

    if (keys.length === 0) {
      return null;
    }

    let allUnChecked = true;
    let allChecked = true;

    for (const key of keys.sort()) {
      if (!status.stage[key]) {
        allChecked = false;
      }

      if (!status.unstaged[key]) {
        allUnChecked = false;
      }
    }

    const indeterminate = !allChecked && !allUnChecked;

    return (
      <div className="pad-top">
        <strong>{title}</strong>
        <table className="table--fancy table--outlined margin-top-sm">
          <thead>
            <tr>
              <th>
                <label className="wide no-pad">
                  <span className="txt-md">
                    <IndeterminateCheckbox
                      className="space-right"
                      type="checkbox"
                      checked={allChecked}
                      onChange={() => this._handleAllToggle(keys, allUnChecked)}
                      indeterminate={indeterminate}
                    />
                  </span>{' '}
                  name
                </label>
              </th>
              <th className="text-right">Description</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(key => {
              if (!lookupMap[key]) {
                return null;
              }

              const { entry, type, checked, changes } = lookupMap[key];
              return (
                <tr key={key} className="table--no-outline-row">
                  <td>
                    <label className="no-pad wide">
                      <input
                        className="space-right"
                        type="checkbox"
                        checked={checked}
                        name={key}
                        onChange={this._handleStageToggle}
                      />{' '}
                      {entry.name}
                    </label>
                  </td>
                  <td className="text-right">
                    {SyncStagingModal.renderOperation(entry, type, changes || [])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  render() {
    const { status, message, error, branch } = this.state;

    const nonAddedKeys = [];
    const addedKeys = [];
    const allMap = { ...status.stage, ...status.unstaged };
    const allKeys = Object.keys(allMap);
    for (const key of allKeys) {
      if (allMap[key].added) {
        addedKeys.push(key);
      } else {
        nonAddedKeys.push(key);
      }
    }

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Create Snapshot</ModalHeader>
        <ModalBody className="wide pad">
          {error && (
            <p className="notice error margin-bottom-sm no-margin-top">
              <button className="pull-right icon" onClick={this._handleClearError}>
                <i className="fa fa-times" />
              </button>
              {error}
            </p>
          )}

          <div className="form-group">
            <div className="form-control form-control--outlined">
              <label>
                Snapshot Message
                <textarea
                  ref={this._setTextAreaRef}
                  cols="30"
                  rows="3"
                  onChange={this._handleMessageChange}
                  value={message}
                  placeholder="This is a helpful message that describe the changes made in this snapshot"
                  required
                />
              </label>
            </div>
          </div>

          {this.renderTable(nonAddedKeys, 'Modified Objects')}
          {this.renderTable(addedKeys, 'Unversioned Objects')}
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm tall">
            <i className="fa fa-code-fork" /> {branch}
          </div>
          <div>
            <button className="btn" onClick={this._handleTakeSnapshot}>
              Create
            </button>
            <button className="btn" onClick={this._handleTakeSnapshotAndPush}>
              Create and Push
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default SyncStagingModal;
