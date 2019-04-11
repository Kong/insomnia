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
import HelpTooltip from '../help-tooltip';

type Props = {
  workspace: Workspace,
  syncItems: Array<StatusCandidate>,
  vcs: VCS,
};

type State = {
  status: Status,
  message: string,
  error: string,
};

@autobind
class SyncStagingModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  _onSnapshot: ?() => void;
  _handlePush: ?() => void;
  textarea: ?HTMLTextAreaElement;

  constructor(props: Props) {
    super(props);
    this.state = {
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

    await this.refreshState({}, newStage);
  }

  async _handleStageAll() {
    const { vcs } = this.props;
    const { status } = this.state;

    const items = [];
    for (const id of Object.keys(status.unstaged)) {
      items.push(status.unstaged[id]);
    }

    const stage = await vcs.stage(status.stage, items);
    await this.refreshState({}, stage);
  }

  async _handleUnstageAll() {
    const { vcs } = this.props;
    const { status } = this.state;
    const items: Array<StageEntry> = [];
    for (const id of Object.keys(status.stage)) {
      items.push(status.stage[id]);
    }

    const stage = await vcs.unstage(status.stage, items);
    await this.refreshState({}, stage);
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
    await this.refreshState({ message: '', error: '' });
    this.hide();
  }

  async refreshState(newState?: Object = {}, newStage?: Stage = {}) {
    const { vcs, syncItems } = this.props;
    const branch = await vcs.getBranch();
    const branches = await vcs.getBranches();
    const status = await vcs.status(syncItems, newStage);

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

  async show(options: { onSnapshot?: () => any, handlePush: () => any }) {
    const { vcs, syncItems } = this.props;

    this.modal && this.modal.show();
    this._onSnapshot = options.onSnapshot;
    this._handlePush = options.handlePush;

    // Add everything to stage by default except new items
    const status: Status = await vcs.status(syncItems, {});
    const toStage = [];
    for (const key of Object.keys(status.unstaged)) {
      toStage.push(status.unstaged[key]);
    }

    const stage = await vcs.stage(status.stage, toStage);
    await this.refreshState({}, stage);
    this.textarea && this.textarea.focus();
  }

  static renderOperation(entry: StageEntry) {
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

    return <code className="txt-xs pad-xxs">{name}</code>;
  }

  render() {
    const { status, message, error } = this.state;

    const allKeys = [...Object.keys(status.stage), ...Object.keys(status.unstaged)];

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>
          Create Workspace Snapshot{' '}
          <HelpTooltip>
            A snapshot saves the state of everything in the current workspace for use with Insomnia
            Sync
          </HelpTooltip>
        </ModalHeader>
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

          <div>
            <div className="pull-right">
              <button
                className="btn btn--clicky-small"
                disabled={Object.keys(status.stage).length === 0}
                onClick={this._handleUnstageAll}>
                Unselect All
              </button>
              <button
                className="space-left btn btn--clicky-small"
                onClick={this._handleStageAll}
                disabled={Object.keys(status.unstaged).length === 0}>
                Select All
              </button>
            </div>
            <h2>
              Changes{' '}
              <small>
                ({Object.keys(status.stage).length}/{allKeys.length})
              </small>
            </h2>
          </div>
          <ul>
            {allKeys.sort().map(key => {
              const isStaged = status.stage.hasOwnProperty(key);
              const statusItem = status.stage[key] || status.unstaged[key];
              if (!statusItem) {
                // Should never happen
                throw new Error(`Failed to find item in stage or unstaged key=${key}`);
              }

              return (
                <li key={key}>
                  <label className="wide">
                    <input
                      className="space-right"
                      type="checkbox"
                      checked={isStaged}
                      name={key}
                      onChange={this._handleStageToggle}
                    />
                    {SyncStagingModal.renderOperation(statusItem)} {statusItem.name}
                  </label>
                </li>
              );
            })}
          </ul>
        </ModalBody>
        <ModalFooter>
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
