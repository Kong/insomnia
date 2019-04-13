// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import type { Workspace } from '../../../models/workspace';
import VCS from '../../../sync/vcs';
import type { Stage, StageEntry, Status, StatusCandidate } from '../../../sync/types';
import * as models from '../../../models';
import Tooltip from '../tooltip';

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
    [string]: {
      entry: StageEntry,
      type: string,
      checked: boolean,
      operation: string,
    },
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
  toggleAllInputRef: ?HTMLInputElement;
  modal: ?Modal;
  _onSnapshot: ?() => void;
  _handlePush: ?() => void;
  textarea: ?HTMLTextAreaElement;

  state = _initialState;

  _setToggleAllRef(el: ?HTMLInputElement) {
    this.toggleAllInputRef = el;
  }

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

    const newStage = status.stage[id]
      ? await vcs.unstage(status.stage, [status.stage[id]])
      : await vcs.stage(status.stage, [status.unstaged[id]]);

    await this.refreshMainAttributes({}, newStage);
  }

  async _handleAllToggle() {
    const { vcs } = this.props;
    const { status } = this.state;

    // const numStaged = Object.keys(status.stage).length;
    const numStaged = Object.keys(status.stage).length;

    let stage;
    if (numStaged === 0) {
      const entries: Array<StageEntry> = [];
      for (const k of Object.keys(status.unstaged)) {
        entries.push(status.unstaged[k]);
      }
      stage = await vcs.stage(status.stage, entries);
    } else {
      const entries: Array<StageEntry> = [];
      for (const k of Object.keys(status.stage)) {
        entries.push(status.stage[k]);
      }
      stage = await vcs.unstage(status.stage, entries);
    }

    await this.refreshMainAttributes({}, stage);
  }

  async _handleTakeSnapshotAndPush() {
    await this._handleTakeSnapshot();
    this._handlePush && this._handlePush();
  }

  async _handleTakeSnapshot() {
    const { vcs } = this.props;
    const {
      message,
      status: { stage },
    } = this.state;
    try {
      await vcs.takeSnapshot(stage, message);
    } catch (err) {
      this.setState({ error: err.message });
      return;
    }

    this._onSnapshot && this._onSnapshot();
    await this.refreshMainAttributes({ message: '', error: '' });
    this.hide();
  }

  async refreshMainAttributes(newState?: Object = {}, newStage?: Stage = {}) {
    const { vcs, syncItems } = this.props;
    const branch = await vcs.getBranch();
    const status = await vcs.status(syncItems, newStage);

    const lookupMap = {};
    const allKeys = [...Object.keys(status.stage), ...Object.keys(status.unstaged)];
    for (const key of allKeys) {
      const item = syncItems.find(si => si.key === key);
      const doc = (item && item.document) || (await vcs.blobFromLastSnapshot(key));
      const entry = status.stage[key] || status.unstaged[key];

      if (!entry || !doc) {
        continue;
      }

      lookupMap[key] = {
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

    // Update indeterminite status of checkbox
    const numUnstaged = Object.keys(status.unstaged).length;
    const numStaged = Object.keys(status.stage).length;
    if (this.toggleAllInputRef) {
      this.toggleAllInputRef.indeterminate = numUnstaged !== 0 && numStaged !== 0;
    }
  }

  hide() {
    this.modal && this.modal.hide();
  }

  async show(options: { onSnapshot?: () => any, handlePush: () => any }) {
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
      toStage.push(status.unstaged[key]);
    }

    const stage = await vcs.stage(status.stage, toStage);
    await this.refreshMainAttributes({}, stage);
    this.textarea && this.textarea.focus();
  }

  static renderOperation(entry: StageEntry) {
    if (entry.added) {
      return (
        <Tooltip message="Added" delay={200}>
          <i className="fa fa-plus-circle success" />
        </Tooltip>
      );
    } else if (entry.modified) {
      return (
        <Tooltip message="Modified" delay={200}>
          <i className="fa fa-circle faded" />
        </Tooltip>
      );
    } else if (entry.deleted) {
      return (
        <Tooltip message="Deleted" delay={200}>
          <i className="fa fa-minus-circle danger" />
        </Tooltip>
      );
    } else {
      return (
        <Tooltip message="Unknown Operation">
          <i className="fa fa-question-circle info" />
        </Tooltip>
      );
    }
  }

  render() {
    const { status, message, error, lookupMap, branch } = this.state;

    const allKeys = [...Object.keys(status.stage), ...Object.keys(status.unstaged)];

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
                Snapshot Name
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

          <h2>
            Changes {Object.keys(status.stage).length}/{allKeys.length}
          </h2>

          <table className="table--fancy table--outlined">
            <thead>
              <tr>
                <th>
                  <label className="wide no-pad">
                    <span className="txt-md">
                      <input
                        ref={this._setToggleAllRef}
                        className="space-right"
                        type="checkbox"
                        checked={Object.keys(status.unstaged).length === 0}
                        onChange={this._handleAllToggle}
                      />
                    </span>{' '}
                    name
                  </label>
                </th>
                <th className="text-right">Description</th>
              </tr>
            </thead>
            <tbody>
              {allKeys.map(key => {
                if (!lookupMap[key]) {
                  return null;
                }

                const { entry, type, checked } = lookupMap[key];
                return (
                  <tr key={key} className="table--no-outline-row">
                    <td>
                      <label className="no-pad">
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
                      {type} {SyncStagingModal.renderOperation(entry)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
