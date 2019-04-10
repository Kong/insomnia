// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import type { Workspace } from '../../../models/workspace';
import * as db from '../../../common/database';
import * as models from '../../../models';
import VCS from '../../../sync/vcs';
import type { StageEntry, Status, StatusCandidate } from '../../../sync/types';
import HelpTooltip from '../help-tooltip';

type Props = {
  workspace: Workspace,
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
  onPush: () => any;

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

    if (status.stage[id]) {
      await vcs.unstage([status.stage[id]]);
    } else {
      await vcs.stage([status.unstaged[id]]);
    }

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
    const items: Array<StageEntry> = [];
    for (const id of Object.keys(stage)) {
      items.push(stage[id]);
    }

    await vcs.unstage(items);
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

    await this.updateStatus({ message: '', error: '' });

    if (this.onPush) {
      this.onPush();
    }
  }

  async generateStatusItems(): Promise<Array<StatusCandidate>> {
    const allDocs = await db.withDescendants(this.props.workspace);
    return allDocs.filter(models.canSync).map(doc => ({
      key: doc._id,
      name: (doc: any).name || 'No Name',
      document: doc,
    }));
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

    const canCreateSnapshot = !!message.trim();

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
                  <label>
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
          <div className="margin-left italic txt-sm tall">
            * Note: snapshots only exist locally until pushed to Insomnia Sync
          </div>
          <button className="btn" onClick={this._handleTakeSnapshot} disabled={!canCreateSnapshot}>
            Create Snapshot
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

export default SyncStagingModal;
